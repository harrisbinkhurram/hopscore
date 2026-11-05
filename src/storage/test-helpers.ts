import type { StorageLike } from './safe-storage';

/** An in-memory stand-in for `localStorage`. */
export class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** Storage that throws on every call, like Safari private mode with storage blocked. */
export class BlockedStorage implements StorageLike {
  getItem(): string | null {
    throw new DOMException('blocked', 'SecurityError');
  }
  setItem(): void {
    throw new DOMException('blocked', 'SecurityError');
  }
  removeItem(): void {
    throw new DOMException('blocked', 'SecurityError');
  }
}

/** Storage that works until `full` is set, then refuses writes like a full quota. */
export class FillingStorage extends FakeStorage {
  full = false;
  override setItem(key: string, value: string): void {
    if (this.full) throw new DOMException('full', 'QuotaExceededError');
    super.setItem(key, value);
  }
}
