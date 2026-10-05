// The pet as a real 3D model, built from simple shapes so every kind, colour, mood and accessory
// works without any downloaded files. No textures are used, which keeps it reliable on expo-gl.
import * as THREE from 'three';
import type { Mood, PetKind } from '../../lib/api';

export type Face = 'open' | 'happy' | 'sad' | 'sleep';

export type PetRig = {
  root: THREE.Group; // moves and spins
  body: THREE.Group; // squashes and breathes
  ears: THREE.Object3D[];
  tail: THREE.Object3D | null;
  eyes: Record<Face, THREE.Group>;
  mouths: Record<'smile' | 'grin' | 'flat' | 'frown' | 'snooze', THREE.Object3D>;
  cheeks: THREE.Object3D;
  shadow: THREE.Mesh;
  dispose: () => void;
};

const INK = 0x2b2340;
const PINK = 0xf7a1b5;
const R = 1; // body radius
const BODY_Y = 1.0;
const SQUASH = 0.93; // body is slightly wider than tall

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return c;
}

/** A point on the front of the body, given an offset across (x) and up (y) from its centre. */
function onFront(x: number, y: number, lift = 0) {
  const yy = y / SQUASH;
  const z = Math.sqrt(Math.max(0.01, R * R - x * x - yy * yy));
  const p = new THREE.Vector3(x, BODY_Y + y, z);
  const n = new THREE.Vector3(x, yy, z).normalize();
  return { p: p.add(n.clone().multiplyScalar(lift)), n };
}

export function buildPet(kind: PetKind, colorHex: string, stage: number): PetRig {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const geo = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g; };
  const mat = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });
    mats.push(m);
    return m;
  };

  const fur = mat(colorHex);
  const furDark = mat(shade(colorHex, -0.14));
  const furLight = mat(shade(colorHex, 0.16));
  const ink = mat(INK, { roughness: 0.3 });
  const white = mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 });
  const pink = mat(PINK, { roughness: 0.7 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Body
  const torso = new THREE.Mesh(geo(new THREE.SphereGeometry(R, 40, 28)), fur);
  torso.scale.set(1, SQUASH, 1);
  torso.position.y = BODY_Y;
  body.add(torso);
  const belly = new THREE.Mesh(geo(new THREE.SphereGeometry(0.62, 32, 20)), furLight);
  belly.scale.set(1, 0.85, 0.5);
  belly.position.set(0, BODY_Y - 0.42, 0.62);
  body.add(belly);

  // Feet
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.24, 20, 14)), furDark);
    foot.scale.set(1.1, 0.6, 1.3);
    foot.position.set(0.42 * sx, 0.12, 0.42);
    body.add(foot);
  }

  // Ears
  const ears: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    if (kind === 'cat') {
      const outer = new THREE.Mesh(geo(new THREE.ConeGeometry(0.3, 0.55, 20)), fur);
      const inner = new THREE.Mesh(geo(new THREE.ConeGeometry(0.17, 0.36, 16)), pink);
      inner.position.set(0, -0.04, 0.1);
      outer.position.y = 0.22;
      inner.position.y = 0.17;
      ear.add(outer, inner);
      ear.position.set(0.52 * sx, BODY_Y + 0.66, 0.05);
      ear.rotation.z = -0.38 * sx;
    } else if (kind === 'bunny') {
      const outer = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.16, 0.75, 8, 16)), fur);
      const inner = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.08, 0.55, 6, 12)), pink);
      outer.position.y = 0.5;
      inner.position.set(0, 0.5, 0.1);
      ear.add(outer, inner);
      ear.position.set(0.3 * sx, BODY_Y + 0.72, 0);
      ear.rotation.z = -0.16 * sx;
    } else if (kind === 'bear') {
      const outer = new THREE.Mesh(geo(new THREE.SphereGeometry(0.27, 20, 14)), fur);
      const inner = new THREE.Mesh(geo(new THREE.SphereGeometry(0.15, 16, 12)), furDark);
      outer.scale.set(1, 1, 0.6);
      inner.scale.set(1, 1, 0.4);
      inner.position.z = 0.1;
      ear.add(outer, inner);
      ear.position.set(0.62 * sx, BODY_Y + 0.62, 0);
    } else {
      // Dog: soft floppy ears hanging at the sides
      const outer = new THREE.Mesh(geo(new THREE.SphereGeometry(0.28, 20, 14)), furDark);
      outer.scale.set(0.55, 1.25, 0.9);
      outer.position.y = -0.3;
      ear.add(outer);
      ear.position.set(0.86 * sx, BODY_Y + 0.42, 0.05);
      ear.rotation.z = 0.35 * sx;
    }
    ear.userData.side = sx;
    ear.userData.baseZ = ear.rotation.z;
    body.add(ear);
    ears.push(ear);
  }

  // Tail at the back
  let tail: THREE.Object3D | null = new THREE.Group();
  if (kind === 'cat') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.25, -0.35), new THREE.Vector3(0, 0.75, -0.45), new THREE.Vector3(0.15, 1.05, -0.3),
    ]);
    tail.add(new THREE.Mesh(geo(new THREE.TubeGeometry(curve, 24, 0.09, 10, false)), fur));
    const tip = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 12, 10)), fur);
    tip.position.set(0.15, 1.05, -0.3);
    tail.add(tip);
  } else if (kind === 'dog') {
    const t = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.1, 0.4, 6, 12)), fur);
    t.position.set(0, 0.25, -0.12);
    t.rotation.x = -0.7;
    tail.add(t);
  } else if (kind === 'bunny') {
    tail.add(new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 16, 12)), furLight));
  } else {
    tail.add(new THREE.Mesh(geo(new THREE.SphereGeometry(0.13, 14, 10)), fur));
  }
  tail.position.set(0, BODY_Y - 0.45, -0.88);
  body.add(tail);

  // Face
  const face = new THREE.Group();
  body.add(face);
  const place = (o: THREE.Object3D, x: number, y: number, lift = 0) => {
    const { p, n } = onFront(x, y, lift);
    o.position.copy(p);
    o.lookAt(p.clone().add(n));
    face.add(o);
    return o;
  };

  if (kind === 'dog' || kind === 'bear') {
    const muzzle = new THREE.Mesh(geo(new THREE.SphereGeometry(0.3, 24, 16)), furLight);
    muzzle.scale.set(1.15, 0.8, 0.55);
    place(muzzle, 0, -0.12, -0.04);
  }
  const nose = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 16, 12)), kind === 'cat' || kind === 'bunny' ? pink : ink);
  nose.scale.set(1.3, 0.9, 0.8);
  place(nose, 0, -0.03, kind === 'dog' || kind === 'bear' ? 0.12 : 0.02);

  if (kind === 'cat') {
    for (const sx of [-1, 1]) for (const dy of [-0.02, -0.1]) {
      const w = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 6)), furDark);
      w.rotation.z = Math.PI / 2 + dy * 2 * sx;
      const { p } = onFront(0.55 * sx, dy - 0.04, 0.02);
      w.position.copy(p);
      w.position.x += 0.12 * sx;
      face.add(w);
    }
  }

  // Eyes: four sets, one visible at a time.
  const eyeX = 0.33;
  const eyeY = 0.14;
  const eyes = {} as Record<Face, THREE.Group>;
  const arc = (up: boolean) => {
    const g = new THREE.Mesh(geo(new THREE.TorusGeometry(0.09, 0.028, 8, 20, Math.PI)), ink);
    if (!up) g.rotation.z = Math.PI;
    return g;
  };
  for (const f of ['open', 'happy', 'sad', 'sleep'] as Face[]) {
    const set = new THREE.Group();
    for (const sx of [-1, 1]) {
      const holder = new THREE.Group();
      if (f === 'open' || f === 'sad') {
        const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 20, 14)), ink);
        ball.scale.set(1, 1.1, 0.55);
        holder.add(ball);
        const glint = new THREE.Mesh(geo(new THREE.SphereGeometry(0.035, 10, 8)), white);
        glint.position.set(0.035, 0.045, 0.05);
        holder.add(glint);
        if (f === 'sad') {
          const brow = new THREE.Mesh(geo(new THREE.BoxGeometry(0.17, 0.035, 0.03)), ink);
          brow.position.set(0, 0.17, 0.02);
          brow.rotation.z = -0.35 * sx;
          holder.add(brow);
        }
      } else {
        holder.add(arc(f === 'happy'));
      }
      place(holder, eyeX * sx, eyeY, 0.01);
      face.remove(holder);
      set.add(holder);
    }
    set.visible = f === 'open';
    face.add(set);
    eyes[f] = set;
  }

  // Mouths
  const mouths = {
    smile: (() => { const m = arc(false); m.scale.setScalar(0.85); return m; })(),
    frown: (() => { const m = arc(true); m.scale.setScalar(0.8); return m; })(),
    grin: (() => { const m = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(0x8a2846)); m.rotation.x = Math.PI; m.scale.set(1, 0.9, 0.4); return m; })(),
    flat: new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8)), ink),
    snooze: (() => { const m = new THREE.Mesh(geo(new THREE.SphereGeometry(0.04, 10, 8)), ink); m.scale.set(1, 0.7, 0.5); return m; })(),
  };
  (mouths.flat as THREE.Mesh).rotation.z = Math.PI / 2;
  for (const [k, m] of Object.entries(mouths)) {
    const holder = new THREE.Group();
    holder.add(m);
    place(holder, 0, k === 'frown' ? -0.27 : -0.2, 0.01);
    holder.visible = false;
    (mouths as Record<string, THREE.Object3D>)[k] = holder;
  }

  const cheeks = new THREE.Group();
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(geo(new THREE.SphereGeometry(0.1, 14, 10)), mat(PINK, { transparent: true, opacity: 0.75 }));
    c.scale.set(1.3, 0.75, 0.3);
    place(c, 0.58 * sx, -0.08, 0);
    face.remove(c);
    cheeks.add(c);
  }
  face.add(cheeks);

  // Accessories
  if (stage >= 3) {
    const green = mat(0x1f8a62, { roughness: 0.8 });
    const scarf = new THREE.Mesh(geo(new THREE.TorusGeometry(0.8, 0.12, 12, 40)), green);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = BODY_Y - 0.48;
    scarf.scale.set(1.04, 1.04, 1);
    body.add(scarf);
    const end = new THREE.Mesh(geo(new THREE.BoxGeometry(0.2, 0.45, 0.08)), green);
    end.position.set(0.42, BODY_Y - 0.7, 0.62);
    end.rotation.set(0.5, 0, 0.25);
    body.add(end);
  }
  if (stage >= 4) {
    const gold = mat(0xf2c96b, { metalness: 0.55, roughness: 0.3 });
    const crown = new THREE.Group();
    const band = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.32, 0.16, 24, 1, true)), gold);
    gold.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(geo(new THREE.ConeGeometry(0.07, 0.18, 10)), gold);
      spike.position.set(Math.sin(a) * 0.3, 0.16, Math.cos(a) * 0.3);
      crown.add(spike);
    }
    const gem = new THREE.Mesh(geo(new THREE.SphereGeometry(0.05, 12, 10)), mat(0xe2557b, { roughness: 0.2 }));
    gem.position.set(0, 0.02, 0.31);
    crown.add(gem);
    crown.position.set(0, BODY_Y + 0.95, 0.05);
    crown.rotation.x = -0.12;
    body.add(crown);
  }

  // Soft round shadow on the floor
  const shadow = new THREE.Mesh(geo(new THREE.CircleGeometry(0.9, 32)), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  mats.push(shadow.material as THREE.Material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  shadow.scale.set(1, 0.7, 1);
  root.add(shadow);

  const size = [0.72, 0.84, 0.94, 1, 1][Math.min(stage, 4)];
  root.scale.setScalar(size);

  return {
    root, body, ears, tail, eyes, mouths, cheeks, shadow,
    dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

/** Which face and mouth go with each mood. */
export function faceFor(mood: Mood, asleep: boolean): { eyes: Face; mouth: keyof PetRig['mouths']; cheeks: boolean } {
  if (asleep) return { eyes: 'sleep', mouth: 'snooze', cheeks: false };
  switch (mood) {
    case 'thrilled': return { eyes: 'happy', mouth: 'grin', cheeks: true };
    case 'happy': return { eyes: 'happy', mouth: 'smile', cheeks: true };
    case 'new': return { eyes: 'open', mouth: 'smile', cheeks: true };
    case 'sad': return { eyes: 'sad', mouth: 'frown', cheeks: false };
    default: return { eyes: 'open', mouth: 'flat', cheeks: false };
  }
}
