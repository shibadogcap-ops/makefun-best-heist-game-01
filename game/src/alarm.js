// The alarm meter: vision fills it (guards, cameras), it cools off when nothing is seen,
// and at max the heist is blown. `stage` is the coarse alert level — 0 calm, 1 noticed,
// 2 hunted — and once `tripped` it never un-trips.
import { ALARM } from './config.js';

const DECAY_AFTER_SEEN = 1.5;
const STAGE_1 = 35;
const STAGE_2 = 70;
const DECAY_FLOOR_GEM = 30;

/** Fresh meter at stage 0; `sinceSeen` starts high so decay waits a beat. */
export function createAlarm() {
  return { level: 0, stage: 0, tripped: false, sinceSeen: 999 };
}

function fill(alarm, amount) {
  alarm.level = Math.min(ALARM.max, alarm.level + amount);
  alarm.sinceSeen = 0;
  if (alarm.level >= ALARM.max) alarm.tripped = true;
}

/** Guard/camera exposure: continuous fill while a detector holds sight. */
export function addExposure(alarm, amount) {
  fill(alarm, amount);
}

/** Instant jump — the gem grab pushes the alarm up a chunk at once. */
export function raiseAlarm(alarm, amount) {
  fill(alarm, amount);
}

/** Cool the meter down, keep the stage honest, never un-trip. */
export function updateAlarm(state, dt) {
  const alarm = state.alarm;
  alarm.sinceSeen += dt;
  if (alarm.sinceSeen > DECAY_AFTER_SEEN) {
    const floor = state.gemTaken ? DECAY_FLOOR_GEM : 0;
    alarm.level = Math.max(floor, alarm.level - ALARM.decay * dt);
  }
  if (alarm.level >= STAGE_2) alarm.stage = 2;
  else if (alarm.level >= STAGE_1) alarm.stage = 1;
  else alarm.stage = 0;
}
