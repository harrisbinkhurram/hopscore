/** The part of the Web Storage API this app uses. `localStorage` fits it; tests pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Key-value storage that never throws. It uses the given storage while that works and falls back
 * to memory for the rest of the session as soon as it does not (blocked or full). Current private
 * browsing modes allow storage and clear it later, so they are not caught here.
 */
export class SafeStorage {
  private backend: StorageLike | null;
  /** Kept for reading after writes stop working: full storage can still be read. */
  private readonly reader: StorageLike | null;
  private readonly memory = new Map<string, string>();
  /** Keys removed in this session, so the read-only fallback does not bring an old value back. */
  private readonly removed = new Set<string>();

  constructor(backend: StorageLike | null | undefined = defaultBackend()) {
    this.reader = backend ?? null;
    this.backend = backend && probe(backend) ? backend : null;
  }

  /** True while values are really saved on the device. */
  get persistent(): boolean {
    return this.backend !== null;
  }

  get(key: string): string | null {
    if (this.backend) {
      try {
        return this.backend.getItem(key);
      } catch {
        this.fallBack();
      }
    }
    if (this.memory.has(key)) return this.memory.get(key)!;
    if (this.removed.has(key)) return null;
    try {
      return this.reader?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    this.removed.delete(key);
    this.memory.set(key, value);
    if (!this.backend) return;
    try {
      this.backend.setItem(key, value);
    } catch {
      this.fallBack();
    }
  }

  remove(key: string): void {
    this.memory.delete(key);
    this.removed.add(key);
    try {
      // Full storage still allows removing: it frees space.
      (this.backend ?? this.reader)?.removeItem(key);
    } catch {
      if (this.backend) this.fallBack();
    }
  }

  private fallBack(): void {
    this.backend = null;
  }
}

const PROBE_KEY = 'hopscore.probe';

function probe(backend: StorageLike): boolean {
  try {
    backend.setItem(PROBE_KEY, '1');
    const ok = backend.getItem(PROBE_KEY) === '1';
    backend.removeItem(PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
}

function defaultBackend(): StorageLike | null {
  try {
    // Reading the property itself throws in some browsers when storage is blocked.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
