// Boot and the one loop for MIDNIGHT VAULT: input is read every frame, the world
// advances in fixed 1/60 s steps (thief, guards, cameras, alarm — in that order),
// events become sounds, and the renderer paints whatever screen the state is on.
// ?shot=name&seed=N stages a screenshot scene via shots.js instead of running the game.
import { STEP, WORLD } from './config.js';
import { buildLevel } from './level.js';
import { createThief, updateThief } from './thief.js';
import { createGuards, updateGuards } from './guards.js';
import { createCameras, updateCameras } from './cameras.js';
import { createAlarm, updateAlarm } from './alarm.js';
import { drawFrame, SCREEN_TITLE, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_ESCAPE } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Par time for the escape bonus, in seconds. */
const PAR = 240;
const UNSEEN_BONUS = 1500;
const TIME_BONUS_PER_SECOND = 10;
const CATCH_DISTANCE = 20;
const HINT_EVERY = 2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = WORLD.width;
canvas.height = WORLD.height;
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

/** A fresh heist: new thief, guards and cameras on the fixed floor plan. */
function buildState(runSeed) {
  const level = buildLevel();
  return {
    screen: SCREEN_TITLE,
    time: 0,
    seed: runSeed,
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

function boot() {
  const input = createInput(canvas);
  const audio = createAudio();
  let state = buildState(seed);
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  // AudioContext needs a real gesture: unlock inside the event handlers themselves.
  window.addEventListener('keydown', () => audio.unlock());
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function beginRun() {
    state = buildState(seed);
    state.screen = SCREEN_PLAY;
    state.startedAt = state.time;
    accumulator = 0;
    announce('Heist started. Grab the Star Sapphire and reach the van.');
  }

  function endCaught(cause) {
    state.screen = SCREEN_CAUGHT;
    state.cause = cause;
    audio.play('caught');
    announce('Busted. Press R to try again.');
  }

  function endEscape() {
    const timeBonus = Math.max(0, Math.round((PAR - state.time) * TIME_BONUS_PER_SECOND));
    const unseenBonus = state.maxAlarmStage < 2 ? UNSEEN_BONUS : 0;
    const total = state.banked + timeBonus + unseenBonus;
    state.result = { lootScore: state.banked, timeBonus, unseenBonus, total };
    state.score = total;
    state.screen = SCREEN_ESCAPE;
    audio.play('escape');
    announce(`Clean getaway. Total $${total}. Press R to run it again.`);
  }

  function hintExit() {
    if (state.hintCooldown > 0) return;
    state.hintCooldown = HINT_EVERY;
    state.events.push({ type: 'hint' });
  }

  function drainEvents() {
    for (const event of state.events) {
      if (event.type === 'loot') audio.play(event.major ? 'gem' : 'loot');
      else if (event.type === 'toss') audio.play('toss');
      else if (event.type === 'emp') audio.play('emp');
      else if (event.type === 'hint') announce('The van is no good yet — grab the Star Sapphire first.');
    }
    state.events.length = 0;
  }

  function checkEnd() {
    const thief = state.thief;
    if (state.alarm.tripped) {
      endCaught('alarm');
      return;
    }
    for (const guard of state.guards) {
      const alerted = guard.suspicion >= 1 || guard.mode === 'chase' || guard.mode === 'alert';
      if (alerted && Math.hypot(guard.x - thief.x, guard.y - thief.y) <= CATCH_DISTANCE) {
        endCaught('guard');
        return;
      }
    }
    const exit = state.level.exit;
    const inside = thief.x >= exit.x && thief.x <= exit.x + exit.w && thief.y >= exit.y && thief.y <= exit.y + exit.h;
    if (!inside) return;
    if (state.gemTaken) endEscape();
    else hintExit();
  }

  function step() {
    const stageBefore = state.alarm.stage;
    state.time += STEP;
    state.hintCooldown = Math.max(0, state.hintCooldown - STEP);
    updateThief(state, input, STEP);
    updateGuards(state, STEP);
    updateCameras(state, STEP);
    updateAlarm(state, STEP);
    state.maxAlarmStage = Math.max(state.maxAlarmStage, state.alarm.stage);
    if (state.alarm.stage > stageBefore) audio.play('spotted');
    drainEvents();
    checkEnd();
  }

  function handlePresses() {
    if (state.screen === SCREEN_TITLE) {
      if (input.wasPressed('start')) beginRun();
    } else if (state.screen === SCREEN_PLAY) {
      if (input.wasPressed('pause')) {
        state.paused = !state.paused;
        announce(state.paused ? 'Paused.' : 'Heist resumed.');
      }
      if (input.wasPressed('help')) state.showHelp = !state.showHelp;
    } else if (input.wasPressed('restart') || input.wasPressed('start')) {
      beginRun();
    }
  }

  // Leaving the tab pauses a running game rather than letting guards wander unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY && !state.paused) {
      state.paused = true;
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handlePresses();
    if (state.screen === SCREEN_PLAY && !state.paused && !state.showHelp) {
      while (accumulator >= STEP && state.screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    drawFrame(ctx, state);
    input.endFrame();
  }

  announce('Midnight Vault. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

/** ?shot=name: paint one staged frame and flag readiness, or fall back to the game. */
async function runShot(name) {
  try {
    const { buildShotScene } = await import('./shots.js');
    const scene = buildShotScene(name, seed);
    drawFrame(ctx, scene);
    status.textContent = `Screenshot scene: ${name}`;
    window.__shotReady = true;
    return true;
  } catch {
    return false;
  }
}

if (shot) runShot(shot).then((ok) => { if (!ok) boot(); });
else boot();
