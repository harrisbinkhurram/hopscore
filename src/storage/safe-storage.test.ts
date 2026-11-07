import { describe, expect, it } from 'vitest';
import { SafeStorage } from './safe-storage';
import { BlockedStorage, FakeStorage, FillingStorage } from './test-helpers';

describe('SafeStorage', () => {
  it('saves to working storage and leaves no probe key behind', () => {
    const backend = new FakeStorage();
    const storage = new SafeStorage(backend);
    storage.set('k', 'v');
    expect(storage.persistent).toBe(true);
    expect([...backend.items.entries()]).toEqual([['k', 'v']]);
  });

  it('falls back to memory when storage is blocked', () => {
    const storage = new SafeStorage(new BlockedStorage());
    expect(storage.persistent).toBe(false);
    storage.set('k', 'v');
    expect(storage.get('k')).toBe('v');
  });

  it('falls back to memory when storage is already full', () => {
    const backend = new FillingStorage();
    backend.full = true;
    expect(new SafeStorage(backend).persistent).toBe(false);
  });

  it('still reads what was saved when storage is full', () => {
    const backend = new FillingStorage();
    backend.setItem('k', 'saved');
    backend.full = true;
    const storage = new SafeStorage(backend);
    expect(storage.get('k')).toBe('saved');
    storage.set('k', 'new'); // kept for the session only
    expect(storage.get('k')).toBe('new');
    expect(backend.getItem('k')).toBe('saved');
  });

  it('keeps the value in memory when a write fails later', () => {
    const backend = new FillingStorage();
    const storage = new SafeStorage(backend);
    backend.full = true;
    storage.set('k', 'v');
    expect(storage.persistent).toBe(false);
    expect(storage.get('k')).toBe('v');
  });

  it('works with no storage and no window (as in tests)', () => {
    const storage = new SafeStorage();
    expect(storage.persistent).toBe(false);
    expect(storage.get('missing')).toBeNull();
  });

  it('removes a key from working storage', () => {
    const backend = new FakeStorage();
    const storage = new SafeStorage(backend);
    storage.set('k', 'v');
    storage.remove('k');
    expect(storage.get('k')).toBeNull();
    expect(backend.items.has('k')).toBe(false);
  });

  it('really removes a key from full storage, which still allows removing', () => {
    const backend = new FillingStorage();
    backend.setItem('k', 'saved');
    backend.full = true;
    new SafeStorage(backend).remove('k');
    expect(backend.getItem('k')).toBeNull();
  });

  it('does not read a removed key back from full storage', () => {
    const backend = new FillingStorage();
    backend.setItem('k', 'saved');
    backend.full = true;
    const storage = new SafeStorage(backend);
    storage.remove('k');
    expect(storage.get('k')).toBeNull();
    storage.set('k', 'again');
    expect(storage.get('k')).toBe('again');
  });

  it('never throws when removing from blocked storage', () => {
    const storage = new SafeStorage(new BlockedStorage());
    expect(() => storage.remove('k')).not.toThrow();
  });
});
