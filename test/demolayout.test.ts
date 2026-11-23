import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_DASH } from '../app/src/demo/layout';

describe('demo Overview layout', () => {
  const width = { s: 1, m: 2, l: 6 } as Record<string, number>;
  const groups = () => {
    const g: string[][] = []; let row: string[] = [], used = 0;
    for (const k of DEMO_DASH.order) {
      const w = width[(DEMO_DASH.size as Record<string, string>)[k]];
      if (used + w > 6) { g.push(row); row = []; used = 0; }
      row.push(k); used += w;
    }
    g.push(row);
    return g;
  };
  it('lists each card once, in the recording order', () => {
    expect(DEMO_DASH.order).toEqual(['activity', 'insights', 'scorecard', 'networth', 'earned', 'spent', 'safe', 'attention', 'budgets', 'cash', 'cards', 'bills', 'spending', 'payees', 'income', 'trends', 'loans', 'goals', 'pace', 'flow', 'cashflow', 'recent', 'heatmap', 'subs', 'savings']);
    expect(new Set(DEMO_DASH.order).size).toBe(DEMO_DASH.order.length);
  });
  it('groups the rows as in the recording', () => {
    expect(groups().map(g => g.join(' '))).toEqual(['activity', 'insights', 'scorecard networth earned spent safe attention', 'budgets', 'cash cards bills', 'spending payees income', 'trends loans goals', 'pace flow cashflow', 'recent', 'heatmap subs savings']);
  });
  it('shows the non-default cards, hides none and has no rating cards', () => {
    expect(DEMO_DASH.shown).toEqual(expect.arrayContaining(['scorecard', 'cash', 'cards', 'heatmap', 'loans', 'payees', 'flow', 'income', 'goals', 'pace', 'savings', 'recent', 'trends', 'subs']));
    expect(DEMO_DASH.hidden).toEqual([]);
    expect(DEMO_DASH.order.some(k => /^sc[A-Z]/.test(k))).toBe(false);
    expect(DEMO_DASH.opts.activity.range).toBe('all');
  });
});

describe('demo defaults', () => {
  it('opens in Interstellar over New York City with a clear sky, without asking for a location', () => {
    const src = readFileSync('app/src/demo/demo.ts', 'utf8');
    expect(src).toContain("setItem('moneyTheme', 'interstellar')");
    expect(src).toMatch(/money\.skyLoc', JSON\.stringify\(\{ lat: 40\.7, lon: -74, name: 'New York/);
    expect(src).toContain("setItem('money.skyWx', 'clear')");
    expect(src).not.toContain('geolocation');
  });
});
