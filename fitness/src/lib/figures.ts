// Simple stick figure drawings for moves without a photo. Each pose is a set of joint angles;
// the figure is placed on the floor on its own, and an exercise moves between two or more poses.
// Angles are degrees from straight down: 90 points forward (to the right), 180 straight up, -90 back.
// Side view faces right. "Front" poses use the same numbers, with x meaning left and right.

export type Pose = {
  t: number; // torso lean forward: 0 upright, 90 flat with the head to the right, more than 90 head lower than hips, -90 lying on the back
  la: [number, number]; ra: [number, number]; // far arm and near arm: upper arm, forearm
  ll: [number, number]; rl: [number, number]; // far leg and near leg: thigh, shin
  up?: number; // lift off the floor, for jumps
  head?: number; // head tilt from the line of the torso
};
export type Prop = 'chair' | 'wall' | 'step' | 'mat' | 'partner';
export type Figure = { frames: Pose[]; prop?: Prop; secs?: number; front?: boolean };

const P = (t: number, la: [number, number], ra: [number, number], ll: [number, number], rl: [number, number], extra: Partial<Pose> = {}): Pose => ({ t, la, ra, ll, rl, ...extra });

export const POSES = {
  stand: P(0, [6, 10], [-6, -10], [3, 0], [-3, 0]),
  standArmsFwd: P(0, [90, 90], [85, 88], [3, 0], [-3, 0]),
  standArmsUp: P(0, [175, 175], [170, 172], [3, 0], [-3, 0]),
  march: P(0, [40, 70], [-35, -10], [90, 0], [-5, 0]),
  march2: P(0, [-35, -10], [40, 70], [-5, 0], [90, 0]),
  highKnee: P(5, [60, 120], [-40, 10], [100, -5], [-8, 0], { up: 3 }),
  highKnee2: P(5, [-40, 10], [60, 120], [-8, 0], [100, -5], { up: 3 }),
  squat: P(35, [90, 90], [85, 88], [80, -10], [78, -12]),
  deepSquat: P(25, [70, 140], [65, 135], [100, -25], [98, -28]),
  squatReach: P(0, [175, 178], [170, 172], [3, 0], [-3, 0], { up: 0 }),
  lungeBack: P(0, [8, 30], [-8, 20], [85, 0], [-30, -90]),
  lowLunge: P(10, [175, 175], [170, 170], [80, 0], [-80, -5]),
  sideLungeFront: P(10, [20, 60], [-20, -60], [40, 0], [-12, -12]),
  standFront: P(0, [15, 10], [-15, -10], [6, 0], [-6, 0]),
  jackOpen: P(0, [135, 150], [-135, -150], [25, 15], [-25, -15], { up: 4 }),
  jackClosed: P(0, [12, 6], [-12, -6], [4, 0], [-4, 0]),
  stepOut: P(0, [120, 150], [-120, -150], [30, 15], [-3, 0]),
  stepOut2: P(0, [-120, -150], [120, 150], [3, 0], [-30, -15]),
  wallAngelUp: P(0, [140, 175], [-140, -175], [6, 0], [-6, 0]),
  wallAngelDown: P(0, [80, 170], [-80, -170], [6, 0], [-6, 0]),
  yRaise: P(0, [150, 155], [-150, -155], [6, 0], [-6, 0]),
  armsOut: P(0, [90, 90], [-90, -90], [6, 0], [-6, 0]),
  armsOutPulse: P(0, [100, 100], [-100, -100], [6, 0], [-6, 0]),
  treeFront: P(0, [170, 200], [-170, -200], [6, 0], [-40, 70]),
  warriorFront: P(0, [90, 90], [-90, -90], [45, -10], [-30, -30]),
  sideBend: P(15, [160, 170], [-20, -10], [8, 0], [-8, 0]),
  sideBend2: P(-15, [20, 10], [-160, -170], [8, 0], [-8, 0]),
  twist: P(0, [90, 140], [60, 120], [3, 0], [-3, 0]),
  twist2: P(0, [60, 120], [90, 140], [3, 0], [-3, 0]),
  punch: P(0, [90, 90], [30, 140], [15, 0], [-15, 0]),
  punch2: P(0, [30, 140], [90, 90], [15, 0], [-15, 0]),
  guard: P(5, [30, 150], [35, 145], [15, 0], [-15, 0]),
  kneePunch: P(5, [100, 100], [30, 150], [95, 0], [-5, 0]),
  hinge: P(70, [0, 0], [0, 0], [8, 0], [8, 0]),
  hingeRow: P(70, [-60, 15], [-60, 15], [8, 0], [8, 0]),
  kickStart: P(70, [-70, 0], [-70, 0], [8, 0], [8, 0]),
  kickEnd: P(70, [-75, -80], [-75, -80], [8, 0], [8, 0]),
  skate: P(15, [40, 30], [-60, -40], [-10, 0], [-35, 20], { up: 3 }),
  skate2: P(-15, [60, 40], [-40, -30], [35, -20], [10, 0], { up: 3 }),
  calfUp: P(0, [6, 10], [-6, -10], [3, 0], [-3, 0], { up: 6 }),
  // Floor
  plank: P(78, [0, 0], [0, 0], [-80, -80], [-80, -80]),
  forearmPlank: P(85, [0, 90], [0, 90], [-85, -85], [-85, -85]),
  plankArm: P(78, [0, 0], [90, 90], [-80, -80], [-80, -80]),
  plankKneeIn: P(78, [0, 0], [0, 0], [-80, -80], [30, -60]),
  plankKneeIn2: P(78, [0, 0], [0, 0], [30, -60], [-80, -80]),
  plankJackOpen: P(78, [0, 0], [0, 0], [-70, -70], [-90, -90]),
  pushDown: P(88, [-50, 40], [-50, 40], [-82, -82], [-82, -82]),
  kneePushUp: P(70, [0, 0], [0, 0], [-60, -150], [-60, -150]),
  kneePushDown: P(85, [-45, 40], [-45, 40], [-60, -150], [-60, -150]),
  pike: P(140, [175, 175], [175, 175], [-30, -30], [-30, -30]),
  allFours: P(90, [0, 0], [0, 0], [0, -90], [0, -90]),
  birdDog: P(90, [0, 0], [95, 95], [0, -90], [-90, -90]),
  donkeyKick: P(90, [0, 0], [0, 0], [0, -90], [-120, -30]),
  bearHold: P(90, [0, 0], [0, 0], [30, -90], [30, -90]),
  threadNeedle: P(105, [0, 0], [-20, -90], [0, -90], [0, -90]),
  downDog: P(135, [40, 40], [40, 40], [-30, -30], [-30, -30]),
  cobra: P(60, [-10, -5], [-10, -5], [-90, -90], [-90, -90]),
  childsPose: P(125, [95, 95], [95, 95], [60, -90], [60, -90]),
  lyingFaceDown: P(90, [92, 92], [95, 95], [-90, -90], [-90, -90]),
  superman: P(80, [100, 100], [102, 102], [-100, -100], [-100, -100]),
  snowAngel: P(85, [-60, -80], [-60, -80], [-95, -95], [-95, -95]),
  lyingBack: P(-90, [90, 90], [92, 92], [90, 90], [92, 92]),
  lyingKneesBent: P(-90, [90, 90], [92, 92], [135, 20], [135, 20]),
  bridgeUp: P(-110, [90, 90], [92, 92], [100, 15], [100, 15]),
  crunch: P(-60, [100, 100], [100, 100], [135, 20], [135, 20]),
  deadBug: P(-90, [180, 180], [-100, -100], [180, 90], [100, 100]),
  deadBug2: P(-90, [-100, -100], [180, 180], [100, 100], [180, 90]),
  legsUp: P(-90, [90, 90], [92, 92], [180, 180], [180, 180]),
  legsDown: P(-90, [90, 90], [92, 92], [98, 98], [98, 98]),
  flutter: P(-90, [90, 90], [92, 92], [112, 112], [98, 98]),
  flutter2: P(-90, [90, 90], [92, 92], [98, 98], [112, 112]),
  bicycle: P(-60, [-140, 60], [-140, 60], [100, 100], [190, 70]),
  bicycle2: P(-60, [-140, 60], [-140, 60], [190, 70], [100, 100]),
  tabletop: P(-90, [90, 90], [92, 92], [180, 90], [180, 90]),
  reverseCrunch: P(-90, [90, 90], [92, 92], [215, 110], [215, 110]),
  happyBaby: P(-90, [150, 180], [150, 180], [210, 180], [215, 180]),
  lyingTwist: P(-90, [-90, -90], [180, 180], [120, 40], [110, 60]),
  hollow: P(-80, [-110, -110], [-110, -110], [102, 102], [102, 102]),
  vSitHold: P(-35, [100, 100], [100, 100], [130, 130], [130, 130]),
  sitUp: P(-20, [100, 100], [100, 100], [135, 20], [135, 20]),
  toeReach: P(-90, [180, 180], [180, 180], [180, 180], [180, 180]),
  toeReachUp: P(-50, [160, 160], [160, 160], [180, 180], [180, 180]),
  sideLying: P(-90, [-90, -90], [100, 100], [120, 60], [122, 60]),
  clamOpen: P(-90, [-90, -90], [100, 100], [120, 60], [165, 60]),
  figureFour: P(-90, [120, 150], [120, 150], [135, 20], [175, 100]),
  wheelbarrow: P(78, [0, 0], [0, 0], [-80, -80], [-80, -80]),
  // Chair
  seated: P(0, [10, 80], [5, 80], [90, 0], [90, 0]),
  seatedKnee: P(0, [10, 80], [5, 80], [130, 40], [90, 0]),
  seatedKnee2: P(0, [10, 80], [5, 80], [90, 0], [130, 40]),
  seatedTuck: P(-20, [-40, -40], [-40, -40], [130, 40], [130, 40]),
  seatedLegLift: P(0, [-20, -10], [-20, -10], [90, 0], [95, 95]),
  seatedArmsUp: P(0, [175, 175], [170, 172], [90, 0], [90, 0]),
  seatedArmsOut: P(0, [135, 150], [-135, -150], [100, 20], [-100, -20]),
  seatedPunch: P(0, [90, 90], [30, 140], [90, 0], [90, 0]),
  seatedPunch2: P(0, [30, 140], [90, 90], [90, 0], [90, 0]),
  seatedRowOut: P(10, [90, 90], [90, 90], [90, 0], [90, 0]),
  seatedRowIn: P(0, [-30, 90], [-30, 90], [90, 0], [90, 0]),
  wallSit: P(0, [10, 10], [5, 5], [90, 0], [90, 0]),
} satisfies Record<string, Pose>;
type PoseName = keyof typeof POSES;
const F = (names: PoseName[], extra: Omit<Figure, 'frames'> = {}): Figure => ({ frames: names.map((n) => POSES[n]), ...extra });

/** Moves without a photo, drawn as a stick figure. */
export const FIGURES: Record<string, Figure> = {
  'g-machine-lateral-raise': F(['standFront', 'armsOut'], { front: true }),
  'g-landmine-press': F(['guard', 'standArmsFwd']),
  'g-bayesian-cable-curl': F(['stand', 'guard']),
  'g-pendulum-squat': F(['stand', 'squat']),
  'g-belt-squat': F(['stand', 'squat']),
  'g-frog-pumps': F(['lyingKneesBent', 'bridgeUp']),
  'g-hollow-hold': F(['hollow', 'hollow']),
  'g-l-sit': F(['vSitHold', 'vSitHold']),
  'g-suitcase-carry': F(['march', 'march2'], { secs: 1.6 }),
  'g-man-makers': F(['standArmsUp', 'squat', 'plank', 'hingeRow']),
  'g-wall-balls': F(['squat', 'standArmsUp']),
  'g-burpee-box-jump-overs': F(['stand', 'squat', 'plank', 'squatReach']),
  'g-ski-erg': F(['standArmsUp', 'hinge']),
  'g-swimming': F(['lyingFaceDown', 'superman']),
  'g-foam-rolling': F(['lyingBack', 'lyingKneesBent'], { prop: 'mat' }),
  'g-thoracic-rotations': F(['allFours', 'threadNeedle'], { prop: 'mat' }),
  'h-march': F(['march', 'march2'], { secs: 1.4 }),
  'h-leg-swings': F(['march', 'lungeBack']),
  'h-torso-twist': F(['twist', 'twist2']),
  'h-lateral-lunge': F(['standFront', 'sideLungeFront'], { front: true }),
  'h-wall-sit': F(['wallSit', 'wallSit'], { prop: 'wall' }),
  'h-skater': F(['skate', 'skate2'], { front: true }),
  'h-shoulder-tap': F(['plank', 'plankArm'], { prop: 'mat' }),
  'h-snow-angel': F(['lyingFaceDown', 'snowAngel'], { prop: 'mat' }),
  'h-y-raise': F(['standFront', 'yRaise'], { front: true }),
  'h-bird-dog': F(['allFours', 'birdDog'], { prop: 'mat' }),
  'h-bear-hold': F(['allFours', 'bearHold'], { prop: 'mat' }),
  'h-plank-jack': F(['plank', 'plankJackOpen'], { prop: 'mat' }),
  'h-step-jacks': F(['jackClosed', 'stepOut', 'jackClosed', 'stepOut2'], { front: true }),
  'h-high-knees': F(['highKnee', 'highKnee2'], { secs: 0.8 }),
  'h-fast-march': F(['march', 'march2'], { secs: 1 }),
  'h-burpee': F(['stand', 'squat', 'plank', 'squat', 'squatReach']),
  'h-step-burpee': F(['stand', 'squat', 'plank', 'squat']),
  'h-shadow-box': F(['punch', 'punch2'], { secs: 0.9 }),
  'h-fast-feet': F(['highKnee', 'highKnee2'], { secs: 0.5 }),
  'h-squat-reach': F(['squat', 'squatReach']),
  'h-stair-run': F(['march', 'march2'], { prop: 'step', secs: 1.2 }),
  'h-cross-jab': F(['twist', 'twist2']),
  'h-figure-four': F(['lyingKneesBent', 'figureFour'], { prop: 'mat' }),
  'h-thread-needle': F(['allFours', 'threadNeedle'], { prop: 'mat' }),
  'h-deep-squat': F(['deepSquat', 'deepSquat']),
  'h-neck-shoulders': F(['standFront', 'sideBend', 'standFront', 'sideBend2'], { front: true, secs: 3 }),
  'h-seat-march': F(['seatedKnee', 'seatedKnee2'], { prop: 'chair', secs: 1.4 }),
  'h-seat-punch': F(['seatedPunch', 'seatedPunch2'], { prop: 'chair', secs: 1 }),
  'h-seat-jacks': F(['seated', 'seatedArmsOut'], { prop: 'chair', front: true }),
  'h-seat-knee': F(['seated', 'seatedTuck'], { prop: 'chair' }),
  'h-seat-legext': F(['seated', 'seatedLegLift'], { prop: 'chair' }),
  'h-sit-stand': F(['seated', 'stand'], { prop: 'chair' }),
  'h-seat-overhead': F(['seated', 'seatedArmsUp'], { prop: 'chair' }),
  'h-seat-row': F(['seatedRowOut', 'seatedRowIn'], { prop: 'chair' }),
  'h-chair-calf': F(['stand', 'calfUp'], { prop: 'chair' }),
  'h-step-touch': F(['jackClosed', 'stepOut', 'jackClosed', 'stepOut2'], { front: true }),
  'h-grapevine': F(['standFront', 'stepOut', 'standFront', 'stepOut2'], { front: true }),
  'h-knee-punch': F(['guard', 'kneePunch']),
  'h-boxer-shuffle': F(['guard', 'march'], { secs: 0.8 }),
  'h-side-reach': F(['sideBend', 'sideBend2'], { front: true }),
  'h-heel-dig': F(['stand', 'lungeBack']),
  'h-wall-angels': F(['wallAngelDown', 'wallAngelUp'], { front: true }),
  'h-arm-pulses': F(['armsOut', 'armsOutPulse'], { front: true, secs: 0.6 }),
  'h-tricep-kick': F(['kickStart', 'kickEnd']),
  'h-bottle-curl': F(['stand', 'guard']),
  'h-donkey-kick': F(['allFours', 'donkeyKick'], { prop: 'mat' }),
  'h-fire-hydrant': F(['allFours', 'donkeyKick'], { prop: 'mat' }),
  'h-clamshell': F(['sideLying', 'clamOpen'], { prop: 'mat' }),
  'h-toe-touch': F(['toeReach', 'toeReachUp'], { prop: 'mat' }),
  'h-mountain': F(['stand', 'standArmsUp'], { secs: 4 }),
  'h-down-dog': F(['allFours', 'downDog'], { prop: 'mat', secs: 3 }),
  'h-cobra': F(['lyingFaceDown', 'cobra'], { prop: 'mat', secs: 3 }),
  'h-warrior-two': F(['standFront', 'warriorFront'], { front: true, secs: 3 }),
  'h-tree': F(['standFront', 'treeFront'], { front: true, secs: 3 }),
  'h-low-lunge': F(['lungeBack', 'lowLunge'], { secs: 3 }),
  'h-happy-baby': F(['lyingKneesBent', 'happyBaby'], { prop: 'mat', secs: 3 }),
  'h-supine-twist': F(['lyingKneesBent', 'lyingTwist'], { prop: 'mat', secs: 3 }),
  'h-p-plank-five': F(['plank', 'plankArm'], { prop: 'partner' }),
  'h-p-wall-race': F(['wallSit', 'wallSit'], { prop: 'wall' }),
  'h-p-hand-squat': F(['standArmsFwd', 'squat'], { prop: 'partner' }),
  'h-p-situp-pass': F(['lyingKneesBent', 'sitUp'], { prop: 'partner' }),
  'h-p-pushup-five': F(['plank', 'pushDown', 'plank', 'plankArm'], { prop: 'partner' }),
  'h-p-mirror': F(['skate', 'skate2'], { front: true, prop: 'partner' }),
  'h-p-back-squat': F(['stand', 'wallSit'], { prop: 'partner' }),
  'h-p-leg-throw': F(['legsUp', 'legsDown'], { prop: 'mat' }),
  'h-p-wheelbarrow': F(['wheelbarrow', 'plankArm'], { prop: 'partner' }),
  'h-p-shadow': F(['punch', 'punch2'], { prop: 'partner', secs: 0.9 }),
};

// Body sizes in drawing units. The floor sits at y = 100.
const L = { torso: 34, neck: 4, head: 7, upper: 16, fore: 15, thigh: 20, shin: 20 };
const rad = (d: number) => (d * Math.PI) / 180;
const step = (p: [number, number], len: number, deg: number): [number, number] => [p[0] + len * Math.sin(rad(deg)), p[1] + len * Math.cos(rad(deg))];

export type Joints = { hip: [number, number]; neck: [number, number]; head: [number, number]; la: [number, number][]; ra: [number, number][]; ll: [number, number][]; rl: [number, number][] };
/** Joint positions for a pose, set down on the floor and centred on x = 60. */
export function joints(p: Pose): Joints {
  const hip: [number, number] = [0, 0];
  const shoulder = step(hip, L.torso, 180 - p.t);
  const neck = step(shoulder, L.neck, 180 - p.t - (p.head ?? 0));
  const head = step(neck, L.head, 180 - p.t - (p.head ?? 0));
  const limb = (from: [number, number], a: [number, number], l1: number, l2: number) => { const mid = step(from, l1, a[0]); return [from, mid, step(mid, l2, a[1])]; };
  const j = { hip, neck, head, la: limb(shoulder, p.la, L.upper, L.fore), ra: limb(shoulder, p.ra, L.upper, L.fore), ll: limb(hip, p.ll, L.thigh, L.shin), rl: limb(hip, p.rl, L.thigh, L.shin) };
  const pts = [hip, shoulder, [head[0], head[1] + L.head], ...j.la, ...j.ra, ...j.ll, ...j.rl] as [number, number][];
  const maxY = Math.max(...pts.map((q) => q[1]));
  const minX = Math.min(...pts.map((q) => q[0]));
  const maxX = Math.max(...pts.map((q) => q[0]));
  const dx = 60 - (minX + maxX) / 2;
  const dy = 100 - maxY - (p.up ?? 0);
  const mv = (q: [number, number]): [number, number] => [q[0] + dx, q[1] + dy];
  return { hip: mv(hip), neck: mv(neck), head: mv(head), la: j.la.map(mv) as [number, number][], ra: j.ra.map(mv) as [number, number][], ll: j.ll.map(mv) as [number, number][], rl: j.rl.map(mv) as [number, number][] };
}

/** A pose part way between two poses, for smooth movement. */
export function blend(a: Pose, b: Pose, k: number): Pose {
  const m = (x: number, y: number) => x + (y - x) * k;
  const m2 = (x: [number, number], y: [number, number]): [number, number] => [m(x[0], y[0]), m(x[1], y[1])];
  return { t: m(a.t, b.t), la: m2(a.la, b.la), ra: m2(a.ra, b.ra), ll: m2(a.ll, b.ll), rl: m2(a.rl, b.rl), up: m(a.up ?? 0, b.up ?? 0), head: m(a.head ?? 0, b.head ?? 0) };
}
