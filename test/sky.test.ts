import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEYS, mix, paintSky, skyAt } from '../app/src/core/sky';

const css = readFileSync('app/assets/money.css', 'utf8');
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
const at = (h: number, m = 0) => skyAt(h * 60 + m);

describe('Interstellar sky: time of day', () => {
  it('maps the clock to dawn, day, dusk and night', () => {
    expect([0, 3, 4.9, 20, 23.5].map(h => at(h).phase)).toEqual(['night', 'night', 'night', 'night', 'night']);
    expect([5, 6.5].map(h => at(h).phase)).toEqual(['dawn', 'dawn']);
    expect([7, 12, 16.9].map(h => at(h).phase)).toEqual(['day', 'day', 'day']);
    expect([17, 18.5].map(h => at(h).phase)).toEqual(['dusk', 'dusk']);
  });
  it('puts the sun up from 6:00 to 18:00, highest at noon, on the horizon at both ends', () => {
    expect(at(5).sun.o).toBe(0); expect(at(19).sun.o).toBe(0); expect(at(0).sun.o).toBe(0);
    expect(at(12).sun.o).toBe(1);
    expect(at(12).sun.x).toBe(50); expect(at(12).sun.y).toBe(20);
    expect(at(6).sun.x).toBe(6); expect(at(6).sun.y).toBe(74); expect(at(18).sun.x).toBe(94); expect(at(18).sun.y).toBe(74);
    expect(at(9).sun.x).toBeLessThan(at(15).sun.x);
    expect(at(9).sun.y).toBeGreaterThan(at(12).sun.y);
  });
  it('puts the moon up from 18:00 to 6:00, highest at midnight, and out of the way by day', () => {
    expect(at(12).moon.o).toBe(0); expect(at(0).moon.o).toBe(1); expect(at(0).moon.x).toBe(50); expect(at(0).moon.y).toBe(20);
    expect(at(18).moon.x).toBe(6); expect(at(6).moon.x).toBe(94);
    expect(at(21).moon.x).toBeLessThan(at(3).moon.x);
    expect(at(12).moon.o).toBe(0);
  });
  it('shows stars at night only and fades them through twilight', () => {
    expect(at(2).stars).toBe(1); expect(at(22).stars).toBe(1); expect(at(12).stars).toBe(0);
    expect(at(5).stars).toBeGreaterThan(0); expect(at(5).stars).toBeLessThan(1);
  });
  it('wraps around midnight, and a minute is a small step', () => {
    expect(skyAt(-60)).toEqual(skyAt(23 * 60)); expect(skyAt(24 * 60)).toEqual(skyAt(0));
    const a = at(11, 59), b = at(12, 0); expect(Math.abs(a.sun.x - b.sun.x)).toBeLessThan(.5);
  });
  it('blends colours between keyframes', () => { expect(mix('#000000', '#ffffff', .5)).toBe('#808080'); expect(skyAt(KEYS[2][0]).bot).toBe(KEYS[2][3]); });
  it('lays the sky on the element as CSS variables', () => {
    const set: Record<string, string> = {}, attrs: Record<string, string> = {};
    paintSky(12 * 60, { style: { setProperty: (k: string, v: string) => { set[k] = v; } }, setAttribute: (k: string, v: string) => { attrs[k] = v; } } as unknown as HTMLElement);
    expect(set['--sun-x']).toBe('50'); expect(set['--sky-top']).toBe(KEYS[4][1]); expect(attrs['data-sky']).toBe('day');
  });
});

describe('Interstellar sky: text stays readable (WCAG AA, 4.5:1) at every time of day', () => {
  const block = css.slice(css.indexOf('html[data-theme="interstellar"] {'), css.indexOf('}', css.indexOf('html[data-theme="interstellar"] {')));
  const v = (n: string) => new RegExp('--' + n + ': (#[0-9a-f]{6})', 'i').exec(block)![1];
  const text = v('text'), muted = v('muted');
  it('on the sky itself, every minute of the day, including a dim moon disc behind it', () => {
    for (let m = 0; m < 1440; m += 5) {
      const s = skyAt(m);
      for (const bg of [s.top, s.mid, s.bot, '#3f4b5d', '#0b0906']) { expect(ratio(text, bg), m + ' text on ' + bg).toBeGreaterThanOrEqual(4.5); expect(ratio(muted, bg), m + ' muted on ' + bg).toBeGreaterThanOrEqual(4.5); }
    }
  });
  it('on the sun glow, and on cards over the brightest sky', () => {
    for (let m = 0; m < 1440; m += 5) { const s = skyAt(m); const glow = mix(s.bot, s.sun.c, .08 * s.sun.o); expect(ratio(muted, glow), m + ' muted on glow').toBeGreaterThanOrEqual(4.5); }
    const card = mix('#36475b', '#090c12', .9);
    expect(ratio(text, card)).toBeGreaterThanOrEqual(4.5); expect(ratio(muted, card)).toBeGreaterThanOrEqual(4.5);
  });
  it('for the accent, its button label and the amounts, on the cards', () => {
    const card = '#0f1218';
    for (const c of ['accent', 'good-t', 'spend-t', 'warn-t']) expect(ratio(v(c), card), c).toBeGreaterThanOrEqual(4.5);
    expect(ratio(v('on-accent'), v('accent'))).toBeGreaterThanOrEqual(4.5);
  });
  it('is drawn by CSS variables only: no animation, no filters', () => {
    const rules = css.split('\n').filter(l => l.includes('data-theme="interstellar"')).join('\n');
    expect(rules).not.toMatch(/animation|@keyframes|filter:\s*blur|transition/);
  });
});
