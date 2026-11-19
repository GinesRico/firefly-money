import { describe, expect, it } from 'vitest';
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
});
