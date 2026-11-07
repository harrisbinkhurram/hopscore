import { Mesh, type BufferGeometry, type Material } from 'three';
import { describe, expect, it } from 'vitest';
import { createBunny, type Bunny } from './bunny';

/** Every geometry and material a bunny draws with. */
function parts(bunny: Bunny): (BufferGeometry | Material)[] {
  const out = new Set<BufferGeometry | Material>();
  bunny.group.traverse((o) => {
    if (o instanceof Mesh) out.add(o.geometry).add(o.material as Material);
  });
  return [...out];
}

describe('createBunny', () => {
  it('frees the shared parts only when the last bunny is disposed', () => {
    const a = createBunny('#ff0000');
    const b = createBunny('#00ff00');
    const shared = parts(a).filter((p) => parts(b).includes(p));
    expect(shared.length).toBeGreaterThan(0);
    const freed = new Set<unknown>();
    for (const p of shared) p.addEventListener('dispose', () => freed.add(p));

    a.dispose();
    a.dispose();
    expect(freed.size).toBe(0);
    b.dispose();
    expect(freed.size).toBe(shared.length);

    const c = createBunny('#0000ff');
    expect(parts(c).some((p) => shared.includes(p))).toBe(false);
    c.dispose();
  });
});
