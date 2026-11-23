import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tileOn, tileOpt } from '../app/src/features/dashboard';

const save = (v: unknown) => localStorage.setItem('money.dash', JSON.stringify(v));

describe('which Overview cards are on', () => {
  beforeEach(() => localStorage.clear());
  it('starts a new Overview with the bento tiles', () => {
    expect(['networth', 'safe', 'spent', 'earned', 'insights', 'spending', 'budgets', 'bills', 'attention', 'cashflow'].every(tileOn)).toBe(true);
    expect(['payees', 'heatmap', 'pace', 'trends'].some(tileOn)).toBe(false);
  });
  it('starts a layout from before the bento over, keeping each tile’s settings', () => {
    save({ v: 2, order: ['safe', 'payees'], hidden: ['spending'], shown: ['payees'], opts: { recent: { count: 5 } } });
    expect(tileOn('payees')).toBe(false);
    expect(tileOn('spending')).toBe(true);
    expect(tileOn('spent')).toBe(true);
    expect(tileOpt('recent', 'count')).toBe(5);
  });
  it('follows what was added and hidden', () => {
    save({ v: 3, order: [], hidden: ['bills'], shown: ['pace'] });
    expect(tileOn('pace')).toBe(true);
    expect(tileOn('bills')).toBe(false);
    expect(tileOn('payees')).toBe(false);
  });
});

describe('Add cards offers every card that is off', () => {
  it('marks habits and the scorecard "off" (not empty) so Customize lists them', () => {
    const src = readFileSync('app/src/pages/overview.ts', 'utf8');
    expect(src).toMatch(/\['scorecard', !scorecardShown\(\) \? \(!tileOn\('scorecard'\) && scorecardOn\(\) \? 'off' : ''\)/);
    expect(src).toMatch(/\['habits', !habitsShown\(\) \? \(!tileOn\('habits'\) && habitsOn\(\) \? 'off' : ''\)/);
  });
  it('the scorecard is off by default but can be added', () => {
    expect(tileOn('scorecard')).toBe(false);
    save({ v: 3, order: [], hidden: [], shown: ['scorecard'] });
    expect(tileOn('scorecard')).toBe(true);
  });
});
