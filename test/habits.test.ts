import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { type Buy, habitStats, habitTodo, habitsOn, habitsPanel, nearGoal, nwMilestone } from '../app/src/features/habits';
import es from '../app/src/locales/es.json';

const css = readFileSync('app/assets/money.css', 'utf8');
const overview = readFileSync('app/src/pages/overview.ts', 'utf8');
const dash = readFileSync('app/src/features/dashboard.ts', 'utf8');
const settings = readFileSync('app/src/pages/settings.ts', 'utf8');
// 2026-11-18 is a Wednesday; its week started Monday the 16th
const today = '2026-11-18';
const day = (d: string, amount = 10, category = 'Food'): Buy => ({ date: d, amount, category });
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
// A purchase every day for the last n days
const everyDay = (n: number, amount = 10, category = 'Food') => [...Array(n)].map((_, i) => day(addDays(today, -i), amount, category));
beforeEach(() => localStorage.clear());

describe('habit stats', () => {
  it('has nothing to say without purchases', () => expect(habitStats([], today)).toBeNull());
  it('counts days in a row with every purchase categorized, and resets on a bare one', () => {
    const buys = [...everyDay(10), day(addDays(today, -4), 5, '')];
    const s = habitStats(buys, today)!;
    expect(s.categorized).toBe(4);
    expect(s.uncategorized).toBe(1);
  });
  it('counts whole no-spend days after the first purchase, not today and not before it', () => {
    const s = habitStats([day('2026-11-03'), day('2026-11-06'), day('2026-11-17')], today)!;
    expect(s.quietMonth).toBe(12);          // Nov 4-5 and 7-16
    expect(s.quietRun).toBe(10);
    expect(s.quietWeek).toBe(1);            // Mon 16th only (17th had a purchase, today isn't over)
  });
  it('ignores a spending streak until there are four complete weeks', () => {
    expect(habitStats(everyDay(20), today)!.usual).toBeNull();
    expect(habitStats(everyDay(60), today)!.usual).toBeGreaterThan(0);
  });
  it('counts complete weeks in a row at or under the usual week', () => {
    // complete weeks from Oct 12: 300, 300, 400, 100, 100 → usual 300, and the last two are under it
    const wk = (monday: string, total: number) => day(monday, total);
    const buys = [wk('2026-10-12', 300), wk('2026-10-19', 300), wk('2026-10-26', 400), wk('2026-11-02', 100), wk('2026-11-09', 100), day('2026-11-16', 20)];
    const s = habitStats(buys, today)!;
    expect(s.usual).toBe(300);
    expect(s.underWeeks).toBe(2);
    expect(s.week).toEqual({ spent: 20, elapsed: 3, onTrack: true });
  });
  it('flags a week running above the usual pace', () => {
    const wk = (monday: string, total: number) => day(monday, total);
    const buys = [wk('2026-10-12', 100), wk('2026-10-19', 100), wk('2026-10-26', 100), wk('2026-11-02', 100), wk('2026-11-09', 100), day('2026-11-16', 200)];
    expect(habitStats(buys, today)!.week!.onTrack).toBe(false);
  });
  it('writes the fun facts from the data', () => {
    const s = habitStats(everyDay(80), today)!;
    expect(s.facts.some(f => /average day/i.test(f))).toBe(true);
    expect(s.facts.some(f => /quietest day/.test(f))).toBe(true);
  });
});

describe('milestones and goals', () => {
  const pts = (a: number, b: number) => [{ date: addDays(today, -30), net: a }, { date: today, net: b }];
  it('finds the biggest round number net worth passed this month', () => {
    expect(nwMilestone(pts(48000, 52000), today)).toBe(50000);
    expect(nwMilestone(pts(8000, 21000), today)).toBe(20000);
  });
  it('says nothing when none was passed, or net worth fell, or the history is thin', () => {
    expect(nwMilestone(pts(51000, 52000), today)).toBeNull();
    expect(nwMilestone(pts(52000, 48000), today)).toBeNull();
    expect(nwMilestone([{ date: today, net: 5e4 }], today)).toBeNull();
    expect(nwMilestone(null, today)).toBeNull();
  });
  it('picks the goal nearest the finish once it is past half way', () => {
    expect(nearGoal([{ name: 'Trip', target: 1000, current: 850, active: true }, { name: 'Car', target: 1000, current: 600, active: true }])).toEqual({ name: 'Trip', pct: 85 });
    expect(nearGoal([{ name: 'Trip', target: 1000, current: 400, active: true }, { name: 'Done', target: 100, current: 100, active: true }, { name: 'Off', target: 100, current: 90, active: false }])).toBeNull();
  });
});

describe('to do', () => {
  it('ticks what is done and links what is not', () => {
    const t = habitTodo({ uncat: 3, billsDue: 0, atRisk: ['Food'], drafts: 1 });
    expect(t.map(x => x.text)).toEqual(['Categorize 3 expenses', 'No bills due this week', 'Check the Food budget', 'Finish 1 draft']);
    expect(t.map(x => x.done)).toEqual([false, true, false, false]);
    expect(t[0].href).toBe('#/inbox');
  });
  it('leaves out bills and budgets that are not set up', () => {
    expect(habitTodo({ uncat: 0, billsDue: null, atRisk: null, drafts: 0 })).toEqual([{ text: 'Everything is categorized', done: true }]);
  });
});

describe('habits card', () => {
  const stats = habitStats(everyDay(80), today);
  const markup = String(habitsPanel({ stats, today, todo: { uncat: 0, billsDue: 1, atRisk: [], drafts: 0 } }));
  it('can be hidden for the day and uses literal App handlers', () => {
    expect(markup).toContain('data-onclick="App.habitsHide()"');
    expect(markup).toContain('Hide habits for today');
  });
  it('has no emoji, no guilt and no gamified wording', () => {
    expect(markup).not.toMatch(/\p{Extended_Pictographic}|🔥|streak broken|you failed|don.t break|keep it up|!/u);
  });
  it('is on unless switched off in Settings', () => {
    expect(habitsOn()).toBe(true);
    localStorage.setItem('money.habits', 'false');
    expect(habitsOn()).toBe(false);
    expect(settings).toMatch(/data-onchange="App.toggleHabits\(this.checked\)"/);
  });
  it('is on the Overview by default, draws nothing without Firefly, and is switchable', () => {
    expect(dash).toMatch(/DASH_DEFAULT = \[[^\]]*'habits'/);
    expect(overview).toMatch(/if \(!buys\) return quietPanel\('habits'/);
    expect(overview).toContain("tileOn('habits') && habitsOn()");
  });
  it('lays out at every width and theme with tokens only', () => {
    const block = css.slice(css.indexOf('/* Habits card'), css.indexOf('/* The "Looks like a bill" rows'));
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(block).toContain('overflow-wrap: anywhere');
  });
  it('has Spanish for every phrase', () => {
    const cat = es as Record<string, string>;
    for (const k of ['Habits', 'Habits card', 'Small wins, no pressure', 'Hide for today', 'Everything categorized', 'No-spend days', 'No bills due this week', 'Budgets are on track', 'Categorize {n} expenses', 'Net worth passed {amount} this month.', '{n} weeks in a row']) expect(cat[k], k).toBeTruthy();
  });
});
