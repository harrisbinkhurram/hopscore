import { isBunnyColour, pickFreeColour } from './colours';
import { cleanName, loadData } from './migrate';
import { SafeStorage, type StorageLike } from './safe-storage';
import { LIMITS, type Group, type Player, type SavedData } from './types';

/** The one local-storage key for players and groups. Games and history use their own keys. */
export const PLAYERS_KEY = 'hopscore.players';

/** Changes return this instead of throwing, so the screen can show the message. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface PlayerStore {
  /** False when changes will be lost on reload. `notSavedReason` says why. */
  readonly persistent: boolean;
  /**
   * 'storage-off': storage is blocked or full.
   * 'kept-safe': the saved data is from a newer app, or could not be upgraded, so it is left alone.
   */
  readonly notSavedReason: 'storage-off' | 'kept-safe' | null;
  /** Recently used first, then by name. */
  players(): Player[];
  player(id: string): Player | undefined;
  groups(): Group[];
  addPlayer(name: string, colour?: string): Result<Player>;
  renamePlayer(id: string, name: string): Result<Player>;
  recolourPlayer(id: string, colour: string): Result<Player>;
  /** Also removes the player from every group. */
  deletePlayer(id: string): void;
  createGroup(name: string, playerIds: string[]): Result<Group>;
  updateGroup(id: string, changes: { name?: string; playerIds?: string[] }): Result<Group>;
  deleteGroup(id: string): void;
  /** Marks players as just used, so they come first. Task 04 calls this when a game starts. */
  markUsed(playerIds: string[], now?: number): void;
  /** Called after every change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/**
 * Creates the store. With no argument it uses `localStorage`; pass a fake (or `null` for
 * memory only) in tests.
 *
 * Create one per page and share it (main.ts does). A second store in the same tab keeps its own
 * copy and would write it over the first store's changes: browsers send no `storage` event to
 * the tab that wrote.
 */
export function createPlayerStore(backend?: StorageLike | null): PlayerStore {
  const storage = new SafeStorage(backend);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  let { data: state, keepSaved } = read(storage);

  const commit = (next: SavedData): void => {
    state = next;
    // Never write over data from a newer app, or data a migration failed on.
    if (!keepSaved) storage.set(PLAYERS_KEY, JSON.stringify(state));
    notify();
  };

  // Another tab saved: load its version, so this tab does not write over it with old data.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event) => {
      if (event.key !== PLAYERS_KEY && event.key !== null) return;
      ({ data: state, keepSaved } = read(storage));
      notify();
    });
  }

  const find = (id: string) => state.players.find((p) => p.id === id);

  const checkPlayerName = (name: string, exceptId?: string): Result<string> => {
    const clean = cleanName(name, Number.MAX_SAFE_INTEGER);
    if (clean === '') return fail('Type a name.');
    if (clean.length > LIMITS.playerNameMax) {
      return fail(`Keep names to ${LIMITS.playerNameMax} letters or fewer.`);
    }
    const taken = state.players.some(
      (p) => p.id !== exceptId && p.name.toLowerCase() === clean.toLowerCase(),
    );
    return taken ? fail(`There is already a player called ${clean}.`) : ok(clean);
  };

  const checkGroup = (name: string, playerIds: string[], exceptId?: string): Result<Group> => {
    const clean = cleanName(name, Number.MAX_SAFE_INTEGER);
    if (clean === '') return fail('Give the group a name.');
    if (clean.length > LIMITS.groupNameMax) {
      return fail(`Keep group names to ${LIMITS.groupNameMax} letters or fewer.`);
    }
    if (state.groups.some((g) => g.id !== exceptId && g.name.toLowerCase() === clean.toLowerCase())) {
      return fail(`There is already a group called ${clean}.`);
    }
    const ids = [...new Set(playerIds)].filter((id) => find(id));
    if (ids.length < LIMITS.groupMin || ids.length > LIMITS.groupMax) {
      return fail(`A group needs ${LIMITS.groupMin} to ${LIMITS.groupMax} players.`);
    }
    return ok({ id: exceptId ?? newId(), name: clean, playerIds: ids });
  };

  const updatePlayer = (id: string, change: Partial<Player>): Result<Player> => {
    const current = find(id);
    if (!current) return fail('That player is gone.');
    const updated = { ...current, ...change };
    commit({ ...state, players: state.players.map((p) => (p.id === id ? updated : p)) });
    return ok(updated);
  };

  return {
    get persistent() {
      return storage.persistent && !keepSaved;
    },

    get notSavedReason() {
      if (!storage.persistent) return 'storage-off';
      return keepSaved ? 'kept-safe' : null;
    },

    players() {
      return [...state.players].sort(
        (a, b) => b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name),
      );
    },

    player: find,

    groups() {
      return [...state.groups].sort((a, b) => a.name.localeCompare(b.name));
    },

    addPlayer(name, colour) {
      const checked = checkPlayerName(name);
      if (!checked.ok) return checked;
      if (colour !== undefined && !isBunnyColour(colour)) return fail('Pick a colour from the list.');
      const player: Player = {
        id: newId(),
        name: checked.value,
        colour: colour ?? pickFreeColour(state.players.map((p) => p.colour)),
        lastUsedAt: 0,
      };
      commit({ ...state, players: [...state.players, player] });
      return ok(player);
    },

    renamePlayer(id, name) {
      const checked = checkPlayerName(name, id);
      return checked.ok ? updatePlayer(id, { name: checked.value }) : checked;
    },

    recolourPlayer(id, colour) {
      if (!isBunnyColour(colour)) return fail('Pick a colour from the list.');
      return updatePlayer(id, { colour });
    },

    deletePlayer(id) {
      if (!find(id)) return;
      commit({
        ...state,
        players: state.players.filter((p) => p.id !== id),
        groups: state.groups.map((g) => ({ ...g, playerIds: g.playerIds.filter((p) => p !== id) })),
      });
    },

    createGroup(name, playerIds) {
      const checked = checkGroup(name, playerIds);
      if (checked.ok) commit({ ...state, groups: [...state.groups, checked.value] });
      return checked;
    },

    updateGroup(id, changes) {
      const current = state.groups.find((g) => g.id === id);
      if (!current) return fail('That group is gone.');
      const checked = checkGroup(changes.name ?? current.name, changes.playerIds ?? current.playerIds, id);
      if (checked.ok) {
        commit({ ...state, groups: state.groups.map((g) => (g.id === id ? checked.value : g)) });
      }
      return checked;
    },

    deleteGroup(id) {
      if (!state.groups.some((g) => g.id === id)) return;
      commit({ ...state, groups: state.groups.filter((g) => g.id !== id) });
    },

    markUsed(playerIds, now = Date.now()) {
      const used = new Set(playerIds);
      if (!state.players.some((p) => used.has(p.id))) return;
      commit({
        ...state,
        players: state.players.map((p) => (used.has(p.id) ? { ...p, lastUsedAt: now } : p)),
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function read(storage: SafeStorage) {
  const text = storage.get(PLAYERS_KEY);
  let raw: unknown = null;
  if (text !== null) {
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
  }
  return loadData(raw);
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail<T>(error: string): Result<T> {
  return { ok: false, error };
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the simple id below.
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
