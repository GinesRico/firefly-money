import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { activityPanel } from '../app/src/features/charts';
import { AG3_MAX, ag3Cells, ag3Fit, ag3Scale } from '../app/src/features/activity3d';

const css = readFileSync('app/assets/money.css', 'utf8');
const buys = [{ date: '2026-11-03', amount: 20 }, { date: '2026-02-10', amount: 5 }];

describe('Activity in 3D drawer', () => {
  it('the card opens it, with a keyboard button, and the cells no longer navigate by themselves', () => {
    const h = String(activityPanel(buys, '2026-01-01', '2026-11-07', { range: 'year' }));
    expect(h).toContain('data-onclick="App.activity3d(this)"');
    expect(h).toContain('class="ag-open"');
    expect(h).toContain('data-d="');
    expect(h).not.toContain('data-go="');
  });
  it('keeps the latest weeks of a wide range, whole week columns, and turns day links on for the drawer', () => {
    const host = document.createElement('div');
    host.innerHTML = Array.from({ length: 7 * 80 }, (_, i) => `<span class="ag-c l1" data-d="#/x${i}" data-tip="t"></span>`).join('');
    const r = ag3Cells([...host.children], 10);
    expect(r.cols).toBe(10); expect(r.cut).toBe(true);
    expect(r.html.match(/class="ag-c/g)!.length).toBe(70);
    expect(r.html).toContain('data-go="#/x559"'); expect(r.html).not.toContain('data-d=');
    expect(r.html).toContain('data-onclick="App.closeDrawer()"');
  });
  it('fits the width and the drawer, and never shows more than a year', () => {
    expect(ag3Fit(337)).toBeLessThan(AG3_MAX); expect(ag3Fit(5000)).toBe(AG3_MAX); expect(ag3Fit(10)).toBe(18);
    expect(ag3Scale(51, 14, 3, 464, 300)).toBeLessThan(1);
    expect(ag3Scale(4, 14, 3, 464, 300)).toBeGreaterThan(ag3Scale(51, 14, 3, 464, 300));
  });
  it('styles bars by level, tilts in, and respects reduced motion', () => {
    for (const l of ['l1', 'l2', 'l3', 'l4']) expect(css).toMatch(new RegExp('\\.ag3-grid \\.ag-c\\.' + l + ' \\{ --z: \\d+px'));
    expect(css).toContain('rotateX(calc(58deg * var(--k)))');
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.ag3-stage \{ --k: 1/);
  });
});
