import { useEffect, useRef, useState } from 'react';
import { AppState, PanResponder, Platform, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import * as THREE from 'three';
import * as Haptics from 'expo-haptics';
import { reduceMotion } from '../../lib/motion';
import type { Mood, PetKind } from '../../lib/api';
import { buildPet, faceFor, type PetRig } from './model';
import { PetArt } from '../Pet';

export type Trick = 'sit' | 'paw' | 'spin' | 'roll' | 'bow' | 'beg' | 'zoomies' | 'dance';
export type PetAction = { name: Trick | 'treat' | 'pat' | 'wake' | 'eat' | 'shake'; id: number };
/** How the dog is doing right now: mud on the coat, messes on the floor, sleepy, poorly or napping. */
export type PetCare = { dirt: number; mess: number; tired: boolean; sick: boolean; napping: boolean };
export type FetchThrow = { id: number; power: number; perfect: boolean };

type Props = {
  kind?: PetKind;
  color: string;
  mood: Mood;
  stage: number;
  wearing?: string | null;
  size?: number;
  height?: number;
  /** Bump this number to make the pet celebrate, for example after a walk is logged. */
  celebrate?: number;
  /** Plays a trick or reaction once each time the id changes. */
  action?: PetAction | null;
  /** Fetch minigame: throws the ball each time the id changes. */
  fetchThrow?: FetchThrow | null;
  onFetchDone?: (caught: boolean) => void;
  /** Lets the pet fall asleep late at night. */
  sleepy?: boolean;
  onTap?: () => void;
  onPat?: () => void;
  interactive?: boolean;
  /** Pull the camera back, for fetch. */
  wide?: boolean;
  care?: PetCare | null;
  /** Bath foam, 0 to 1. */
  bubbles?: number;
};

/** Last 3D problem on this phone, shown in Settings so we can see why the flat drawing appeared. */
export let pet3dStatus: string = 'Not started';

/**
 * Expo's Android GL context differs from a browser's in a few places that three.js trips over.
 * These are the same fixes react-three-fiber applies on native: shader logs come back empty
 * instead of as text, and only one pixelStorei setting is supported.
 */
function patchExpoGL(gl: ExpoWebGLRenderingContext) {
  if (Platform.OS === 'web') return;
  const g = gl as unknown as Record<string, unknown> & { __patched?: boolean; UNPACK_FLIP_Y_WEBGL: number };
  if (g.__patched) return;
  g.__patched = true;
  const pixelStorei = gl.pixelStorei.bind(gl);
  g.pixelStorei = (param: number, value: number | boolean) => { if (param === g.UNPACK_FLIP_Y_WEBGL) pixelStorei(param, value as number); };
  const programLog = gl.getProgramInfoLog.bind(gl);
  g.getProgramInfoLog = (p: WebGLProgram) => programLog(p) ?? '';
  const shaderLog = gl.getShaderInfoLog.bind(gl);
  g.getShaderInfoLog = (s: WebGLShader) => shaderLog(s) ?? '';
}

const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 5; };
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 → 1 → 0 bump across a window. */
const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI));

export const TRICK_INFO: Record<Trick, { label: string; seconds: number }> = {
  sit: { label: 'Sit', seconds: 1.4 },
  paw: { label: 'High five', seconds: 1.8 },
  spin: { label: 'Spin', seconds: 1.4 },
  roll: { label: 'Roll over', seconds: 2 },
  bow: { label: 'Play bow', seconds: 1.8 },
  beg: { label: 'Beg', seconds: 2 },
  zoomies: { label: 'Zoomies', seconds: 2.8 },
  dance: { label: 'Dance', seconds: 3.2 },
};
const ACTION_SECONDS: Record<string, number> = { ...Object.fromEntries(Object.entries(TRICK_INFO).map(([k, v]) => [k, v.seconds])), treat: 2.4, pat: 1.6, wake: 1, eat: 3.4, shake: 1.6 };

/**
 * The dog in real 3D. Breathes, blinks, wags, twitches its ears, does tricks, eats treats,
 * plays fetch, celebrates on cue, sleeps at night and spins when dragged. Stroke it to pat it.
 * Falls back to the flat drawing if the phone cannot start 3D.
 */
export function Pet3D({
  kind = 'dog', color, mood, stage, wearing = null, size = 220, height, celebrate = 0, action = null, fetchThrow = null,
  onFetchDone, sleepy = true, onTap, onPat, interactive = true, wide = false, care = null, bubbles = 0,
}: Props) {
  const [failed, setFailed] = useState(false);
  const props = useRef({ kind, color, mood, stage, sleepy, wearing, wide, care, bubbles });
  props.current = { kind, color, mood, stage, sleepy, wearing, wide, care, bubbles };
  const events = useRef({
    jump: -10, celebrate: -10, spinVel: 0, spin: 0, wokeAt: -100, now: 0,
    action: null as null | { name: string; at: number },
    fetch: null as null | { at: number; power: number; perfect: boolean; done: boolean },
    patting: 0,
  });
  const active = useRef(true);
  const raf = useRef<number | null>(null);
  const loopRef = useRef<(() => void) | null>(null);
  const cb = useRef({ onTap, onPat, onFetchDone });
  cb.current = { onTap, onPat, onFetchDone };
  const h = height ?? size;

  // Celebrate when the counter changes.
  const lastCelebrate = useRef(celebrate);
  useEffect(() => {
    if (celebrate !== lastCelebrate.current) {
      lastCelebrate.current = celebrate;
      events.current.celebrate = events.current.now;
      events.current.wokeAt = events.current.now;
    }
  }, [celebrate]);
  const lastAction = useRef(action?.id ?? 0);
  useEffect(() => {
    if (action && action.id !== lastAction.current) {
      lastAction.current = action.id;
      events.current.action = { name: action.name, at: events.current.now };
      events.current.wokeAt = events.current.now;
    }
  }, [action]);
  const lastFetch = useRef(fetchThrow?.id ?? 0);
  useEffect(() => {
    if (fetchThrow && fetchThrow.id !== lastFetch.current) {
      lastFetch.current = fetchThrow.id;
      events.current.fetch = { at: events.current.now, power: fetchThrow.power, perfect: fetchThrow.perfect, done: false };
      events.current.wokeAt = events.current.now;
    }
  }, [fetchThrow]);

  // Pause the render loop while the screen is hidden or the app is in the background.
  const resume = () => { if (!active.current) { active.current = true; loopRef.current?.(); } };
  const pause = () => { active.current = false; if (raf.current != null) cancelAnimationFrame(raf.current); raf.current = null; };
  useFocusEffect(() => { resume(); return pause; });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? resume() : pause()));
    return () => { sub.remove(); pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap to bounce, drag sideways to spin, stroke up and down to pat.
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderMove: (_e, g) => {
      if (Math.abs(g.dy) > Math.abs(g.dx) * 1.3) {
        events.current.patting = events.current.now;
      } else {
        events.current.spinVel = g.vx * 0.35;
      }
    },
    onPanResponderRelease: (_e, g) => {
      const ev = events.current;
      if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
        ev.jump = ev.now;
        ev.wokeAt = ev.now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        cb.current.onTap?.();
      } else if (Math.abs(g.dy) > Math.abs(g.dx) * 1.3) {
        ev.action = { name: 'pat', at: ev.now };
        ev.wokeAt = ev.now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        cb.current.onPat?.();
      }
    },
    onPanResponderTerminationRequest: () => true,
  })).current;

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      patchExpoGL(gl);
      pet3dStatus = 'Starting';
      const w = gl.drawingBufferWidth;
      const hh = gl.drawingBufferHeight;
      const canvas = {
        width: w, height: hh, style: {}, clientWidth: w, clientHeight: hh,
        addEventListener: () => undefined, removeEventListener: () => undefined, getContext: () => gl,
      } as unknown as HTMLCanvasElement;
      // Expo's WebGL 2 context inherits from the WebGL 1 class, which three.js reads as WebGL 1 and rejects.
      // Hide the WebGL 1 class while the renderer starts so it sees the WebGL 2 context it really is.
      const g = globalThis as unknown as { WebGLRenderingContext?: unknown };
      const savedGL1 = g.WebGLRenderingContext;
      if (Platform.OS !== 'web') g.WebGLRenderingContext = undefined;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true });
      } finally {
        if (Platform.OS !== 'web') g.WebGLRenderingContext = savedGL1;
      }
      renderer.setPixelRatio(1);
      renderer.setSize(w, hh, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, w / hh, 0.1, 60);
      const camNear = { pos: new THREE.Vector3(0.9, 1.9, 6.6), look: new THREE.Vector3(0, 1.05, 0) };
      const camWide = { pos: new THREE.Vector3(1.6, 3.2, 9.5), look: new THREE.Vector3(0, 0.9, -2.2) };
      camera.position.copy(camNear.pos);
      camera.lookAt(camNear.look);
      const look = camNear.look.clone();

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f9e, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2.5, 4, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xb9c0ff, 1.4);
      rim.position.set(-3, 2.5, -3);
      scene.add(rim);

      // Floating hearts, music notes and sparkles.
      const heartShape = new THREE.Shape();
      heartShape.moveTo(0, -0.12);
      heartShape.bezierCurveTo(-0.02, -0.06, -0.16, -0.02, -0.16, 0.08);
      heartShape.bezierCurveTo(-0.16, 0.16, -0.06, 0.2, 0, 0.12);
      heartShape.bezierCurveTo(0.06, 0.2, 0.16, 0.16, 0.16, 0.08);
      heartShape.bezierCurveTo(0.16, -0.02, 0.02, -0.06, 0, -0.12);
      const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
      const heartMat = new THREE.MeshStandardMaterial({ color: 0xf56f9a, roughness: 0.4, transparent: true });
      const hearts = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(heartGeo, heartMat); m.visible = false; scene.add(m); return m; });
      const sparkGeo = new THREE.OctahedronGeometry(0.06);
      const sparkMat = new THREE.MeshStandardMaterial({ color: 0xf2c96b, emissive: 0xf2c96b, emissiveIntensity: 0.8, transparent: true });
      const sparks = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(sparkGeo, sparkMat); m.visible = false; scene.add(m); return m; });
      const zGeo = new THREE.TorusGeometry(0.06, 0.018, 6, 12);
      const zMat = new THREE.MeshStandardMaterial({ color: 0xb9c0ff, transparent: true });
      const zzz = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(zGeo, zMat); m.visible = false; scene.add(m); return m; });

      let rig: PetRig | null = null;
      let rigKey = '';
      const clock = new THREE.Clock();
      const ev = events.current;
      let nextBlink = 2;
      let blinkUntil = 0;
      let twitch = { at: 3, ear: 0 };
      let tilt = { at: 5, dir: 1 };
      const still = reduceMotion();
      const tmp = new THREE.Vector3();

      let frames = 0;
      const frame = () => {
        if (!active.current) return;
        try { draw(); } catch (e) {
          pet3dStatus = `Stopped: ${(e as Error).message}`;
          console.warn('3D pet stopped, using the flat drawing', e);
          setFailed(true);
          return;
        }
        if (++frames === 30) pet3dStatus = 'Running';
        raf.current = requestAnimationFrame(frame);
      };
      const draw = () => {
        const t = clock.getElapsedTime();
        ev.now = t;
        const p = props.current;

        const k = `${p.color}|${p.stage}|${p.wearing}`;
        if (k !== rigKey) {
          if (rig) { scene.remove(rig.root); scene.remove(rig.ball); scene.remove(rig.bowl); scene.remove(rig.messes); rig.dispose(); }
          rig = buildPet(p.kind, p.color, p.stage, p.wearing);
          rig.bone.position.set(0, -0.42, 0.9);
          rig.head.add(rig.bone);
          rig.bowl.position.set(0, 0, 1.2);
          scene.add(rig.root);
          scene.add(rig.ball);
          scene.add(rig.bowl);
          scene.add(rig.messes);
          rigKey = k;
        }
        const r = rig!;

        // Camera eases between the close view and the wide fetch view.
        const target = p.wide ? camWide : camNear;
        camera.position.lerp(target.pos, 0.06);
        look.lerp(target.look, 0.06);
        camera.lookAt(look);

        const act = ev.action && t - ev.action.at < (ACTION_SECONDS[ev.action.name] ?? 1.5) ? ev.action : null;
        const at = act ? (t - act.at) / (ACTION_SECONDS[act.name] ?? 1.5) : 0;
        const care = p.care;
        const asleep = !act && (care?.napping ? t - ev.wokeAt > 2.5 : p.sleepy && isNight() && t - ev.wokeAt > 20);
        const sick = !!care?.sick;
        const tired = !!care?.tired && !sick;
        const celebrating = t - ev.celebrate < 2.4;
        const patting = t - ev.patting < 0.4 || act?.name === 'pat';
        const happyNow = celebrating || patting || (act && act.name !== 'wake');
        const face = faceFor(happyNow ? 'thrilled' : sick ? 'sad' : p.mood, asleep);

        // Reset the pose each frame, then layer idle motion and any action on top.
        r.root.position.set(0, 0, 0);
        r.root.rotation.set(0, 0, 0);
        r.body.position.set(0, 0, 0);
        r.body.rotation.set(0, 0, 0);
        r.head.rotation.set(0, 0, 0);
        r.frontLegs.forEach((l) => l.rotation.set(0, 0, 0));
        r.backLegs.forEach((l) => l.rotation.set(0, 0, 0));
        r.bone.visible = false;

        // Blink every few seconds.
        if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random() * 3; }
        const blinking = t < blinkUntil && (face.eyes === 'open' || face.eyes === 'sad');
        for (const [name, gr] of Object.entries(r.eyes)) {
          gr.visible = name === face.eyes;
          gr.scale.y = gr.visible && blinking ? 0.12 : gr.visible && tired && !happyNow && name === 'open' ? 0.55 : 1;
        }
        for (const [name, m] of Object.entries(r.mouths)) m.visible = name === face.mouth;
        r.cheeks.visible = face.cheeks;
        // Panting when happy.
        r.tongue.visible = face.tongue && !asleep;
        r.tongue.scale.y = 1 + Math.sin(t * 9) * 0.12;

        const energy = asleep ? 0.2 : celebrating ? 1.6 : sick ? 0.25 : ({ thrilled: 1.3, happy: 1, new: 0.9, okay: 0.6, sad: 0.35 } as Record<Mood, number>)[p.mood] * (tired ? 0.55 : 1);

        // Care: mud on the coat, foam in the bath, messes on the floor, ice pack when poorly.
        const dirtCount = Math.round(clamp01(care?.dirt ?? 0) * r.mud.length);
        r.mud.forEach((m, i) => { m.visible = i < dirtCount; });
        const foam = Math.round(clamp01(p.bubbles) * r.bubbles.length);
        r.bubbles.forEach((m, i) => {
          m.visible = i < foam;
          if (m.visible) {
            const b = m.userData.base as THREE.Vector3;
            m.position.set(b.x, b.y + Math.sin(t * 3 + i) * 0.02, b.z);
            m.scale.setScalar(1 + Math.sin(t * 4 + i * 1.7) * 0.08);
          }
        });
        r.messes.children.forEach((m, i) => { m.visible = !p.wide && i < (care?.mess ?? 0); });
        r.icePack.visible = sick;
        r.bowl.visible = false;

        // Breathing and a little bounce.
        const breathe = Math.sin(t * (asleep ? 1.2 : 2.2)) * (asleep ? 0.03 : 0.02);
        r.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
        let y = still || act ? 0 : Math.max(0, Math.sin(t * 2.4 * energy)) * 0.04 * energy;

        // Tap: hop.
        const jt = t - ev.jump;
        if (jt < 0.6) {
          y += bump(jt / 0.6) * 0.5;
          r.frontLegs.forEach((l) => { l.rotation.x = -bump(jt / 0.6) * 0.6; });
        }
        if (celebrating) {
          const ct = t - ev.celebrate;
          y += Math.abs(Math.sin(ct * Math.PI * 1.25)) * 0.42;
          r.frontLegs.forEach((l, i) => { l.rotation.x = -0.4 - Math.abs(Math.sin(ct * 8 + i)) * 0.5; });
        }

        // Turning: drag to spin, otherwise a gentle look around.
        ev.spin += ev.spinVel;
        ev.spinVel *= 0.92;
        if (Math.abs(ev.spinVel) < 0.002) ev.spin = (ev.spin % (Math.PI * 2)) * 0.97;
        const celebrateSpin = celebrating ? Math.min(1, (t - ev.celebrate) / 1.2) * Math.PI * 2 : 0;
        const lookAround = still || asleep || act ? 0 : Math.sin(t * 0.45) * 0.3 * Math.min(1, energy);
        let rotY = ev.spin + celebrateSpin + lookAround;

        // Head tilt now and then.
        if (t > tilt.at) tilt = { at: t + 4 + Math.random() * 5, dir: Math.random() > 0.5 ? 1 : -1 };
        const tiltPhase = Math.max(0, 1 - Math.abs(t - (tilt.at - 2)) / 0.8);
        r.head.rotation.z = tiltPhase * 0.22 * tilt.dir;

        let tailWag = asleep ? 0.05 : 0.3 + energy * 0.35;
        let earPerk = 0;
        let x = 0;
        let z = 0;

        // Sleeping: lie down, head on paws.
        if (asleep) {
          r.body.rotation.x = 0.35;
          r.body.position.set(0, -0.28, 0.12);
          r.frontLegs.forEach((l) => { l.rotation.x = -1.25; });
          r.head.rotation.x = 0.35;
        }

        if (act) {
          const s = at;
          switch (act.name) {
            case 'sit': {
              const d = bump(s);
              r.body.position.y = -0.12 * d;
              r.head.rotation.x = Math.sin(s * Math.PI * 4) * 0.15 * d;
              earPerk = d;
              break;
            }
            case 'paw': {
              const d = bump(s);
              r.frontLegs[1].rotation.x = -1.7 * d;
              r.frontLegs[1].rotation.z = Math.sin(s * Math.PI * 6) * 0.25 * d;
              r.body.rotation.z = 0.08 * d;
              r.head.rotation.z = -0.15 * d;
              earPerk = d;
              break;
            }
            case 'spin': {
              rotY += ease(s) * Math.PI * 2;
              y += bump(s) * 0.25;
              tailWag = 0.9;
              break;
            }
            case 'roll': {
              // Flop down, roll onto the back and up the other side.
              const d = bump(s);
              r.body.position.y = -0.45 * d;
              r.body.rotation.z = ease(clamp01((s - 0.1) / 0.8)) * Math.PI * 2;
              r.frontLegs.forEach((l) => { l.rotation.x = -1.2 * d; });
              break;
            }
            case 'bow': {
              const d = bump(s);
              r.body.rotation.x = 0.55 * d;
              r.body.position.set(0, -0.15 * d, 0.1 * d);
              r.frontLegs.forEach((l) => { l.rotation.x = -1.4 * d; });
              r.head.rotation.x = -0.45 * d;
              tailWag = 1.2;
              earPerk = d;
              break;
            }
            case 'beg': {
              const d = bump(s);
              r.body.rotation.x = -0.45 * d;
              r.body.position.y = 0.2 * d;
              r.frontLegs.forEach((l, i) => { l.rotation.x = -1.3 * d + Math.sin(s * Math.PI * 8 + i) * 0.2 * d; });
              r.head.rotation.x = -0.25 * d;
              earPerk = d;
              break;
            }
            case 'zoomies': {
              const a = ease(s) * Math.PI * 4;
              const rad = 1.3 * bump(s * 0.999 + 0.0005) ** 0.3;
              x = Math.sin(a) * rad;
              z = (Math.cos(a) - 1) * rad;
              rotY = a + Math.PI / 2;
              y += Math.abs(Math.sin(t * 16)) * 0.12;
              r.frontLegs.forEach((l, i) => { l.rotation.x = Math.sin(t * 22 + i * Math.PI) * 0.8; });
              r.backLegs.forEach((l, i) => { l.rotation.x = Math.sin(t * 22 + i * Math.PI + 1) * 0.5; });
              tailWag = 1.2;
              break;
            }
            case 'dance': {
              x = Math.sin(s * Math.PI * 4) * 0.35;
              y += Math.abs(Math.sin(s * Math.PI * 8)) * 0.18;
              r.body.rotation.z = Math.sin(s * Math.PI * 8) * 0.18;
              r.body.rotation.x = -0.25;
              r.frontLegs.forEach((l, i) => { l.rotation.x = -1.2 + Math.sin(s * Math.PI * 8 + i * Math.PI) * 0.6; });
              r.head.rotation.z = Math.sin(s * Math.PI * 8 + 1) * 0.25;
              tailWag = 1.3;
              break;
            }
            case 'treat': {
              // Bone appears at the mouth, two chomps, gone, happy wiggle.
              r.bone.visible = s < 0.65;
              r.bone.scale.setScalar(Math.max(0.01, 1 - clamp01((s - 0.2) / 0.45)));
              r.head.rotation.x = Math.sin(s * Math.PI * 10) * 0.12 * (s < 0.65 ? 1 : 0) + 0.15 * bump(s);
              r.mouths.grin.visible = Math.sin(s * Math.PI * 10) > 0;
              r.mouths.smile.visible = !r.mouths.grin.visible;
              y += s > 0.65 ? bump((s - 0.65) / 0.35) * 0.3 : 0;
              tailWag = 1.2;
              break;
            }
            case 'eat': {
              // Bowl appears, head dips in for a few mouthfuls, kibble disappears, happy lick.
              r.bowl.visible = s < 0.92;
              const kib = r.bowl.userData.kibble as THREE.Object3D[];
              kib.forEach((k, i) => { k.visible = i >= Math.floor(clamp01((s - 0.12) / 0.65) * kib.length); });
              const d = bump(clamp01(s / 0.85));
              r.body.rotation.x = 0.42 * d;
              r.body.position.set(0, -0.12 * d, 0.12 * d);
              r.head.rotation.x = 0.55 * d + (s > 0.12 && s < 0.8 ? Math.abs(Math.sin(s * Math.PI * 14)) * 0.18 : 0);
              r.frontLegs.forEach((l) => { l.rotation.x = -0.3 * d; });
              r.tongue.visible = s > 0.8;
              tailWag = 1.1;
              break;
            }
            case 'shake': {
              const d = bump(s);
              r.body.rotation.z = Math.sin(s * Math.PI * 16) * 0.32 * d;
              r.head.rotation.z = -Math.sin(s * Math.PI * 16) * 0.4 * d;
              earPerk = Math.sin(s * Math.PI * 16) * d;
              tailWag = 1.4;
              break;
            }
            case 'pat': {
              const d = bump(s);
              r.head.rotation.z = Math.sin(s * Math.PI * 3) * 0.25 * d;
              r.head.rotation.x = 0.12 * d;
              earPerk = -d;
              tailWag = 1.1;
              break;
            }
            default:
              break;
          }
        }

        // Fetch: the ball flies out, the dog either leaps to catch it or runs out, grabs it and brings it back.
        const f = ev.fetch;
        r.ball.visible = false;
        if (f) {
          const ft = t - f.at;
          const dist = 2.2 + f.power * 3.2;
          const flight = 0.9;
          const start = new THREE.Vector3(0.6, 2.4, 4.2);
          const land = new THREE.Vector3(0.3, 0.14, -dist);
          const runOut = 0.35 + dist * 0.16;
          const ballAt = (u: number) => tmp.copy(start).lerp(land, u).setY(start.y + (land.y - start.y) * u + Math.sin(u * Math.PI) * (1.6 + f.power));
          if (f.perfect) {
            // Leap and catch in the air above the dog.
            const catchAt = 0.55;
            if (ft < flight * catchAt) {
              r.ball.visible = true;
              r.ball.position.copy(ballAt(ft / flight));
              r.head.rotation.x = -0.4;
              earPerk = 1;
            } else if (ft < flight * catchAt + 1.6) {
              const u = (ft - flight * catchAt) / 1.6;
              y += bump(u) * 1.3;
              r.body.rotation.x = -0.5 * bump(u);
              r.frontLegs.forEach((l) => { l.rotation.x = -1.5 * bump(u); });
              rotY += u * Math.PI * 2;
              r.ball.visible = true;
              r.head.updateWorldMatrix(true, false);
              r.ball.position.copy(r.head.localToWorld(tmp.set(0, -0.35, 0.95)));
              tailWag = 1.3;
            } else if (!f.done) {
              f.done = true;
              cb.current.onFetchDone?.(true);
            }
          } else {
            const back = runOut;
            const total = flight + runOut + 0.3 + back;
            if (ft < flight) {
              r.ball.visible = true;
              r.ball.position.copy(ballAt(ft / flight));
              r.head.rotation.x = -0.3;
              earPerk = 1;
            } else if (ft < total) {
              r.ball.visible = true;
              const u = ft - flight;
              let pos = 0;
              if (u < runOut) { pos = ease(u / runOut); rotY = Math.PI; }
              else if (u < runOut + 0.3) { pos = 1; rotY = Math.PI; r.body.rotation.x = 0.4; r.head.rotation.x = 0.5; }
              else { pos = 1 - ease((u - runOut - 0.3) / back); rotY = 0; }
              z = -dist * pos * 0.92;
              x = land.x * pos;
              const running = u < runOut || u > runOut + 0.3;
              if (running) {
                y += Math.abs(Math.sin(t * 16)) * 0.15;
                r.frontLegs.forEach((l, i) => { l.rotation.x = Math.sin(t * 20 + i * Math.PI) * 0.9; });
                r.backLegs.forEach((l, i) => { l.rotation.x = Math.sin(t * 20 + i * Math.PI + 1) * 0.5; });
              }
              if (u < runOut) r.ball.position.copy(land);
              else {
                r.root.position.set(x, y, z);
                r.root.rotation.y = rotY;
                r.root.updateWorldMatrix(true, true);
                r.ball.position.copy(r.head.localToWorld(tmp.set(0, -0.35, 0.95)));
              }
              tailWag = 1.2;
            } else if (ft < total + 0.6) {
              r.ball.visible = true;
              r.ball.position.set(0.15, 0.14, 0.9);
              r.head.rotation.x = 0.2;
            } else if (!f.done) {
              f.done = true;
              cb.current.onFetchDone?.(false);
            }
          }
          if (f.done && ft > 6) ev.fetch = null;
        }

        r.root.position.set(x, y, z);
        r.root.rotation.y = rotY;
        if ((p.mood === 'sad' || sick) && !act && !celebrating && !asleep) r.root.rotation.z = Math.sin(t * 0.8) * 0.04;

        r.shadow.scale.set(Math.max(0.5, 1 - y * 0.5), Math.max(0.5, 1 - y * 0.5) * 0.8, 1);
        (r.shadow.material as THREE.MeshBasicMaterial).opacity = 0.22 * Math.max(0.35, 1 - y * 0.7);

        // Tail wag.
        r.tail.rotation.y = Math.sin(t * (5 + tailWag * 8)) * tailWag * 0.6;
        r.tail.rotation.x = -0.15 * tailWag;

        // Ear twitch; ears droop when sad or asleep, perk up for tricks, flatten for pats.
        if (t > twitch.at) twitch = { at: t + 2 + Math.random() * 4, ear: Math.floor(Math.random() * 2) };
        r.ears.forEach((ear, i) => {
          const base = ear.userData.baseZ as number;
          const side = ear.userData.side as number;
          const droop = (asleep || p.mood === 'sad') && !happyNow ? 0.3 * side : 0;
          const tw = i === twitch.ear ? Math.max(0, 1 - Math.abs(t - (twitch.at - 1.5)) / 0.12) * 0.3 * side : 0;
          ear.rotation.z = base + droop - tw - earPerk * 0.35 * side;
          ear.rotation.x = earPerk < 0 ? earPerk * 0.5 : 0;
        });

        // Hearts when happy, sparkles for the Legend stage, Zzz while asleep.
        const showHearts = celebrating || patting || act?.name === 'treat' || (p.mood === 'thrilled' && !asleep);
        hearts.forEach((m, i) => {
          const phase = (t * 0.5 + i / hearts.length) % 1;
          m.visible = showHearts && !still;
          m.position.set(x + Math.sin(i * 2.3) * 0.9, 2.1 + phase * 1.1 + y, z + 0.3);
          m.rotation.y = Math.sin(t * 2 + i) * 0.5;
          m.scale.setScalar(0.6 + phase * 0.5);
          (m.material as THREE.MeshStandardMaterial).opacity = Math.sin(phase * Math.PI);
        });
        sparks.forEach((m, i) => {
          const phase = (t * 0.4 + i / sparks.length) % 1;
          m.visible = p.stage >= 8 && !still;
          const a = i * 1.05 + t * 0.6;
          m.position.set(x + Math.sin(a) * 1.1, 0.4 + phase * 2, z + Math.cos(a) * 0.8);
          m.rotation.y = t * 2;
          (m.material as THREE.MeshStandardMaterial).opacity = Math.sin(phase * Math.PI);
        });
        zzz.forEach((m, i) => {
          const phase = (t * 0.35 + i / 3) % 1;
          m.visible = asleep && !still;
          m.position.set(0.5 + phase * 0.5, 1.9 + phase * 0.9, 0.4);
          m.scale.setScalar(0.6 + phase);
          (m.material as THREE.MeshStandardMaterial).opacity = Math.sin(phase * Math.PI);
        });

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      loopRef.current = () => { if (raf.current == null) raf.current = requestAnimationFrame(frame); };
      loopRef.current();
    } catch (e) {
      pet3dStatus = `Could not start: ${(e as Error).message}`;
      console.warn('3D pet failed, using the flat drawing', e);
      setFailed(true);
    }
  };

  if (failed) return <PetArt kind="dog" color={color} mood={mood} stage={Math.min(4, stage)} size={Math.min(size, h)} />;

  return (
    <View style={{ width: size, height: h }} {...(interactive ? pan.panHandlers : {})}
      {...(interactive ? { accessibilityRole: 'button' as const, accessibilityLabel: 'Your dog. Tap to say hello, stroke up and down to pat, drag sideways to spin.' } : { importantForAccessibility: 'no-hide-descendants' as const })}>
      <GLView style={{ width: size, height: h }} onContextCreate={onContextCreate} />
    </View>
  );
}
