import { App, absDiff, arr, fmtNum, monthRange, nowMonth } from './base';
import { LS } from './helpers';
import { api } from './api';

/* ---------- Hours of work: prices as the time you worked for them ----------
   Settings → Appearance → Hours of work. Your hourly take-home is the one you set, or else what came in over the last
   six full months spread over the hours you work in that time (40 a week unless you say otherwise). */
export const lensOn = () => !!LS.get('workLens', false);
export const workHours = () => { const v = +LS.get('workHours', 40); return v >= 1 && v <= 168 ? v : 40; };
type Source = { n: string, s: number };
type Learned = { v: number, at: number, hrs: number, src?: Source[] };
// Income you leave out of the hourly take-home (tax refunds, benefits…), by who paid it
export const workSkip = (): string[] => { const v = LS.get('workSkip', []); return Array.isArray(v) ? v : []; };
export const workSources = (): string[] => { const a: Learned | null = LS.get('workRateAuto', null); return ((a && a.src) || []).map(x => x.n).sort(); };
const rateOf = (src: Source[], hrs: number) => { const skip = workSkip(); return src.filter(x => !skip.includes(x.n)).reduce((t, x) => t + x.s, 0) / 6 / (hrs * 52 / 12); };
// Counting a source in or out redraws from what was fetched, no new request
export function setWorkSkip(list: string[]) {
  LS.set('workSkip', list);
  const a: Learned | null = LS.get('workRateAuto', null);
  if (a && a.src) LS.set('workRateAuto', { ...a, v: rateOf(a.src, a.hrs) });
}
export function hourlyRate() {
  const own = +LS.get('workRate', 0); if (own > 0) return own;
  const a: Learned | null = LS.get('workRateAuto', null);
  return a && a.v > 0 ? a.v * a.hrs / workHours() : 0;
}
// 45 min, 2.5 hrs, 3 days (a workday is a fifth of your week). short: for a row's amount ("2.5 h", "3 d")
export function hoursText(amount: number, short = false, rate = hourlyRate()) {
  if (!rate || !amount) return '';
  const h = Math.abs(amount) / rate, day = workHours() / 5;
  const n = (x: number) => x < 10 ? fmtNum(x, 1) : fmtNum(x);
  if (Math.round(h * 60) < 60) return Math.max(1, Math.round(h * 60)) + ' min';
  if (h >= day * 2) { const d = n(h / day); return short ? d + ' d' : d + ' workdays'; }
  return short ? n(h) + ' h' : n(h) + (n(h) === '1' ? ' hour' : ' hours');
}
let learning: Promise<number> | null = null;
// Work out the hourly rate from income, once a week (or when the hours change). Redraws the page the first time.
export function learnRate(force = false) {
  const a: Learned | null = LS.get('workRateAuto', null);
  if (!force && a && a.src && Date.now() - a.at < 7 * 864e5) return Promise.resolve(a.v);
  if (learning) return learning;
  const [y, m] = nowMonth(), from = monthRange(y, m - 6), to = monthRange(y, m - 1);
  learning = api('/insight/income/revenue', { params: { start: from.start, end: to.end } }).then(r => {
    const by: Record<string, number> = {};
    for (const x of arr(r)) by[x.name || 'Other'] = (by[x.name || 'Other'] || 0) + absDiff(x);
    const src = Object.keys(by).map(n => ({ n, s: by[n] })), v = rateOf(src, workHours());
    LS.set('workRateAuto', { v, at: Date.now(), hrs: workHours(), src });
    if (!a && v > 0 && lensOn() && App.reload) App.reload({ quiet: true });
    return v;
  }).catch(() => 0).finally(() => { learning = null; });
  return learning;
}
