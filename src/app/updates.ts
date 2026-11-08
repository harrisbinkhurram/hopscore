/** The parts of a service worker this file uses. */
export interface WorkerLike {
  readonly state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

/** The parts of a `ServiceWorkerRegistration` this file uses. */
export interface RegistrationLike {
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
  update(): Promise<unknown>;
}

/** The parts of `navigator.serviceWorker` this file uses. */
export interface WorkerContainerLike {
  readonly controller: unknown;
  register(url: string, options: { scope: string }): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface Updates {
  /** A new version is downloaded and waits: `apply()` switches to it. */
  readonly ready: boolean;
  /** Another tab switched this page to a new version while it runs the old code: reload when safe. */
  readonly reloadNeeded: boolean;
  /** Switches to the waiting version; the page reloads once it has taken over. */
  apply(): void;
  /** Asks the browser to look for a new version now (an installed app may not load a page for days). */
  check(): void;
}

/**
 * Registers the service worker and reports new versions through `onChange`. The first install is
 * not an update: it only counts when a worker already controlled the page. Registration failures
 * are ignored: the app works without the service worker.
 */
export function watchForUpdates(
  container: WorkerContainerLike,
  url: string,
  scope: string,
  onChange: () => void,
  reload: () => void,
): Updates {
  let registration: RegistrationLike | null = null;
  let ready = false;
  let reloadNeeded = false;
  let asked = false;
  let controlled = container.controller != null;

  const markReady = () => {
    if (ready || container.controller == null) return;
    ready = true;
    onChange();
  };

  container.addEventListener('controllerchange', () => {
    if (asked) return reload();
    // The first install takes control of the page too; that is not a new version.
    if (controlled && !reloadNeeded) {
      reloadNeeded = true;
      onChange();
    }
    controlled = true;
  });

  container.register(url, { scope }).then((reg) => {
    registration = reg;
    if (reg.waiting) markReady();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') markReady();
      });
    });
  }).catch(() => {});

  return {
    get ready() {
      return ready;
    },
    get reloadNeeded() {
      return reloadNeeded;
    },
    apply() {
      const waiting = registration?.waiting;
      if (!waiting) return;
      asked = true;
      waiting.postMessage('skip-waiting');
    },
    check() {
      registration?.update().catch(() => {});
    },
  };
}
