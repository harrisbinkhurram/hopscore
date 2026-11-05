import {
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * An original low-poly bunny, built from a few simple shapes.
 *
 * Parts that share a colour are merged into one mesh, so each bunny is 5 draw
 * calls (fur, inner ears, eyes, tail, shadow). Geometry is built once and shared.
 * The bunny faces +z (towards the camera). Its feet are at y = 0.
 */

/**
 * The shapes below are modelled about 0.6 wide and 0.77 deep; this scale brings
 * them to the footprint in layout.ts (BUNNY_FOOTPRINT), big enough to read on a phone.
 */
const BUNNY_SCALE = 1.3;

/** Height of the top of the ears, used to place the name label. */
export const BUNNY_HEIGHT = 1.12 * BUNNY_SCALE;

interface Parts {
  fur: BufferGeometry;
  innerEars: BufferGeometry;
  eyes: BufferGeometry;
  tail: BufferGeometry;
  shadow: BufferGeometry;
}

let shared: Parts | null = null;
const sharedMaterials: Record<'inner' | 'eye' | 'tail' | 'shadow', Material | null> = {
  inner: null,
  eye: null,
  tail: null,
  shadow: null,
};

function ico(radius: number, detail: number): BufferGeometry {
  return new IcosahedronGeometry(radius, detail);
}

function capsule(radius: number, length: number): BufferGeometry {
  return new CapsuleGeometry(radius, length, 2, 6).toNonIndexed();
}

function ear(side: 1 | -1, inner: boolean): BufferGeometry {
  const g = inner ? capsule(0.035, 0.26) : capsule(0.07, 0.3);
  g.scale(1, 1, inner ? 0.35 : 0.55);
  g.rotateZ(-side * 0.22);
  g.rotateX(-0.15);
  g.translate(side * 0.1, 0.9, inner ? 0.075 : 0.04);
  return g;
}

function buildParts(): Parts {
  const body = ico(0.3, 1);
  body.scale(1, 0.92, 1.08);
  body.translate(0, 0.3, 0);

  const head = ico(0.22, 1);
  head.scale(1.05, 0.95, 1);
  head.translate(0, 0.64, 0.1);

  const footL = ico(0.1, 0);
  footL.scale(1, 0.55, 1.5);
  footL.translate(-0.13, 0.05, 0.2);
  const footR = footL.clone();
  footR.translate(0.26, 0, 0);

  const fur = mergeGeometries([body, head, ear(1, false), ear(-1, false), footL, footR])!;

  const innerEars = mergeGeometries([ear(1, true), ear(-1, true)])!;

  const eyeL = ico(0.035, 0);
  eyeL.translate(-0.085, 0.68, 0.3);
  const eyeR = eyeL.clone();
  eyeR.translate(0.17, 0, 0);
  const nose = ico(0.028, 0);
  nose.scale(1.3, 0.8, 1);
  nose.translate(0, 0.6, 0.32);
  const eyes = mergeGeometries([eyeL, eyeR, nose])!;

  const tail = ico(0.1, 0);
  tail.translate(0, 0.28, -0.32);

  const shadow = new CircleGeometry(0.36, 12);
  shadow.rotateX(-Math.PI / 2);
  shadow.translate(0, 0.012, 0);

  return { fur, innerEars, eyes, tail, shadow };
}

function material(key: keyof typeof sharedMaterials): Material {
  let m = sharedMaterials[key];
  if (!m) {
    if (key === 'shadow') {
      m = new MeshBasicMaterial({ color: 0x2a3a1a, transparent: true, opacity: 0.28, depthWrite: false });
    } else {
      const color = key === 'inner' ? 0xffb3c1 : key === 'eye' ? 0x2b2433 : 0xfffaf2;
      m = new MeshLambertMaterial({ color, flatShading: true });
    }
    sharedMaterials[key] = m;
  }
  return m;
}

export interface Bunny {
  group: Group;
  setColor(color: string): void;
  dispose(): void;
}

/** Makes one bunny in the given CSS colour. */
export function createBunny(color: string): Bunny {
  shared ??= buildParts();
  const furMaterial = new MeshLambertMaterial({ color: new Color(color), flatShading: true });

  const group = new Group();
  group.scale.setScalar(BUNNY_SCALE);
  const fur = new Mesh(shared.fur, furMaterial);
  const inner = new Mesh(shared.innerEars, material('inner'));
  const eyes = new Mesh(shared.eyes, material('eye'));
  const tail = new Mesh(shared.tail, material('tail'));
  const shadow = new Mesh(shared.shadow, material('shadow'));
  shadow.renderOrder = -1;
  group.add(shadow, fur, inner, eyes, tail);

  return {
    group,
    setColor(next) {
      furMaterial.color.set(next);
    },
    dispose() {
      furMaterial.dispose();
    },
  };
}
