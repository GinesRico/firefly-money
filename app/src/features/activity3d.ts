import { html, raw } from '../core/html';
import { App } from '../core/base';
import { openDrawer } from '../core/dom';

/* ---------- Activity in 3D: tap the Activity grid and a drawer slides in with the same days as a skyline ----------
   Built from the card's own cells (no new request, so nothing shows when the card has nothing to show). A taller bar is more spent;
   a bar opens that day's purchases. Wide ranges show their latest weeks so the bars stay readable. */
export const AG3_MAX = 53;
export const ag3Fit = (width: number) => Math.max(18, Math.min(AG3_MAX, Math.floor(width / 9)));
// The cells for the last `maxCols` week columns (the cells are in week order, 7 to a column, blank cells first), drill links moved to where the page handles them
export function ag3Cells(cells: Element[], maxCols: number) {
  const cols = Math.ceil(cells.length / 7), skip = Math.max(0, cols - maxCols) * 7;
  return { html: cells.slice(skip).map(c => c.outerHTML.replace(' data-d=', ' data-onclick="App.closeDrawer()" data-go=')).join(''), cols: Math.min(cols, maxCols), cut: skip > 0 };
}
// The grid's transform scale so the tilted skyline fits the stage (its width and height after tilting)
export function ag3Scale(cols: number, cell: number, gap: number, w: number, h: number, zmax = 36) {
  const W = cols * (cell + gap), H = 7 * (cell + gap), cz = Math.cos(40 * Math.PI / 180), sz = Math.sin(40 * Math.PI / 180), sx = Math.sin(58 * Math.PI / 180), cx = Math.cos(58 * Math.PI / 180);
  const pw = W * cz + H * sz, ph = (W * sz + H * cz) * sx + zmax * cx;
  return Math.min(1.6, w / pw, h / ph);
}
function open3d(src: HTMLElement) {
  const card = src.closest<HTMLElement>('.ag-card'), grid = card && card.querySelector<HTMLElement>('.ag-grid');
  if (!grid) return;
  const w = Math.min(520, innerWidth) - 56, g = ag3Cells([...grid.children], ag3Fit(w));
  const label = grid.getAttribute('aria-label') || '';
  openDrawer('Activity', html`<p class="sub-s ag3-cap">Taller means more spent${g.cut ? ' · latest ' + g.cols + ' weeks' : ''} · tap a day to see it</p><div class="ag3-stage" role="img" aria-label="${label}"><div class="ag3-grid" style="--cols:${g.cols}">${raw(g.html)}</div></div><div class="ag3-key" aria-hidden="true"><span>Less</span><i class="ag-c l0"></i><i class="ag-c l1"></i><i class="ag-c l2"></i><i class="ag-c l3"></i><i class="ag-c l4"></i><span>More</span></div>`);
  const stage = document.querySelector<HTMLElement>('#drawer .ag3-stage'), gr = stage && stage.querySelector<HTMLElement>('.ag3-grid');
  if (!stage || !gr) return;
  const fit = () => { stage.style.setProperty('--s', String(ag3Scale(g.cols, 14, 3, stage.clientWidth || w, stage.clientHeight || 300).toFixed(3))); };
  fit();
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('on')));
}
const methods = { activity3d: open3d };
Object.assign(App, methods);
type Methods = typeof methods;
declare module '../core/base' { interface AppApi extends Methods {} }
