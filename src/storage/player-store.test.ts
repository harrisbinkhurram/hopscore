import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUNNY_COLOURS } from './colours';
import { createPlayerStore, PLAYERS_KEY, type Result } from './player-store';
import { BlockedStorage, FakeStorage, FillingStorage } from './test-helpers';
import { CURRENT_VERSION } from './types';

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.value;
}

function error<T>(result: Result<T>): string {
  if (result.ok) throw new Error('expected an error');
  return result.error;
}

function storeWithPlayers(backend: FakeStorage, ...names: string[]) {
  const store = createPlayerStore(backend);
  const ids = names.map((n) => value(store.addPlayer(n)).id);
  return { store, ids };
}

describe('players: saving and loading', () => {
  it('saves a new player with a version number', () => {
    const backend = new FakeStorage();
    const store = createPlayerStore(backend);
    const alice = value(store.addPlayer('  Alice '));

    expect(alice.name).toBe('Alice');
    const saved = JSON.parse(backend.getItem(PLAYERS_KEY)!);
    expect(saved.version).toBe(CURRENT_VERSION);
    expect(createPlayerStore(backend).players()).toEqual([alice]);
  });

  it('remembers renames, recolours and deletes', () => {
    const backend = new FakeStorage();
    const { store, ids } = storeWithPlayers(backend, 'Alice', 'Bob');

    value(store.renamePlayer(ids[0], 'Ali'));
    value(store.recolourPlayer(ids[0], 'lilac'));
    store.deletePlayer(ids[1]);

    const reloaded = createPlayerStore(backend).players();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({ id: ids[0], name: 'Ali', colour: 'lilac' });
  });

  it('gives each new player a colour nobody has yet', () => {
    const { store } = storeWithPlayers(new FakeStorage(), 'A', 'B', 'C');
    const colours = store.players().map((p) => p.colour);
    expect(new Set(colours).size).toBe(3);
  });

  it('reuses the least used colour once all are taken', () => {
    const names = BUNNY_COLOURS.map((_, i) => `P${i}`);
    const { store } = storeWithPlayers(new FakeStorage(), ...names, 'Extra');
    const extra = store.players().find((p) => p.name === 'Extra')!;
    expect(extra.colour).toBe(BUNNY_COLOURS[0].id);
  });

  it('starts empty, and keeps working, when the saved text is not JSON', () => {
    const backend = new FakeStorage();
    backend.setItem(PLAYERS_KEY, '{not json');
    const store = createPlayerStore(backend);
    expect(store.players()).toEqual([]);
    value(store.addPlayer('Alice'));
    expect(createPlayerStore(backend).players()).toHaveLength(1);
  });
});

describe('players: rules', () => {
  it('rejects empty, too long and duplicate names', () => {
    const { store, ids } = storeWithPlayers(new FakeStorage(), 'Alice', 'Bob');
    expect(error(store.addPlayer('   '))).toMatch(/name/i);
    expect(error(store.addPlayer('x'.repeat(21)))).toMatch(/20/);
    expect(error(store.addPlayer('alice'))).toMatch(/already/);
    expect(error(store.renamePlayer(ids[1], 'ALICE'))).toMatch(/already/);
    expect(value(store.renamePlayer(ids[0], 'alice')).name).toBe('alice'); // own name, new case
  });

  it('rejects unknown colours and unknown players', () => {
    const { store, ids } = storeWithPlayers(new FakeStorage(), 'Alice');
    expect(error(store.recolourPlayer(ids[0], 'neon'))).toMatch(/colour/);
    expect(error(store.addPlayer('Bob', 'neon'))).toMatch(/colour/);
    expect(error(store.renamePlayer('nope', 'Zed'))).toMatch(/gone/);
  });
});

describe('players: recently used first', () => {
  it('orders by last used, then by name', () => {
    const { store, ids } = storeWithPlayers(new FakeStorage(), 'Cara', 'Alice', 'Bob', 'Dan');
    expect(store.players().map((p) => p.name)).toEqual(['Alice', 'Bob', 'Cara', 'Dan']);

    store.markUsed([ids[3]], 1000); // Dan
    store.markUsed([ids[0], ids[2]], 2000); // Cara, Bob
    expect(store.players().map((p) => p.name)).toEqual(['Bob', 'Cara', 'Dan', 'Alice']);
  });

  it('remembers the order after a reload', () => {
    const backend = new FakeStorage();
    const { store, ids } = storeWithPlayers(backend, 'Alice', 'Bob');
    store.markUsed([ids[1]], 50);
    expect(createPlayerStore(backend).players()[0].name).toBe('Bob');
  });
});

describe('groups', () => {
  it('creates, edits and deletes groups, and saves each change', () => {
    const backend = new FakeStorage();
    const { store, ids } = storeWithPlayers(backend, 'A', 'B', 'C', 'D');

    const crew = value(store.createGroup(' Friday  crew ', ids.slice(0, 3)));
    expect(crew).toMatchObject({ name: 'Friday crew', playerIds: ids.slice(0, 3) });
    expect(createPlayerStore(backend).groups()).toEqual([crew]);

    value(store.updateGroup(crew.id, { name: 'Weekend', playerIds: ids }));
    expect(createPlayerStore(backend).groups()[0]).toMatchObject({ name: 'Weekend', playerIds: ids });

    store.deleteGroup(crew.id);
    expect(createPlayerStore(backend).groups()).toEqual([]);
  });

  it('needs a unique name and 3 to 6 known players', () => {
    const { store, ids } = storeWithPlayers(new FakeStorage(), 'A', 'B', 'C', 'D', 'E', 'F', 'G');
    expect(error(store.createGroup('', ids.slice(0, 3)))).toMatch(/name/);
    expect(error(store.createGroup('Two', ids.slice(0, 2)))).toMatch(/3 to 6/);
    expect(error(store.createGroup('Seven', ids))).toMatch(/3 to 6/);
    expect(error(store.createGroup('Ghosts', [ids[0], ids[1], 'ghost']))).toMatch(/3 to 6/);
    expect(error(store.createGroup('Dupes', [ids[0], ids[0], ids[1]]))).toMatch(/3 to 6/);

    value(store.createGroup('Crew', ids.slice(0, 3)));
    expect(error(store.createGroup('crew', ids.slice(3, 6)))).toMatch(/already/);
  });

  it('removes a deleted player from every group, and keeps the group', () => {
    const backend = new FakeStorage();
    const { store, ids } = storeWithPlayers(backend, 'A', 'B', 'C');
    const crew = value(store.createGroup('Crew', ids));

    store.deletePlayer(ids[1]);
    const after = createPlayerStore(backend).groups();
    expect(after).toEqual([{ ...crew, playerIds: [ids[0], ids[2]] }]);
  });
});

describe('storage blocked or failing', () => {
  it('works for the session when storage throws on every call', () => {
    const store = createPlayerStore(new BlockedStorage());
    expect(store.persistent).toBe(false);
    expect(store.notSavedReason).toBe('storage-off');

    const alice = value(store.addPlayer('Alice'));
    value(store.renamePlayer(alice.id, 'Ali'));
    expect(store.players().map((p) => p.name)).toEqual(['Ali']);
  });

  it('works in memory when there is no storage at all', () => {
    const store = createPlayerStore(null);
    expect(store.persistent).toBe(false);
    value(store.addPlayer('Alice'));
    expect(store.players()).toHaveLength(1);
  });

  it('switches to memory and tells listeners when storage fills up', () => {
    const backend = new FillingStorage();
    const store = createPlayerStore(backend);
    value(store.addPlayer('Alice'));
    expect(store.persistent).toBe(true);

    let calls = 0;
    store.subscribe(() => calls++);
    backend.full = true;
    value(store.addPlayer('Bob'));

    expect(store.persistent).toBe(false);
    expect(calls).toBe(1);
    expect(store.players()).toHaveLength(2); // the change is kept in memory
  });

  it('still loads saved players when storage is already full at start', () => {
    const backend = new FillingStorage();
    value(createPlayerStore(backend).addPlayer('Alice'));
    backend.full = true;

    const store = createPlayerStore(backend);
    expect(store.persistent).toBe(false);
    expect(store.players().map((p) => p.name)).toEqual(['Alice']);
  });

  it('does not write over data saved by a newer version of the app', () => {
    const backend = new FakeStorage();
    const newer = JSON.stringify({
      version: CURRENT_VERSION + 1,
      players: [{ id: 'a', name: 'Alice', colour: 'sky', lastUsedAt: 0, mood: 'happy' }],
      groups: [],
    });
    backend.setItem(PLAYERS_KEY, newer);

    const store = createPlayerStore(backend);
    expect(store.persistent).toBe(false);
    expect(store.notSavedReason).toBe('kept-safe');
    expect(store.players().map((p) => p.name)).toEqual(['Alice']);
    value(store.addPlayer('Bob'));

    expect(backend.getItem(PLAYERS_KEY)).toBe(newer);
  });
});

describe('subscribe', () => {
  it('calls listeners after each change until unsubscribed', () => {
    const store = createPlayerStore(new FakeStorage());
    let calls = 0;
    const stop = store.subscribe(() => calls++);
    value(store.addPlayer('Alice'));
    stop();
    value(store.addPlayer('Bob'));
    expect(calls).toBe(1);
  });
});

describe('another tab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads another tab's save, so it does not write over it", () => {
    const fakeWindow = new EventTarget();
    vi.stubGlobal('window', fakeWindow);
    const backend = new FakeStorage();
    const tabA = createPlayerStore(backend);
    const tabB = createPlayerStore(backend);
    let calls = 0;
    tabA.subscribe(() => calls++);

    const alice = value(tabA.addPlayer('Alice'));
    fakeWindow.dispatchEvent(Object.assign(new Event('storage'), { key: PLAYERS_KEY }));
    value(tabB.addPlayer('Sam'));
    fakeWindow.dispatchEvent(Object.assign(new Event('storage'), { key: PLAYERS_KEY }));
    value(tabA.renamePlayer(alice.id, 'Ali'));

    expect(calls).toBeGreaterThan(1);
    expect(createPlayerStore(backend).players().map((p) => p.name)).toEqual(['Ali', 'Sam']);
  });
});
