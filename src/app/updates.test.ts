import { describe, expect, it, vi } from 'vitest';
import { watchForUpdates, type RegistrationLike, type WorkerContainerLike, type WorkerLike } from './updates';

class FakeWorker implements WorkerLike {
  state = 'installing';
  readonly messages: unknown[] = [];
  private listener: (() => void) | null = null;
  postMessage(message: unknown) {
    this.messages.push(message);
  }
  addEventListener(_type: 'statechange', listener: () => void) {
    this.listener = listener;
  }
  become(state: string) {
    this.state = state;
    this.listener?.();
  }
}

function setup(options: { controller?: boolean; waiting?: boolean; fail?: boolean } = {}) {
  const waiting = options.waiting ? new FakeWorker() : null;
  let onUpdateFound: (() => void) | null = null;
  const registration = {
    waiting: waiting as WorkerLike | null,
    installing: null as WorkerLike | null,
    addEventListener: (_type: 'updatefound', listener: () => void) => {
      onUpdateFound = listener;
    },
    update: vi.fn(async () => {}),
  } satisfies RegistrationLike;
  let onControllerChange: (() => void) | null = null;
  const container = {
    controller: options.controller ? {} : null,
    register: vi.fn(async () => {
      if (options.fail) throw new Error('blocked');
      return registration;
    }),
    addEventListener: (_type: 'controllerchange', listener: () => void) => {
      onControllerChange = listener;
    },
  } satisfies WorkerContainerLike;
  const onChange = vi.fn();
  const reload = vi.fn();
  const updates = watchForUpdates(container, '/hopscore/sw.js', '/hopscore/', onChange, reload);
  return {
    updates,
    registration,
    container,
    onChange,
    reload,
    waiting,
    /** A new version is found later and finishes installing. */
    newVersion() {
      const worker = new FakeWorker();
      registration.installing = worker;
      onUpdateFound!();
      worker.become('installed');
      registration.installing = null;
      registration.waiting = worker;
      return worker;
    },
    takeOver() {
      container.controller = {};
      onControllerChange!();
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('watchForUpdates', () => {
  it('registers the worker under the app path', async () => {
    const t = setup();
    await settle();
    expect(t.container.register).toHaveBeenCalledWith('/hopscore/sw.js', { scope: '/hopscore/' });
  });

  it('does not report the first install as an update', async () => {
    const t = setup();
    await settle();
    t.newVersion();
    t.takeOver();
    expect(t.updates.ready).toBe(false);
    expect(t.updates.reloadNeeded).toBe(false);
    expect(t.onChange).not.toHaveBeenCalled();
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('reports a version already waiting when the page opens', async () => {
    const t = setup({ controller: true, waiting: true });
    await settle();
    expect(t.updates.ready).toBe(true);
    expect(t.onChange).toHaveBeenCalledTimes(1);
  });

  it('reports a version found later, once it has installed', async () => {
    const t = setup({ controller: true });
    await settle();
    expect(t.updates.ready).toBe(false);
    t.newVersion();
    expect(t.updates.ready).toBe(true);
    expect(t.onChange).toHaveBeenCalledTimes(1);
  });

  it('switches only when asked, then reloads once the new version has taken over', async () => {
    const t = setup({ controller: true });
    await settle();
    const worker = t.newVersion() as FakeWorker;
    expect(worker.messages).toEqual([]);
    t.updates.apply();
    expect(worker.messages).toEqual(['skip-waiting']);
    expect(t.reload).not.toHaveBeenCalled();
    t.takeOver();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('asks a page switched by another tab to reload when it is safe, without reloading it', async () => {
    const t = setup({ controller: true });
    await settle();
    t.takeOver();
    expect(t.updates.reloadNeeded).toBe(true);
    expect(t.onChange).toHaveBeenCalledTimes(1);
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('looks for a new version when asked to check', async () => {
    const t = setup({ controller: true });
    await settle();
    t.updates.check();
    expect(t.registration.update).toHaveBeenCalledTimes(1);
  });

  it('keeps working when registration fails', async () => {
    const t = setup({ controller: true, fail: true });
    await settle();
    t.updates.apply();
    t.updates.check();
    expect(t.updates.ready).toBe(false);
    expect(t.onChange).not.toHaveBeenCalled();
  });
});
