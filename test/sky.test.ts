import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEYS, WX, keysFor, mix, paintSky, skyAt, sunToday, sunUTC, wxOf } from '../app/src/core/sky';

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
    expect(at(12).sun.x).toBe(50); expect(at(12).sun.y).toBe(11);
    expect(at(6).sun.x).toBe(6); expect(at(6).sun.y).toBe(36); expect(at(18).sun.x).toBe(94); expect(at(18).sun.y).toBe(36);
    expect(at(9).sun.x).toBeLessThan(at(15).sun.x);
    expect(at(9).sun.y).toBeGreaterThan(at(12).sun.y);
  });
  it('puts the moon up from 18:00 to 6:00, highest at midnight, and out of the way by day', () => {
    expect(at(12).moon.o).toBe(0); expect(at(0).moon.o).toBe(1); expect(at(0).moon.x).toBe(50); expect(at(0).moon.y).toBe(11);
    expect(at(18).moon.x).toBe(6); expect(at(6).moon.x).toBe(94);
    expect(at(21).moon.x).toBeLessThan(at(3).moon.x);
  });
  it('shows stars at night only, fades them through twilight, and birds only in daylight', () => {
    expect(at(2).stars).toBe(1); expect(at(22).stars).toBe(1); expect(at(12).stars).toBe(0);
    expect(at(5).stars).toBeGreaterThan(0); expect(at(5).stars).toBeLessThan(1);
    expect(at(12).birds).toBe(1); expect(at(2).birds).toBe(0); expect(at(6).birds).toBe(0);
  });
  it('wraps around midnight, and a minute is a small step', () => {
    expect(skyAt(-60)).toEqual(skyAt(23 * 60)); expect(skyAt(24 * 60)).toEqual(skyAt(0));
    const a = at(11, 59), b = at(12, 0); expect(Math.abs(a.sun.x - b.sun.x)).toBeLessThan(.5);
  });
  it('blends colours between keyframes', () => { expect(mix('#000000', '#ffffff', .5)).toBe('#808080'); expect(skyAt(KEYS[2][0]).bot).toBe(KEYS[2][3]); });
  it('lays the sky on the element as CSS variables', () => {
    const set: Record<string, string> = {}, attrs: Record<string, string> = {};
    const el = { style: { setProperty: (k: string, v: string) => { set[k] = v; } }, setAttribute: (k: string, v: string) => { attrs[k] = v; }, removeAttribute: (k: string) => { delete attrs[k]; } } as unknown as HTMLElement;
    paintSky(12 * 60, {}, el);
    expect(set['--sun-x']).toBe('50'); expect(set['--sky-top']).toBe(KEYS[4][1]); expect(attrs['data-sky']).toBe('day'); expect(attrs['data-wx']).toBeUndefined();
    paintSky(12 * 60, { wx: 'rain' }, el); expect(attrs['data-wx']).toBe('rain');
    paintSky(12 * 60, { wx: 'clear' }, el); expect(attrs['data-wx']).toBeUndefined();
  });
});

describe('Interstellar sky: your location', () => {
  const NYC = [40.7, -74], DAY = (m: number, d: number) => Math.floor((Date.UTC(2026, m - 1, d) - Date.UTC(2026, 0, 0)) / 864e5);
  it('finds sunrise and sunset for a place and day (NOAA, within 10 minutes)', () => {
    const s = sunUTC(NYC[0], NYC[1], DAY(6, 21))!;        // New York, midsummer: 5:25 and 20:31 EDT = 9:25 and 00:31 UTC
    expect(Math.abs(s[0] - (9 * 60 + 25))).toBeLessThan(10); expect(Math.abs(s[1] - (24 * 60 + 31))).toBeLessThan(10);
    const w = sunUTC(NYC[0], NYC[1], DAY(12, 21))!;       // midwinter: 7:17 and 16:32 EST
    expect(Math.abs(w[0] - (12 * 60 + 17))).toBeLessThan(10); expect(Math.abs(w[1] - (21 * 60 + 32))).toBeLessThan(10);
    const q = sunUTC(0, 0, DAY(3, 20))!; expect(Math.abs(q[0] - (6 * 60 + 7))).toBeLessThan(10); expect(Math.abs(q[1] - (18 * 60 + 7))).toBeLessThan(10);
  });
  it('has no sunrise in the polar night or sun in the polar summer, and falls back to 6:00 and 18:00', () => {
    expect(sunUTC(78, 15, DAY(12, 21))).toBeNull(); expect(sunUTC(78, 15, DAY(6, 21))).toBeNull();
    expect(sunToday(78, 15, new Date(2026, 5, 21))).toEqual([360, 1080]);
  });
  it('gives sensible local minutes for a day in this time zone', () => {
    const [r, s] = sunToday(NYC[0], NYC[1], new Date(2026, 5, 21));
    expect(r).toBeGreaterThanOrEqual(180); expect(s).toBeLessThanOrEqual(1350); expect(r).toBeLessThan(s);
  });
  it('moves the sun and the colours with an early sunrise and a late sunset', () => {
    const o = { rise: 5 * 60, set: 21 * 60 };
    expect(skyAt(5 * 60, o).sun.x).toBe(6); expect(skyAt(21 * 60, o).sun.x).toBe(94); expect(skyAt(13 * 60, o).sun.x).toBe(50);
    expect(skyAt(5.5 * 60, o).sun.o).toBeGreaterThan(0); expect(skyAt(5.5 * 60).sun.o).toBe(0);     // up at 5:30 here, not at the default 6:00
    expect(skyAt(20 * 60, o).phase).toBe('dusk'); expect(skyAt(20 * 60).phase).toBe('night');
    const k = keysFor(5 * 60, 21 * 60); expect(k.map(x => x[0])).toEqual(k.map(x => x[0]).sort((a, b) => a - b)); expect(k[k.length - 1][0]).toBe(1440);
  });
  it('keeps keyframes in order even for the longest and shortest days', () => {
    for (const [r, s] of [[180, 1350], [600, 900], [360, 1080]]) { const k = keysFor(r, s).map(x => x[0]); k.forEach((t, i) => { if (i) expect(t).toBeGreaterThan(k[i - 1]); }); }
  });
});

describe('Interstellar sky: weather', () => {
  it('turns WMO weather codes into what the sky shows', () => {
    expect([0, 1].map(wxOf)).toEqual(['clear', 'clear']); expect([2, 3].map(wxOf)).toEqual(['cloudy', 'cloudy']); expect([45, 48].map(wxOf)).toEqual(['fog', 'fog']);
    expect([51, 55, 61, 65, 66, 80, 82].map(wxOf).every(w => w === 'rain')).toBe(true); expect([71, 75, 77, 85, 86].map(wxOf).every(w => w === 'snow')).toBe(true);
    expect([95, 96, 99].map(wxOf).every(w => w === 'storm')).toBe(true);
  });
  it('dims the sun, hides stars and birds, and brings clouds in', () => {
    const clear = skyAt(12 * 60), rain = skyAt(12 * 60, { wx: 'rain' });
    expect(rain.sun.o).toBeLessThan(clear.sun.o); expect(rain.birds).toBe(0); expect(rain.cloud.o).toBeGreaterThan(clear.cloud.o); expect(rain.top).not.toBe(clear.top);
    expect(skyAt(2 * 60, { wx: 'storm' }).stars).toBeLessThan(skyAt(2 * 60).stars); expect(skyAt(12 * 60, { wx: 'clear' })).toEqual(clear);
    expect(skyAt(12 * 60, { wx: 'cloudy' }).birds).toBe(1);
  });
  it('knows every weather the settings offer', () => { expect(WX).toEqual(['clear', 'cloudy', 'fog', 'rain', 'snow', 'storm']); });
});

describe('Interstellar sky: text stays readable (WCAG AA, 4.5:1) at every time of day', () => {
  const block = css.slice(css.indexOf('html[data-theme="interstellar"] {'), css.indexOf('}', css.indexOf('html[data-theme="interstellar"] {')));
  const v = (n: string) => new RegExp('--' + n + ': (#[0-9a-f]{6})', 'i').exec(block)![1];
  const text = v('text'), muted = v('muted'), pm = /--panel: rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(block)!;
  const panel = '#' + [pm[1], pm[2], pm[3]].map(n => (+n).toString(16).padStart(2, '0')).join(''), alpha = +pm[4];
  const card = (under: string) => mix(under, panel, alpha);                              // a card over whatever is behind it
  // The brightest things that can sit behind a card: the sun's core, the moon's face, a cloud, fog, snow
  const bright = ['#fffbe8', '#fbfdff', '#e8f0fa', '#aab6c6', '#ffffff'];
  it('on cards over the sky, the sun, the moon, clouds, fog and snow, at any hour and in any weather', () => {
    for (const wx of [undefined, ...WX]) for (let m = 0; m < 1440; m += 15) {
      const s = skyAt(m, { wx });
      for (const bg of [s.top, s.mid, s.bot, ...bright]) { expect(ratio(text, card(bg)), m + ' text on ' + bg).toBeGreaterThanOrEqual(4.5); expect(ratio(muted, card(bg)), m + ' muted on ' + bg).toBeGreaterThanOrEqual(4.5); }
    }
  });
  it('directly on the sky, every minute of the day in every weather', () => {
    for (const wx of [undefined, ...WX]) for (let m = 0; m < 1440; m += 5) {
      const s = skyAt(m, { wx });
      for (const bg of [s.top, s.mid, s.bot]) { expect(ratio(text, bg), m + ' text on ' + bg).toBeGreaterThanOrEqual(4.5); expect(ratio(muted, bg), m + ' muted on ' + bg).toBeGreaterThanOrEqual(4.5); }
    }
  });
  it('and for early sunrises, late sunsets and each time of year', () => {
    for (const o of [{ rise: 180, set: 1350 }, { rise: 480, set: 960 }]) for (let m = 0; m < 1440; m += 10) {
      const s = skyAt(m, o); for (const bg of [s.top, s.mid, s.bot]) { expect(ratio(text, bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(muted, bg)).toBeGreaterThanOrEqual(4.5); }
    }
  });
  it('for the accent, its button label and the amounts, on the cards', () => {
    for (const bg of ['#0c1220', '#2a5a88', '#7d4727']) for (const c of ['accent', 'good-t', 'spend-t', 'warn-t']) expect(ratio(v(c), card(bg)), c + ' on ' + bg).toBeGreaterThanOrEqual(4.5);
    expect(ratio(v('on-accent'), v('accent'))).toBeGreaterThanOrEqual(4.5);
  });
  it('animates only inside the scene, and the global reduced-motion rule stops all of it', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ animation: none !important; transition: none !important; \} \}/);
    expect(css).toMatch(/@media print \{ html\[data-theme="interstellar"\] #sky \{ display: none; \} \}/);
    const rules = css.split('\n').filter(l => /^\s*html\[data-theme="interstellar"\]/.test(l) && /animation:|transition:/.test(l));
    for (const l of rules) expect(l, l.slice(0, 60)).toMatch(/\.sk-|#sky/);
  });
  it('flashes no faster than once a second, and never fully white', () => {
    const f = /@keyframes sk-flash \{([^}]*\}[^}]*\}[^}]*\}[^}]*\})/.exec(css)![0];
    expect(Math.max(...[...f.matchAll(/opacity: ([\d.]+)/g)].map(m => +m[1]))).toBeLessThanOrEqual(.25);
    expect(/\.sk-flash \{[^}]*animation: sk-flash (\d+)s/.exec(css)![1]).toBe('11');
  });
});

describe('Interstellar sky: choosing a place', () => {
  const ts = readFileSync('app/src/core/sky.ts', 'utf8'), settings = readFileSync('app/src/pages/settings.ts', 'utf8'), conf = readFileSync('app/default.conf.template', 'utf8');
  it('follows the time zone when no place is chosen', async () => {
    const { zonePlace } = await import('../app/src/core/sky');
    const [lat, lon] = zonePlace(new Date(2026, 5, 21));
    expect(lat).toBe(38); expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    const [r, s] = sunToday(lat, lon, new Date(2026, 5, 21)); expect(r).toBeLessThan(s);
    expect(ts).toMatch(/zp = loc \|\| zonePlace\(n\)/);
  });
  it('searches through this server, not another site, and stores the choice on the device only', () => {
    expect(settings).toContain("fetch('/geo?q='"); expect(settings).not.toMatch(/https?:\/\/[a-z-]*open-meteo/);
    expect(settings).toContain("LS.set('skyLoc', { lat: f.lat, lon: f.lon, name: f.name })");
    expect(settings).toContain('data-onclick="App.skyPick(this.dataset.i)"'); expect(settings).toContain('data-onclick="App.skyLocation()"'); expect(settings).toContain('data-onclick="App.skyClear()"');
    const at = conf.indexOf('location = /geo {'), block = conf.slice(at, conf.indexOf('\n    }', at));
    expect(at).toBeGreaterThan(-1);
    for (const x of ['limit_except GET { deny all; }', 'limit_req zone=relay', 'proxy_set_header Cookie ""', 'proxy_set_header Authorization ""', 'geocoding-api.open-meteo.com']) expect(block).toContain(x);
    expect(block).toMatch(/\$arg_q !~/);
  });
  it('shows no weather when live weather cannot be had (nothing stale)', () => { expect(ts).toContain('live = typeof code === \'number\' ? wxOf(code) : null'); expect(ts).toContain('catch (e) { live = null; }'); });
});

describe('Interstellar sky: weather scene', () => {
  const sceneHtml = readFileSync('app/src/core/sky.ts', 'utf8');
  it('layers clouds, rain and snow for depth, and darkens clouds in bad weather', () => {
    for (const c of ['sk-over', 'sk-cloud c', 'sk-rain far', 'sk-rain near', 'sk-snow far', 'sk-snow near', 'sk-mist', 'sk-bolt b1', 'sk-bolt b2']) expect(sceneHtml).toContain(c);
    expect(sceneHtml).toContain('[1, 2, 3, 4, 5, 6, 7].map')
    expect(skyAt(12 * 60, { wx: 'storm' }).cloud.c).not.toBe(skyAt(12 * 60).cloud.c);
    const lumOf = (w?: 'storm' | 'rain' | 'cloudy') => lum(skyAt(12 * 60, { wx: w }).cloud.c);
    expect(lumOf('storm')).toBeLessThan(lumOf('rain')); expect(lumOf('rain')).toBeLessThan(lumOf('cloudy')); expect(lumOf('cloudy')).toBeLessThan(lumOf());
    for (const k of ['.sk-rain.far', '.sk-rain.near', '.sk-snow.far', '.sk-snow.near', '.sk-bolt.b1', '.sk-mist', '.sk-over']) expect(css, k).toContain(k);
  });
  it('keeps motion on the compositor (transform and opacity only) and cheap on a phone', () => {
    const frames = [...css.matchAll(/@keyframes (sk-[\w-]+) \{(.*)\}/g)].filter(m => /interstellar|sk-/.test(m[1]));
    expect(frames.length).toBeGreaterThan(8);
    for (const [, n, body] of frames) expect(body.replace(/transform:[^;]*;|opacity:[^;]*;|[\d.%, ]+\{|\}|\s|from|to/g, ''), n).toBe('');
    expect(css).not.toMatch(/html\[data-theme="interstellar"\][^{]*\.sk-[^{]*\{[^}]*(?<!-)filter:/);
  });
});
