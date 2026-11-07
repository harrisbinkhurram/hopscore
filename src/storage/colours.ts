/** A bunny colour. The name is always shown next to the swatch, so colour is never the only cue. */
export interface BunnyColour {
  id: string;
  name: string;
  hex: string;
}

/** The bunny palette. Ids are saved, so never rename or remove one; add new ones at the end. */
export const BUNNY_COLOURS: readonly BunnyColour[] = [
  { id: 'clover', name: 'Clover', hex: '#4caf6a' },
  { id: 'sky', name: 'Sky', hex: '#3d8fe0' },
  { id: 'sunny', name: 'Sunny', hex: '#f2c230' },
  { id: 'berry', name: 'Berry', hex: '#d6406d' },
  { id: 'carrot', name: 'Carrot', hex: '#f08a2c' },
  { id: 'lilac', name: 'Lilac', hex: '#9b6ad6' },
  { id: 'snow', name: 'Snow', hex: '#f1ede6' },
  { id: 'cocoa', name: 'Cocoa', hex: '#7a5238' },
];

const BY_ID = new Map(BUNNY_COLOURS.map((c) => [c.id, c]));

export function isBunnyColour(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

export function bunnyColour(id: string): BunnyColour {
  return BY_ID.get(id) ?? BUNNY_COLOURS[0];
}

/**
 * True when `colour` is held by someone else and a colour nobody else holds is still left, so it
 * cannot be picked. Once every colour is held, colours are shared again (there is no player limit).
 */
export function colourLocked(colour: string, usedByOthers: readonly string[]): boolean {
  const used = new Set(usedByOthers);
  return used.has(colour) && BUNNY_COLOURS.some((c) => !used.has(c.id));
}

/** The first colour nobody uses yet, or the least used one when all are taken. */
export function pickFreeColour(used: readonly string[]): string {
  const counts = new Map(BUNNY_COLOURS.map((c) => [c.id, 0]));
  for (const id of used) {
    if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
  }
  let best = BUNNY_COLOURS[0].id;
  for (const c of BUNNY_COLOURS) {
    if (counts.get(c.id)! < counts.get(best)!) best = c.id;
  }
  return best;
}
