import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  OctahedronGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { isNumberedStone, STONE_RADIUS, type Track } from './track';

/**
 * The garden: an open grass field, the stepping stones with their numbers, and a few
 * bushes, trees and flowers. Every repeated shape is one InstancedMesh, so the
 * whole garden is a handful of draw calls whatever the track length.
 */

const GRASS = 0x8fcf6a;
/** Slightly lighter and darker patches, so the open field does not look flat. */
const GRASS_PATCHES = [0x9bd675, 0x84c460];
/** The field reaches far past anything the camera can show, so no edge is ever seen. */
const FIELD_RADIUS = 220;
/** How far past the path bushes and trees still grow, so the sides look full too. */
const SCATTER_MARGIN = 10;
const TRAIL = 0xc7d98a;
/** Width of the worn trail that links the stones, so the order reads at a glance. */
const TRAIL_WIDTH = 0.9;
const STONE = 0xe9dfcf;
const STONE_START = 0xffe08a;
const STONE_FINISH = 0xffc94d;
const BUSH = 0x5aa04a;
const LEAVES = 0x4f9a52;
const TRUNK = 0x8a5a3a;
const FLOWER_COLOURS = [0xff8fab, 0xffffff, 0xffd166, 0xc8a2ff, 0xff9f6b];

/** A small seeded random generator, so the garden looks the same on every load. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export interface Garden {
  group: Group;
  /** The area around the path, for framing the camera and limiting panning. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  dispose(): void;
}

export function createGarden(track: Track): Garden {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const keep = <T extends BufferGeometry | Material | Texture>(x: T): T => {
    if (x instanceof BufferGeometry) geometries.push(x);
    else if ('isTexture' in x) textures.push(x as Texture);
    else materials.push(x as Material);
    return x;
  };
  const lambert = (color: number) => keep(new MeshLambertMaterial({ color, flatShading: true }));

  // Area around the path that the camera frames and the player can pan over.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of track.stones) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
  }
  // Room around the outermost stones for a crowd of bunnies and a few bushes.
  const pad = 2.6;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  // Ground: one wide, flat field. The camera looks down at 58 degrees, so the
  // horizon never shows and the grass fills the screen edge to edge.
  const fieldGeo = keep(new CircleGeometry(FIELD_RADIUS, 48));
  fieldGeo.rotateX(-Math.PI / 2);
  const field = new Mesh(fieldGeo, lambert(GRASS));
  field.position.set(cx, 0, cz);
  group.add(field);

  // A worn trail from stone to stone, under the stones: shows which stone comes next.
  const trail = new Mesh(keep(trailGeometry(track)), lambert(TRAIL));
  trail.position.y = 0.02;
  group.add(trail);

  // Stones: one instanced mesh for all of them, coloured per instance.
  const stoneGeo = keep(new CylinderGeometry(STONE_RADIUS, STONE_RADIUS * 1.08, 0.14, 9));
  const stones = new InstancedMesh(stoneGeo, lambert(0xffffff), track.stones.length);
  const dummy = new Object3D();
  const rand = seededRandom(track.length * 7919 + 17);
  for (const s of track.stones) {
    dummy.position.set(s.x, 0.05, s.z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    const size = s.radius / STONE_RADIUS;
    dummy.scale.set(size, 1, size);
    dummy.updateMatrix();
    stones.setMatrixAt(s.index, dummy.matrix);
    const colour = s.index === 0 ? STONE_START : s.index === track.length ? STONE_FINISH : STONE;
    stones.setColorAt(s.index, new Color(colour));
  }
  group.add(stones);

  // Numbers on every 5th stone and the finish: a flat disc with a canvas texture.
  const numberDisc = keep(new CircleGeometry(STONE_RADIUS * 0.75, 20));
  numberDisc.rotateX(-Math.PI / 2);
  for (const s of track.stones) {
    if (!isNumberedStone(s.index, track.length)) continue;
    const texture = keep(numberTexture(s.index));
    const disc = new Mesh(numberDisc, keep(new MeshBasicMaterial({ map: texture, transparent: true })));
    disc.position.set(s.x, 0.125, s.z);
    disc.scale.setScalar(s.radius / STONE_RADIUS);
    group.add(disc);
  }

  // Decorations, kept off the stones and clear of a crowd standing on them. They
  // spread a little past the path on every side, so the field looks open, not fenced.
  const clear = (x: number, z: number, margin: number) =>
    track.stones.every((s) => Math.hypot(s.x - x, s.z - z) > s.radius + margin);
  // Past the path area things thin out bit by bit, so there is no hard edge.
  const thinsOut = (x: number, z: number) => {
    const out = Math.hypot(Math.max(0, minX - x, x - maxX), Math.max(0, minZ - z, z - maxZ));
    return rand() > out / SCATTER_MARGIN;
  };

  const outMinX = minX - SCATTER_MARGIN;
  const outMaxX = maxX + SCATTER_MARGIN;
  const outMinZ = minZ - SCATTER_MARGIN;
  const outMaxZ = maxZ + SCATTER_MARGIN;
  const area = (outMaxX - outMinX) * (outMaxZ - outMinZ);
  const spots = (count: number, margin: number, apart: number) => {
    const out: { x: number; z: number; s: number; r: number }[] = [];
    for (let tries = 0; out.length < count && tries < count * 40; tries += 1) {
      const x = outMinX + rand() * (outMaxX - outMinX);
      const z = outMinZ + rand() * (outMaxZ - outMinZ);
      if (clear(x, z, margin) && thinsOut(x, z) && out.every((o) => Math.hypot(o.x - x, o.z - z) > apart)) {
        out.push({ x, z, s: 0.75 + rand() * 0.5, r: rand() * Math.PI * 2 });
      }
    }
    return out;
  };

  const place = (mesh: InstancedMesh, list: { x: number; z: number; s: number; r: number }[], y: number) => {
    list.forEach((p, i) => {
      dummy.position.set(p.x, y * p.s, p.z);
      dummy.rotation.set(0, p.r, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = list.length;
    group.add(mesh);
  };

  // Soft patches of lighter and darker grass, flat on the ground.
  const patchSpots = spots(Math.round(area / 10), 0.6, 1.8);
  const patches = new InstancedMesh(
    keep(new CircleGeometry(0.9, 7).rotateX(-Math.PI / 2)),
    lambert(0xffffff),
    Math.max(1, patchSpots.length),
  );
  patchSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0.01, p.z);
    dummy.rotation.set(0, p.r, 0);
    dummy.scale.set(p.s * 1.6, 1, p.s);
    dummy.updateMatrix();
    patches.setMatrixAt(i, dummy.matrix);
    patches.setColorAt(i, new Color(GRASS_PATCHES[i % GRASS_PATCHES.length]));
  });
  patches.count = patchSpots.length;
  group.add(patches);

  const bushSpots = spots(Math.round(area / 14), 1.2, 1.6);
  place(new InstancedMesh(keep(new IcosahedronGeometry(0.42, 0)), lambert(BUSH), Math.max(1, bushSpots.length)), bushSpots, 0.25);

  const treeSpots = spots(Math.round(area / 45), 1.5, 2.2);
  const treeCount = Math.max(1, treeSpots.length);
  place(new InstancedMesh(keep(new CylinderGeometry(0.1, 0.14, 0.7, 5)), lambert(TRUNK), treeCount), treeSpots, 0.35);
  place(new InstancedMesh(keep(new ConeGeometry(0.6, 1.3, 6)), lambert(LEAVES), treeCount), treeSpots, 1.25);

  const flowerSpots = spots(Math.round(area / 3), 0.25, 0.7);
  const flowers = new InstancedMesh(
    keep(new OctahedronGeometry(0.09, 0)),
    lambert(0xffffff),
    Math.max(1, flowerSpots.length),
  );
  place(flowers, flowerSpots, 0.08);
  flowerSpots.forEach((_, i) => {
    flowers.setColorAt(i, new Color(FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)]));
  });

  // Instances spread far from the origin; refresh their bounds so culling stays correct.
  group.traverse((o) => {
    if (o instanceof InstancedMesh) o.computeBoundingSphere();
  });

  return {
    group,
    bounds: { minX, maxX, minZ, maxZ },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((mat) => mat.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

function numberTexture(n: number): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5b4a3a';
  ctx.font = `800 ${n >= 10 ? 74 : 84}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), size / 2, size / 2 + 5);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A flat ribbon along a smooth curve through the stone centres. */
function trailGeometry(track: Track): BufferGeometry {
  const curve = new CatmullRomCurve3(track.stones.map((s) => new Vector3(s.x, 0, s.z)));
  const count = track.stones.length * 8;
  const points = curve.getSpacedPoints(count);
  const positions: number[] = [];
  const indices: number[] = [];
  const half = TRAIL_WIDTH / 2;
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    // Across the trail: the direction of travel turned 90 degrees.
    const ax = (-dz / d) * half;
    const az = (dx / d) * half;
    positions.push(p.x + ax, 0, p.z + az, p.x - ax, 0, p.z - az);
    if (i > 0) {
      const k = i * 2;
      indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
