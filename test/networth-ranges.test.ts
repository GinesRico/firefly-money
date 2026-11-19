import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { App } from '../app/src/core/base';
import { customLabel, nwMonths, nwOptions, nwSeg, nwWords } from '../app/src/features/networth';

describe('net worth ranges', () => {
  it('offers ranges past 10 years for a long history, and one past what the history reaches', () => {
    const y = new Date().getFullYear();
    expect(nwOptions(`${y - 15}-01-01`)).toEqual([6, 12, 36, 60, 120, 180, 240]);
    expect(nwOptions(`${y - 8}-01-01`)).toEqual([6, 12, 36, 60, 120]);
    expect(nwOptions(`${y - 40}-01-01`)).toContain(360);
  });
  it('keeps a typed range as whole months and shows it on the switch', () => {
    localStorage.setItem('money.nwMonths', '84');
    expect(nwMonths()).toBe(84); expect(nwWords()).toBe('7 years'); expect(customLabel(84)).toBe('7Y'); expect(customLabel(18)).toBe('18M');
    expect(String(nwSeg())).toContain('>7Y</button>');
    localStorage.setItem('money.nwMonths', '60'); expect(String(nwSeg())).toContain('>…</button>');
  });
  it('the years box rejects nonsense and keeps its row inside the card (measured at 320 to 1920 across themes)', () => {
    localStorage.setItem('money.nwMonths', '60'); document.body.innerHTML = '<div id="toast"></div>';
    App.nwSet('0'); App.nwSet('abc'); App.nwSet('51');
    expect(localStorage.getItem('money.nwMonths')).toBe('60');
    expect(readFileSync('app/assets/money.css', 'utf8')).toMatch(/\.nwcust \{ display: flex; gap: 6px; align-items: center; \} \.nwcust input \{ width: 64px;/);
  });
});
