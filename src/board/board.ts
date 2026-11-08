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
import { BUNNY_HEIGHT, createBunny, type Bunny, type BunnyPose } from './bunny';
import { distanceOf, fitPoints, focusOn, FOCUS_DISTANCE, poseAt, type CameraPose, type Limits, type Vec3 } from './camera';
import { planRound, type RoundPlay } from './choreography';
import { attachControls } from './controls';
import { createEffects } from './effects';
import { createFrameWatch } from './frame-watch';
import { createGarden } from './garden';
import { layoutBunnies, stoneForScore, type BoardPlayer, type BunnySpot } from './layout';
import { droopAmount, easeInOut, hopHeight, squash, timeline, type Timeline, type TimedEvent } from './motion';
import { buildTrack } from './track';

export type { BoardPlayer } from './layout';
export type { RoundPlay } from './choreography';

export interface BoardOptions {
  trackLength: number;
  players: readonly BoardPlayer[];
  /** Overrides the phone's reduced-motion setting (the debug page uses it). */
  reducedMotion?: boolean;
  /** Told when a round starts and stops playing, for example to show a Skip button. */
  onPlayingChange?: (playing: boolean) => void;
  /** `lite` starts with fewer pixels and no dust or petals (the board was slow before). Default `full`. */
  quality?: BoardQuality;
  /**
   * Told when rounds play too slowly. `lite`: the board has turned its effects down by itself.
   * `flat`: still too slow at `lite`; the caller should swap the board for something simpler.
   */
  onSlow?: (next: 'lite' | 'flat') => void;
}

export type BoardQuality = 'full' | 'lite';

export interface Board {
  /** Updates names, colours and scores. Bunnies jump straight to their stones; a round playing is skipped first. */
  setPlayers(players: readonly BoardPlayer[]): void;
  /**
   * Plays one round from the current scores to `round.players`: hops, celebrations, the finale.
   * Always resolves, never rejects: when it ends, is skipped, is replaced by another round or
   * `setPlayers`, or the board is disposed.
   */
  play(round: RoundPlay): Promise<void>;
  /** Puts every bunny on its final stone at once. Does nothing when no round is playing. */
  skip(): void;
  /** Frames the whole track. This is the default view. Players can also pinch, drag and double-tap. */
  showWholeTrack(): void;
  /** Moves the camera in on one bunny. Unknown ids are ignored. */
  focusOn(playerId: string): void;
  dispose(): void;
}

const FOV = 40;
const BACKGROUND = { light: 0xfff7ec, dark: 0x1d1a24 };
const TWEEN_MS = 450;
/** The board shows where everyone was for this long before the first hop. */
const START_DELAY_MS = 400;
/** Bunnies make room on a stone in this long. */
const SLIDE_MS = 200;
/** Height of a hop, in bunny model units. */
const HOP_LIFT = 0.45;
/** How quickly a bunny turns to face where it goes, ms (time constant). */
const TURN_MS = 70;
/** How far the camera stays from a bunny it follows: close enough to see it, far enough to see where it goes. */
const FOLLOW_DISTANCE = FOCUS_DISTANCE * 1.6;
/** Space kept free above the track for a name label, in CSS pixels. */
const LABEL_ROOM_PX = 30;

interface BunnyEntry {
  bunny: Bunny;
  label: HTMLDivElement;
  stem: HTMLDivElement;
  spot: BunnySpot;
  labelWidth: number;
  labelHeight: number;
  /** Where the bunny stands now. Differs from `spot` only while it moves. */
  pos: { x: number; z: number };
  /** The stone it stands on now. */
  stone: number;
  move: Move | null;
  /** Which way it faces now, radians about the upright axis (0 faces the camera). */
  facing: number;
}

interface Move {
  kind: 'hop' | 'glide' | 'slide';
  from: { x: number; z: number };
  to: { x: number; z: number };
  start: number;
  duration: number;
}

/** A round being played. Times are `performance.now()` values. */
interface Playing {
  tl: Timeline;
  /** When the timeline's 0 is. */
  t0: number;
  final: BoardPlayer[];
  resolve: () => void;
  nextEvent: number;
  /** For each beat, how many of its hops have started. */
  stepsStarted: number[];
}

/**
 * `free` means the player has pinched or dragged; the camera then stays where they left it.
 * `follow` tracks a bunny while it moves during a round.
 */
type View = { kind: 'whole' } | { kind: 'focus'; id: string } | { kind: 'follow'; id: string } | { kind: 'free' };

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
  let quality: BoardQuality = options.quality ?? 'full';
  const pixelRatio = () => (quality === 'lite' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setPixelRatio(pixelRatio());
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
  const effects = createEffects();
  scene.add(effects.group);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 400);
  let view: View = { kind: 'whole' };
  let pose: CameraPose | null = null;
  let tween: { from: CameraPose; to: CameraPose; start: number } | null = null;

  const entries = new Map<string, BunnyEntry>();
  /** The players as last placed, in their given order (seat order). */
  let shown: BoardPlayer[] = [];
  let playing: Playing | null = null;
  let frame = 0;
  let lastFrame = 0;
  let disposed = false;
  /** Watches frame times while a round plays; see `slowDown`. */
  const frames = createFrameWatch();
  let gaveUp = false;

  const reduced = () => options.reducedMotion ?? motionQuery?.matches ?? false;

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
    if (view.kind === 'follow') {
      const e = entries.get(view.id);
      if (e) return poseAt({ x: e.pos.x, y: 0.5, z: e.pos.z }, FOLLOW_DISTANCE);
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
    if (!pose || reduced()) {
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
    const dt = lastFrame ? now - lastFrame : 16;
    // Only frames drawn one after another count; the first after a rest has no real duration.
    if (playing && lastFrame && frames.add(dt)) {
      slowDown();
      // The caller may have swapped the board out in `onSlow`.
      if (disposed) return;
    }
    lastFrame = now;
    let busy = false;
    if (playing) {
      advance(now);
      busy = true;
    }
    if (poseBunnies(now, dt)) busy = true;
    if (playing && now - playing.t0 >= playing.tl.duration && ![...entries.values()].some((e) => e.move)) {
      finish(false);
    }
    if (effects.update(dt)) busy = true;
    if (view.kind === 'follow' && pose) {
      // Ease towards the moving bunny rather than snapping to it.
      pose = lerpPose(pose, targetPose(), 1 - Math.exp(-dt / 220));
      tween = null;
    }
    if (busy) requestRender();
    else lastFrame = 0;
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
        scratch.set(e.pos.x, 0, e.pos.z + 0.3).project(camera);
        const feet = (1 - scratch.y) * 0.5 * h;
        scratch.set(e.pos.x, BUNNY_HEIGHT + 0.08, e.pos.z).project(camera);
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

  /** Starts the hops that are due, and the events (dust, petals, camera) that are due. */
  function advance(now: number) {
    const p = playing!;
    const t = now - p.t0;
    if (t < 0) return;
    p.tl.beats.forEach((tb, i) => {
      if (tb.beat.kind !== 'hop') return;
      const { id, stones } = tb.beat;
      while (p.stepsStarted[i] < stones.length && t >= tb.start + p.stepsStarted[i] * tb.stepMs) {
        const k = p.stepsStarted[i];
        p.stepsStarted[i] += 1;
        startHop(id, stones[k], p.t0 + tb.start + k * tb.stepMs, tb.stepMs, tb.glide);
      }
    });
    const events = p.tl.events;
    while (playing === p && p.nextEvent < events.length && events[p.nextEvent].at <= t) {
      handleEvent(events[p.nextEvent]);
      p.nextEvent += 1;
    }
  }

  function handleEvent(event: TimedEvent) {
    if (event.kind === 'settle') {
      if (view.kind !== 'free') {
        view = { kind: 'whole' };
        goTo(targetPose());
      }
      return;
    }
    const e = entries.get(event.id);
    if (!e) return;
    if (event.kind === 'dust') {
      if (quality === 'full') effects.spawnDust(e.pos);
    } else if (event.kind === 'petals') {
      if (quality === 'full') effects.spawnPetals(e.pos);
    }
    else if (view.kind !== 'free') view = { kind: 'follow', id: event.id };
  }

  /**
   * One bunny sets off for the next stone. It lands on the spot it will have there among the
   * bunnies already standing on it, and those on the stones it leaves and lands on make room.
   */
  function startHop(id: string, stone: number, start: number, duration: number, glide: boolean) {
    const mover = entries.get(id);
    if (!mover) return;
    mover.stone = stone;
    const now = shown.map((p) => ({ ...p, score: entries.get(p.id)!.stone }));
    const spots = layoutBunnies(now, track);
    now.forEach((p, i) => {
      const e = entries.get(p.id)!;
      const to = { x: spots[i].x, z: spots[i].z };
      e.spot = spots[i];
      const heading = e.move ? e.move.to : e.pos;
      if (e === mover) {
        // The last hop has ended by now even if no frame drew its landing: start from its stone.
        const landed = e.move && e.move.start + e.move.duration <= start ? e.move.to : e.pos;
        e.move = { kind: glide ? 'glide' : 'hop', from: { ...landed }, to, start, duration };
      } else if (Math.hypot(heading.x - to.x, heading.z - to.z) > 1e-3) {
        e.move = { kind: 'slide', from: { ...e.pos }, to, start, duration: SLIDE_MS };
      }
    });
  }

  /** Moves and poses every bunny for this frame. Returns true while any is still moving or turning. */
  function poseBunnies(now: number, dt: number): boolean {
    if (!playing && ![...entries.values()].some((e) => e.move || e.facing !== restFacing(e))) return false;
    let moving = false;
    for (const [id, e] of entries) {
      const pose: BunnyPose = {};
      // A hopping or gliding bunny faces where it goes; otherwise it turns back to the camera.
      const m0 = e.move;
      const travelling = m0 && m0.kind !== 'slide' && now >= m0.start;
      const want = travelling ? Math.atan2(m0.to.x - m0.from.x, m0.to.z - m0.from.z) : restFacing(e);
      e.facing = turnTowards(e.facing, want, dt);
      if (e.facing !== want) moving = true;
      if (e.move) {
        const m = e.move;
        const u = (now - m.start) / m.duration;
        if (u >= 1) {
          e.pos = { ...m.to };
          e.move = null;
        } else if (u >= 0) {
          moving = true;
          const k = m.kind === 'slide' ? easeInOut(u) : u;
          e.pos = { x: m.from.x + (m.to.x - m.from.x) * k, z: m.from.z + (m.to.z - m.from.z) * k };
          if (m.kind === 'hop') {
            pose.lift = hopHeight(u) * HOP_LIFT;
            pose.squash = squash(u);
          }
        } else {
          moving = true;
        }
      }
      if (playing) Object.assign(pose, beatPose(id, now - playing.t0));
      e.bunny.setPose(pose);
      placeBunny(e);
    }
    return moving;
  }

  /** The celebration, droop or finale pose for one bunny at time `t` of the round. */
  function beatPose(id: string, t: number): BunnyPose {
    for (const tb of playing!.tl.beats) {
      const { beat } = tb;
      if (t < tb.start || t > tb.start + tb.duration) continue;
      const local = t - tb.start;
      if (beat.kind === 'hop' && beat.big && beat.id === id) {
        const moving = beat.stones.length * tb.stepMs;
        if (local < moving) continue;
        const u = (local - moving) / (tb.duration - moving);
        return { spin: easeInOut(u) * Math.PI * 2, lift: hopHeight(u) * 0.35 };
      }
      if (beat.kind === 'cheer' && beat.id === id) {
        const u = local / tb.duration;
        return { spin: easeInOut(u) * Math.PI * 2, lift: hopHeight(u) * 0.35 };
      }
      if (beat.kind === 'droop' && beat.id === id) {
        return { droop: droopAmount(local / tb.duration) };
      }
      if (beat.kind === 'finale') {
        const u = local / tb.duration;
        const fade = Math.min(1, (1 - u) * 8);
        if (beat.winners.includes(id)) {
          return { spin: easeInOut(u) * Math.PI * 4, lift: Math.abs(Math.sin(u * Math.PI * 6)) * 0.4 * fade };
        }
        if (beat.others.includes(id)) {
          const clap = Math.abs(Math.sin(u * Math.PI * 10));
          return { lift: clap * 0.12 * fade, droop: -0.12 * clap * fade };
        }
      }
    }
    return {};
  }

  /** At rest a bunny faces the camera, turned a little towards the way the path goes. */
  function restFacing(e: BunnyEntry): number {
    return 0.3 * track.stones[e.stone].dirX;
  }

  function placeBunny(e: BunnyEntry) {
    e.bunny.group.position.set(e.pos.x, 0.12, e.pos.z);
    e.bunny.group.rotation.y = e.facing;
  }

  /** Ends the round: everyone on their final spot, at rest. */
  function finish(skipped: boolean) {
    const p = playing;
    if (!p) return;
    playing = null;
    if (skipped) effects.clear();
    place(p.final);
    // A skip always shows the whole result; a tap's tiny finger jitter has already made the view
    // `free`. A round that ends on its own leaves a camera the player moved where it is.
    if (skipped || view.kind === 'follow') view = { kind: 'whole' };
    goTo(targetPose());
    p.resolve();
    options.onPlayingChange?.(false);
  }

  /** Rounds play too slowly: first fewer pixels and no particles, then ask for a simpler board. */
  function slowDown() {
    if (quality === 'full') {
      quality = 'lite';
      effects.clear();
      renderer.setPixelRatio(pixelRatio());
      frames.reset();
      options.onSlow?.('lite');
    } else if (!gaveUp) {
      gaveUp = true;
      options.onSlow?.('flat');
    }
  }

  function play(round: RoundPlay): Promise<void> {
    if (disposed) return Promise.resolve();
    finish(true);
    const known = round.players.length === entries.size && round.players.every((p) => entries.has(p.id));
    if (!known) {
      place(round.players);
      return Promise.resolve();
    }
    const tl = timeline(planRound(shown, round, track.length), { reduced: reduced() });
    // Names and colours change at once; positions move with the round.
    for (const p of round.players) dressEntry(entries.get(p.id)!, p);
    frames.reset();
    return new Promise((resolve) => {
      playing = {
        tl,
        t0: performance.now() + START_DELAY_MS,
        final: [...round.players],
        resolve,
        nextEvent: 0,
        stepsStarted: tl.beats.map(() => 0),
      };
      options.onPlayingChange?.(true);
      requestRender();
    });
  }

  function dressEntry(e: BunnyEntry, p: BoardPlayer) {
    e.bunny.setColor(p.color);
    if (e.label.textContent !== p.name) {
      e.label.textContent = p.name;
      e.labelWidth = 0;
    }
    e.label.style.setProperty('--bunny', p.color);
    e.stem.style.setProperty('--bunny', p.color);
    e.label.style.color = textColourOn(p.color);
  }

  function setPlayers(players: readonly BoardPlayer[]) {
    finish(true);
    place(players);
  }

  function place(players: readonly BoardPlayer[]) {
    shown = [...players];
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
        e = { bunny, label, stem, spot, labelWidth: 0, labelHeight: 0, pos: { x: spot.x, z: spot.z }, stone: spot.stone, move: null, facing: 0 };
        entries.set(p.id, e);
      }
      e.spot = spot;
      e.pos = { x: spot.x, z: spot.z };
      e.stone = stoneForScore(p.score, track.length);
      e.move = null;
      e.facing = restFacing(e);
      dressEntry(e, p);
      e.bunny.setPose({});
      placeBunny(e);
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
    tap() {
      finish(true);
    },
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
  place(options.players);
  resize();
  // Compile the shaders now, so the first hop of a round does not stutter.
  renderer.compile(scene, camera);

  return {
    setPlayers,
    play,
    skip() {
      finish(true);
    },
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
      // The round's promise still resolves, but nothing else is told.
      const pending = playing;
      playing = null;
      pending?.resolve();
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      detachControls();
      darkQuery?.removeEventListener('change', applyTheme);
      for (const e of entries.values()) e.bunny.dispose();
      entries.clear();
      garden.dispose();
      effects.dispose();
      renderer.dispose();
      // Free the WebGL context now: the scores screen makes a new board every round.
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelLayer.remove();
      container.classList.remove('hs-board');
    },
  };
}

/** Turns `from` towards `to` the short way round, easing in over about TURN_MS; snaps when close. */
function turnTowards(from: number, to: number, dt: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  if (Math.abs(diff) < 0.01) return to;
  return from + diff * (1 - Math.exp(-dt / TURN_MS));
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
