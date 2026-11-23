import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('app/src/pages/overview.ts', 'utf8');
const css = readFileSync('app/assets/money.css', 'utf8');

describe('loading placeholders are true to size', () => {
  it('sizes a card’s placeholder to its height from the last time it loaded (pixels only, no data)', () => {
    expect(src).toContain("localStorage.getItem('money.skh')");
    expect(src).toContain('const known = skHeights()[skKey(k)];');
    expect(src).toContain('style="height:${known}px;min-height:0;flex:1 0 ${known}px"');
    // the remembered height is for this width, theme and language, so a change of any of them doesn't reuse another's
    expect(src).toMatch(/skKey = .*clientWidth.*data-theme.*lang/);
  });
  it('remembers heights only once every card has arrived, and never any numbers', () => {
    expect(src).toContain("d.querySelector('.sk, [aria-busy]')");
    expect(src).toContain('h[skKey(w.dataset.w!)] = Math.round(r * 10) / 10');
    expect(src.match(/setTimeout\(rememberHeights, 600\)/g)).toHaveLength(3);
  });
  it('draws the net worth placeholder with the chart’s own geometry', () => {
    expect(src).not.toContain('<div class="sk" style="height:56px"></div>');
    expect(src).toContain("keepHeight('networth')");
    expect(css).toContain('.panel.stat.nw .sk { height: 76px; margin-top: auto; border-top: 12px solid transparent;');
    expect(css).toContain('.cards.bento .panel.stat.nw .sk { flex: 1 1 0; height: auto; min-height: clamp(64px, 20cqi, 150px); }');
  });
});

describe('chart tables do not resize a card after it is drawn', () => {
  it('adds "Show as table" in the same frame as the chart, not after a pause', () => {
    const a11y = readFileSync('app/src/features/a11y.ts', 'utf8');
    expect(a11y).toContain('queueMicrotask(() => { ctQueued = false; chartTables(); })');
    expect(a11y).not.toContain('}, 250)');
  });
});
