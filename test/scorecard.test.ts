import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { type Behaviour, type ScoreIn, type Tx, lastMonths, pickPersonality, rateOf, scorecard, trendOf } from '../app/src/features/scorecard';
import { shareSvg } from '../app/src/features/scoreshare';
import { scorecardOn, scorecardPage, scorecardPageOn, scorecardTile } from '../app/src/pages/scorecard';
import es from '../app/src/locales/es.json';

const css = readFileSync('app/assets/money.css', 'utf8');
const overview = readFileSync('app/src/pages/overview.ts', 'utf8');
const dash = readFileSync('app/src/features/dashboard.ts', 'utf8');
const settings = readFileSync('app/src/pages/settings.ts', 'utf8');
const dom = readFileSync('app/src/core/dom.ts', 'utf8');
const share = readFileSync('app/src/features/scoreshare.ts', 'utf8');
const today = '2026-11-18';
const months = lastMonths(today);                      // 2025-11 .. 2026-10
beforeEach(() => localStorage.clear());

// The first day in a month that falls on a weekday (0 = Sunday .. 6 = Saturday)
const dayOn = (key: string, wd: number, nth = 0) => { let n = 0; for (let d = 1; d <= 28; d++) { const iso = key + '-' + String(d).padStart(2, '0'); if (new Date(iso + 'T12:00:00').getDay() === wd && n++ === nth) return iso; } return key + '-28'; };
const tx = (date: string, amount: number, category = 'Food', desc = 'Purchase', payee = 'Corner Shop'): Tx => ({ date, amount, category, desc, payee });
type Opts = { income?: number, spend?: (i: number) => number, category?: string, wd?: number, from?: number };
// Twelve months of one income and four purchases a month (together as big as that month's spending)
function year({ income = 5000, spend = () => 3000, category = 'Food', wd = 3, from = 0 }: Opts = {}) {
  const out: Tx[] = [], inc: Tx[] = [];
  months.forEach((k, i) => { if (i < from) return; inc.push(tx(k + '-01', income, '', 'Pay', 'Employer')); for (let n = 0; n < 4; n++) out.push(tx(dayOn(k, wd, n), spend(i) / 4, category)); });
  return { out, inc };
}
const base = (o: Opts = {}, more: Partial<ScoreIn> = {}): ScoreIn => { const { out, inc } = year(o); return { today, out, inc, charges: [], bills: null, cash: null, debt: null, ...more }; };
const grade = (s: ReturnType<typeof scorecard>, k: string) => s.grades.find(g => g.key === k);

describe('ratings', () => {
  it('have plain-word thresholds and no letter grades', () => {
    expect([30, 20, 19.9, 10, 9.9, 0, -1].map(v => rateOf('savings', v))).toEqual(['Strong', 'Strong', 'Steady', 'Steady', 'Building', 'Building', 'Needs attention']);
    expect([100, 95, 94, 85, 84, 70, 69].map(v => rateOf('bills', v))).toEqual(['Strong', 'Strong', 'Steady', 'Steady', 'Building', 'Building', 'Needs attention']);
    expect([8, 6, 5.9, 3, 2.9, 1, .5].map(v => rateOf('cushion', v))).toEqual(['Strong', 'Strong', 'Steady', 'Steady', 'Building', 'Building', 'Needs attention']);
    expect([100, 95, 90, 85, 70, 65, 40].map(v => rateOf('tidiness', v))).toEqual(['Strong', 'Strong', 'Steady', 'Steady', 'Building', 'Building', 'Needs attention']);
    expect([.1, .15, .2, .3, .4, .5, .8].map(v => rateOf('consistency', v))).toEqual(['Strong', 'Strong', 'Steady', 'Steady', 'Building', 'Building', 'Needs attention']);
    expect([-100, -10, -9, -2, 0, 2, 3].map(v => rateOf('debt', v))).toEqual(['Strong', 'Strong', 'Steady', 'Building', 'Building', 'Building', 'Needs attention']);
  });
  it('compares against the six months before, with a margin before it counts as a change', () => {
    expect(trendOf('savings', 25, 20)).toMatchObject({ trend: 'up' });
    expect(trendOf('savings', 21, 20)).toEqual({ trend: 'same', move: 0 });
    expect(trendOf('savings', 10, 20)).toMatchObject({ trend: 'down' });
    expect(trendOf('consistency', .1, .3)).toMatchObject({ trend: 'up' });          // lower is better
    expect(trendOf('debt', 100, 300)).toMatchObject({ trend: 'up' });               // less interest is better
    expect(trendOf('bills', 90, null)).toEqual({ trend: null, move: 0 });
  });
});

describe('the scorecard', () => {
  it('is a Fresh Starter, with no ratings, under about three months of history', () => {
    const s = scorecard({ ...base(), out: [tx('2026-10-20', 50)], inc: [tx('2026-10-20', 900, '', 'Pay')] });
    expect(s.fresh).toBe(true);
    expect(s.grades).toEqual([]);
    expect(s.person.key).toBe('fresh');
    expect(scorecard({ ...base(), out: [], inc: [] }).person.key).toBe('fresh');
  });
  it('rates savings, consistency and tidiness from the last six months', () => {
    const s = scorecard(base());
    expect(grade(s, 'savings')).toMatchObject({ rating: 'Strong', reason: 'You kept 40% of what came in.', trend: 'same' });
    expect(grade(s, 'consistency')!.rating).toBe('Strong');
    expect(grade(s, 'tidiness')).toMatchObject({ rating: 'Strong', reason: '100% of purchases have a category.' });
    expect(grade(s, 'bills')).toBeUndefined();                                       // no bills, nothing to rate
    expect(grade(s, 'debt')).toBeUndefined();
  });
  it('says when more went out than came in, without blame', () => {
    const g = grade(scorecard(base({ spend: () => 5500 })), 'savings')!;
    expect(g.rating).toBe('Needs attention');
    expect(g.reason).toBe('About 10% more went out than came in.');
  });
  it('shows a trend and names the biggest improvement and the best habit', () => {
    const s = scorecard(base({ spend: i => i < 6 ? 4600 : 3200 }, { bills: { cur: { paid: 20, late: 0 }, prev: { paid: 15, late: 5 } } }));
    expect(grade(s, 'savings')).toMatchObject({ trend: 'up' });
    expect(grade(s, 'bills')).toMatchObject({ rating: 'Strong', trend: 'up' });
    expect(s.improved).not.toBeNull();
    expect(s.improved!.trend).toBe('up');
    expect(s.best!.rank).toBe(3);
    expect(s.best!.key).toBe('bills');                                               // ties go to bills first
  });
  it('rates the cushion in months of spending, and the debt by how balances moved', () => {
    const acct = (balance: number) => [{ name: 'Checking', role: 'defaultAsset', balance }];
    const interest = months.flatMap((k, i) => [tx(k + '-15', i < 6 ? 300 : 100, 'Interest', 'Loan interest', 'Lender')]);
    const b = base({}, { cash: { now: acct(12000), ago: acct(6000) }, debt: { now: 8000, ago: 10000 } });
    const s = scorecard({ ...b, out: [...b.out, ...interest] });
    expect(grade(s, 'cushion')).toMatchObject({ rating: 'Steady', trend: 'up' });
    expect(grade(s, 'debt')).toMatchObject({ rating: 'Strong', reason: 'Balances are down 20% in six months.', trend: 'up' });
    expect(grade(s, 'debt')!.detail).toContain('Interest paid');
    expect(scorecard({ ...b, debt: { now: 11000, ago: 10000 } }).grades.find(g => g.key === 'debt')!.rating).toBe('Needs attention');
    expect(scorecard({ ...b, debt: { now: 0, ago: 0 } }).grades.some(g => g.key === 'debt')).toBe(false);
  });
  it('links every rating to the place it can be improved', () => {
    const s = scorecard(base({}, { bills: { cur: { paid: 5, late: 5 }, prev: { paid: 5, late: 5 } }, cash: { now: [{ name: 'A', role: 'defaultAsset', balance: 900 }], ago: null }, debt: { now: 5, ago: 10 } }));
    expect(s.grades.map(g => g.key)).toEqual(['savings', 'consistency', 'bills', 'cushion', 'tidiness', 'debt']);
    expect(s.grades.map(g => g.href)).toEqual(['#/budgets', '#/recap', '#/bills', '#/piggy', '#/inbox', '#/loans']);
  });
  it('leaves out ratings it cannot back up', () => {
    const s = scorecard(base({ from: 8 }));                                          // four months of history
    expect(s.grades.map(g => g.key)).toContain('consistency');
    expect(s.grades.every(g => g.trend === null)).toBe(true);                        // nothing before to compare with
  });
});

describe('money personality', () => {
  const b = (o: Partial<Behaviour> = {}): Behaviour => ({ fresh: false, weekend: null, subs: null, saver: null, ranks: {}, ...o });
  it('picks a label from behaviour', () => {
    expect(pickPersonality(b({ fresh: true }))).toBe('fresh');
    expect(pickPersonality(b({ ranks: { consistency: 3, bills: 3, tidiness: 3 }, weekend: { share: .7, dining: true } }))).toBe('planner');
    expect(pickPersonality(b({ weekend: { share: .62, dining: true } }))).toBe('weekend');
    expect(pickPersonality(b({ weekend: { share: .5, dining: true } }))).toBe('balancer');
    expect(pickPersonality(b({ subs: { n: 8, share: .15 } }))).toBe('subscriber');
    expect(pickPersonality(b({ saver: { share: .8, months: 6 } }))).toBe('sprinter');
    expect(pickPersonality(b({ ranks: { consistency: 2, bills: 2, tidiness: 2 } }))).toBe('planner');
  });
  it('shows three traits with the evidence, from the data', () => {
    // Every month: one big dining purchase on a Saturday and a small one on a Tuesday, so spending is lumpy and not a planner's
    const out = months.flatMap((k, i) => [tx(dayOn(k, 6), i % 2 ? 900 : 2100, 'Dining out'), tx(dayOn(k, 2), 20, 'Dining out'), tx(dayOn(k, 6, 1), 20, 'Dining out')]);
    const inc = months.map(k => tx(k + '-01', 5000, '', 'Pay', 'Employer'));
    const s = scorecard({ ...base(), out, inc });
    expect(s.person.key).toBe('weekend');
    expect(s.person.label).toBe('Weekend Spender');
    expect(s.person.traits).toHaveLength(3);
    expect(s.person.traits[0].text).toMatch(/^\d+% of dining happens Fri–Sun$/);
    expect(s.person.nudge).toMatch(/^Try this: /);
  });
  it('finds repeating payments', () => {
    const { out, inc } = year({ spend: i => i % 2 ? 900 : 2100 });
    const charges = months.flatMap(k => ['Streamer', 'Music', 'Cloud', 'Gym', 'News', 'Phone', 'Games'].map((p, j) => ({ date: k + '-' + String(3 + j).padStart(2, '0'), amount: 400, payeeId: p, payee: p })));
    const s = scorecard({ ...base(), out, inc, charges: charges.map(c => ({ ...c })) });
    expect(s.person.key).toBe('subscriber');
    expect(s.person.traits[0].text).toMatch(/^7 repeating payments, \d+% of spending$/);
  });
  it('always has a nudge in a kind voice: no emoji, no exclamation marks, no shaming', () => {
    const keys = ['planner', 'weekend', 'sprinter', 'subscriber', 'fresh', 'balancer'];
    const texts = keys.flatMap(k => { const p = scorecard(k === 'fresh' ? { ...base(), out: [], inc: [] } : base()).person; return [p.line, p.nudge, p.label]; });
    const every = [...texts, ...Object.keys(es).filter(k => k.startsWith('Try this: '))].join(' ');
    expect(every).not.toMatch(/\p{Extended_Pictographic}|!|\b(bad|failed|failing|wasteful|guilty|overspend|careless)\b/iu);
  });
});

describe('share picture', () => {
  const s = scorecard(base({}, { bills: { cur: { paid: 20, late: 0 }, prev: { paid: 15, late: 5 } }, debt: { now: 5, ago: 10 } }));
  // Real-looking names and amounts everywhere in the data, none of which may reach the picture
  const loaded = scorecard({ ...base({ category: 'Secret Cafe', spend: () => 2750 }), charges: [] });
  const svg = shareSvg(s), text = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(' | ');
  it('has the ratings, the personality and the two top lines as words', () => {
    expect(text).toContain(s.person.label);
    for (const g of s.grades) { expect(text).toContain(g.name); expect(text).toContain(g.rating); }
    expect(text).toContain('Best habit');
    expect(text).toContain('Biggest improvement');
  });
  it('holds no amounts, numbers, currency, names or dates', () => {
    expect(text).not.toMatch(/\d/);
    expect(svg).not.toMatch(/[$€£¥]|\bUSD\b|\bEUR\b/);
    expect(shareSvg(loaded)).not.toMatch(/Secret|Cafe|2,?750|Corner Shop|Employer/);
    expect(text).not.toMatch(/%/);
    for (const g of s.grades) { expect(text).not.toContain(g.reason); expect(text).not.toContain(g.detail || '\u0000'); }
    for (const t of s.person.traits) expect(text).not.toContain(t.text);
  });
  it('is a self-contained SVG that fits a phone screen and carries no scripts or links out', () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="1080" height="\d+"/);
    expect(svg).not.toMatch(/<script|href=|<image|foreignObject|https?:\/\/(?!www\.w3\.org)/);
  });
  it('is previewed before it is shared, and shared or saved with a fallback', () => {
    expect(share).toContain('App.scoreShare()');
    expect(share).toContain('App.scoreDownload()');
    expect(share).toContain('navigator.share');
    expect(share).toMatch(/canShare/);
    expect(share).toContain("a.download = f.name");
  });
});

describe('placement', () => {
  const s = scorecard(base());
  it('has a page of its own and a separate Overview card, both switchable in Settings', () => {
    expect(scorecardOn()).toBe(true);
    expect(scorecardPageOn()).toBe(true);
    localStorage.setItem('money.scorecard', 'false'); localStorage.setItem('money.scorecardPage', 'false');
    expect(scorecardOn()).toBe(false);
    expect(scorecardPageOn()).toBe(false);
    expect(settings).toMatch(/data-onchange="App.toggleScorecard\(this.checked\)"/);
    expect(settings).toMatch(/data-onchange="App.toggleScorecardPage\(this.checked\)"/);
    expect(dom).toContain("['scorecard', 'Money scorecard', 'scorecard']");
    expect(dom).toContain("r === 'scorecard'");
    expect(dash).toMatch(/DASH_DEFAULT = \[[^\]]*'scorecard'/);
    expect(dash).toMatch(/habits: 'Habits', scorecard: 'Money scorecard'/);            // its own tile, not part of Habits
  });
  it('draws nothing from an old copy when Firefly is down', () => {
    expect(overview).toContain("scorecardShown() ? loadScore() : none");
    expect(String(scorecardTile(null))).toContain('Firefly isn’t answering, so nothing is shown.');
    expect(String(scorecardTile(null))).not.toContain('sc-mini');
    const src = readFileSync('app/src/pages/scorecard.ts', 'utf8');
    expect(src).toContain('} catch (e) { return null; }');
    expect(src).not.toMatch(/localStorage|fetch\(|sessionStorage/);                  // nothing is stored, and no new calls
  });
  it('keeps every handler a literal App call and never joins markup with +', () => {
    const page = String(scorecardPage(s)) + String(scorecardTile(s));
    expect(page).not.toMatch(/data-on\w+="(?!App\.\w+\()/);
    expect(readFileSync('app/src/pages/scorecard.ts', 'utf8')).toContain('data-onclick="App.scorePreview()"');
    expect(readFileSync('app/src/pages/scorecard.ts', 'utf8')).not.toMatch(/html`[^`]*`\s*\+\s*html`/);
  });
  it('shows ratings in words with a link to improve each, on the page and as a card', () => {
    const page = String(scorecardPage(s)), tile = String(scorecardTile(s));
    expect(page).toContain('Your money personality');
    expect(page).toContain('Your ratings');
    for (const g of s.grades) { expect(page).toContain(g.reason); expect(page).toContain('href="' + g.href + '"'); expect(tile).toContain(g.name); }
    expect(tile).toContain('href="#/scorecard"');
    expect(page + tile).not.toMatch(/\p{Extended_Pictographic}|\b[A-F][+-]?\b grade/u);
  });
  it('lays out at every width and theme with tokens only', () => {
    const block = css.slice(css.indexOf('/* Money scorecard'), css.indexOf('/* The "Looks like a bill" rows'));
    expect(block.length).toBeGreaterThan(500);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(block).toContain('overflow-wrap: anywhere');
  });
  it('has Spanish for every phrase it can show', () => {
    const cat = es as Record<string, string>, all = scorecard(base({}, { bills: { cur: { paid: 20, late: 0 }, prev: { paid: 15, late: 5 } }, debt: { now: 5, ago: 10 }, cash: { now: [{ name: 'A', role: 'defaultAsset', balance: 9000 }], ago: null } }));
    const phrases = [...all.grades.flatMap(g => [g.name, g.rating, g.action, g.reason.replace(/\d+/g, '{n}')]), all.person.label, all.person.line, all.person.nudge];
    const keys = Object.keys(cat);
    for (const p of phrases) expect(keys.some(k => k === p || new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.*') + '$').test(p)), p).toBe(true);
    for (const k of ['Money scorecard', 'Money scorecard card', 'Money scorecard page', 'Your money personality', 'Dipping', 'Improving', 'Holding', 'Strong', 'Steady', 'Building', 'Needs attention', 'Share your scorecard', 'Save image', '{pct}% of dining happens Fri–Sun']) expect(cat[k], k).toBeTruthy();
  });
});
