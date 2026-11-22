// The screenshot scenes behind ?shot=cover|mid|escape|caught&seed=N. Each scene builds a
// fresh heist with the same constructors main.js uses, then steps the real update
// functions (thief, guards, cameras, alarm — in that order) forward with a scripted
// input, so every painted frame is a real game frame and the same seed gives the same
// frame. Waypoints are driven by a tiny goto() helper: direction booleans recomputed
// toward the target each step.
import { STEP } from './config.js';
import { buildLevel } from './level.js';
import { createThief, updateThief } from './thief.js';
import { createGuards, updateGuards } from './guards.js';
import { createCameras, updateCameras } from './cameras.js';
import { createAlarm, updateAlarm } from './alarm.js';
import { SCREEN_PLAY } from './render.js';

const MAX_STEPS = 60 * 120;

/** A fresh heist state — the same shape main.js builds for a real run. */
function freshState(seed) {
  const level = buildLevel();
  return {
    screen: SCREEN_PLAY,
    time: 0,
    seed,
    level,
    loots: level.loots,
    solids: [...level.walls, ...level.covers],
    thief: createThief(level),
    guards: createGuards(level),
    cameras: createCameras(level),
    alarm: createAlarm(),
    banked: 0,
    gemTaken: false,
    noise: null,
    events: [],
    showHelp: false,
    paused: false,
    startedAt: 0,
    result: null,
    maxAlarmStage: 0,
    hintCooldown: 0,
  };
}

/** One real simulation step, in main.js's order. */
function step(state, input) {
  state.time += STEP;
  updateThief(state, input, STEP);
  updateGuards(state, STEP);
  updateCameras(state, STEP);
  updateAlarm(state, STEP);
}

/**
 * Play a script of input runs. Each run holds one input — an object, or a function of
 * the state for inputs that need live values like a toss target — for `steps` steps,
 * or until `until(state)` says stop, whichever comes first.
 */
function stepScript(state, runs) {
  for (const run of runs) {
    const cap = run.steps ?? MAX_STEPS;
    for (let i = 0; i < cap; i += 1) {
      if (run.until && run.until(state)) break;
      const input = typeof run.input === 'function' ? run.input(state) : run.input;
      step(state, input);
    }
  }
}

/** Walk toward (tx, ty), holding sneak if asked; finishes within 5px of the target. */
function goto(tx, ty, sneak = false) {
  return {
    until: (s) => Math.hypot(s.thief.x - tx, s.thief.y - ty) <= 5,
    input: (s) => ({
      up: s.thief.y - ty > 3,
      down: ty - s.thief.y > 3,
      left: s.thief.x - tx > 3,
      right: tx - s.thief.x > 3,
      sneak,
    }),
  };
}

/** Set the alarm meter to a staged level for the money shot, post-stepping. */
function dialAlarm(state, level, stage) {
  state.alarm.level = level;
  state.alarm.stage = stage;
  state.alarm.tripped = false;
}

// The money shot: thief mid-gallery, empty-handed, a guard's cone sweeping across the
// floor ahead of him while he eyes the vault, a camera beam visible, alarm noticed.
function sceneCover(seed) {
  const s = freshState(seed);
  stepScript(s, [
    goto(172, 462),
    goto(360, 430),
    goto(620, 335),
    { steps: 520, input: {} }, // hold while the gallery guard comes down the east lane
  ]);
  dialAlarm(s, 30, 1);
  return s;
}

// The mid-score: a side painting banked, the thief tucked behind a display case,
// a coin just clattered ahead of the gallery guard — noise fresh, guard investigating.
function sceneMid(seed) {
  const s = freshState(seed);
  stepScript(s, [
    goto(172, 462),
    goto(360, 430), // keep moving to shake the lobby guard's interest
    goto(300, 300),
    goto(212, 212), // brushes Moonlit Vista on the way
    goto(500, 302), // tucked on the south face of the (460,240) display case
    {
      steps: 1,
      input: (st) => {
        const g = st.guards[0];
        const dx = 450 - g.x;
        const dy = 300 - g.y;
        const d = Math.hypot(dx, dy) || 1;
        return {
          sneak: true,
          tossClicked: true,
          mouseX: Math.min(880, Math.max(60, g.x + (dx / d) * 140)),
          mouseY: Math.min(450, Math.max(60, g.y + (dy / d) * 140)),
        };
      },
    },
    { steps: 55, input: { sneak: true } },
  ]);
  dialAlarm(s, 55, 1);
  return s;
}

// The getaway frame: the Star Sapphire banked, the thief at the van door with the
// lobby guard alerted and closing in behind him — one step before the escape tally.
function sceneEscape(seed) {
  const s = freshState(seed);
  stepScript(s, [
    goto(172, 462),
    goto(360, 430),
    goto(700, 260),
    goto(872, 152),
    goto(928, 152), // through the gallery->vault door
    goto(1160, 165), // the Star Sapphire itself
    goto(880, 155),
    goto(560, 330),
    goto(320, 400),
    goto(200, 430),
    goto(172, 540), // back through the gallery->lobby door
    goto(268, 664), // just east of the van door exit zone
    { steps: 5, input: {} },
  ]);
  dialAlarm(s, 80, 2);
  return s;
}

// The frame before BUSTED: a guard bursts in at point-blank, suspicion maxed, hot cones.
function sceneCaught(seed) {
  const s = freshState(seed);
  stepScript(s, [
    goto(172, 462),
    goto(330, 400),
    goto(500, 316), // stand on the gallery patrol's lane
    {
      steps: 2400,
      until: (st) =>
        st.guards.some(
          (g) =>
            g.suspicion >= 1 &&
            Math.hypot(g.x - st.thief.x, g.y - st.thief.y) < 30,
        ),
      input: {},
    },
  ]);
  dialAlarm(s, 97, 2);
  return s;
}

/**
 * Build the named screenshot scene (cover, mid, escape or caught) on a fresh world and
 * return it with screen set to SCREEN_PLAY; unknown names fall back to cover.
 */
export function buildShotScene(name, seed) {
  switch (name) {
    case 'mid':
      return sceneMid(seed);
    case 'escape':
      return sceneEscape(seed);
    case 'caught':
      return sceneCaught(seed);
    case 'cover':
    default:
      return sceneCover(seed);
  }
}
