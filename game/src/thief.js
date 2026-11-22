// The thief: WASD movement with wall sliding, sneaking, loot grabs, the vent pair,
// coin tosses that bait guards, and EMPs that blind cameras. Reads the shared `state`
// ({thief, solids, loots, level, time, noise}) plus the input module's held flags.
import { ALARM, THIEF, TOOLS } from './config.js';
import { raiseAlarm } from './alarm.js';

const VENT_COOLDOWN = 0.8;
const COVER_SHADOW = 6;

/** Push a thief-radius circle out of a solid rect (smallest-penetration axis). */
function pushOut(t, r) {
  const cx = Math.max(r.x, Math.min(t.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(t.y, r.y + r.h));
  const dx = t.x - cx;
  const dy = t.y - cy;
  const d2 = dx * dx + dy * dy;
  const radius = THIEF.radius;
  if (d2 >= radius * radius) return;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    t.x += dx * push;
    t.y += dy * push;
    return;
  }
  // Centre inside the rect: leave through the nearest face.
  const left = t.x - r.x;
  const right = r.x + r.w - t.x;
  const top = t.y - r.y;
  const bottom = r.y + r.h - t.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) t.x = r.x - radius;
  else if (m === right) t.x = r.x + r.w + radius;
  else if (m === top) t.y = r.y - radius;
  else t.y = r.y + r.h + radius;
}

/** Axis-separated move with sliding: x resolves, then y resolves. */
function moveThief(t, dx, dy, solids) {
  t.x += dx;
  for (const r of solids) pushOut(t, r);
  t.y += dy;
  for (const r of solids) pushOut(t, r);
}

/** Circle-vs-rect overlap: nearest point on the rect within the thief's radius. */
function overlaps(t, r) {
  const cx = Math.max(r.x, Math.min(t.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(t.y, r.y + r.h));
  return (t.x - cx) * (t.x - cx) + (t.y - cy) * (t.y - cy) <= THIEF.radius * THIEF.radius;
}

/** Centre sits on (or just inside) the rect. */
function inside(t, r) {
  return t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h;
}

function pushEvent(state, event) {
  if (!state.events) state.events = [];
  state.events.push(event);
}

/** Thief at the level's start, pockets full, facing up. */
export function createThief(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    radius: THIEF.radius,
    angle: -Math.PI / 2,
    sneaking: false,
    coins: TOOLS.coins,
    emps: TOOLS.emps,
    empCooldown: 0,
    hidden: false,
  };
}

function stepThief(state, input, dt) {
  const { thief: t, solids, loots, level } = state;
  t.sneaking = Boolean(input.sneak);
  t.empCooldown = Math.max(0, t.empCooldown - dt);
  if (state.ventCooldown !== undefined) state.ventCooldown = Math.max(0, state.ventCooldown - dt);

  // --- Movement ----------------------------------------------------------------
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const len = Math.hypot(dx, dy);
    const speed = t.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
    moveThief(t, (dx / len) * speed * dt, (dy / len) * speed * dt, solids);
    t.angle = Math.atan2(dy, dx);
  } else if (input.mouseX !== undefined && input.mouseY !== undefined) {
    t.angle = Math.atan2(input.mouseY - t.y, input.mouseX - t.x);
  }

  // --- Cover shadow: crouched within 6px of a display case/pillar/desk ----------
  t.hidden = false;
  if (t.sneaking) {
    for (const c of level.covers) {
      const near =
        t.x > c.x - COVER_SHADOW && t.x < c.x + c.w + COVER_SHADOW &&
        t.y > c.y - COVER_SHADOW && t.y < c.y + c.h + COVER_SHADOW;
      if (near) { t.hidden = true; break; }
    }
  }

  // --- Loot: grab on touch -------------------------------------------------------
  for (const loot of loots) {
    if (!loot.taken && overlaps(t, loot)) {
      loot.taken = true;
      state.banked = (state.banked ?? 0) + loot.value;
      pushEvent(state, { type: 'loot', major: loot.major });
      if (loot.major) {
        state.gemTaken = true;
        raiseAlarm(state.alarm, ALARM.gemRaise);
      }
    }
  }

  // --- Vents: hop between the linked grates ---------------------------------------
  if (input.vent && (!state.ventCooldown || state.ventCooldown <= 0)) {
    const { ventA, ventB } = level;
    if (inside(t, ventA)) {
      t.x = ventB.x + ventB.w / 2;
      t.y = ventB.y + ventB.h / 2;
      state.ventCooldown = VENT_COOLDOWN;
    } else if (inside(t, ventB)) {
      t.x = ventA.x + ventA.w / 2;
      t.y = ventA.y + ventA.h / 2;
      state.ventCooldown = VENT_COOLDOWN;
    }
  }

  // --- Coin toss: a clatter at the cursor that pulls guards' attention ----------
  if (input.tossClicked && t.coins > 0) {
    t.coins -= 1;
    state.noise = { x: input.mouseX, y: input.mouseY, t: state.time };
    pushEvent(state, { type: 'toss' });
  }

  // --- EMP: blind every camera for a stretch --------------------------------------
  if (input.emp && t.emps > 0 && t.empCooldown <= 0) {
    t.emps -= 1;
    t.empCooldown = TOOLS.empSeconds;
    for (const cam of state.cameras ?? []) cam.disabled = TOOLS.empSeconds;
    pushEvent(state, { type: 'emp' });
  }
}

/** Advance the thief by dt seconds against the shared world state. */
export function updateThief(state, input, dt) {
  stepThief(state, input, dt);
}
