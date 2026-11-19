import { describe, expect, it } from 'vitest';
import { nwOptions } from '../app/src/features/networth';

describe('net worth ranges', () => {
  it('offers ranges past 10 years for a long history, and one past what the history reaches', () => {
    const y = new Date().getFullYear();
    expect(nwOptions(`${y - 15}-01-01`)).toEqual([6, 12, 36, 60, 120, 180, 240]);
    expect(nwOptions(`${y - 8}-01-01`)).toEqual([6, 12, 36, 60, 120]);
    expect(nwOptions(`${y - 40}-01-01`)).toContain(360);
  });
});
