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
 * The garden: a grassy island, the stepping stones with their numbers, and a few
 * bushes, trees and flowers. Every repeated shape is one InstancedMesh, so the
 * whole garden is a handful of draw calls whatever the track length.
 */

const GRASS = 0x8fcf6a;
const SOIL = 0xa8784e;
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
  /** Corners of the ground, for framing the camera. */
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

  // Ground: a low, rounded island just bigger than the path.
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
  const rx = (maxX - minX) / 2;
  const rz = (maxZ - minZ) / 2;

  const islandGeo = keep(new CylinderGeometry(1, 1.04, 1, 28, 1));
  const island = new Mesh(islandGeo, lambert(GRASS));
  island.scale.set(rx * 1.12, 0.4, rz * 1.06);
  island.position.set(cx, -0.2, cz);
  const soil = new Mesh(islandGeo, lambert(SOIL));
  soil.scale.set(rx * 1.13, 0.5, rz * 1.07);
  soil.position.set(cx, -0.62, cz);
  group.add(soil, island);

  // A worn trail from stone to stone, under the stones: shows which stone comes next.
  const trail = new Mesh(keep(trailGeometry(track)), lambert(TRAIL));
  trail.position.y = 0.006;
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

  // Decorations, kept off the stones and clear of a crowd standing on them.
  const clear = (x: number, z: number, margin: number) =>
    track.stones.every((s) => Math.hypot(s.x - x, s.z - z) > s.radius + margin) &&
    ((x - cx) / (rx * 1.05)) ** 2 + ((z - cz) / (rz * 1.02)) ** 2 < 1;

  const area = (maxX - minX) * (maxZ - minZ);
  const spots = (count: number, margin: number, apart: number) => {
    const out: { x: number; z: number; s: number; r: number }[] = [];
    for (let tries = 0; out.length < count && tries < count * 40; tries += 1) {
      const x = minX + rand() * (maxX - minX);
      const z = minZ + rand() * (maxZ - minZ);
      if (clear(x, z, margin) && out.every((o) => Math.hypot(o.x - x, o.z - z) > apart)) {
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
