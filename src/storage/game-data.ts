import { BUNNY_COLOURS, isBunnyColour } from './colours';
import { isRecord, runMigrations, type LoadResult, type Migration } from './migrate';
import {
  GAME_VERSION,
  HISTORY_LIMIT,
  HISTORY_VERSION,
  type HistoryEntry,
  type SavedGame,
  type SavedRound,
  type SavedScore,
  type SavedStep,
} from './types';

/** `GAME_MIGRATIONS[n]` turns version-n saved game data into version n+1. None yet. */
export const GAME_MIGRATIONS: Readonly<Record<number, Migration>> = {};
/** `HISTORY_MIGRATIONS[n]` turns version-n history data into version n+1. None yet. */
export const HISTORY_MIGRATIONS: Readonly<Record<number, Migration>> = {};

/**
 * Reads a saved game (already JSON-parsed, or anything else). Never throws. A game with any
 * broken part is dropped whole, since keeping some of its rounds would change the scores; a
 * broken Redo list or draft costs only itself.
 */
export function loadSavedGame(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = GAME_MIGRATIONS,
  currentVersion: number = GAME_VERSION,
): { saved: SavedGame | null; keepSaved: LoadResult['keepSaved'] } {
  if (!isRecord(raw)) return { saved: null, keepSaved: null };
  const { data, keepSaved } = runMigrations(raw, migrations, currentVersion);
  return { saved: readSavedGame(data), keepSaved };
}

/** Reads the saved history: broken entries are dropped one by one, newest first, at most `HISTORY_LIMIT`. Never throws. */
export function loadHistory(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = HISTORY_MIGRATIONS,
  currentVersion: number = HISTORY_VERSION,
): { entries: HistoryEntry[]; keepSaved: LoadResult['keepSaved'] } {
  if (!isRecord(raw)) return { entries: [], keepSaved: null };
  const { data, keepSaved } = runMigrations(raw, migrations, currentVersion);
  const entries: HistoryEntry[] = [];
  const ids = new Set<string>();
  for (const item of Array.isArray(data.entries) ? data.entries : []) {
    const entry = readEntry(item);
    if (!entry || ids.has(entry.id)) continue;
    ids.add(entry.id);
    entries.push(entry);
  }
  entries.sort((a, b) => b.finishedAt - a.finishedAt);
  return { entries: entries.slice(0, HISTORY_LIMIT), keepSaved };
}

function readSavedGame(data: Record<string, unknown>): SavedGame | null {
  const game = data.game;
  if (!isRecord(game)) return null;
  const seats = readSeats(game.seats);
  if (!seats) return null;
  const ids = new Set(seats.map((s) => s.id));
  if (!isNumber(game.trackLength) || typeof game.storyteller !== 'string') return null;
  if (!Array.isArray(game.rounds)) return null;
  const rounds: SavedRound[] = [];
  for (const item of game.rounds) {
    const round = readRound(item);
    if (!round) return null;
    rounds.push(round);
  }
  return {
    game: {
      seats,
      trackLength: game.trackLength,
      storyteller: game.storyteller,
      rounds,
      endedByHand: game.endedByHand === true,
      redo: readRedo(game.redo),
    },
    view: data.view === 'scores' ? 'scores' : 'round',
    draft: readDraft(data.draft, ids),
  };
}

function readSeats(value: unknown): SavedGame['game']['seats'] | null {
  if (!Array.isArray(value)) return null;
  const out: { id: string; name: string; colour: string }[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return null;
    const { id, name } = item;
    if (typeof id !== 'string' || id === '' || ids.has(id)) return null;
    if (typeof name !== 'string' || name.trim() === '') return null;
    ids.add(id);
    out.push({ id, name, colour: isBunnyColour(item.colour) ? item.colour : BUNNY_COLOURS[0].id });
  }
  return out;
}

function readRound(value: unknown): SavedRound | null {
  if (!isRecord(value) || typeof value.storyteller !== 'string' || !Array.isArray(value.scores)) return null;
  const scores: SavedScore[] = [];
  for (const item of value.scores) {
    if (!isRecord(item) || typeof item.player !== 'string' || !isNumber(item.points)) return null;
    if (!Array.isArray(item.reasons)) return null;
    const reasons: SavedScore['reasons'][number][] = [];
    for (const r of item.reasons) {
      if (!isRecord(r) || typeof r.kind !== 'string' || !isNumber(r.points) || typeof r.text !== 'string') return null;
      reasons.push({ kind: r.kind, points: r.points, text: r.text });
    }
    scores.push({ player: item.player, points: item.points, reasons });
  }
  return { storyteller: value.storyteller, scores };
}

/** The Redo list, or an empty one if any step is broken. */
function readRedo(value: unknown): SavedStep[] {
  if (!Array.isArray(value)) return [];
  const out: SavedStep[] = [];
  for (const item of value) {
    if (!isRecord(item)) return [];
    if (item.kind === 'end') {
      out.push({ kind: 'end' });
      continue;
    }
    const round = item.kind === 'round' ? readRound(item.round) : null;
    if (!round) return [];
    out.push({ kind: 'round', round });
  }
  return out;
}

/** The draft, keeping only votes by and for seated players; null if the storyteller is not seated. */
function readDraft(value: unknown, seated: ReadonlySet<string>): SavedGame['draft'] {
  if (!isRecord(value) || typeof value.storyteller !== 'string' || !seated.has(value.storyteller)) return null;
  const storyteller = value.storyteller;
  const votes: Record<string, string> = {};
  if (isRecord(value.votes)) {
    for (const [voter, pick] of Object.entries(value.votes)) {
      if (typeof pick !== 'string' || voter === storyteller || voter === pick) continue;
      if (seated.has(voter) && seated.has(pick)) votes[voter] = pick;
    }
  }
  return { storyteller, votes };
}

function readEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) return null;
  const { id, finishedAt, trackLength, rounds } = value;
  if (typeof id !== 'string' || id === '') return null;
  if (!isNumber(finishedAt) || finishedAt <= 0 || !isNumber(trackLength)) return null;
  if (!isNumber(rounds) || !Number.isInteger(rounds) || rounds < 0) return null;
  if (!Array.isArray(value.players) || value.players.length === 0) return null;
  const players: { name: string; colour: string; score: number }[] = [];
  for (const p of value.players) {
    if (!isRecord(p) || typeof p.name !== 'string' || p.name.trim() === '' || !isNumber(p.score)) return null;
    players.push({ name: p.name, colour: isBunnyColour(p.colour) ? p.colour : BUNNY_COLOURS[0].id, score: p.score });
  }
  return { id, finishedAt, trackLength, rounds, endedByHand: value.endedByHand === true, players };
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
