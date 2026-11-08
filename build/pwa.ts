import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Every cache this app makes starts with this, so a new version can delete the old ones. */
export const CACHE_PREFIX = 'hopscore-';
/** The service worker's file name in the built site. */
export const SW_FILE = 'sw.js';

/**
 * The service worker. `__CACHE__` and `__FILES__` are filled in at build time.
 * - install: caches every file of this version, bypassing the HTTP cache (Pages caches files for
 *   10 minutes, which could pair an old index.html with new chunks). It waits until asked.
 * - activate: deletes the caches of older versions, then controls open pages.
 * - fetch: page loads get the cached index.html; files come from the cache, else the network.
 *   Matching ignores `Vary`: scripts and styles are requested with an Origin header that the
 *   precache requests did not have, so a server answering `Vary: Origin` would otherwise miss.
 *   Other origins, other paths and non-GET requests are left to the browser.
 * It cannot touch localStorage, so an update never changes saved games or players.
 */
export const SW_TEMPLATE = `const CACHE = __CACHE__;
const FILES = __FILES__;
const PREFIX = ${JSON.stringify(CACHE_PREFIX)};

self.addEventListener('install', (event) => {
  const scope = self.registration.scope;
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(FILES.map((file) => new Request(new URL(file, scope).href, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const scope = new URL(self.registration.scope);
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const wanted = request.mode === 'navigate' ? new URL('index.html', scope).href : request;
  event.respondWith(caches.open(CACHE)
    .then((cache) => cache.match(wanted, { ignoreVary: true }))
    .then((hit) => hit || fetch(request)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
`;

/** The URLs to cache, relative to the service worker's scope, from the built files' paths. */
export function precacheList(paths: readonly string[]): string[] {
  return paths
    .map((p) => p.split(sep).join('/'))
    .filter((p) => p !== SW_FILE)
    .sort()
    .map((p) => `./${p}`);
}

/** A short hash of the built files and the worker itself: any change gives a new cache. */
export function cacheVersion(files: readonly { path: string; content: string | Uint8Array }[]): string {
  const hash = createHash('sha256').update(SW_TEMPLATE);
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    if (f.path === SW_FILE) continue;
    hash.update(`\0${f.path}\0`).update(f.content);
  }
  return hash.digest('hex').slice(0, 12);
}

export function serviceWorkerSource(version: string, files: readonly string[]): string {
  return SW_TEMPLATE
    .replace('__CACHE__', JSON.stringify(CACHE_PREFIX + version))
    .replace('__FILES__', JSON.stringify(files));
}

/**
 * Writes `sw.js` into the built site, after Vite has written everything else (`closeBundle`).
 * Build only; after a failed build (no index.html) it does nothing.
 */
export function pwa(): Plugin {
  let outDir = '';
  return {
    name: 'hopscore-pwa',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!outDir || !existsSync(join(outDir, 'index.html'))) return;
      const paths = listFiles(outDir).filter((p) => p !== SW_FILE);
      const version = cacheVersion(paths.map((path) => ({ path, content: readFileSync(join(outDir, path)) })));
      writeFileSync(join(outDir, SW_FILE), serviceWorkerSource(version, precacheList(paths)));
    },
  };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
}
