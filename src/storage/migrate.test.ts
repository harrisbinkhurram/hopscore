import { describe, expect, it } from 'vitest';
import { loadData, type Migration } from './migrate';
import { CURRENT_VERSION } from './types';

const alice = { id: 'a', name: 'Alice', colour: 'sky', lastUsedAt: 5 };
const bob = { id: 'b', name: 'Bob', colour: 'berry', lastUsedAt: 0 };

describe('loadData: bad saved data', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'hello'],
    ['an array', [alice]],
    ['an empty object', {}],
    ['wrong field types', { version: 1, players: 'x', groups: 7 }],
  ])('gives empty data for %s without throwing', (_label, raw) => {
    const { data, keepSaved } = loadData(raw);
    expect(data).toEqual({ version: CURRENT_VERSION, players: [], groups: [] });
    expect(keepSaved).toBeNull();
  });

  it('keeps good players and drops broken ones', () => {
    const { data } = loadData({
      version: 1,
      players: [
        alice,
        null,
        'Bob',
        { id: 'c' }, // no name
        { name: 'No id' },
        { id: 'd', name: '   ' },
        { id: 'a', name: 'Same id' },
        { id: 'e', name: 'ALICE' }, // same name, other case
        bob,
      ],
      groups: [],
    });
    expect(data.players).toEqual([alice, bob]);
  });

  it('repairs fixable player fields', () => {
    const { data } = loadData({
      version: 1,
      players: [{ id: 'x', name: '  Zed   Two ', colour: 'neon', lastUsedAt: 'yesterday' }],
    });
    expect(data.players).toEqual([{ id: 'x', name: 'Zed Two', colour: 'clover', lastUsedAt: 0 }]);
  });

  it('drops unknown and repeated player ids from groups, and broken groups', () => {
    const { data } = loadData({
      version: 1,
      players: [alice, bob],
      groups: [
        { id: 'g1', name: 'Friday crew', playerIds: ['a', 'ghost', 'b', 'a', 3] },
        { id: 'g2', name: '' },
        { name: 'No id', playerIds: [] },
        { id: 'g3', name: 'No list' },
      ],
    });
    expect(data.groups).toEqual([
      { id: 'g1', name: 'Friday crew', playerIds: ['a', 'b'] },
      { id: 'g3', name: 'No list', playerIds: [] },
    ]);
  });

  it('drops a group whose name repeats another (ignoring case)', () => {
    const { data } = loadData({
      version: 1,
      groups: [
        { id: 'g1', name: 'Friday', playerIds: [] },
        { id: 'g2', name: 'FRIDAY', playerIds: [] },
      ],
    });
    expect(data.groups.map((g) => g.id)).toEqual(['g1']);
  });

  it('treats data with no version as version 1', () => {
    const { data } = loadData({ players: [alice] });
    expect(data.version).toBe(CURRENT_VERSION);
    expect(data.players).toEqual([alice]);
  });
});

describe('loadData: migrations', () => {
  // A pretend history: v1 stored `title`, v2 renamed it to `name`, v3 added `lastUsedAt`.
  const migrations: Record<number, Migration> = {
    1: (d) => ({
      ...d,
      players: (d.players as { id: string; title: string }[]).map(({ title, ...p }) => ({
        ...p,
        name: title,
      })),
    }),
    2: (d) => ({
      ...d,
      players: (d.players as object[]).map((p) => ({ ...p, lastUsedAt: 9 })),
    }),
  };

  it('runs each step in order from the saved version to the current one', () => {
    const { data } = loadData(
      { version: 1, players: [{ id: 'a', title: 'Alice', colour: 'sky' }], groups: [] },
      migrations,
      3,
    );
    expect(data).toEqual({
      version: 3,
      players: [{ id: 'a', name: 'Alice', colour: 'sky', lastUsedAt: 9 }],
      groups: [],
    });
  });

  it('starts from the saved version, skipping steps already applied', () => {
    const { data } = loadData(
      { version: 2, players: [{ id: 'a', name: 'Alice', colour: 'sky' }] },
      migrations,
      3,
    );
    expect(data.players).toEqual([{ id: 'a', name: 'Alice', colour: 'sky', lastUsedAt: 9 }]);
  });

  it('passes current data through unchanged', () => {
    const saved = { version: CURRENT_VERSION, players: [alice, bob], groups: [] };
    expect(loadData(saved).data).toEqual(saved);
  });

  it('keeps the last good step and protects the saved data when a migration throws', () => {
    const failing: Record<number, Migration> = {
      ...migrations,
      2: () => {
        throw new Error('boom');
      },
    };
    const { data, keepSaved } = loadData(
      { version: 1, players: [{ id: 'a', title: 'Alice', colour: 'sky' }] },
      failing,
      3,
    );
    expect(keepSaved).toBe('migration-failed');
    expect(data.players).toEqual([{ id: 'a', name: 'Alice', colour: 'sky', lastUsedAt: 0 }]);
  });

  it('protects the saved data when a migration returns something broken', () => {
    const broken: Record<number, Migration> = { 1: () => null as never };
    const { data, keepSaved } = loadData({ version: 1, players: [alice] }, broken, 2);
    expect(keepSaved).toBe('migration-failed');
    expect(data.players).toEqual([alice]);
  });

  it('flags data from a newer version, and still reads what it can', () => {
    const { data, keepSaved } = loadData({
      version: CURRENT_VERSION + 1,
      players: [alice],
      groups: [],
    });
    expect(keepSaved).toBe('newer-version');
    expect(data.players).toEqual([alice]);
  });
});
