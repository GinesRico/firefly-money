import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { money } from '../app/src/core/base';
import { billDatesTo, billDays, billDueDates, billPaidIn, billsFrom } from '../app/src/pages/bills';
import { scheduledPayments } from '../app/src/pages/forecast';
import { trends } from '../app/src/features/unusual';

// Firefly's own shapes: paid_dates only inside the range asked, pay_dates every date after the latest payment in it
const bill = (freq: string, pay: string[], paid: string[] = [], more: Record<string, unknown> = {}) => ({
  id: '1', attributes: { name: 'Rent', amount_min: '100', amount_max: '100', repeat_freq: freq, skip: 0, active: true, date: '2026-01-01',
    pay_dates: pay.map(d => d + 'T00:00:00-04:00'), paid_dates: paid.map(d => ({ transaction_group_id: 'g' + d, date: d + 'T00:00:00-04:00' })), ...more } });
const NOV = { start: '2026-11-01', end: '2026-11-30' };

describe('bills paid around the month start (H1, H2, L2)', () => {
  it('asks for bills from before the month, so an earlier payment comes back', () => {
    expect(billsFrom('2026-11-14')).toBe('2026-09-17');
  });
  it('H1: rent due the 1st and paid Oct 30 is not overdue in November', () => {
    const b = bill('monthly', ['2026-11-01'], ['2026-10-30']);
    expect(billDueDates(b.attributes, NOV)).toEqual([]);
    expect(billDays([b], '2026-11-14', NOV).sum).toEqual({ paid: 0, due: 0, late: 0 });
  });
  it('H2: a bill due the 20th and paid the 12th is not still due on the 14th', () => {
    const b = bill('monthly', ['2026-11-20'], ['2026-11-12']);
    expect(billDueDates(b.attributes, NOV)).toEqual([]);
    expect(billDays([b], '2026-11-14', NOV).sum).toEqual({ paid: 100, due: 0, late: 0 });
  });
  it('a payment made late settles the date it was late for, not the next one', () => {
    expect(billDueDates(bill('monthly', ['2026-12-01'], ['2026-11-14']).attributes, { start: '2026-11-01', end: '2026-12-31' })).toEqual(['2026-12-01']);
  });
  it('an unpaid date from last month is still overdue, and a payment settles each date once', () => {
    expect(billDueDates(bill('monthly', ['2026-10-01', '2026-11-01'], []).attributes)).toEqual(['2026-10-01', '2026-11-01']);
    expect(billDueDates(bill('monthly', ['2026-11-01', '2026-12-01'], ['2026-10-30']).attributes)).toEqual(['2026-12-01']);
  });
  it('payments before the period are not counted as paid in it', () => {
    expect(billPaidIn(bill('monthly', [], ['2026-10-30', '2026-11-05']).attributes, NOV)).toHaveLength(1);
  });
});

describe('weekly bills (M1) and long forecasts (M6)', () => {
  it('a weekly bill paid once still has dates left in the month', () => {
    const b = bill('weekly', ['2026-11-13', '2026-11-20', '2026-11-27'], ['2026-11-06']);
    expect(billDueDates(b.attributes, NOV)).toEqual(['2026-11-13', '2026-11-20', '2026-11-27']);
    expect(billPaidIn(b.attributes, NOV)).toHaveLength(1);
  });
  it('carries a daily bill on past the dates Firefly lists', () => {
    const pay = Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
    const dates = billDatesTo(bill('daily', pay).attributes, '2026-12-31');
    expect(dates).toHaveLength(61);
    expect(dates[60]).toBe('2026-12-31');
  });
  it('does not invent dates for a bill that has ended', () => {
    const pay = Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
    expect(billDatesTo(bill('daily', pay, [], { end_date: '2026-12-05' }).attributes, '2026-12-31')).toHaveLength(35);
  });
  it('the forecast counts a bill paid before the month once, not as overdue', () => {
    const out = scheduledPayments({ from: '2026-11-14', to: '2026-12-31', accIds: ['1'], loans: [], bills: [bill('monthly', ['2026-11-01', '2026-12-01'], ['2026-10-30'])], payers: {} });
    expect(out.map(e => e.date)).toEqual(['2026-12-01']);
  });
});

describe('small fixes', () => {
  it('L1: a sum that rounds to nothing prints no minus sign', () => {
    expect(money(10.1 + 20.2 - 30.3)).not.toContain('-');
    expect(money(-0.004)).not.toContain('-');
    expect(money(-0.5)).toContain('-');
  });
  it('M3: merchant trends follow a month that starts mid-month', () => {
    localStorage.setItem('money.cycleDay', '15');
    try {
      const charges = [{ key: 'a', date: '2026-11-16', amount: 50 }, { key: 'a', date: '2026-10-16', amount: 10 }, { key: 'a', date: '2026-09-16', amount: 10 }, { key: 'a', date: '2026-08-16', amount: 10 }] as never[];
      // 20 Nov is the 6th day of the cycle that began on the 15th: the November charge counts as "this month"
      expect(JSON.stringify(trends(charges, '2026-11-20'))).toContain('"a"');
    } finally { localStorage.removeItem('money.cycleDay'); }
  });
  it('S1/S2/M11: the address bar can’t reach a handler or the API path, and names with an apostrophe toggle', () => {
    const acc = readFileSync('app/src/pages/accounts.ts', 'utf8'), tx = readFileSync('app/src/pages/transactions.ts', 'utf8'), fc = readFileSync('app/src/pages/forecast.ts', 'utf8');
    expect(acc).toContain("['assets', 'cards', 'liabilities', 'expense', 'revenue'].includes(r.q.tab)");
    expect(tx).toContain('id(q.budget)');
    expect(tx).toContain('encodeURIComponent(q.tag)');
    expect(fc).toContain('data-key="${e.key}" data-onchange="App.fcToggle(this.dataset.key, this.checked)"');
  });
  it('M2: the narrowest phones get tighter tables', () => {
    expect(readFileSync('app/assets/money.css', 'utf8')).toMatch(/max-width: 340px\) \{\s*\.tbl th, \.tbl td \{ padding-left: 8px/);
  });
  it('A1: the page behind the drawer is inert while it is open', () => {
    const dom = readFileSync('app/src/core/dom.ts', 'utf8');
    expect(dom).toContain("el('app').inert = true");
    expect(dom).toContain("el('app').inert = false");
  });
});

describe('remaining audit items', () => {
  it('S3/A3/A4/L10/L11 are in place', () => {
    expect(readFileSync('app/default.conf.template', 'utf8')).toContain('zone=signin:1m rate=6r/m');
    expect(readFileSync('app/index.html', 'utf8').match(/<nav [^>]*aria-label=/g)).toHaveLength(3);
    expect(readFileSync('app/assets/money.css', 'utf8')).toContain('.seg:not(.mini) button { min-height: 44px; }');
    expect(readFileSync('app/src/pages/forecast.ts', 'utf8')).toContain('the same payment is already a bill');
    expect(readFileSync('app/src/core/api.ts', 'utf8')).toContain('SETTLED_FOR = 36e5');
  });
});
