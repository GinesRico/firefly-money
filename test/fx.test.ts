import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FX, FX_TTL, type FxFetch, convertFromPrimary, convertMinor, convertToPrimary, fromMinor, fxEnsure, fxSetup, fxStatus, inPrimary, readRates, sumPrimary, toMinor } from '../app/src/core/fx';
import { S, absDiff, moneyIn, spentSum, sumDiff } from '../app/src/core/base';
import { normAccount, withPlan } from '../app/src/core/lists';
import { nativeFor, normGroup, openingRepairs, signed, signedNative } from '../app/src/core/feed';

const T0 = 1_800_000_000_000;
const frank = (rates: Record<string, number>) => ({ amount: 1, base: 'USD', date: '2026-11-13', rates });
const erapi = (rates: Record<string, number>) => ({ result: 'success', base_code: 'USD', time_last_update_utc: 'Fri, 13 Nov 2026 00:02:31 +0000', rates });
const down: FxFetch = async () => { throw new Error('offline'); };
// Rates in place as if fetched at `at`, without the network
const seed = (rates: Record<string, string>, at = T0) => { for (const [c, r] of Object.entries(rates)) FX.rates[c] = { r, at, src: 'test' }; FX.needed = Object.keys(rates).sort(); };

beforeEach(() => {
  localStorage.clear();
  FX.rates = {}; FX.needed = []; FX.missing.clear(); FX.failedAt = 0; FX.dp = {};
  fxSetup('USD', { USD: 2, INR: 2, JPY: 0, EUR: 2 });
  FX.loaded = true; S.currency = 'USD';
});

describe('exact decimal arithmetic', () => {
  it('reads an amount as whole smallest units, rounding half away from zero', () => {
    expect(toMinor('12.50', 2)).toBe(1250n);
    expect(toMinor('1.005', 2)).toBe(101n);            // floats give 100
    expect(toMinor('-1.005', 2)).toBe(-101n);
    expect(toMinor('1234.5', 0)).toBe(1235n);
    expect(toMinor('0.1', 2) + toMinor('0.2', 2)).toBe(30n);
    expect(toMinor(1e-7, 2)).toBe(0n);
    expect(toMinor('not a number', 2)).toBe(0n);
    expect(fromMinor(148987n, 2)).toBe(1489.87);
  });
  it('divides by the rate without floats', () => {
    expect(convertMinor('125000.00', '83.9', 2)).toBe(148987n);
    expect(convertMinor('0.01', '2', 2)).toBe(1n);       // 0.005 rounds away from zero
    expect(convertMinor('-0.01', '2', 2)).toBe(-1n);
    expect(convertMinor('10', '0', 2)).toBeNull();
  });
});

describe('convertToPrimary', () => {
  it('passes the main currency through untouched', () => {
    expect(convertToPrimary('12.50', 'USD')).toBe(12.5);
    expect(convertToPrimary('-80.126', 'usd')).toBe(-80.126);
    expect(convertToPrimary('7', '')).toBe(7);
    expect(convertToPrimary('7', null)).toBe(7);
    expect(convertToPrimary('junk', 'USD')).toBe(0);
  });
  it('converts INR to USD at the rate, to the cent', () => {
    seed({ INR: '83.9' });
    expect(convertToPrimary('125000.00', 'INR')).toBe(1489.87);
    expect(convertToPrimary(125000, 'INR')).toBe(1489.87);
    expect(convertToPrimary('83.9', 'INR')).toBe(1);
  });
  it('respects currencies with no decimals', () => {
    seed({ JPY: '150.25' });
    expect(convertToPrimary('12000', 'JPY')).toBe(79.87);
    // and a main currency with none: the result is a whole number of yen
    fxSetup('JPY', { JPY: 0, USD: 2 }); FX.loaded = true;
    seed({ USD: '0.0066556' });
    expect(convertToPrimary('100.00', 'USD')).toBe(15025);
    expect(Number.isInteger(convertToPrimary('19.99', 'USD'))).toBe(true);
  });
  it('keeps the sign of a negative balance (a credit card)', () => {
    seed({ INR: '83.9' });
    expect(convertToPrimary('-2500.00', 'INR')).toBe(-29.8);
    expect(convertToPrimary('-125000.00', 'INR')).toBe(-1489.87);
    expect(convertToPrimary('-0.01', 'INR')).toBe(0);          // a sum that rounds to nothing is 0, never -0
  });
  it('gives nothing, not a wrong number, without a rate', () => {
    expect(convertToPrimary('125000.00', 'INR')).toBeNull();
    expect(inPrimary('125000.00', 'INR')).toBe(0);
    expect([...FX.missing]).toEqual(['INR']);
  });
  it('gives nothing when converting is switched off', () => {
    seed({ INR: '83.9' });
    localStorage.setItem('money.fxConvert', 'false');
    expect(convertToPrimary('125000.00', 'INR')).toBeNull();
    expect(convertToPrimary('5', 'USD')).toBe(5);
    localStorage.setItem('money.fxConvert', 'true');
    expect(convertToPrimary('125000.00', 'INR')).toBe(1489.87);
  });
  it('adds mixed currencies in whole cents and names what it left out', () => {
    seed({ INR: '83.9' });
    expect(sumPrimary([{ amount: '0.10', code: 'USD' }, { amount: '0.20', code: 'USD' }]).total).toBe(0.3);
    const t = sumPrimary([{ amount: '1000.00', code: 'USD' }, { amount: '125000.00', code: 'INR' }, { amount: '-2500.00', code: 'INR' }, { amount: '500', code: 'EUR' }]);
    expect(t.total).toBe(2460.07);
    expect(t.left).toEqual(['EUR']);
  });
});

describe('fetching rates', () => {
  it('asks the first service for only the currencies in use', async () => {
    const urls: string[] = [];
    await fxEnsure(['INR', 'USD', 'jpy', 'INR', ''], false, async u => { urls.push(u); return frank({ INR: 83.9, JPY: 150.25 }); }, T0);
    expect(urls).toEqual(['/fx/a/USD/INR,JPY']);
    expect(FX.rates.INR).toMatchObject({ r: '83.9', at: T0 });
    expect(convertToPrimary('125000.00', 'INR')).toBe(1489.87);
    expect(fxStatus(T0 + 1000)).toMatchObject({ foreign: ['INR', 'JPY'], stale: false, missing: [] });
  });
  it('asks nothing when every account is in the main currency', async () => {
    let n = 0;
    await fxEnsure(['USD', 'USD'], false, async () => { n++; return frank({}); }, T0);
    expect(n).toBe(0);
  });
  it('keeps a rate for an hour, then fetches again', async () => {
    let n = 0; const get: FxFetch = async () => { n++; return frank({ INR: 83.9 + n }); };
    await fxEnsure(['INR'], false, get, T0);
    await fxEnsure(['INR'], false, get, T0 + FX_TTL - 1);
    expect(n).toBe(1);
    await fxEnsure(['INR'], false, get, T0 + FX_TTL);
    expect(n).toBe(2);
    await fxEnsure(['INR'], true, get, T0 + FX_TTL + 5);      // the Refresh rates button
    expect(n).toBe(3);
  });
  it('falls back to the second service when the first fails or lacks a currency', async () => {
    const urls: string[] = [];
    await fxEnsure(['INR'], false, async u => { urls.push(u); if (u.startsWith('/fx/a/')) throw new Error('502'); return erapi({ INR: 84.1, EUR: 0.92 }); }, T0);
    expect(urls).toEqual(['/fx/a/USD/INR', '/fx/b/USD']);
    expect(FX.rates.INR.r).toBe('84.1');
    expect(FX.rates.EUR).toBeUndefined();           // not on any account: not kept
    await fxEnsure(['INR', 'PKR'], true, async u => u.startsWith('/fx/a/') ? frank({ INR: 83.9 }) : erapi({ INR: 84.1, PKR: 278.5 }), T0);
    expect(FX.rates.INR.r).toBe('83.9');
    expect(FX.rates.PKR).toMatchObject({ r: '278.5', src: 'open.er-api.com' });
  });
  it('uses the last rate and says how old it is when the fetch fails', async () => {
    await fxEnsure(['INR'], false, async () => frank({ INR: 83.9 }), T0);
    const later = T0 + 2 * FX_TTL;
    await fxEnsure(['INR'], false, down, later);
    expect(convertToPrimary('125000.00', 'INR')).toBe(1489.87);
    const st = fxStatus(later);
    expect(st.stale).toBe(true);
    expect(st.asOf).toBe(T0);
    expect(st.missing).toEqual([]);
    // it doesn't hammer a service that's down, but Refresh rates still tries
    let n = 0; const count: FxFetch = async () => { n++; throw new Error('offline'); };
    await fxEnsure(['INR'], false, count, later + 1000);
    expect(n).toBe(0);
    await fxEnsure(['INR'], true, count, later + 2000);
    expect(n).toBe(2);
  });
  it('flags the currency and leaves it out when there is no rate at all', async () => {
    await fxEnsure(['INR'], false, down, T0);
    expect(convertToPrimary('125000.00', 'INR')).toBeNull();
    expect(fxStatus(T0)).toMatchObject({ missing: ['INR'], stale: false });
    const a = normAccount({ id: 7, attributes: { name: 'SBI', type: 'asset', currency_code: 'INR', current_balance: '125000.00' } });
    expect(a).toMatchObject({ balance: 0, unconv: true, nat: { balance: 125000 } });
  });
  it('survives a reload: rates are kept on the device, and only for the same main currency', async () => {
    await fxEnsure(['INR'], false, async () => frank({ INR: 83.9 }), T0);
    FX.rates = {}; FX.loaded = false;
    await fxEnsure(['INR'], false, down, T0 + 1000);
    expect(FX.rates.INR.r).toBe('83.9');
    fxSetup('EUR');
    expect(FX.rates).toEqual({});
  });
  it('ignores an answer that is not what was asked for', () => {
    expect(readRates({ base: 'EUR', rates: { INR: 90 } }, 'USD', ['INR']).rates).toEqual({});
    expect(readRates({ result: 'error', base_code: 'USD', rates: { INR: 90 } }, 'USD', ['INR']).rates).toEqual({});
    expect(readRates(frank({ INR: 0, JPY: -1 }), 'USD', ['INR', 'JPY']).rates).toEqual({});
    expect(readRates(null, 'USD', ['INR']).rates).toEqual({});
  });
});

describe('where amounts enter the app', () => {
  beforeEach(() => seed({ INR: '83.9' }));
  it('an account keeps its own currency and joins totals in the main one', () => {
    const sbi = normAccount({ id: 7, attributes: { name: 'Rabab’s SBI', type: 'asset', currency_code: 'INR', current_balance: '125000.00', opening_balance: '1000.00' } });
    expect(sbi).toMatchObject({ balance: 1489.87, opening: 11.92, currency: 'INR', unconv: false, nat: { balance: 125000, opening: 1000 } });
    const card = normAccount({ id: 8, attributes: { name: 'Card', type: 'asset', account_role: 'ccAsset', currency_code: 'INR', current_balance: '-2500.00' } });
    expect(card).toMatchObject({ balance: -29.8, debt: 29.8, nat: { balance: -2500, debt: 2500 } });
    const usd = normAccount({ id: 9, attributes: { name: 'Checking', type: 'asset', currency_code: 'USD', current_balance: '1000.00' } });
    expect(usd.balance).toBe(1000);
    expect(usd.nat).toBeUndefined();
    expect(moneyIn(125000, 'INR').replace(/\s/g, '')).toBe('₹1,25,000.00');
    expect(moneyIn(12000, 'JPY')).toMatch(/12,000$/);
  });
  it('insight totals in several currencies become one figure', () => {
    const rows = [{ difference: '-100.00', difference_float: -100, currency_code: 'USD' }, { difference: '-8390.00', difference_float: -8390, currency_code: 'INR' }];
    expect(absDiff(rows[1])).toBe(100);
    expect(sumDiff(rows)).toBe(200);
    expect(spentSum({ attributes: { spent: [{ sum: '-50.00', currency_code: 'USD' }, { sum: '-839.00', currency_code: 'INR' }] } })).toBe(60);
  });
  it('a transaction is added in the main currency and edited in its own', () => {
    const g = normGroup({ id: 1, attributes: { transactions: [{ transaction_journal_id: 5, type: 'withdrawal', date: '2026-11-01', amount: '8390.00', currency_code: 'INR', source_id: 7, destination_id: 50 }] } });
    expect(g).toMatchObject({ total: 100, cur: 'INR', nativeTotal: 8390 });
    expect(g.splits[0]).toMatchObject({ amount: 100, native: 8390, cur: 'INR' });
    expect(signed(g, '7')).toBe(-100);
    expect(signedNative(g, '7')).toBe(-8390);
    const usd = normGroup({ id: 2, attributes: { transactions: [{ transaction_journal_id: 6, type: 'transfer', date: '2026-11-01', amount: '100.00', currency_code: 'USD', foreign_amount: '8390.00', foreign_currency_code: 'INR', source_id: 9, destination_id: 7 }] } });
    expect(usd.cur).toBe('');
    expect(usd.splits[0]).toMatchObject({ amount: 100, native: 100 });
    expect(nativeFor(usd.splits[0], 'INR')).toBe(8390);      // the INR account's side of a USD transfer
    expect(nativeFor(usd.splits[0], 'USD')).toBe(100);
  });
});

describe('the server', () => {
  const conf = readFileSync('app/default.conf.template', 'utf8');
  it('fetches rates itself, so the page still talks to nobody else', () => {
    expect(conf).toContain("connect-src 'self'");
    for (const loc of ['location ~ "^/fx/a/', 'location ~ "^/fx/b/']) {
      const at = conf.indexOf(loc), block = conf.slice(at, conf.indexOf('\n    }', at));
      expect(at).toBeGreaterThan(-1);
      expect(block).toContain('limit_except GET { deny all; }');
      expect(block).toContain('limit_req zone=relay');
      expect(block).toContain('proxy_set_header Cookie ""');
      expect(block).toContain('proxy_set_header Authorization ""');
    }
    expect(conf).toContain('api.frankfurter.dev');
    expect(conf).toContain('open.er-api.com');
  });
  it('never writes a converted amount back: forms read the amount as Firefly has it', () => {
    expect(readFileSync('app/src/features/txform.ts', 'utf8')).toContain('amount: String(s.native)');
    expect(readFileSync('app/src/core/fx.ts', 'utf8')).not.toMatch(/method:|\bapi\(/);
  });
});

describe('loans and card payments in another currency', () => {
  beforeEach(() => seed({ INR: '83.9' }));
  it('goes back from the main currency to the account’s, to its decimals', () => {
    expect(convertFromPrimary('100', 'INR')).toBe(8390);
    expect(convertFromPrimary('29.80', 'INR')).toBe(2500.22);
    expect(convertFromPrimary('5', 'USD')).toBe(5);
    seed({ JPY: '150.25' });
    expect(convertFromPrimary('1.99', 'JPY')).toBe(299);
    expect(convertFromPrimary('1', 'EUR')).toBeNull();
  });
  it('a foreign loan’s planned payment joins the plan in the main currency and is kept as written', () => {
    const loan = normAccount({ id: 3, attributes: { name: 'Home loan', type: 'liabilities', currency_code: 'INR', current_balance: '-839000.00', notes: 'Monthly payment: 8390.00 on day 5' } });
    expect(loan).toMatchObject({ debt: 10000, plan: { amount: 100, day: 5 }, nat: { debt: 839000, plan: { amount: 8390, day: 5 } } });
    expect(withPlan('', { amount: 8390, day: 5 }, 'INR')).toBe('Monthly payment: 8390.00 on day 5');
    expect(withPlan('', { amount: 500 }, 'USD')).toBe('Monthly payment: $500.00');
    expect(withPlan('', { amount: 500 })).toBe('Monthly payment: $500.00');
  });
});

describe('opening balance in the wrong currency', () => {
  const ob = (cur: string) => normGroup({ id: '9', attributes: { group_title: null, transactions: [{ transaction_journal_id: '5', type: 'opening balance', date: '2026-11-01', amount: '55000', currency_code: cur, description: 'Initial balance', source_id: '1', destination_id: '7' }] } });
  it('moves a USD opening balance to the account currency, keeping the amount', () => {
    const r = openingRepairs([ob('USD')], 'INR');
    expect(r.length).toBe(1);
    expect(r[0].id).toBe('9');
    expect(r[0].body.transactions).toEqual([{ currency_code: 'INR', transaction_journal_id: '5' }]);
  });
  it('leaves one already in the account currency alone', () => {
    expect(openingRepairs([ob('INR')], 'INR')).toEqual([]);
    expect(openingRepairs([ob('USD')], 'USD')).toEqual([]);
  });
  it('ignores other transactions', () => {
    const g = ob('USD'); g.splits[0].type = 'deposit';
    expect(openingRepairs([g], 'INR')).toEqual([]);
  });
});
