// Every move the workouts draw from. Nothing here needs a gym or a pool.
// equip: what the move needs ('none' means just floor space). impact 'high' moves involve jumping and drop out in quiet mode.

export type Area = 'legs' | 'push' | 'pull' | 'core' | 'cardio' | 'mobility' | 'warm';
export type Equip = 'none' | 'mat' | 'chair' | 'stairs' | 'dumbbells' | 'bands' | 'kettlebell' | 'rope' | 'backpack';

export type Exercise = {
  id: string;
  name: string;
  area: Area;
  equip: Equip;
  how: string;
  easier?: string;
  harder?: string;
  impact?: 'high';
  level?: 1 | 2 | 3; // lowest level that gets this move
  sides?: boolean; // done on each side, so the timer splits the block in half
  partner?: boolean;
};

export const EQUIPMENT: { value: Equip; label: string; note: string }[] = [
  { value: 'mat', label: 'Yoga mat or towel', note: 'For floor work' },
  { value: 'chair', label: 'Sturdy chair or couch', note: 'Dips, step ups, incline push ups' },
  { value: 'stairs', label: 'Stairs or a step', note: 'At home or outside' },
  { value: 'backpack', label: 'Backpack with books', note: 'Free extra weight' },
  { value: 'dumbbells', label: 'Dumbbells', note: 'Any weight' },
  { value: 'bands', label: 'Resistance bands', note: 'Loop or long bands' },
  { value: 'kettlebell', label: 'Kettlebell', note: 'Swings and goblet squats' },
  { value: 'rope', label: 'Skipping rope', note: 'Cardio' },
];

export const EXERCISES: Exercise[] = [
  // Warm up
  { id: 'march', name: 'March on the spot', area: 'warm', equip: 'none', how: 'Lift your knees to hip height and swing your arms. Start easy and build the pace.' },
  { id: 'arm-circles', name: 'Arm circles', area: 'warm', equip: 'none', how: 'Arms out to the sides. Small circles forwards, growing bigger, then switch direction halfway.' },
  { id: 'hip-circles', name: 'Hip circles', area: 'warm', equip: 'none', how: 'Hands on hips, feet wide. Draw big slow circles with your hips, switch direction halfway.' },
  { id: 'slow-squat', name: 'Slow squats', area: 'warm', equip: 'none', how: 'Sit back as if into a chair, three seconds down, stand up tall. Wake the legs up.' },
  { id: 'leg-swings', name: 'Leg swings', area: 'warm', equip: 'none', sides: true, how: 'Hold a wall. Swing one leg forwards and back, relaxed and loose.' },
  { id: 'torso-twist', name: 'Standing twists', area: 'warm', equip: 'none', how: 'Feet wide, arms loose. Turn your shoulders side to side and let the arms follow.' },

  // Legs
  { id: 'squat', name: 'Squats', area: 'legs', equip: 'none', how: 'Feet shoulder width, sit hips back and down, chest up, knees track over toes. Drive up through your heels.', easier: 'Squat to a chair and stand back up.', harder: 'Pause for two seconds at the bottom.' },
  { id: 'sumo-squat', name: 'Sumo squats', area: 'legs', equip: 'none', how: 'Wide stance, toes turned out. Lower straight down, keep knees pushed out.', harder: 'Rise onto your toes at the top.' },
  { id: 'reverse-lunge', name: 'Reverse lunges', area: 'legs', equip: 'none', how: 'Step one foot back and lower the back knee towards the floor. Push through the front heel to stand. Alternate legs.', easier: 'Hold a wall or chair for balance.', harder: 'Add a knee drive at the top.' },
  { id: 'lateral-lunge', name: 'Side lunges', area: 'legs', equip: 'none', how: 'Step wide to one side, sit back into that hip with the other leg straight. Push back to centre. Alternate.' },
  { id: 'curtsy-lunge', name: 'Curtsy lunges', area: 'legs', equip: 'none', level: 2, how: 'Step one foot behind and across the other, lower down, return. Alternate sides.' },
  { id: 'glute-bridge', name: 'Glute bridges', area: 'legs', equip: 'mat', how: 'Lie on your back, knees bent, feet flat. Squeeze your glutes and lift your hips until your body forms a straight line. Lower slowly.', harder: 'Hold for two seconds at the top.' },
  { id: 'single-bridge', name: 'Single leg bridges', area: 'legs', equip: 'mat', level: 2, sides: true, how: 'Bridge position with one leg lifted straight. Drive up through the planted heel.' },
  { id: 'wall-sit', name: 'Wall sit', area: 'legs', equip: 'none', how: 'Back flat against a wall, slide down until your thighs are close to level. Hold and breathe.', easier: 'Sit a little higher up the wall.' },
  { id: 'calf-raise', name: 'Calf raises', area: 'legs', equip: 'none', how: 'Rise onto your toes, pause, lower slowly. Hold a wall for balance if needed.', harder: 'Stand on the edge of a step for a bigger range.' },
  { id: 'squat-pulse', name: 'Squat pulses', area: 'legs', equip: 'none', level: 2, how: 'Hold the bottom of a squat and pulse up and down a few centimetres.' },
  { id: 'good-morning', name: 'Good mornings', area: 'legs', equip: 'none', how: 'Hands behind your head, soft knees. Hinge forward at the hips with a flat back, then squeeze your glutes to stand.' },
  { id: 'chair-squat', name: 'Chair squats', area: 'legs', equip: 'chair', how: 'Sit down to the chair under control, tap the seat, stand straight back up without rocking.' },
  { id: 'split-squat', name: 'Split squats on a chair', area: 'legs', equip: 'chair', level: 2, sides: true, how: 'Rest the top of your back foot on a chair behind you. Lower the back knee, keep the front knee over the ankle.' },
  { id: 'step-up', name: 'Step ups', area: 'legs', equip: 'stairs', how: 'Step up onto a stair or sturdy step with one foot, stand tall, step down. Alternate the lead leg.', harder: 'Use a higher step or hold your backpack.' },
  { id: 'jump-squat', name: 'Jump squats', area: 'legs', equip: 'none', impact: 'high', level: 2, how: 'Squat down, then jump up explosively. Land softly and sink straight into the next squat.' },
  { id: 'skater', name: 'Skaters', area: 'legs', equip: 'none', impact: 'high', level: 2, how: 'Leap sideways from one foot to the other, landing softly with a slight bend.', easier: 'Step across instead of jumping.' },
  { id: 'goblet-squat', name: 'Goblet squats', area: 'legs', equip: 'dumbbells', how: 'Hold one dumbbell at your chest, elbows tucked. Squat deep with your chest up.' },
  { id: 'db-rdl', name: 'Dumbbell deadlifts', area: 'legs', equip: 'dumbbells', how: 'Dumbbells in front of your thighs. Hinge at the hips, slide the weights down your legs with a flat back, then stand tall.' },
  { id: 'kb-swing', name: 'Kettlebell swings', area: 'legs', equip: 'kettlebell', level: 2, how: 'Hinge and hike the bell back between your legs, then snap your hips forward so it floats to chest height. The power comes from your hips.' },
  { id: 'band-walk', name: 'Band side steps', area: 'legs', equip: 'bands', how: 'Loop band above the knees, half squat. Step sideways keeping tension, then come back the other way.' },
  { id: 'backpack-squat', name: 'Backpack squats', area: 'legs', equip: 'backpack', how: 'Wear a loaded backpack on your front or back and squat with a tall chest.' },

  // Push
  { id: 'wall-pushup', name: 'Wall push ups', area: 'push', equip: 'none', how: 'Hands on a wall at shoulder height, step back. Lower your chest to the wall and push away. Keep your body straight.' },
  { id: 'incline-pushup', name: 'Incline push ups', area: 'push', equip: 'chair', how: 'Hands on a sturdy chair, couch arm or bench. Lower your chest to the edge, push back up.' },
  { id: 'knee-pushup', name: 'Knee push ups', area: 'push', equip: 'mat', how: 'Knees down, hands under shoulders, body straight from knees to head. Lower your chest to the floor and press up.' },
  { id: 'pushup', name: 'Push ups', area: 'push', equip: 'none', level: 2, how: 'Hands under shoulders, body in a straight plank. Lower your chest close to the floor, press back up.', easier: 'Drop to your knees when the form slips.' },
  { id: 'shoulder-tap', name: 'Plank shoulder taps', area: 'push', equip: 'mat', how: 'High plank, feet wide. Tap each shoulder with the opposite hand while keeping your hips still.', easier: 'Do them from your knees.' },
  { id: 'dips', name: 'Chair dips', area: 'push', equip: 'chair', how: 'Hands on the edge of a chair behind you, feet out front. Bend your elbows straight back to lower, then press up.', easier: 'Bend your knees and keep feet close.' },
  { id: 'pike-pushup', name: 'Pike push ups', area: 'push', equip: 'none', level: 3, how: 'Hips high in an upside down V. Bend your elbows to lower the top of your head towards the floor, press up.' },
  { id: 'db-press', name: 'Dumbbell shoulder press', area: 'push', equip: 'dumbbells', how: 'Dumbbells at shoulder height, press straight overhead, lower with control.' },
  { id: 'db-floor-press', name: 'Dumbbell floor press', area: 'push', equip: 'dumbbells', how: 'Lie on your back, elbows on the floor. Press the dumbbells up over your chest and lower until your elbows touch.' },
  { id: 'band-press', name: 'Band chest press', area: 'push', equip: 'bands', how: 'Band around your back, ends in your hands. Press forward to straight arms, return slowly.' },

  // Pull and back
  { id: 'superman', name: 'Supermans', area: 'pull', equip: 'mat', how: 'Lie face down, arms forward. Lift arms, chest and legs a few centimetres, squeeze, lower.' },
  { id: 'snow-angel', name: 'Reverse snow angels', area: 'pull', equip: 'mat', how: 'Face down, chest slightly lifted. Sweep your arms from your hips to overhead and back, thumbs up.' },
  { id: 'y-raise', name: 'Y raises', area: 'pull', equip: 'mat', how: 'Face down, arms overhead in a Y. Lift your arms off the floor by squeezing your shoulder blades.' },
  { id: 'backpack-row', name: 'Backpack rows', area: 'pull', equip: 'backpack', how: 'Hold the backpack by the top handle. Hinge forward with a flat back and row it to your ribs.' },
  { id: 'db-row', name: 'Dumbbell rows', area: 'pull', equip: 'dumbbells', sides: true, how: 'One hand on a chair, flat back. Row the dumbbell to your hip, lower slowly.' },
  { id: 'band-row', name: 'Band rows', area: 'pull', equip: 'bands', how: 'Anchor the band at chest height in a door or around a pole. Pull your elbows back and squeeze.' },
  { id: 'band-apart', name: 'Band pull aparts', area: 'pull', equip: 'bands', how: 'Arms straight out front holding the band. Pull it apart to your chest, return with control.' },

  // Core
  { id: 'plank', name: 'Plank', area: 'core', equip: 'mat', how: 'Forearms down, elbows under shoulders, body straight. Squeeze glutes and brace like someone is about to poke your stomach.', easier: 'Knees down.' },
  { id: 'side-plank', name: 'Side plank', area: 'core', equip: 'mat', sides: true, how: 'On one forearm, feet stacked, hips lifted in a straight line.', easier: 'Bottom knee down.' },
  { id: 'dead-bug', name: 'Dead bugs', area: 'core', equip: 'mat', how: 'On your back, arms up, knees bent over hips. Lower the opposite arm and leg towards the floor, keep your lower back flat. Alternate.' },
  { id: 'bird-dog', name: 'Bird dogs', area: 'core', equip: 'mat', how: 'On hands and knees. Reach the opposite arm and leg out long, pause, return. Alternate.' },
  { id: 'climbers', name: 'Mountain climbers', area: 'core', equip: 'none', how: 'High plank. Drive one knee to your chest, then switch. Steady for low impact, fast for cardio.' },
  { id: 'bicycle', name: 'Bicycle crunches', area: 'core', equip: 'mat', how: 'On your back, hands behind your head. Bring the opposite elbow towards the opposite knee as the other leg extends.' },
  { id: 'hollow', name: 'Hollow hold', area: 'core', equip: 'mat', level: 2, how: 'On your back, press your lower back down, lift shoulders and legs off the floor and hold.', easier: 'Bend your knees.' },
  { id: 'flutter', name: 'Flutter kicks', area: 'core', equip: 'mat', how: 'On your back, legs straight and lifted a little. Kick small and fast, lower back pressed down.' },
  { id: 'heel-tap', name: 'Heel taps', area: 'core', equip: 'mat', how: 'On your back, knees bent, shoulders lifted. Reach side to side to tap each heel.' },
  { id: 'russian-twist', name: 'Russian twists', area: 'core', equip: 'mat', how: 'Sit leaning back, feet down or lifted. Turn your shoulders to touch the floor beside each hip.' },
  { id: 'knee-elbow', name: 'Standing knee to elbow', area: 'core', equip: 'none', how: 'Hands behind your head. Lift one knee and crunch the opposite elbow down to meet it. Alternate.' },
  { id: 'bear-hold', name: 'Bear hold', area: 'core', equip: 'mat', how: 'On hands and knees, lift your knees two centimetres off the floor and hold, back flat.' },
  { id: 'plank-jack', name: 'Plank jacks', area: 'core', equip: 'none', impact: 'high', level: 2, how: 'High plank. Jump your feet out wide and back in, hips steady.' },

  // Cardio
  { id: 'jacks', name: 'Jumping jacks', area: 'cardio', equip: 'none', impact: 'high', how: 'Jump feet wide while raising your arms overhead, jump back in.' },
  { id: 'step-jacks', name: 'Step jacks', area: 'cardio', equip: 'none', how: 'Step one foot out wide as your arms go up, step in, switch sides. Quiet and quick.' },
  { id: 'high-knees', name: 'High knees', area: 'cardio', equip: 'none', impact: 'high', how: 'Run on the spot driving your knees up to hip height, arms pumping.' },
  { id: 'fast-march', name: 'Power march', area: 'cardio', equip: 'none', how: 'March on the spot as fast as you can, knees high, arms driving.' },
  { id: 'butt-kicks', name: 'Butt kicks', area: 'cardio', equip: 'none', how: 'Jog on the spot, flicking your heels up towards your glutes.' },
  { id: 'burpee', name: 'Burpees', area: 'cardio', equip: 'none', impact: 'high', level: 2, how: 'Squat, hands down, jump feet back to a plank, jump them in, jump up.', easier: 'Step back and step in, then stand up.' },
  { id: 'step-burpee', name: 'Step back burpees', area: 'cardio', equip: 'none', how: 'Squat, hands down, step back to a plank one foot at a time, step back in, stand tall.' },
  { id: 'shadow-box', name: 'Shadow boxing', area: 'cardio', equip: 'none', how: 'Light on your feet, hands up. Throw straight punches, hooks and uppercuts, keep moving.' },
  { id: 'fast-feet', name: 'Fast feet', area: 'cardio', equip: 'none', how: 'Half squat, quick tiny steps on the balls of your feet as fast as you can.' },
  { id: 'squat-reach', name: 'Squat to reach', area: 'cardio', equip: 'none', how: 'Squat down, then stand and reach both arms high onto your toes. Keep a steady rhythm.' },
  { id: 'inchworm', name: 'Inchworms', area: 'cardio', equip: 'none', how: 'Fold forward, walk your hands out to a plank, walk them back in, stand up.' },
  { id: 'skip-rope', name: 'Skipping', area: 'cardio', equip: 'rope', impact: 'high', how: 'Small bounces on the balls of your feet, wrists turning the rope.' },
  { id: 'stair-run', name: 'Stair climbs', area: 'cardio', equip: 'stairs', how: 'Climb stairs at a steady fast pace, walk down to recover. Use the rail on the way down.' },
  { id: 'cross-jab', name: 'Cross body punches', area: 'cardio', equip: 'none', how: 'Twist and punch across your body, alternating sides, quick and controlled.' },

  // Mobility and stretching
  { id: 'cat-cow', name: 'Cat and cow', area: 'mobility', equip: 'mat', how: 'On hands and knees. Round your back up, then let your belly drop and look up. Move with your breath.' },
  { id: 'worlds-greatest', name: 'Lunge with a twist', area: 'mobility', equip: 'none', sides: true, how: 'Long lunge, hand inside the front foot, rotate and reach the other arm to the ceiling.' },
  { id: 'hip-flexor', name: 'Hip flexor stretch', area: 'mobility', equip: 'mat', sides: true, how: 'Kneel on one knee, tuck your hips under and lean gently forward until the front of the hip stretches.' },
  { id: 'childs-pose', name: 'Child’s pose', area: 'mobility', equip: 'mat', how: 'Knees wide, sit back on your heels and stretch your arms forward on the floor. Breathe slowly.' },
  { id: 'hamstring', name: 'Hamstring stretch', area: 'mobility', equip: 'mat', sides: true, how: 'Sit with one leg straight, other foot against the knee. Fold forward from the hips over the straight leg.' },
  { id: 'figure-four', name: 'Figure four stretch', area: 'mobility', equip: 'mat', sides: true, how: 'On your back, ankle across the opposite knee. Pull the bottom leg towards you.' },
  { id: 'thread-needle', name: 'Thread the needle', area: 'mobility', equip: 'mat', sides: true, how: 'On hands and knees, slide one arm under your body and rest your shoulder down. Open back up to the ceiling.' },
  { id: 'quad-stretch', name: 'Standing quad stretch', area: 'mobility', equip: 'none', sides: true, how: 'Hold a wall, pull one heel towards your glutes, knees together.' },
  { id: 'chest-opener', name: 'Doorway chest stretch', area: 'mobility', equip: 'none', how: 'Forearms on a door frame, step through gently until your chest opens up.' },
  { id: 'deep-squat', name: 'Deep squat hold', area: 'mobility', equip: 'none', how: 'Sink into a low squat, elbows pressing knees out. Hold a door frame if needed.' },
  { id: 'neck-shoulders', name: 'Neck and shoulder rolls', area: 'mobility', equip: 'none', how: 'Slow shoulder rolls back, then tilt each ear towards the shoulder.' },

  // Partner moves
  { id: 'p-plank-five', name: 'Plank high fives', area: 'core', equip: 'mat', partner: true, how: 'Face each other in high plank, heads apart. Take turns high fiving with alternate hands.', easier: 'Knees down.' },
  { id: 'p-wall-race', name: 'Wall sit race', area: 'legs', equip: 'none', partner: true, how: 'Wall sit side by side. Whoever stands up first owes the other a cup of tea.' },
  { id: 'p-hand-squat', name: 'Hand hold squats', area: 'legs', equip: 'none', partner: true, how: 'Face each other holding hands, feet apart. Squat deep together, using each other for balance.' },
  { id: 'p-situp-pass', name: 'Sit up and pass', area: 'core', equip: 'mat', partner: true, how: 'Sit facing each other, feet touching. Sit up together and pass a water bottle at the top, lower down, repeat.' },
  { id: 'p-pushup-five', name: 'Push up high fives', area: 'push', equip: 'none', partner: true, how: 'Face each other in push up position. One push up each, then a high five.', easier: 'Both on your knees.' },
  { id: 'p-mirror', name: 'Mirror drill', area: 'cardio', equip: 'none', partner: true, how: 'Face each other. One leads with side shuffles and fast feet, the other copies. Swap leader halfway.' },
  { id: 'p-back-squat', name: 'Back to back sit', area: 'legs', equip: 'none', partner: true, how: 'Stand back to back, link arms, walk your feet out and lower into a sit together. Hold.' },
  { id: 'p-lunge-pass', name: 'Lunge and pass', area: 'legs', equip: 'none', partner: true, how: 'Lunge side by side and pass a water bottle under the front leg to your partner each rep.' },
  { id: 'p-leg-throw', name: 'Leg throw downs', area: 'core', equip: 'mat', partner: true, level: 2, how: 'One lies down holding the standing partner’s ankles and lifts both legs up. The partner pushes them down, and the lifter stops them before the floor. Swap halfway.' },
  { id: 'p-wheelbarrow', name: 'Wheelbarrow walk', area: 'push', equip: 'none', partner: true, level: 3, how: 'One holds the other’s ankles while they walk forward on their hands. Swap halfway.' },
  { id: 'p-shadow', name: 'Pad and punch', area: 'cardio', equip: 'none', partner: true, how: 'One holds up open palms as targets, the other throws light punches at them. Swap halfway.' },
];

export const byId = (id: string) => EXERCISES.find((e) => e.id === id);
