import { BUNNY_COLOURS, isBunnyColour } from './colours';
import { CURRENT_VERSION, LIMITS, type Group, type Player, type SavedData } from './types';

/**
 * Migrations: `MIGRATIONS[n]` turns version-n data into version n+1.
 * Version 1 is the first saved shape, so there are none yet. When the shape changes,
 * bump CURRENT_VERSION and add the step here (with a test).
 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export interface LoadResult {
  data: SavedData;
  /**
   * Why the store must not write over the saved data, if it must not:
   * it came from a newer app version, or a migration failed on it.
   */
  keepSaved: 'newer-version' | 'migration-failed' | null;
}

export function emptyData(): SavedData {
  return { version: CURRENT_VERSION, players: [], groups: [] };
}

/**
 * Turns whatever was saved (already JSON-parsed, or anything else) into valid data.
 * Never throws. Broken entries are dropped one by one; good ones are kept.
 */
export function loadData(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  currentVersion: number = CURRENT_VERSION,
): LoadResult {
  if (!isRecord(raw)) return { data: emptyData(), keepSaved: null };

  let version = typeof raw.version === 'number' && Number.isInteger(raw.version) ? raw.version : 1;
  if (version < 1) version = 1;
  let keepSaved: LoadResult['keepSaved'] = version > currentVersion ? 'newer-version' : null;

  // Each step works on the last good result. If one fails, use what we have for this session,
  // and never write over the saved data, so a fixed app can migrate it later.
  let data: Record<string, unknown> = raw;
  while (version < currentVersion) {
    const step = migrations[version];
    if (!step) break; // No path forward: validate what we have.
    let next: unknown;
    try {
      next = step(data);
    } catch {
      next = undefined;
    }
    if (!isRecord(next)) {
      keepSaved = 'migration-failed';
      break;
    }
    data = next;
    version += 1;
  }

  const players = readPlayers(data.players);
  const known = new Set(players.map((p) => p.id));
  const groups = readGroups(data.groups, known);
  return { data: { version: currentVersion, players, groups }, keepSaved };
}

function readPlayers(value: unknown): Player[] {
  if (!Array.isArray(value)) return [];
  const out: Player[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = item.id;
    const name = typeof item.name === 'string' ? cleanName(item.name, LIMITS.playerNameMax) : '';
    if (typeof id !== 'string' || id === '' || ids.has(id) || name === '') continue;
    if (names.has(name.toLowerCase())) continue;
    const colour = isBunnyColour(item.colour) ? item.colour : BUNNY_COLOURS[0].id;
    const lastUsedAt =
      typeof item.lastUsedAt === 'number' && Number.isFinite(item.lastUsedAt) && item.lastUsedAt > 0
        ? item.lastUsedAt
        : 0;
    ids.add(id);
    names.add(name.toLowerCase());
    out.push({ id, name, colour, lastUsedAt });
  }
  return out;
}

function readGroups(value: unknown, knownPlayers: Set<string>): Group[] {
  if (!Array.isArray(value)) return [];
  const out: Group[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = item.id;
    const name = typeof item.name === 'string' ? cleanName(item.name, LIMITS.groupNameMax) : '';
    if (typeof id !== 'string' || id === '' || ids.has(id) || name === '') continue;
    if (names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    const playerIds = Array.isArray(item.playerIds)
      ? [...new Set(item.playerIds.filter((p): p is string => typeof p === 'string' && knownPlayers.has(p)))]
      : [];
    ids.add(id);
    out.push({ id, name, playerIds });
  }
  return out;
}

/** Trims, squashes inner spaces and cuts to the limit. */
export function cleanName(name: string, max: number): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, max).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
