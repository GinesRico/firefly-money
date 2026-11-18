import { beforeEach, describe, expect, it } from 'vitest';
import { hourlyRate, setWorkSkip, workHours, workSources } from '../app/src/core/worklens';

const learned = (src: { n: string, s: number }[]) => localStorage.setItem('money.workRateAuto', JSON.stringify({ v: 0, at: Date.now(), hrs: 40, src }));

describe('hours of work: income counted', () => {
  beforeEach(() => localStorage.clear());
  it('leaves skipped sources out of the hourly take-home', () => {
    learned([{ n: 'Employer', s: 6000 }, { n: 'Tax office', s: 1200 }]);
    setWorkSkip([]);
    const all = hourlyRate();
    setWorkSkip(['Tax office']);
    expect(workSources()).toEqual(['Employer', 'Tax office']);
    expect(hourlyRate()).toBeCloseTo(all * 6000 / 7200, 6);
  });
  it('takes more than 60 hours a week', () => {
    localStorage.setItem('money.workHours', '66');
    expect(workHours()).toBe(66);
    localStorage.setItem('money.workHours', '500');
    expect(workHours()).toBe(40);
  });
});
