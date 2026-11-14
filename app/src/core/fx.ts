/* ================= Foreign currencies: one place that turns an amount into the main currency =================
   Firefly keeps each account in its own currency. Every total in the app (net worth, the Overview cards, account
   group totals, income, spending, budgets) has to be one figure in the main currency, so every amount that enters
   the app from Firefly goes through convertToPrimary() here, and nowhere else does the arithmetic.

   Rates are today's, from a free service that needs no key, asked through this server (/fx/ in
   default.conf.template): Frankfurter first, open.er-api.com for whatever it doesn't have or when it fails.
   Firefly's own /exchange-rates are not used (they're whatever was last typed in). Only the currencies the accounts
   use are asked for and kept. A rate is kept on this device for an hour (rates only, never Firefly data); when a
   fetch fails the last one is used and the app says how old it is, and with no rate at all the amount is left out
   of totals and flagged. Nothing here is ever written back to Firefly.

   The arithmetic is exact: amounts and rates are whole numbers of their smallest unit (BigInt), never floats, and
   the result is rounded half away from zero to the main currency's decimals (2 for USD, 0 for JPY). */

export type Rate = { r: string, at: number, src: string, day?: string };      // 1 main = r of the currency; when fetched; from where; the service's own date
export type FxFetch = (url: string) => Promise<unknown>;
export const FX_TTL = 36e5, FX_RETRY = 3e5;
const STORE = 'money.fx', TOGGLE = 'money.fxConvert';
const SOURCES: [string, string][] = [['a', 'Frankfurter (European Central Bank)'], ['b', 'open.er-api.com']];
export const FX = {
  primary: 'USD',
  dp: {} as Record<string, number>,          // decimals per currency, as Firefly has them
  rates: {} as Record<string, Rate>,
  needed: [] as string[],                    // the foreign currencies the accounts use
  missing: new Set<string>(),                // currencies an amount came in with no rate for (left out of totals)
  failedAt: 0, loaded: false,
};

/* ---------- Exact decimal arithmetic ---------- */
const DEC = /^([+-]?)(\d*)(?:\.(\d*))?$/;
// A decimal as text: Firefly's strings as they are; a number by its shortest exact form (never 1e-7)
export function decText(v: unknown): string {
  if (typeof v === 'number') { if (!isFinite(v)) return '0'; const s = String(v); return /e/i.test(s) ? v.toFixed(12) : s; }
  const s = String(v ?? '').trim();
  return DEC.test(s) && /\d/.test(s) ? s : '0';
}
// The digits of a decimal and how many of them are after the point: "12.50" is [1250n, 2]
function parts(v: unknown): [bigint, number] {
  const m = DEC.exec(decText(v))!, frac = m[3] || '';
  const n = BigInt((m[2] || '0') + frac);
  return [m[1] === '-' ? -n : n, frac.length];
}
// a / b, rounded half away from zero
function divRound(a: bigint, b: bigint): bigint {
  const neg = (a < 0n) !== (b < 0n), x = a < 0n ? -a : a, y = b < 0n ? -b : b;
  const q = (2n * x + y) / (2n * y);
  return neg ? -q : q;
}
const pow10 = (n: number) => 10n ** BigInt(n);
// An amount as a whole number of the currency's smallest unit (cents for USD, yen for JPY)
export function toMinor(v: unknown, dp: number): bigint {
  const [n, scale] = parts(v);
  return scale <= dp ? n * pow10(dp - scale) : divRound(n, pow10(scale - dp));
}
export const fromMinor = (m: bigint, dp: number) => Number(m) / 10 ** dp;
// amount (in a currency worth `rate` per 1 main) in the main currency's smallest unit
export function convertMinor(amount: unknown, rate: unknown, dpTo: number): bigint | null {
  const [a, as] = parts(amount), [r, rs] = parts(rate);
  if (r <= 0n) return null;
  return divRound(a * pow10(rs + dpTo), r * pow10(as));
}

/* ---------- Decimals ---------- */
export function decimalsOf(code: string): number {
  const c = String(code || '').toUpperCase();
  if (FX.dp[c] != null) return FX.dp[c];
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).resolvedOptions().maximumFractionDigits ?? 2; } catch (e) { return 2; }
}
const codeOf = (c: unknown) => { const s = String(c || '').toUpperCase(); return /^[A-Z]{3}$/.test(s) ? s : ''; };
export const isForeign = (code: unknown) => { const c = codeOf(code); return !!c && c !== FX.primary; };

/* ---------- The setting (Settings → Currencies): on unless switched off ---------- */
export function fxOn() { try { return localStorage.getItem(TOGGLE) !== 'false'; } catch (e) { return true; } }

/* ---------- The helper every total uses ----------
   The amount in the main currency, or null when it can't be had: there's no rate for that currency, or converting
   is switched off. An amount already in the main currency (or with no currency named) comes back as it is. */
export function convertToPrimary(amount: unknown, fromCode?: string | null): number | null {
  const c = codeOf(fromCode);
  if (!c || c === FX.primary) { const n = parseFloat(amount as string); return isNaN(n) ? 0 : n; }
  const rate = FX.rates[c];
  if (!fxOn() || !rate) return null;
  const dp = decimalsOf(FX.primary), m = convertMinor(amount, rate.r, dp);
  return m == null ? null : fromMinor(m, dp);
}
// The other way, for a figure typed in a foreign account's own currency or shown beside a main-currency one: a
// main-currency amount in that currency, to its decimals. null without a rate.
export function convertFromPrimary(amount: unknown, toCode?: string | null): number | null {
  const c = codeOf(toCode);
  if (!c || c === FX.primary) { const n = parseFloat(amount as string); return isNaN(n) ? 0 : n; }
  const rate = FX.rates[c];
  if (!fxOn() || !rate) return null;
  const [a, as] = parts(amount), [r, rs] = parts(rate.r), dp = decimalsOf(c);
  return fromMinor(divRound(a * r * pow10(dp), pow10(as + rs)), dp);
}
// The same for a sum: an amount that can't be converted counts as nothing and its currency is remembered, so the
// page can say the total leaves it out (see fxStatus). A wrong number is never added.
export function inPrimary(amount: unknown, fromCode?: string | null): number {
  const v = convertToPrimary(amount, fromCode);
  if (v == null) { FX.missing.add(codeOf(fromCode)); return 0; }
  return v;
}
// Several amounts in any currencies as one main-currency figure, added in whole smallest units
export function sumPrimary(items: { amount: unknown, code?: string | null }[]): { total: number, left: string[] } {
  const dp = decimalsOf(FX.primary), left = new Set<string>();
  let sum = 0n;
  for (const x of items) {
    const v = convertToPrimary(x.amount, x.code);
    if (v == null) { left.add(codeOf(x.code)); FX.missing.add(codeOf(x.code)); } else sum += toMinor(v, dp);
  }
  return { total: fromMinor(sum, dp), left: [...left] };
}

/* ---------- Rates: kept for an hour, on this device ---------- */
function load() {
  if (FX.loaded) return;
  FX.loaded = true;
  try {
    const j = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (j && j.base === FX.primary && j.rates && typeof j.rates === 'object') {
      for (const [k, v] of Object.entries(j.rates as Record<string, Rate>)) if (codeOf(k) && v && parts(v.r)[0] > 0n && v.at > 0) FX.rates[k] = { r: decText(v.r), at: +v.at, src: String(v.src || ''), day: v.day ? String(v.day) : undefined };
    }
  } catch (e) { /* storage blocked or not JSON */ }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify({ base: FX.primary, rates: FX.rates })); } catch (e) { /* storage blocked */ } }
// The main currency and each currency's decimals, from Firefly's list. A new main currency drops the old rates.
export function fxSetup(primary: string, dp: Record<string, number> = {}) {
  const p = codeOf(primary) || 'USD';
  if (p !== FX.primary) { FX.primary = p; FX.rates = {}; FX.loaded = false; FX.failedAt = 0; }
  FX.dp = { ...FX.dp, ...dp };
  load();
}
const getJson: FxFetch = async url => {
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac ? setTimeout(() => ac.abort(), 8000) : 0;
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'omit', ...(ac ? { signal: ac.signal } : {}) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
};
// What a service answered, as { CODE: "83.9" } for the currencies asked for. Both name their rates the same way.
export function readRates(j: unknown, base: string, want: string[]): { rates: Record<string, string>, day: string } {
  const o = (j || {}) as { base?: string, base_code?: string, result?: string, date?: string, time_last_update_utc?: string, rates?: Record<string, unknown> };
  const out: Record<string, string> = {};
  if ((o.base || o.base_code) !== base || (o.result != null && o.result !== 'success') || !o.rates) return { rates: out, day: '' };
  for (const c of want) { const v = o.rates[c]; if (typeof v === 'number' && isFinite(v) && v > 0) out[c] = decText(v); }
  return { rates: out, day: String(o.date || o.time_last_update_utc || '').slice(0, 16) };
}
let inflight: Promise<void> | null = null;
/* Make sure there's a fresh rate for each of these currencies. Asks the first service for all of them, then the
   second for any still missing; a currency neither has keeps its last rate (or none). Never throws: when both fail
   the old rates stay, and it won't ask again for a few minutes unless forced (the Refresh rates button). */
export function fxEnsure(codes: string[], force = false, get: FxFetch = getJson, now = Date.now()): Promise<void> {
  load();
  const need = [...new Set(codes.map(codeOf).filter(c => c && c !== FX.primary))].sort();
  FX.needed = need;
  // Rates nobody uses any more aren't kept
  for (const k of Object.keys(FX.rates)) if (!need.includes(k)) delete FX.rates[k];
  const due = need.filter(c => !FX.rates[c] || now - FX.rates[c].at >= FX_TTL);
  if (!need.length || (!force && (!due.length || now - FX.failedAt < FX_RETRY))) return Promise.resolve();
  if (inflight) return inflight;
  const base = FX.primary, ask = force ? need : due;
  inflight = (async () => {
    let left = ask.slice();
    for (const [key, name] of SOURCES) {
      if (!left.length) break;
      try {
        const j = await get(key === 'a' ? '/fx/a/' + base + '/' + left.join(',') : '/fx/b/' + base);
        if (base !== FX.primary) return;
        const got = readRates(j, base, left);
        for (const [c, r] of Object.entries(got.rates)) FX.rates[c] = { r, at: now, src: name, day: got.day };
        left = left.filter(c => !got.rates[c]);
      } catch (e) { /* try the next one */ }
    }
    FX.failedAt = left.length ? now : 0;
    for (const c of ask) if (FX.rates[c]) FX.missing.delete(c);
    save();
  })().finally(() => { inflight = null; });
  return inflight;
}

/* ---------- What to tell the reader ---------- */
export type FxStatus = {
  foreign: string[], on: boolean,
  rows: { code: string, rate: string, at: number, src: string, old: boolean }[],
  stale: boolean, asOf: number,              // some rate is older than an hour (the last fetch failed): the oldest one's time
  missing: string[],                         // currencies with no rate at all: their amounts are left out of totals
};
export function fxStatus(now = Date.now()): FxStatus {
  const foreign = FX.needed, on = fxOn();
  const rows = foreign.filter(c => FX.rates[c]).map(c => ({ code: c, rate: FX.rates[c].r, at: FX.rates[c].at, src: FX.rates[c].src, old: now - FX.rates[c].at >= FX_TTL }));
  const old = rows.filter(r => r.old);
  return { foreign, on, rows, stale: on && old.length > 0, asOf: old.length ? Math.min(...old.map(r => r.at)) : 0, missing: foreign.filter(c => !FX.rates[c]) };
}
