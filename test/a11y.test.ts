import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const index = readFileSync('app/index.html', 'utf8');
const css = readFileSync('app/assets/money.css', 'utf8');
const src = (f: string) => readFileSync('app/src/' + f, 'utf8');

describe('keyboard and screen reader basics', () => {
  it('has a skip link to the page, and the page can take focus', () => {
    expect(index).toContain('<a href="#view" class="skip">Skip to content</a>');
    expect(index).toContain('<main id="view" tabindex="-1">');
    expect(src('features/a11y.ts')).toContain("closest('a.skip')");     // handled in script: a #view link would be a route
    expect(css).toMatch(/\.skip:focus \{ top:/);
  });
  it('accounts and recurring rows are reachable and open from the keyboard', () => {
    expect(src('pages/accounts.ts')).toContain('<tr class="click" tabindex="0" role="link"');
    expect(src('pages/recurring.ts')).toContain('<tr class="click" tabindex="0" role="button"');
    expect(src('features/a11y.ts')).toContain("tr.click[tabindex]:not([data-gid])");
  });
  it('the current page, tab and segment are announced', () => {
    const a = src('features/a11y.ts');
    expect(a).toContain("'.nav a, .tabbar a, .tabs a'");
    expect(a).toContain("setAttribute('aria-current', 'page')");
    expect(a).toContain("setAttribute('aria-pressed'");
  });
  it('the search is a combobox that follows the highlighted result and gives focus back', () => {
    expect(index).toMatch(/id="palQ"[^>]*role="combobox"[^>]*aria-expanded="true"[^>]*aria-controls="palList"/);
    const p = src('features/palette.ts');
    expect(p).toContain('aria-selected="${i === palIdx');
    expect(p).toContain("setAttribute('aria-activedescendant'");
    expect(p).toContain('palOpener.focus(');
    expect(css).toMatch(/data-theme="glass"\] \.palette-box \{ background: var\(--glass\), rgba\(14, 11, 30, \.94\)/);
  });
  it('page headings do not skip a level', () => {
    expect(src('features/pageopts.ts')).not.toContain('<h3 class="set-h">');
    expect(src('core/dom.ts')).not.toMatch(/es-ic[^\n]*<h3>/);
  });
  it('the delete undo lasts 10 s, pauses while hovered or focused, and error toasts scale with length', () => {
    const d = src('features/polish.ts');
    expect(d).toContain('const UNDO_MS = 10000');
    expect(d).toContain("addEventListener('focusin', hold)");
    expect(css).toContain('animation: drain 10s linear forwards');
    expect(css).toContain('.undo.held .bar { animation-play-state: paused; }');
    expect(src('core/dom.ts')).toContain('2600 + msg.length * 60');
  });
  it('a failed page shows the server message, not JavaScript error text, and is announced', () => {
    const r = src('core/router.ts');
    expect(r).toContain('role="alert"><strong>Couldn’t load this page.');
    expect(r).toContain("'Something went wrong while showing this page.'");
    expect(r).not.toContain('${(e as Error).message}<br>');
  });
  it('the Menu sheet closes when the page changes (Back)', () => {
    expect(src('features/a11y.ts')).toMatch(/hashchange[\s\S]*sheet-search[\s\S]*closeDrawer/);
  });
});
