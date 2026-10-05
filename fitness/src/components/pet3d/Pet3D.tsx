import { useEffect, useRef, useState } from 'react';
import { AppState, PanResponder, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import * as THREE from 'three';
import * as Haptics from 'expo-haptics';
import { reduceMotion } from '../../lib/motion';
import type { Mood, PetKind } from '../../lib/api';
import { buildPet, faceFor, type PetRig } from './model';
import { PetArt } from '../Pet';

type Props = {
  kind: PetKind;
  color: string;
  mood: Mood;
  stage: number;
  size?: number;
  /** Bump this number to make the pet celebrate, for example after a walk is logged. */
  celebrate?: number;
  /** Lets the pet fall asleep late at night. */
  sleepy?: boolean;
  onTap?: () => void;
  interactive?: boolean;
};

const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 5; };

/**
 * The pet in real 3D. Breathes, blinks, wags, twitches its ears, jumps when tapped,
 * celebrates on cue, sleeps at night and spins when dragged. Falls back to the flat
 * drawing if the phone cannot start 3D.
 */
export function Pet3D({ kind, color, mood, stage, size = 220, celebrate = 0, sleepy = true, onTap, interactive = true }: Props) {
  const [failed, setFailed] = useState(false);
  const props = useRef({ kind, color, mood, stage, sleepy });
  props.current = { kind, color, mood, stage, sleepy };
  const events = useRef({ jump: -10, celebrate: -10, spinVel: 0, spin: 0, wokeAt: -100, now: 0 });
  const active = useRef(true);
  const raf = useRef<number | null>(null);
  const loopRef = useRef<(() => void) | null>(null);

  // Celebrate when the counter changes.
  const lastCelebrate = useRef(celebrate);
  useEffect(() => {
    if (celebrate !== lastCelebrate.current) {
      lastCelebrate.current = celebrate;
      events.current.celebrate = events.current.now;
      events.current.wokeAt = events.current.now;
    }
  }, [celebrate]);

  // Pause the render loop while the screen is hidden or the app is in the background.
  const resume = () => { if (!active.current) { active.current = true; loopRef.current?.(); } };
  const pause = () => { active.current = false; if (raf.current != null) cancelAnimationFrame(raf.current); raf.current = null; };
  useFocusEffect(() => { resume(); return pause; });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? resume() : pause()));
    return () => { sub.remove(); pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6,
    onPanResponderMove: (_e, g) => { events.current.spinVel = g.vx * 0.35; },
    onPanResponderRelease: (_e, g) => {
      if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
        events.current.jump = events.current.now;
        events.current.wokeAt = events.current.now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onTapRef.current?.();
      }
    },
    onPanResponderTerminationRequest: () => true,
  })).current;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const canvas = {
        width: w, height: h, style: {}, clientWidth: w, clientHeight: h,
        addEventListener: () => undefined, removeEventListener: () => undefined, getContext: () => gl,
      } as unknown as HTMLCanvasElement;
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true });
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
      camera.position.set(0, 1.7, 7.4);
      camera.lookAt(0, 1.22, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f9e, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2.5, 4, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xb9c0ff, 1.4);
      rim.position.set(-3, 2.5, -3);
      scene.add(rim);

      // Floating hearts for celebrations.
      const heartShape = new THREE.Shape();
      heartShape.moveTo(0, -0.12);
      heartShape.bezierCurveTo(-0.02, -0.06, -0.16, -0.02, -0.16, 0.08);
      heartShape.bezierCurveTo(-0.16, 0.16, -0.06, 0.2, 0, 0.12);
      heartShape.bezierCurveTo(0.06, 0.2, 0.16, 0.16, 0.16, 0.08);
      heartShape.bezierCurveTo(0.16, -0.02, 0.02, -0.06, 0, -0.12);
      const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
      const heartMat = new THREE.MeshStandardMaterial({ color: 0xf56f9a, roughness: 0.4, transparent: true });
      const hearts = Array.from({ length: 4 }, (_, i) => {
        const m = new THREE.Mesh(heartGeo, heartMat);
        m.visible = false;
        m.userData.offset = i;
        scene.add(m);
        return m;
      });

      let rig: PetRig | null = null;
      let rigKey = '';
      const clock = new THREE.Clock();
      const ev = events.current;
      let nextBlink = 2;
      let blinkUntil = 0;
      let twitch = { at: 3, ear: 0 };
      let tilt = { at: 5, dir: 1 };
      const still = reduceMotion();

      const frame = () => {
        if (!active.current) return;
        const t = clock.getElapsedTime();
        ev.now = t;
        const p = props.current;

        const k = `${p.kind}|${p.color}|${p.stage}`;
        if (k !== rigKey) {
          if (rig) { scene.remove(rig.root); rig.dispose(); }
          rig = buildPet(p.kind, p.color, p.stage);
          scene.add(rig.root);
          rigKey = k;
        }
        const r = rig!;
        const asleep = p.sleepy && isNight() && t - ev.wokeAt > 15;
        const celebrating = t - ev.celebrate < 2.4;
        const face = faceFor(celebrating ? 'thrilled' : p.mood, asleep && !celebrating);

        // Blink every few seconds.
        if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random() * 3; }
        const blinking = t < blinkUntil && (face.eyes === 'open' || face.eyes === 'sad');
        for (const [name, g] of Object.entries(r.eyes)) {
          g.visible = name === face.eyes;
          g.scale.y = g.visible && blinking ? 0.12 : 1;
        }
        for (const [name, m] of Object.entries(r.mouths)) m.visible = name === face.mouth;
        r.cheeks.visible = face.cheeks;

        // How lively the pet is.
        const energy = asleep ? 0.2 : celebrating ? 1.6 : ({ thrilled: 1.3, happy: 1, new: 0.9, okay: 0.6, sad: 0.35 } as Record<Mood, number>)[p.mood];

        // Breathing and bounce.
        const breathe = Math.sin(t * (asleep ? 1.2 : 2.2)) * (asleep ? 0.035 : 0.025);
        r.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
        let y = still ? 0 : Math.max(0, Math.sin(t * 2.4 * energy)) * 0.06 * energy;

        // Jump on tap, three hops when celebrating.
        const jt = t - ev.jump;
        if (jt < 0.6) y += Math.sin((jt / 0.6) * Math.PI) * 0.55;
        if (celebrating) {
          const ct = t - ev.celebrate;
          y += Math.abs(Math.sin(ct * Math.PI * 1.25)) * 0.45;
        }
        if (asleep) y -= 0.08;
        r.root.position.y = y;
        // Squash on landing.
        const land = jt > 0.55 && jt < 0.75 ? Math.sin(((jt - 0.55) / 0.2) * Math.PI) * 0.12 : 0;
        r.body.scale.y *= 1 - land;
        r.body.scale.x *= 1 + land * 0.6;
        r.body.scale.z *= 1 + land * 0.6;
        r.shadow.scale.setScalar(Math.max(0.5, 1 - y * 0.6));
        r.shadow.scale.y *= 0.7;
        (r.shadow.material as THREE.MeshBasicMaterial).opacity = 0.22 * Math.max(0.4, 1 - y * 0.8);

        // Turning: drag to spin, a full turn when celebrating, otherwise a gentle look around.
        ev.spin += ev.spinVel;
        ev.spinVel *= 0.92;
        // Once the drag settles, ease back to face the front.
        if (Math.abs(ev.spinVel) < 0.002) ev.spin = ev.spin % (Math.PI * 2) * 0.97;
        const celebrateSpin = celebrating ? Math.min(1, (t - ev.celebrate) / 1.2) * Math.PI * 2 : 0;
        const look = still || asleep ? 0 : Math.sin(t * 0.45) * 0.3 * Math.min(1, energy);
        r.root.rotation.y = ev.spin + celebrateSpin + look;

        // Head tilt now and then.
        if (t > tilt.at) tilt = { at: t + 4 + Math.random() * 5, dir: Math.random() > 0.5 ? 1 : -1 };
        const tiltPhase = Math.max(0, 1 - Math.abs(t - (tilt.at - 2)) / 0.8);
        r.root.rotation.z = (asleep ? 0.12 : tiltPhase * 0.12 * tilt.dir) + (p.mood === 'sad' && !celebrating ? Math.sin(t * 0.8) * 0.04 : 0);
        r.root.rotation.x = asleep ? 0.12 : 0;

        // Tail wag.
        if (r.tail) {
          const wag = asleep ? 0.05 : 0.25 + energy * 0.35;
          r.tail.rotation.y = Math.sin(t * (4 + energy * 6)) * wag;
          r.tail.rotation.z = Math.sin(t * (2 + energy * 3)) * wag * 0.4;
        }

        // Ear twitch, ears droop when sad or asleep.
        if (t > twitch.at) twitch = { at: t + 2 + Math.random() * 4, ear: Math.floor(Math.random() * 2) };
        r.ears.forEach((ear, i) => {
          const base = ear.userData.baseZ as number;
          const side = ear.userData.side as number;
          const droop = (asleep || p.mood === 'sad') && !celebrating ? 0.35 * side : 0;
          const tw = i === twitch.ear ? Math.max(0, 1 - Math.abs(t - (twitch.at - 1.5)) / 0.12) * 0.3 * side : 0;
          ear.rotation.z = base - droop - tw;
        });

        // Hearts float up while celebrating or when thrilled.
        const showHearts = celebrating || (p.mood === 'thrilled' && !asleep);
        hearts.forEach((m, i) => {
          const phase = ((t * 0.5 + i / hearts.length) % 1);
          m.visible = showHearts && !still;
          m.position.set(Math.sin(i * 2.3) * 0.9, 1.6 + phase * 1.2 + y, 0.3);
          m.rotation.y = Math.sin(t * 2 + i) * 0.5;
          m.scale.setScalar(0.6 + phase * 0.5);
          (m.material as THREE.MeshStandardMaterial).opacity = Math.sin(phase * Math.PI);
        });

        renderer.render(scene, camera);
        gl.endFrameEXP();
        raf.current = requestAnimationFrame(frame);
      };
      loopRef.current = () => { if (raf.current == null) raf.current = requestAnimationFrame(frame); };
      loopRef.current();
    } catch (e) {
      console.warn('3D pet failed, using the flat drawing', e);
      setFailed(true);
    }
  };

  if (failed) return <PetArt kind={kind} color={color} mood={mood} stage={stage} size={size} />;

  return (
    <View style={{ width: size, height: size }} {...(interactive ? pan.panHandlers : {})}
      accessibilityRole="button" accessibilityLabel="Your pet. Tap to say hello, drag to spin.">
      <GLView style={{ width: size, height: size }} onContextCreate={onContextCreate} />
    </View>
  );
}
