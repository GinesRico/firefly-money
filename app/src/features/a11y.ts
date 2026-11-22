import { el } from '../core/base';
import { closeDrawer } from '../core/dom';

/* ---------- Accessibility glue: current page/tab marked for screen readers, keyboard on clickable rows, skip link, Menu sheet ---------- */

// The highlighted nav item / tab / segmented button is also announced: .on becomes aria-current, and a segmented
// button gets aria-pressed. Done in one place, after the markup changes, so no page has to remember it.
let queued = false;
export function syncCurrent() {
  queued = false;
  document.querySelectorAll<HTMLElement>('.nav a, .tabbar a, .tabs a').forEach(a => {
    if (a.classList.contains('on')) { if (a.getAttribute('aria-current') !== 'page') a.setAttribute('aria-current', 'page'); }
    else if (a.hasAttribute('aria-current')) a.removeAttribute('aria-current');
  });
  document.querySelectorAll<HTMLElement>('.seg button').forEach(b => {
    if (b.hasAttribute('role') || b.hasAttribute('aria-haspopup')) return;
    const v = b.classList.contains('on') ? 'true' : 'false'; if (b.getAttribute('aria-pressed') !== v) b.setAttribute('aria-pressed', v);
  });
}
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(syncCurrent); } };
new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
queue();

// A focused clickable table row (accounts, recurring…) opens with Enter or Space, like a button. (Transaction rows
// have their own handler in keyboard.ts, because they open the edit drawer.)
document.addEventListener('keydown', e => {
  const t = e.target;
  if (!(t instanceof HTMLElement) || !t.matches('tr.click[tabindex]:not([data-gid])') || (e.key !== 'Enter' && e.key !== ' ') || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault(); t.click();
});

// Back from a page the Menu sheet linked to must not leave the sheet open on top of the previous page
addEventListener('hashchange', () => {
  const d = el('drawer');
  if (d.classList.contains('open') && d.querySelector('.sheet-search')) closeDrawer();
});

// Skip link: jump past the sidebar to the page. (A plain #view link would be read as a route by the router.)
document.addEventListener('click', e => {
  const a = e.target instanceof Element ? e.target.closest('a.skip') : null; if (!a) return;
  e.preventDefault(); el('view').focus({ preventScroll: false });
});
