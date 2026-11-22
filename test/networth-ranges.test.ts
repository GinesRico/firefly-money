import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { App } from '../app/src/core/base';
import { nwAll, nwGear, nwMonths, nwOptsForm, nwWords } from '../app/src/features/networth';

describe('net worth range options', () => {
  it('is a years box and All time inside the card options, not buttons on the card', () => {
    const f = String(nwOptsForm()), g = String(nwGear());
    expect(f).toMatch(/^<form class="nwcust" hidden /); expect(f).toContain('type="number"'); expect(f).toContain('App.nwRange(-1)');
    expect(f).not.toMatch(/6M|15Y|30Y|Custom range/); expect(g).toContain('App.nwOpts(this)'); expect(g).toContain('aria-expanded="false"');
  });
  it('defaults to a year, keeps typed years as whole months, and All time is its own saved choice', () => {
    localStorage.removeItem('money.nwMonths'); localStorage.removeItem('money.nwYears');
    expect(nwMonths()).toBe(12); expect(nwWords()).toBe('1 year');
    localStorage.setItem('money.nwMonths', '84'); expect(nwMonths()).toBe(84); expect(nwWords()).toBe('7 years'); expect(nwAll()).toBe(false);
    localStorage.setItem('money.nwMonths', '18'); expect(nwWords()).toBe('18 months');
    localStorage.setItem('money.nwMonths', '-1'); expect(nwAll()).toBe(true); expect(nwWords()).toBe('all time'); expect(nwMonths()).toBeGreaterThanOrEqual(3);
    expect(String(nwOptsForm())).toContain('value=""');
  });
  it('rejects empty or nonsense input and keeps the saved range', () => {
    localStorage.setItem('money.nwMonths', '60'); document.body.innerHTML = '<div id="toast"></div>';
    App.nwSet(''); App.nwSet('0'); App.nwSet('abc'); App.nwSet('51');
    expect(localStorage.getItem('money.nwMonths')).toBe('60');
    App.nwSet('2.5'); expect(localStorage.getItem('money.nwMonths')).toBe('30');
  });
  it('All time starts at the first transaction and keeps nothing when Firefly is down; the options row has its own styles', () => {
    const src = readFileSync('app/src/features/networth.ts', 'utf8'), css = readFileSync('app/assets/money.css', 'utf8');
    expect(src).toMatch(/fresh: true/); expect(src).toMatch(/total_pages/); expect(src).toMatch(/allFrom = nwAll\(\) \? await firstTxDay\(\) : ''/);
    expect(css).toMatch(/\.nwcust \{ display: flex; flex-wrap: wrap;/); expect(css).toMatch(/\.nw-gear \{[^}]*width: 28px; height: 28px;/);
  });
});
