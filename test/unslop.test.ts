import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('app/assets/money.css', 'utf8');

describe('interface polish', () => {
  it('uses sentence-case labels, not uppercase tracked ones', () => {
    expect(css).not.toMatch(/text-transform:\s*uppercase/);
  });
  it('keeps heading weights at 600 or below', () => {
    expect(css).not.toMatch(/font-weight:\s*(650|700|750|800|900)\b/);
  });
  it('has no emoji in the Needs attention rows', () => {
    const src = readFileSync('app/src/pages/overview.ts', 'utf8');
    expect(src).not.toMatch(/<span class="name">[📊📝🏷🔍📅]|<span class="name">⚠️/u);
  });
});
