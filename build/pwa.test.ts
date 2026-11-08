import { describe, expect, it, vi } from 'vitest';
import { cacheVersion, precacheList, serviceWorkerSource } from './pwa';

const SCOPE = 'https://example.github.io/hopscore/';

describe('precacheList', () => {
  it('lists every built file relative to the scope, without the service worker', () => {
    const list = precacheList(['index.html', 'sw.js', 'assets/index-a1.js', 'assets/board-b2.js', 'icons/icon-192.png']);
    expect(list).toEqual(['./assets/board-b2.js', './assets/index-a1.js', './icons/icon-192.png', './index.html']);
  });
});

describe('cacheVersion', () => {
  const files = [
    { path: 'index.html', content: '<html>' },
    { path: 'assets/index-a1.js', content: 'console.log(1)' },
  ];

  it('is the same for the same files in any order', () => {
    expect(cacheVersion(files)).toBe(cacheVersion([...files].reverse()));
  });

  it('changes when a file changes or is added', () => {
    const v = cacheVersion(files);
    expect(cacheVersion([files[0], { path: 'assets/index-a1.js', content: 'console.log(2)' }])).not.toBe(v);
    expect(cacheVersion([...files, { path: 'favicon.svg', content: '<svg/>' }])).not.toBe(v);
  });

  it('ignores an old sw.js left in the folder', () => {
    expect(cacheVersion([...files, { path: 'sw.js', content: 'old' }])).toBe(cacheVersion(files));
  });
});

describe('serviceWorkerSource', () => {
  it('names the cache after the version and lists the files', () => {
    const source = serviceWorkerSource('abc123', ['./index.html']);
    expect(source).toContain('"hopscore-abc123"');
    expect(source).toContain('["./index.html"]');
    expect(source).not.toContain('__CACHE__');
    expect(source).not.toContain('__FILES__');
  });
});

/** Runs the generated worker against stand-ins for the browser's service worker globals. */
function runWorker(files: string[], version = 'new') {
  const listeners = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, Map<string, string>>();
  const added: { url: string; cache: string }[] = [];
  const matchOptions: { ignoreVary?: boolean }[] = [];

  class FakeRequest {
    constructor(readonly url: string, readonly init: { cache?: string } = {}) {}
  }
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      async addAll(requests: FakeRequest[]) {
        for (const r of requests) {
          added.push({ url: r.url, cache: r.init.cache ?? 'default' });
          store.set(r.url, `cached ${r.url}`);
        }
      },
      async match(request: string | { url: string }, options: { ignoreVary?: boolean } = {}) {
        matchOptions.push(options);
        return store.get(typeof request === 'string' ? request : request.url);
      },
    };
  };
  const caches = {
    open: async (name: string) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    registration: { scope: SCOPE },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
  };
  const fetch = vi.fn(async (request: { url: string }) => `network ${request.url}`);

  new Function('self', 'caches', 'fetch', 'Request', serviceWorkerSource(version, files))(self, caches, fetch, FakeRequest);

  /** Fires an event that may call waitUntil; resolves when its work is done. */
  const lifecycle = async (type: string) => {
    let work: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({ waitUntil: (p: Promise<unknown>) => { work = p; } });
    await work;
  };
  /** Fires a fetch; resolves to the response, or null when the worker left it to the browser. */
  const request = async (url: string, init: { method?: string; mode?: string } = {}) => {
    let response: Promise<unknown> | null = null;
    listeners.get('fetch')!({
      request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' },
      respondWith: (p: Promise<unknown>) => { response = p; },
    });
    return response === null ? null : await response;
  };
  return { listeners, stores, added, matchOptions, self, fetch, lifecycle, request };
}

describe('the generated service worker', () => {
  const files = ['./assets/index-a1.js', './index.html'];

  it('caches every file of its version, bypassing the HTTP cache', async () => {
    const sw = runWorker(files);
    await sw.lifecycle('install');
    expect(sw.added).toEqual([
      { url: `${SCOPE}assets/index-a1.js`, cache: 'reload' },
      { url: `${SCOPE}index.html`, cache: 'reload' },
    ]);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('on activate deletes older Hopscore caches, keeps other caches, and takes control', async () => {
    const sw = runWorker(files);
    sw.stores.set('hopscore-old', new Map());
    sw.stores.set('someone-else', new Map());
    await sw.lifecycle('install');
    await sw.lifecycle('activate');
    expect([...sw.stores.keys()].sort()).toEqual(['hopscore-new', 'someone-else']);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('answers page loads with the cached index.html, whatever the query', async () => {
    const sw = runWorker(files);
    await sw.lifecycle('install');
    expect(await sw.request(SCOPE, { mode: 'navigate' })).toBe(`cached ${SCOPE}index.html`);
    expect(await sw.request(`${SCOPE}?board`, { mode: 'navigate' })).toBe(`cached ${SCOPE}index.html`);
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it('serves cached files from the cache and anything else from the network', async () => {
    const sw = runWorker(files);
    await sw.lifecycle('install');
    expect(await sw.request(`${SCOPE}assets/index-a1.js`)).toBe(`cached ${SCOPE}assets/index-a1.js`);
    expect(await sw.request(`${SCOPE}assets/missing.js`)).toBe(`network ${SCOPE}assets/missing.js`);
  });

  it('ignores Vary when matching, so a script requested with an Origin header still hits', async () => {
    const sw = runWorker(files);
    await sw.lifecycle('install');
    await sw.request(`${SCOPE}assets/index-a1.js`);
    expect(sw.matchOptions).toEqual([{ ignoreVary: true }]);
  });

  it('leaves other origins, other paths and non-GET requests to the browser', async () => {
    const sw = runWorker(files);
    await sw.lifecycle('install');
    expect(await sw.request('https://fonts.example.com/a.css')).toBeNull();
    expect(await sw.request('https://example.github.io/other/index.html', { mode: 'navigate' })).toBeNull();
    expect(await sw.request(`${SCOPE}index.html`, { method: 'POST' })).toBeNull();
  });

  it('takes over only when asked', () => {
    const sw = runWorker(files);
    sw.listeners.get('message')!({ data: 'something else' });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.listeners.get('message')!({ data: 'skip-waiting' });
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });
});
