// The dog as a real 3D model built from simple shapes, so colours, moods, growth stages and
// clothes all work without downloaded files. Built as a sitting puppy: big head with a snout,
// a chest, four legs with paws, floppy ears and a waggy tail. Each moving part has its own pivot
// so the animation code can pose it for tricks.
import * as THREE from 'three';
import type { Mood, PetKind } from '../../lib/api';

export type Face = 'open' | 'happy' | 'sad' | 'sleep';

export type PetRig = {
  root: THREE.Group; // moves and spins on the floor
  body: THREE.Group; // breathes; rotates for roll over and play bow
  head: THREE.Group; // tilts and nods
  ears: THREE.Object3D[];
  tail: THREE.Object3D;
  frontLegs: THREE.Object3D[]; // pivot at the shoulder
  backLegs: THREE.Object3D[]; // pivot at the hip
  eyes: Record<Face, THREE.Group>;
  mouths: Record<'smile' | 'grin' | 'flat' | 'frown' | 'snooze', THREE.Object3D>;
  tongue: THREE.Object3D;
  cheeks: THREE.Object3D;
  shadow: THREE.Mesh;
  ball: THREE.Object3D; // used in fetch
  bone: THREE.Object3D; // treat being eaten
  dispose: () => void;
};

const INK = 0x2b2340;
const PINK = 0xf7a1b5;
const HEAD_R = 0.62;
/** Size at each growth stage. */
export const STAGE_SCALE = [0.6, 0.7, 0.78, 0.85, 0.91, 0.97, 1, 1.03, 1.06];

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return c;
}

export function buildPet(_kind: PetKind, colorHex: string, stage: number, wearing: string | null = null): PetRig {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const geo = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g; };
  const mat = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, ...extra });
    mats.push(m);
    return m;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);
  const sphere = (r: number, seg = 24) => geo(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)));
  const capsule = (r: number, len: number) => geo(new THREE.CapsuleGeometry(r, len, 8, 16));

  const fluffy = stage >= 4;
  const shiny = stage >= 6;
  const fur = mat(colorHex, { roughness: shiny ? 0.45 : 0.65 });
  const furDark = mat(shade(colorHex, -0.16));
  const furLight = mat(shade(colorHex, 0.18));
  const ink = mat(INK, { roughness: 0.3 });
  const white = mat(0xffffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.4 });
  const pink = mat(PINK, { roughness: 0.7 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Torso: sitting upright, chest forward, rump on the floor.
  const torso = mesh(sphere(0.62, 32), fur);
  torso.scale.set(0.95, 1.05, 1.1);
  torso.position.set(0, 0.72, -0.12);
  torso.rotation.x = -0.35;
  body.add(torso);
  const chest = mesh(sphere(0.42, 24), furLight);
  chest.scale.set(0.95, 1.1, 0.7);
  chest.position.set(0, 0.82, 0.3);
  body.add(chest);

  // Back legs: chunky haunches on the floor with paws poking forward.
  const backLegs: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.4 * sx, 0.42, -0.2);
    const haunch = mesh(sphere(0.32, 20), fur);
    haunch.scale.set(0.85, 0.95, 1.2);
    hip.add(haunch);
    const paw = mesh(sphere(0.17, 16), furLight);
    paw.scale.set(1, 0.6, 1.4);
    paw.position.set(0.04 * sx, -0.32, 0.32);
    hip.add(paw);
    hip.userData.side = sx;
    body.add(hip);
    backLegs.push(hip);
  }

  // Front legs: pivot at the shoulder so a paw can lift for a high five.
  const frontLegs: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.24 * sx, 0.78, 0.36);
    const leg = mesh(capsule(0.13, 0.42), fur);
    leg.position.y = -0.32;
    shoulder.add(leg);
    const paw = mesh(sphere(0.16, 16), furLight);
    paw.scale.set(1, 0.65, 1.25);
    paw.position.set(0, -0.66, 0.06);
    shoulder.add(paw);
    for (const tx of [-0.06, 0, 0.06]) {
      const toe = mesh(geo(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4)), furDark);
      toe.rotation.x = Math.PI / 2;
      toe.position.set(tx, -0.66, 0.24);
      shoulder.add(toe);
    }
    shoulder.userData.side = sx;
    body.add(shoulder);
    frontLegs.push(shoulder);
  }

  // Tail: pivot at the base, curling up behind.
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.78);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.18, -0.18), new THREE.Vector3(0, 0.42, -0.22), new THREE.Vector3(0, 0.6, -0.12),
  ]);
  tail.add(mesh(geo(new THREE.TubeGeometry(tailCurve, 20, fluffy ? 0.11 : 0.08, 10, false)), fur));
  const tailTip = mesh(sphere(fluffy ? 0.16 : 0.1, 14), furLight);
  tailTip.position.set(0, 0.6, -0.12);
  tail.add(tailTip);
  body.add(tail);

  // Head with a snout.
  const head = new THREE.Group();
  head.position.set(0, 1.55, 0.32);
  body.add(head);
  const skull = mesh(sphere(HEAD_R, 32), fur);
  skull.scale.set(1.05, 0.95, 0.95);
  head.add(skull);
  const muzzle = mesh(sphere(0.3, 24), furLight);
  muzzle.scale.set(1.1, 0.78, 1);
  muzzle.position.set(0, -0.2, 0.5);
  head.add(muzzle);
  const nose = mesh(sphere(0.095, 16), ink);
  nose.scale.set(1.3, 0.9, 0.9);
  nose.position.set(0, -0.1, 0.8);
  head.add(nose);
  const noseShine = mesh(sphere(0.025, 8), white);
  noseShine.position.set(0.03, -0.07, 0.87);
  head.add(noseShine);

  // Ears hang from a pivot at the top so they flop and perk.
  const ears: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.5 * sx, 0.28, -0.02);
    const flap = mesh(sphere(0.26, 20), furDark);
    flap.scale.set(0.5, fluffy ? 1.35 : 1.15, 0.85);
    flap.position.set(0.06 * sx, -0.26, 0);
    ear.add(flap);
    ear.rotation.z = 0.3 * sx;
    ear.userData.side = sx;
    ear.userData.baseZ = ear.rotation.z;
    head.add(ear);
    ears.push(ear);
  }

  // Face parts sit on the front of the skull.
  const onFace = (o: THREE.Object3D, x: number, y: number, lift = 0.01) => {
    const yy = y / 0.95;
    const z = Math.sqrt(Math.max(0.01, HEAD_R * HEAD_R - x * x - yy * yy)) * 0.95;
    const p = new THREE.Vector3(x, y, z);
    const n = new THREE.Vector3(x, yy, z).normalize();
    o.position.copy(p.add(n.clone().multiplyScalar(lift)));
    o.lookAt(o.position.clone().add(n));
    head.add(o);
    return o;
  };

  const arc = (up: boolean) => {
    const g = mesh(geo(new THREE.TorusGeometry(0.085, 0.026, 8, 20, Math.PI)), ink);
    if (!up) g.rotation.z = Math.PI;
    return g;
  };
  const eyes = {} as Record<Face, THREE.Group>;
  for (const f of ['open', 'happy', 'sad', 'sleep'] as Face[]) {
    const set = new THREE.Group();
    for (const sx of [-1, 1]) {
      const holder = new THREE.Group();
      if (f === 'open' || f === 'sad') {
        const ball = mesh(sphere(0.1, 18), ink);
        ball.scale.set(1, 1.12, 0.55);
        holder.add(ball);
        const glint = mesh(sphere(0.032, 10), white);
        glint.position.set(0.032, 0.042, 0.05);
        holder.add(glint);
        if (f === 'sad') {
          const brow = mesh(geo(new THREE.BoxGeometry(0.16, 0.032, 0.03)), ink);
          brow.position.set(0, 0.16, 0.02);
          brow.rotation.z = -0.35 * sx;
          holder.add(brow);
        }
      } else {
        holder.add(arc(f === 'happy'));
      }
      onFace(holder, 0.25 * sx, 0.08);
      head.remove(holder);
      set.add(holder);
    }
    set.visible = f === 'open';
    head.add(set);
    eyes[f] = set;
  }

  // Mouths sit under the nose on the muzzle.
  const mouthAt = (o: THREE.Object3D, y = -0.33) => { o.position.set(0, y, 0.74); head.add(o); return o; };
  const mouths = {
    smile: mouthAt((() => { const g = new THREE.Group(); const m = arc(false); m.scale.setScalar(0.8); g.add(m); return g; })()),
    frown: mouthAt((() => { const g = new THREE.Group(); const m = arc(true); m.scale.setScalar(0.7); g.add(m); return g; })(), -0.38),
    grin: mouthAt((() => {
      const g = new THREE.Group();
      const m = mesh(geo(new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(0x8a2846));
      m.rotation.x = Math.PI;
      m.scale.set(1.1, 0.9, 0.4);
      g.add(m);
      return g;
    })()),
    flat: mouthAt((() => { const g = new THREE.Group(); const m = mesh(capsule(0.02, 0.1), ink); m.rotation.z = Math.PI / 2; g.add(m); return g; })()),
    snooze: mouthAt((() => { const g = new THREE.Group(); const m = mesh(sphere(0.035, 10), ink); m.scale.set(1, 0.7, 0.5); g.add(m); return g; })()),
  };
  Object.values(mouths).forEach((m) => { m.visible = false; });
  const tongue = mesh(capsule(0.06, 0.08), mat(0xf27a96, { roughness: 0.5 }));
  tongue.scale.set(1, 1, 0.35);
  tongue.position.set(0, -0.44, 0.72);
  tongue.visible = false;
  head.add(tongue);

  const cheeks = new THREE.Group();
  for (const sx of [-1, 1]) {
    const c = mesh(sphere(0.09, 14), mat(PINK, { transparent: true, opacity: 0.7 }));
    c.scale.set(1.3, 0.75, 0.3);
    onFace(c, 0.42 * sx, -0.1, 0);
    head.remove(c);
    cheeks.add(c);
  }
  head.add(cheeks);

  // Growth accessories around the neck and head.
  const neckY = 1.12;
  if (stage === 2) {
    const red = mat(0xd9465b, { roughness: 0.8 });
    const band = mesh(geo(new THREE.ConeGeometry(0.4, 0.5, 3)), red);
    band.rotation.set(Math.PI + 0.25, Math.PI, 0);
    band.scale.set(1, 1, 0.35);
    band.position.set(0, 0.86, 0.6);
    body.add(band);
    const knot = mesh(geo(new THREE.TorusGeometry(0.37, 0.05, 8, 28)), red);
    knot.rotation.x = Math.PI / 2 - 0.2;
    knot.position.set(0, neckY + 0.02, 0.22);
    body.add(knot);
    body.add(band);
  }
  if (stage >= 3) {
    const collar = mesh(geo(new THREE.TorusGeometry(0.38, 0.05, 10, 32)), mat(stage >= 5 ? 0x1f8a62 : 0xe2557b, { roughness: 0.5 }));
    collar.rotation.x = Math.PI / 2 - 0.2;
    collar.position.set(0, neckY, 0.22);
    body.add(collar);
    if (stage < 6) {
      const tag = mesh(geo(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20)), mat(0xf2c96b, { metalness: 0.6, roughness: 0.3 }));
      tag.rotation.x = Math.PI / 2;
      tag.position.set(0, 0.92, 0.6);
      body.add(tag);
    }
  }
  if (stage >= 5) {
    const green = mat(0x1f8a62, { roughness: 0.8 });
    const scarf = mesh(geo(new THREE.TorusGeometry(0.42, 0.11, 12, 36)), green);
    scarf.rotation.x = Math.PI / 2 - 0.2;
    scarf.position.set(0, neckY - 0.02, 0.2);
    body.add(scarf);
    const end = mesh(geo(new THREE.BoxGeometry(0.18, 0.42, 0.07)), green);
    end.position.set(0.3, neckY - 0.28, 0.5);
    end.rotation.set(0.4, 0, 0.2);
    body.add(end);
  }
  if (stage >= 6) {
    const medal = mesh(geo(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 24)), mat(0xf2c96b, { metalness: 0.7, roughness: 0.25 }));
    medal.rotation.x = Math.PI / 2;
    medal.position.set(0, 0.86, 0.62);
    body.add(medal);
  }
  if (stage >= 7) {
    const cape = mesh(geo(new THREE.SphereGeometry(0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.3)), mat(0x5560e8, { roughness: 0.7, side: THREE.DoubleSide }));
    cape.scale.set(1, 1.2, 1);
    cape.rotation.x = Math.PI + 0.25;
    cape.position.set(0, 1.1, -0.35);
    body.add(cape);
  }
  if (stage >= 8 && !wearing) {
    const gold = mat(0xf2c96b, { metalness: 0.6, roughness: 0.3 });
    const crown = new THREE.Group();
    const band = mesh(geo(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 24, 1, true)), gold);
    gold.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = mesh(geo(new THREE.ConeGeometry(0.065, 0.17, 10)), gold);
      spike.position.set(Math.sin(a) * 0.28, 0.15, Math.cos(a) * 0.28);
      crown.add(spike);
    }
    const gem = mesh(sphere(0.05, 12), mat(0xe2557b, { roughness: 0.2 }));
    gem.position.set(0, 0.02, 0.3);
    crown.add(gem);
    crown.position.set(0, 0.6, 0);
    head.add(crown);
  }

  // Clothes from the wardrobe.
  if (wearing) head.add(buildWear(wearing, mat, geo, mesh, sphere));

  // Floor shadow, fetch ball and treat bone.
  const shadow = mesh(geo(new THREE.CircleGeometry(0.95, 32)), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  mats.push(shadow.material as THREE.Material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  shadow.scale.set(1, 0.8, 1);
  root.add(shadow);

  const ball = new THREE.Group();
  const ballMesh = mesh(sphere(0.14, 20), mat(0xc7e04a, { roughness: 0.8 }));
  ball.add(ballMesh);
  const seam = mesh(geo(new THREE.TorusGeometry(0.14, 0.012, 6, 24)), mat(0xffffff));
  seam.rotation.y = Math.PI / 2;
  ball.add(seam);
  ball.visible = false;

  const bone = new THREE.Group();
  const boneMat = mat(0xf4e9d6, { roughness: 0.6 });
  const shaft = mesh(capsule(0.04, 0.22), boneMat);
  shaft.rotation.z = Math.PI / 2;
  bone.add(shaft);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const knob = mesh(sphere(0.05, 10), boneMat);
    knob.position.set(0.15 * sx, 0.035 * sy, 0);
    bone.add(knob);
  }
  bone.visible = false;

  root.scale.setScalar(STAGE_SCALE[Math.min(stage, STAGE_SCALE.length - 1)]);

  return {
    root, body, head, ears, tail, frontLegs, backLegs, eyes, mouths, tongue, cheeks, shadow, ball, bone,
    dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}

type Mk = {
  mat: (c: THREE.ColorRepresentation, e?: Partial<THREE.MeshStandardMaterialParameters>) => THREE.MeshStandardMaterial;
  geo: <T extends THREE.BufferGeometry>(g: T) => T;
};
function buildWear(
  item: string,
  mat: Mk['mat'],
  geo: Mk['geo'],
  mesh: (g: THREE.BufferGeometry, m: THREE.Material) => THREE.Mesh,
  sphere: (r: number, seg?: number) => THREE.SphereGeometry,
): THREE.Object3D {
  const g = new THREE.Group();
  switch (item) {
    case 'party': {
      const hat = mesh(geo(new THREE.ConeGeometry(0.22, 0.5, 24)), mat(0x8b93ff, { roughness: 0.5 }));
      hat.position.y = 0.25;
      g.add(hat);
      const pom = mesh(sphere(0.07, 12), mat(0xf2c96b));
      pom.position.y = 0.52;
      g.add(pom);
      for (let i = 0; i < 3; i++) {
        const dot = mesh(sphere(0.035, 8), mat(0xffffff));
        const a = i * 2.1;
        dot.position.set(Math.sin(a) * 0.13, 0.18 + i * 0.08, Math.cos(a) * 0.13);
        g.add(dot);
      }
      g.position.set(0.12, 0.5, 0);
      g.rotation.z = -0.25;
      break;
    }
    case 'bow': {
      const pinkM = mat(0xf56f9a, { roughness: 0.5 });
      for (const sx of [-1, 1]) {
        const loop = mesh(geo(new THREE.ConeGeometry(0.12, 0.2, 16)), pinkM);
        loop.rotation.z = (Math.PI / 2) * sx;
        loop.position.x = 0.1 * sx;
        g.add(loop);
      }
      g.add(mesh(sphere(0.06, 12), pinkM));
      g.position.set(0.3, 0.45, 0.2);
      g.rotation.z = -0.4;
      break;
    }
    case 'glasses': {
      const black = mat(0x15131f, { roughness: 0.2, metalness: 0.3 });
      for (const sx of [-1, 1]) {
        const lens = mesh(geo(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24)), black);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0.25 * sx, 0.08, 0.57);
        g.add(lens);
      }
      const bridge = mesh(geo(new THREE.BoxGeometry(0.16, 0.03, 0.03)), black);
      bridge.position.set(0, 0.12, 0.6);
      g.add(bridge);
      break;
    }
    case 'beanie': {
      const knit = mat(0xd9465b, { roughness: 0.95 });
      const cap = mesh(geo(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), knit);
      cap.scale.set(1.15, 0.7, 1.1);
      cap.position.y = 0.28;
      g.add(cap);
      const brim = mesh(geo(new THREE.TorusGeometry(0.55, 0.07, 8, 32)), mat(0xf4efe6, { roughness: 0.95 }));
      brim.rotation.x = Math.PI / 2;
      brim.position.y = 0.3;
      g.add(brim);
      const pom = mesh(sphere(0.12, 12), mat(0xf4efe6, { roughness: 1 }));
      pom.position.y = 0.66;
      g.add(pom);
      break;
    }
    case 'flowers': {
      const colors = [0xf59ab8, 0xf2c96b, 0xffffff, 0xb8b6d9, 0x8fd3b6];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const f = mesh(sphere(0.075, 10), mat(colors[i % colors.length], { roughness: 0.6 }));
        f.position.set(Math.sin(a) * 0.42, 0.42 + Math.cos(a * 2) * 0.02, Math.cos(a) * 0.4);
        g.add(f);
        const leaf = mesh(sphere(0.045, 8), mat(0x3f9a5c));
        leaf.position.set(Math.sin(a + 0.35) * 0.43, 0.4, Math.cos(a + 0.35) * 0.41);
        g.add(leaf);
      }
      break;
    }
    case 'cap': {
      const blue = mat(0x2f4fa8, { roughness: 0.7 });
      const crown = mesh(geo(new THREE.SphereGeometry(0.48, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), blue);
      crown.scale.set(1.1, 0.6, 1.05);
      crown.position.y = 0.32;
      g.add(crown);
      const peak = mesh(geo(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24, 1, false, -Math.PI / 2, Math.PI)), blue);
      peak.position.set(0, 0.33, 0.42);
      g.add(peak);
      const button = mesh(sphere(0.05, 8), mat(0xffffff));
      button.position.y = 0.6;
      g.add(button);
      break;
    }
    case 'bowtie': {
      const black = mat(0x15131f, { roughness: 0.4 });
      for (const sx of [-1, 1]) {
        const wing = mesh(geo(new THREE.ConeGeometry(0.11, 0.2, 4)), black);
        wing.rotation.z = (Math.PI / 2) * sx;
        wing.position.x = 0.1 * sx;
        g.add(wing);
      }
      g.add(mesh(sphere(0.05, 10), black));
      g.position.set(0, -0.62, 0.42);
      break;
    }
    case 'veil': {
      const veil = mesh(geo(new THREE.SphereGeometry(0.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2)),
        mat(0xfdfbff, { roughness: 0.3, transparent: true, opacity: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.15 }));
      veil.scale.set(1.3, 1.9, 0.75);
      veil.rotation.x = Math.PI - 0.15;
      veil.position.set(0, 0.62, -0.38);
      g.add(veil);
      const colors = [0xffffff, 0xf59ab8, 0xffffff];
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        const f = mesh(sphere(0.07, 10), mat(colors[i % 3], { roughness: 0.6 }));
        f.position.set(Math.sin(a) * 0.45, 0.46, Math.cos(a) * 0.2);
        g.add(f);
      }
      break;
    }
    default:
      break;
  }
  return g;
}

/** Which face and mouth go with each mood. */
export function faceFor(mood: Mood, asleep: boolean): { eyes: Face; mouth: keyof PetRig['mouths']; cheeks: boolean; tongue: boolean } {
  if (asleep) return { eyes: 'sleep', mouth: 'snooze', cheeks: false, tongue: false };
  switch (mood) {
    case 'thrilled': return { eyes: 'happy', mouth: 'grin', cheeks: true, tongue: true };
    case 'happy': return { eyes: 'happy', mouth: 'smile', cheeks: true, tongue: true };
    case 'new': return { eyes: 'open', mouth: 'smile', cheeks: true, tongue: false };
    case 'sad': return { eyes: 'sad', mouth: 'frown', cheeks: false, tongue: false };
    default: return { eyes: 'open', mouth: 'flat', cheeks: false, tongue: false };
  }
}
