// Guard AI: closed patrol routes, a suspicion meter driven by vision-cone sightings, and
// reactions — face the thief when suspicious, chase and feed the alarm when alerted, and
// wander over to fresh noises before returning to the route. Guards never enter solids:
// patrol waypoints sit on open floor, and chase/investigate movement slides along walls.
import { ALARM, GUARD } from './config.js';
import { inCone } from './vision.js';
import { addExposure } from './alarm.js';

const WAYPOINT_REACH = 6;
const WAYPOINT_PAUSE = 0.7;
const SNEAK_RANGE = 0.62;
const FACE_AT = 0.45;
const ALERT_AT = 1;
const ALERT_MEMORY = 2;
const INVESTIGATE_RANGE = 260;
const NOISE_FRESH = 1.5;
const LOOK_TIME = 1.2;

/** Shortest signed turn from `angle` toward `target`, capped at `maxStep` radians. */
function turnToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return angle + Math.max(-maxStep, Math.min(maxStep, d));
}

/** Push a guard-radius circle out of a solid rect (smallest-penetration axis). */
function pushOut(g, r) {
  const cx = Math.max(r.x, Math.min(g.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(g.y, r.y + r.h));
  const dx = g.x - cx;
  const dy = g.y - cy;
  const d2 = dx * dx + dy * dy;
  const radius = GUARD.radius;
  if (d2 >= radius * radius) return;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    g.x += dx * push;
    g.y += dy * push;
    return;
  }
  // Centre inside the rect: leave through the nearest face.
  const left = g.x - r.x;
  const right = r.x + r.w - g.x;
  const top = g.y - r.y;
  const bottom = r.y + r.h - g.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) g.x = r.x - radius;
  else if (m === right) g.x = r.x + r.w + radius;
  else if (m === top) g.y = r.y - radius;
  else g.y = r.y + r.h + radius;
}

/** Axis-separated move with wall sliding: x resolves, then y resolves. */
function moveBody(g, dx, dy, solids) {
  g.x += dx;
  for (const r of solids) pushOut(g, r);
  g.y += dy;
  for (const r of solids) pushOut(g, r);
}

/**
 * Walk toward (tx, ty) at `speed`, turning `angle` smoothly toward the heading.
 * Returns the remaining distance after the step.
 */
function moveToward(g, tx, ty, speed, dt, solids) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return 0;
  const step = Math.min(speed * dt, dist);
  moveBody(g, (dx / dist) * step, (dy / dist) * step, solids);
  g.angle = turnToward(g.angle, Math.atan2(dy, dx), GUARD.turnRate * dt);
  return dist - step;
}

/** A noise event counts while fresh: `until` timestamp, or `time`/`t` within NOISE_FRESH s. */
function freshNoise(noise, time) {
  if (!noise) return false;
  if (typeof noise.until === 'number') return time < noise.until;
  const t = noise.time ?? noise.t ?? time;
  return time - t <= NOISE_FRESH;
}

/** One guard per patrol route, starting on its first waypoint facing down the loop. */
export function createGuards(level) {
  return level.guardRoutes.map((route) => {
    const g = {
      x: route[0].x,
      y: route[0].y,
      angle: 0,
      route,
      routeIndex: 0,
      mode: 'patrol',
      suspicion: 0,
      target: null,
      wait: 0,
      alert: 0,
      timer: 0,
      noiseKey: null,
    };
    const next = route[1] ?? route[0];
    g.angle = Math.atan2(next.y - g.y, next.x - g.x);
    return g;
  });
}

function updateGuard(g, state, dt) {
  const { thief, solids, noise, time } = state;

  // --- Vision and suspicion -------------------------------------------------
  const seenRange = GUARD.viewRange * (thief.sneaking ? SNEAK_RANGE : 1);
  const tdx = thief.x - g.x;
  const tdy = thief.y - g.y;
  const tdist = Math.hypot(tdx, tdy);
  const seen = inCone(thief.x, thief.y, g.x, g.y, g.angle, GUARD.viewHalfAngle, seenRange, solids);

  if (seen) {
    // Closer sightings fill suspicion faster; far ones take longer to add up.
    const closeness = 1 - Math.min(tdist, seenRange) / seenRange;
    g.suspicion = Math.min(ALERT_AT, g.suspicion + (1.5 + 2.5 * closeness) * dt);
    g.alert = ALERT_MEMORY;
    g.target = { x: thief.x, y: thief.y };
  } else {
    g.suspicion = Math.max(0, g.suspicion - (g.suspicion >= ALERT_AT ? 1.4 : 0.35) * dt);
    g.alert = Math.max(0, g.alert - dt);
  }

  const chasing = g.suspicion >= ALERT_AT && (seen || g.alert > 0);
  if (chasing && seen) addExposure(state.alarm, ALARM.guardFill * dt);

  // --- Fresh noise -> investigate -------------------------------------------
  if (!chasing && g.mode === 'patrol' && g.suspicion < FACE_AT && freshNoise(noise, time)) {
    const key = `${noise.x},${noise.y},${noise.time ?? noise.t ?? noise.until ?? ''}`;
    if (g.noiseKey !== key && Math.hypot(noise.x - g.x, noise.y - g.y) <= INVESTIGATE_RANGE) {
      g.noiseKey = key;
      g.mode = 'investigate';
      g.target = { x: noise.x, y: noise.y };
    }
  }

  // --- Movement ---------------------------------------------------------------
  if (chasing) {
    moveToward(g, g.target.x, g.target.y, GUARD.chaseSpeed, dt, solids);
  } else {
    switch (g.mode) {
      case 'investigate': {
        const left = moveToward(g, g.target.x, g.target.y, GUARD.patrolSpeed, dt, solids);
        if (left <= WAYPOINT_REACH) {
          g.mode = 'return';
          g.timer = LOOK_TIME;
        }
        break;
      }
      case 'return': {
        g.timer -= dt;
        g.angle += GUARD.turnRate * 0.9 * dt; // look around
        if (g.timer <= 0) {
          g.mode = 'patrol';
          g.wait = 0;
        }
        break;
      }
      default: {
        if (g.wait > 0) {
          g.wait -= dt;
          break;
        }
        const wp = g.route[g.routeIndex];
        const left = moveToward(g, wp.x, wp.y, GUARD.patrolSpeed, dt, solids);
        if (left <= WAYPOINT_REACH) {
          g.routeIndex = (g.routeIndex + 1) % g.route.length;
          g.wait = WAYPOINT_PAUSE;
        }
      }
    }
    // Suspicious but not alerted: stop and face the thief.
    if (g.suspicion >= FACE_AT) {
      g.angle = turnToward(g.angle, Math.atan2(tdy, tdx), GUARD.turnRate * dt);
    }
  }
}

/** Advance every guard by dt seconds against the shared world state. */
export function updateGuards(state, dt) {
  for (const g of state.guards) updateGuard(g, state, dt);
}
