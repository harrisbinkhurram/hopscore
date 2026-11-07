import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import './board.css';
import { BUNNY_HEIGHT, createBunny, type Bunny } from './bunny';
import { distanceOf, fitPoints, focusOn, type CameraPose, type Limits, type Vec3 } from './camera';
import { attachControls } from './controls';
import { createGarden } from './garden';
import { layoutBunnies, type BoardPlayer, type BunnySpot } from './layout';
import { buildTrack } from './track';

export type { BoardPlayer } from './layout';

export interface BoardOptions {
  trackLength: number;
  players: readonly BoardPlayer[];
}

export interface Board {
  /** Updates names, colours and scores. Bunnies jump straight to their stones (task 06 adds the hops). */
  setPlayers(players: readonly BoardPlayer[]): void;
  /** Frames the whole track. This is the default view. Players can also pinch, drag and double-tap. */
  showWholeTrack(): void;
  /** Moves the camera in on one bunny. Unknown ids are ignored. */
  focusOn(playerId: string): void;
  dispose(): void;
}

const FOV = 40;
const BACKGROUND = { light: 0xfff7ec, dark: 0x1d1a24 };
const TWEEN_MS = 450;
/** Space kept free above the track for a name label, in CSS pixels. */
const LABEL_ROOM_PX = 30;

interface BunnyEntry {
  bunny: Bunny;
  label: HTMLDivElement;
  stem: HTMLDivElement;
  spot: BunnySpot;
  labelWidth: number;
  labelHeight: number;
}

/** `free` means the player has pinched or dragged; the camera then stays where they left it. */
type View = { kind: 'whole' } | { kind: 'focus'; id: string } | { kind: 'free' };

/** Closest the player can pinch in, in world units from the ground. */
const MIN_ZOOM_DISTANCE = 2.5;
/** How far past the whole-track view the player can pinch out. */
const MAX_ZOOM_OUT = 1.3;

/**
 * Builds the garden board inside `container`. The container decides the size;
 * the board follows it. The board draws a frame only when something changes,
 * so it costs nothing while it sits still.
 */
export function createBoard(container: HTMLElement, options: BoardOptions): Board {
  const track = buildTrack(options.trackLength);

  container.classList.add('hs-board');
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'hs-board__canvas';
  const labelLayer = document.createElement('div');
  labelLayer.className = 'hs-board__labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement, labelLayer);

  const scene = new Scene();
  const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const applyTheme = () => {
    scene.background = new Color(darkQuery?.matches ? BACKGROUND.dark : BACKGROUND.light);
    requestRender();
  };

  // Warm and bright: a soft sky/grass fill so nothing goes black, plus a low golden sun.
  scene.add(new HemisphereLight(0xfff3dc, 0x8fae5a, 2.1));
  const sun = new DirectionalLight(0xffd8a8, 2.4);
  sun.position.set(-4, 10, 6);
  scene.add(sun);

  const garden = createGarden(track);
  scene.add(garden.group);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 400);
  let view: View = { kind: 'whole' };
  let pose: CameraPose | null = null;
  let tween: { from: CameraPose; to: CameraPose; start: number } | null = null;

  const entries = new Map<string, BunnyEntry>();
  let frame = 0;
  let disposed = false;

  function requestRender() {
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  }

  function aspect() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    return w / h;
  }

  function targetPose(): CameraPose {
    if (view.kind === 'focus') {
      const e = entries.get(view.id);
      if (e) return focusOn({ x: e.spot.x, y: 0.5, z: e.spot.z });
    }
    if (view.kind === 'free' && pose) return pose;
    return wholePose();
  }

  let wholeCache: CameraPose | null = null;
  function wholePose(): CameraPose {
    wholeCache ??= fitWholeTrack();
    return wholeCache;
  }

  function limits(): Limits {
    const b = garden.bounds;
    return {
      minDistance: MIN_ZOOM_DISTANCE,
      maxDistance: distanceOf(wholePose()) * MAX_ZOOM_OUT,
      minX: b.minX,
      maxX: b.maxX,
      minZ: b.minZ,
      maxZ: b.maxZ,
    };
  }

  function fitWholeTrack(): CameraPose {
    // The whole track, tall enough to include the bunnies and their names.
    const points: Vec3[] = [];
    for (const s of track.stones) {
      points.push(
        { x: s.x, y: 0, z: s.z + s.radius * 1.2 },
        { x: s.x, y: BUNNY_HEIGHT + 0.6, z: s.z },
      );
    }
    for (const e of entries.values()) {
      points.push({ x: e.spot.x, y: 0, z: e.spot.z }, { x: e.spot.x, y: BUNNY_HEIGHT + 0.6, z: e.spot.z });
    }
    // Leave room above the track for the name labels, which are a fixed size in pixels.
    const h = container.clientHeight || 1;
    return fitPoints(points, { fov: FOV, aspect: aspect() }, 0.05, 0.05 + (2 * LABEL_ROOM_PX) / h);
  }

  function goTo(next: CameraPose) {
    const reduce = motionQuery?.matches ?? false;
    if (!pose || reduce) {
      pose = next;
      tween = null;
    } else {
      tween = { from: pose, to: next, start: performance.now() };
    }
    requestRender();
  }

  function applyPose(p: CameraPose) {
    camera.position.set(p.position.x, p.position.y, p.position.z);
    camera.lookAt(p.target.x, p.target.y, p.target.z);
  }

  function draw(now: number) {
    frame = 0;
    if (disposed) return;
    if (tween) {
      const t = Math.min(1, (now - tween.start) / TWEEN_MS);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      pose = lerpPose(tween.from, tween.to, k);
      if (t >= 1) tween = null;
      else requestRender();
    }
    if (pose) applyPose(pose);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    placeLabels();
  }

  const scratch = new Vector3();
  function placeLabels() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    // Nearest (lowest on screen) first, so far labels move out of the way.
    const items = [...entries.values()]
      .map((e) => {
        scratch.set(e.spot.x, 0, e.spot.z + 0.3).project(camera);
        const feet = (1 - scratch.y) * 0.5 * h;
        scratch.set(e.spot.x, BUNNY_HEIGHT + 0.08, e.spot.z).project(camera);
        return { e, x: (scratch.x + 1) * 0.5 * w, y: (1 - scratch.y) * 0.5 * h, feet, behind: scratch.z > 1 };
      })
      .sort((a, b) => b.y - a.y);
    for (const { e, x, y, feet, behind } of items) {
      if (!e.labelWidth) {
        e.labelWidth = e.label.offsetWidth;
        e.labelHeight = e.label.offsetHeight;
      }
      const lw = e.labelWidth;
      const lh = e.labelHeight;
      const left = x - lw / 2;
      const hitAt = (t: number) =>
        placed.find((p) => left < p.x + p.w && left + lw > p.x && t < p.y + p.h && t + lh > p.y);
      // First try above the bunny, moving up past labels already placed.
      let top = y - lh;
      for (let guard = 0; guard < 12; guard += 1) {
        const hit = hitAt(top);
        if (!hit) break;
        top = hit.y - lh - 2;
      }
      // Off the top of the screen: put it below the bunny's feet instead, moving down.
      if (top < 2) {
        top = feet + 4;
        for (let guard = 0; guard < 12; guard += 1) {
          const hit = hitAt(top);
          if (!hit) break;
          top = hit.y + hit.h + 2;
        }
      }
      placed.push({ x: left, y: top, w: lw, h: lh });
      e.label.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      e.label.style.visibility = behind ? 'hidden' : 'visible';
      // A thin stem between the label and its bunny, so a moved label still points home.
      const above = top < y;
      const stemTop = above ? top + lh : feet;
      const stemLength = Math.max(0, above ? y - stemTop : top - feet);
      e.stem.style.transform = `translate(${Math.round(x - 1)}px, ${Math.round(stemTop)}px)`;
      e.stem.style.height = `${Math.round(stemLength)}px`;
      e.stem.style.visibility = behind || stemLength < 3 ? 'hidden' : 'visible';
    }
  }

  function setPlayers(players: readonly BoardPlayer[]) {
    const spots = layoutBunnies(players, track);
    const seen = new Set<string>();
    players.forEach((p, i) => {
      const spot = spots[i];
      seen.add(p.id);
      let e = entries.get(p.id);
      if (!e) {
        const bunny = createBunny(p.color);
        scene.add(bunny.group);
        const label = document.createElement('div');
        label.className = 'hs-board__label';
        const stem = document.createElement('div');
        stem.className = 'hs-board__stem';
        labelLayer.append(stem, label);
        e = { bunny, label, stem, spot, labelWidth: 0, labelHeight: 0 };
        entries.set(p.id, e);
      }
      e.spot = spot;
      e.bunny.setColor(p.color);
      if (e.label.textContent !== p.name) {
        e.label.textContent = p.name;
        e.labelWidth = 0;
      }
      e.label.style.setProperty('--bunny', p.color);
      e.stem.style.setProperty('--bunny', p.color);
      e.label.style.color = textColourOn(p.color);

      const stone = track.stones[spot.stone];
      e.bunny.group.position.set(spot.x, 0.12, spot.z);
      // Face the camera, turned a little towards the way the path goes.
      e.bunny.group.rotation.y = 0.3 * stone.dirX;
    });
    for (const [id, e] of entries) {
      if (seen.has(id)) continue;
      scene.remove(e.bunny.group);
      e.bunny.dispose();
      e.label.remove();
      e.stem.remove();
      entries.delete(id);
    }
    wholeCache = null;
    goTo(targetPose());
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wholeCache = null;
    pose = targetPose();
    tween = null;
    requestRender();
  }

  const detachControls = attachControls(renderer.domElement, {
    pose: () => pose,
    lens: () => ({ fov: FOV, aspect: aspect() }),
    limits,
    move(next) {
      view = { kind: 'free' };
      tween = null;
      pose = next;
      requestRender();
    },
    reset() {
      view = { kind: 'whole' };
      goTo(targetPose());
    },
  });

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  darkQuery?.addEventListener('change', applyTheme);

  applyTheme();
  setPlayers(options.players);
  resize();

  return {
    setPlayers,
    showWholeTrack() {
      view = { kind: 'whole' };
      goTo(targetPose());
    },
    focusOn(playerId) {
      if (!entries.has(playerId)) return;
      view = { kind: 'focus', id: playerId };
      goTo(targetPose());
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      detachControls();
      darkQuery?.removeEventListener('change', applyTheme);
      for (const e of entries.values()) e.bunny.dispose();
      entries.clear();
      garden.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
      container.classList.remove('hs-board');
    },
  };
}

function lerpPose(a: CameraPose, b: CameraPose, k: number): CameraPose {
  const l = (p: Vec3, q: Vec3) => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, z: p.z + (q.z - p.z) * k });
  return { position: l(a.position, b.position), target: l(a.target, b.target) };
}

/** Dark text on light bunny colours, white text on dark ones. */
export function textColourOn(color: string): string {
  const c = new Color(color); // linear values
  const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return luminance > 0.2 ? '#2b2433' : '#ffffff';
}
