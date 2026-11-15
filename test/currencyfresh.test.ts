import { afterEach, describe, expect, it, vi } from 'vitest';

// Enabling a currency (Settings, or in Firefly itself) must show up in the account Currency picker at once,
// not after the out-of-date saved list has been shown first
describe('currency list is never the saved copy', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('getAll(fresh) skips an out-of-date saved answer', async () => {
    vi.stubGlobal('location', { origin: 'http://x', href: 'http://x/', hash: '' });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('dispatchEvent', () => true);
    let enabled = false;
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify({ data: [
      { id: '1', attributes: { code: 'USD', enabled: true } }, { id: '2', attributes: { code: 'INR', enabled } }] }), { status: 200 })));
    const { api, getAll, clearCache } = await import('../app/src/core/api');
    const { S } = await import('../app/src/core/base');
    await getAll('/currencies');            // saved while INR was off
    enabled = true; clearCache(); S.swr = true;
    const stale = await getAll('/currencies');
    expect(stale[1].attributes.enabled).toBe(false);   // the saved answer is what the page shows first
    const fresh = await getAll('/currencies', {}, true);
    expect(fresh[1].attributes.enabled).toBe(true);
    expect(typeof api).toBe('function');
  });
  it('lists() asks for currencies fresh', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('app/src/core/lists.ts', 'utf8')).toMatch(/getAll\('\/currencies', \{\}, true\)/);
  });
});
