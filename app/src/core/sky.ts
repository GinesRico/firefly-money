/* Interstellar theme: a sky that follows the clock. Pure maths in skyAt(); syncSky() lays it on <html> as CSS variables
   once a minute, and only while the theme is on. No imports: boot.js bundles this file too. */
const H = 60, RISE = 6 * H, SET = 18 * H;
// Minute of day → [top, middle, horizon]. Every stop stays dark enough for the theme's light text (test/sky.test.ts).
export const KEYS: [number, string, string, string][] = [
  [0, '#04060a', '#080c14', '#0e131c'], [5 * H, '#070a11', '#101722', '#1d1b1d'], [RISE, '#101827', '#2a2a3a', '#5a3a22'],
  [7.5 * H, '#17243a', '#26384f', '#38485a'], [12 * H, '#1a2b40', '#27405a', '#36475b'], [16.5 * H, '#1a2b40', '#2a3e56', '#394658'],
  [SET, '#121a2b', '#34303f', '#5e3a1e'], [19.5 * H, '#090d16', '#151826', '#2a1f1c'], [21 * H, '#05070c', '#090d15', '#10151d'], [24 * H, '#04060a', '#080c14', '#0e131c'],
];
const hex = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
export const mix = (a: string, b: string, t: number) => '#' + [0, 1, 2].map(i => Math.round(hex(a, i) + (hex(b, i) - hex(a, i)) * t).toString(16).padStart(2, '0')).join('');
export type Sky = { phase: 'dawn' | 'day' | 'dusk' | 'night', top: string, mid: string, bot: string, sun: { x: number, y: number, o: number, c: string }, moon: { x: number, y: number, o: number }, stars: number };
const r1 = (n: number) => Math.round(n * 10) / 10;
// Where a body is on its arc: x runs left to right across the sky, y peaks at 20% down and sits on the horizon (74%) at both ends
const arc = (t: number) => ({ x: r1(6 + 88 * t), y: r1(74 - 54 * Math.sin(Math.PI * t)) });
const fade = (t: number) => r1(Math.max(0, Math.min(1, Math.min(t, 1 - t) / .06)));
export function skyAt(min: number): Sky {
  const m = ((min % 1440) + 1440) % 1440;
  let i = KEYS.length - 2; while (i > 0 && KEYS[i][0] > m) i--;
  const a = KEYS[i], b = KEYS[i + 1], t = (m - a[0]) / (b[0] - a[0]);
  const ts = (m - RISE) / (SET - RISE), tm = ((m - SET + 1440) % 1440) / 720;       // 0..1 across the day, and across the night
  const up = ts >= 0 && ts <= 1, nightUp = tm <= 1;
  const phase = m >= 5 * H && m < 7 * H ? 'dawn' : m >= 7 * H && m < 17 * H ? 'day' : m >= 17 * H && m < 19 * H ? 'dusk' : 'night';
  const low = 1 - Math.sin(Math.PI * Math.max(0, Math.min(1, ts)));                    // 1 at the horizon, 0 at noon
  return {
    phase, top: mix(a[1], b[1], t), mid: mix(a[2], b[2], t), bot: mix(a[3], b[3], t),
    sun: { ...arc(Math.max(0, Math.min(1, ts))), o: up ? fade(ts) : 0, c: mix('#e8a23c', '#ffcf8a', 1 - low) },
    moon: { ...arc(Math.min(1, tm)), o: nightUp ? fade(tm) : 0 },
    stars: r1(Math.max(0, Math.min(1, (m < 4 * H || m >= 20 * H ? 1 : m < 6 * H ? (6 * H - m) / 120 : m >= 18 * H ? (m - 18 * H) / 120 : 0)))) };
}
const NAMES = ['--sky-top', '--sky-mid', '--sky-bot', '--sun-x', '--sun-y', '--sun-o', '--sun-c', '--moon-x', '--moon-y', '--moon-o', '--star-o'];
export function paintSky(min: number, d: HTMLElement = document.documentElement) {
  const s = skyAt(min), v = [s.top, s.mid, s.bot, s.sun.x, s.sun.y, s.sun.o, s.sun.c, s.moon.x, s.moon.y, s.moon.o, s.stars];
  NAMES.forEach((n, i) => d.style.setProperty(n, String(v[i]))); d.setAttribute('data-sky', s.phase);
}
let timer = 0;
export function syncSky() {
  const d = document.documentElement, on = d.getAttribute('data-theme') === 'interstellar';
  clearInterval(timer); timer = 0;
  if (!on) { NAMES.forEach(n => d.style.removeProperty(n)); d.removeAttribute('data-sky'); return; }
  const tick = () => { const n = new Date(); paintSky(n.getHours() * H + n.getMinutes()); };
  tick(); timer = window.setInterval(tick, 60000);
}
// Any way the theme changes (picker, palette, boot) goes through the attribute
if (typeof MutationObserver !== 'undefined') new MutationObserver(syncSky).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) syncSky(); });   // catch up after the tab slept
syncSky();
