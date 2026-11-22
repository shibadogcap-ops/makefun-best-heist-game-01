// Wall-mounted security cameras: each sweeps a cone back and forth from its base angle.
// Standing in the beam (or sneaking into its close range) feeds the alarm; an EMP blast
// counts the camera down while `disabled` ticks to zero.
import { ALARM, CAMERA } from './config.js';
import { inCone } from './vision.js';
import { addExposure } from './alarm.js';

const SNEAK_RANGE = 0.7;

/** One camera per level camera slot, phased by index so they don't sweep in lockstep. */
export function createCameras(level) {
  return level.cameras.map((c, i) => ({
    x: c.x,
    y: c.y,
    baseAngle: c.baseAngle,
    angle: c.baseAngle,
    phase: (i * Math.PI * 2) / Math.max(1, level.cameras.length),
    disabled: 0,
  }));
}

/** Sweep angles, run EMP cooldowns, and charge the alarm for whoever is in the beam. */
export function updateCameras(state, dt) {
  const { thief, solids, alarm } = state;
  for (const cam of state.cameras) {
    cam.angle = cam.baseAngle + Math.sin(state.time * CAMERA.sweepSpeed + cam.phase) * CAMERA.sweepArc;
    if (cam.disabled > 0) cam.disabled = Math.max(0, cam.disabled - dt);
    if (cam.disabled > 0) continue;
    const range = CAMERA.viewRange * (thief.sneaking ? SNEAK_RANGE : 1);
    if (inCone(thief.x, thief.y, cam.x, cam.y, cam.angle, CAMERA.viewHalfAngle, range, solids)) {
      addExposure(alarm, ALARM.cameraFill * dt);
    }
  }
}
