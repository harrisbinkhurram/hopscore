import {
  Color,
  DoubleSide,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three';

/**
 * Dust puffs on landing and bursts of petals for a big round. Each kind is one instanced
 * mesh with a fixed pool of particles, so a frame allocates nothing. Particles fade by
 * shrinking. Positions are in world units.
 */
export interface Effects {
  group: Group;
  spawnDust(at: { x: number; z: number }): void;
  spawnPetals(at: { x: number; z: number }): void;
  /** Moves the particles on. Returns true while any are still alive. */
  update(dtMs: number): boolean;
  clear(): void;
  dispose(): void;
}

interface Particle {
  alive: boolean;
  age: number;
  life: number;
  p: Vector3;
  v: Vector3;
  rot: Euler;
  spin: Vector3;
  size: number;
}

interface Pool {
  mesh: InstancedMesh;
  items: Particle[];
  next: number;
  /** Air drag per second; petals float, dust stops fast. */
  drag: number;
  gravity: number;
  /** Petals flutter side to side as they fall. */
  flutter: number;
}

const DUST_POOL = 48;
const PETAL_POOL = 96;
const PETAL_COLOURS = [0xff9ec4, 0xffc7dc, 0xfff4f8, 0xffd36e];

export function createEffects(): Effects {
  const group = new Group();
  const geometries: BufferGeometry[] = [];

  const dustGeometry = new IcosahedronGeometry(0.11, 0);
  const dustMaterial = new MeshLambertMaterial({ color: 0xe8dcc4, flatShading: true });
  const petalGeometry = new PlaneGeometry(0.16, 0.1);
  const petalMaterial = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide });
  geometries.push(dustGeometry, petalGeometry);

  const matrix = new Matrix4();
  const quat = new Quaternion();
  const scale = new Vector3();
  const zero = new Matrix4().makeScale(0, 0, 0);

  const makePool = (geometry: BufferGeometry, material: MeshLambertMaterial, size: number, drag: number, gravity: number, flutter: number): Pool => {
    const mesh = new InstancedMesh(geometry, material, size);
    mesh.frustumCulled = false;
    mesh.count = size;
    const items = Array.from({ length: size }, () => ({
      alive: false,
      age: 0,
      life: 1,
      p: new Vector3(),
      v: new Vector3(),
      rot: new Euler(),
      spin: new Vector3(),
      size: 1,
    }));
    group.add(mesh);
    const pool = { mesh, items, next: 0, drag, gravity, flutter };
    hideAll(pool);
    return pool;
  };

  const dust = makePool(dustGeometry, dustMaterial, DUST_POOL, 4, 0, 0);
  const petals = makePool(petalGeometry, petalMaterial, PETAL_POOL, 1.6, -2.2, 1);
  const colour = new Color();
  for (let i = 0; i < PETAL_POOL; i += 1) {
    petals.mesh.setColorAt(i, colour.setHex(PETAL_COLOURS[i % PETAL_COLOURS.length]));
  }

  const take = (pool: Pool) => {
    const item = pool.items[pool.next];
    pool.next = (pool.next + 1) % pool.items.length;
    item.alive = true;
    item.age = 0;
    return item;
  };

  function hideAll(pool: Pool) {
    for (let i = 0; i < pool.items.length; i += 1) {
      pool.items[i].alive = false;
      pool.mesh.setMatrixAt(i, zero);
    }
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  function step(pool: Pool, dt: number): boolean {
    let any = false;
    const s = dt / 1000;
    pool.items.forEach((it, i) => {
      if (!it.alive) return;
      it.age += dt;
      if (it.age >= it.life) {
        it.alive = false;
        pool.mesh.setMatrixAt(i, zero);
        return;
      }
      any = true;
      it.v.y += pool.gravity * s;
      it.v.multiplyScalar(Math.exp(-pool.drag * s));
      it.p.addScaledVector(it.v, s);
      if (pool.flutter) it.p.x += Math.sin(it.age / 140 + i) * 0.004 * pool.flutter;
      if (it.p.y < 0.02) {
        it.p.y = 0.02;
        it.v.set(0, 0, 0);
      }
      it.rot.set(it.rot.x + it.spin.x * s, it.rot.y + it.spin.y * s, it.rot.z + it.spin.z * s);
      const k = it.age / it.life;
      // Grow quickly, then shrink away over the last part of the life.
      const size = it.size * Math.min(1, k * 6) * Math.min(1, (1 - k) * 2.5);
      matrix.compose(it.p, quat.setFromEuler(it.rot), scale.setScalar(size));
      pool.mesh.setMatrixAt(i, matrix);
    });
    pool.mesh.instanceMatrix.needsUpdate = true;
    return any;
  }

  return {
    group,
    spawnDust(at) {
      for (let k = 0; k < 7; k += 1) {
        const it = take(dust);
        const a = (k / 7) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 0.9 + Math.random() * 0.6;
        it.life = 420 + Math.random() * 180;
        it.size = 0.7 + Math.random() * 0.6;
        it.p.set(at.x + Math.cos(a) * 0.25, 0.06, at.z + Math.sin(a) * 0.25);
        it.v.set(Math.cos(a) * speed, 0.35 + Math.random() * 0.3, Math.sin(a) * speed);
        it.rot.set(0, 0, 0);
        it.spin.set(0, 0, 0);
      }
    },
    spawnPetals(at) {
      for (let k = 0; k < 28; k += 1) {
        const it = take(petals);
        const a = Math.random() * Math.PI * 2;
        const out = 0.6 + Math.random() * 1.2;
        it.life = 1300 + Math.random() * 700;
        it.size = 0.8 + Math.random() * 0.5;
        it.p.set(at.x, 1.2, at.z);
        it.v.set(Math.cos(a) * out, 3 + Math.random() * 1.8, Math.sin(a) * out);
        it.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        it.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
      }
    },
    update(dtMs) {
      // A long gap (a hidden tab) should not fling particles across the garden.
      const dt = Math.min(dtMs, 50);
      const a = step(dust, dt);
      const b = step(petals, dt);
      return a || b;
    },
    clear() {
      hideAll(dust);
      hideAll(petals);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      dustMaterial.dispose();
      petalMaterial.dispose();
      dust.mesh.dispose();
      petals.mesh.dispose();
    },
  };
}
