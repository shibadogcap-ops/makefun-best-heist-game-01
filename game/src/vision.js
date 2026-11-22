// Vision geometry: can a guard (or camera) see a point through the museum's walls and
// display cases? Pure functions over the level's solid rects ({x, y, w, h}); solids are
// treated as closed regions, but a segment that only touches an edge or corner — ending
// exactly on a wall face, say — counts as clear as long as it never enters the interior.

/** Slab test: the [t0, t1] interval where segment p->p+d overlaps rect r, clipped to [0,1]. */
function segRectOverlap(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-12) {
    if (x1 < r.x || x1 > r.x + r.w) return null;
  } else {
    let a = (r.x - x1) / dx;
    let b = (r.x + r.w - x1) / dx;
    if (a > b) { const t = a; a = b; b = t; }
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  if (Math.abs(dy) < 1e-12) {
    if (y1 < r.y || y1 > r.y + r.h) return null;
  } else {
    let a = (r.y - y1) / dy;
    let b = (r.y + r.h - y1) / dy;
    if (a > b) { const t = a; a = b; b = t; }
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  // A positive-length overlap means the segment passes through the rect's interior;
  // a zero-length touch (edge, corner, grazing) leaves line of sight intact.
  return t1 - t0 > 1e-9 ? [t0, t1] : null;
}

/** How far a segment may dip before it counts as entering a solid's interior. */
const SKIN = 1e-6;

/**
 * True when the segment crosses no solid rect. Edge touches and endpoints sitting exactly
 * on a boundary are clear; crossing or ending inside a solid is not.
 */
export function losClear(x1, y1, x2, y2, solids) {
  for (const r of solids) {
    // Test the interior only: touching or sliding along an edge never blocks sight.
    const inner = { x: r.x + SKIN, y: r.y + SKIN, w: r.w - 2 * SKIN, h: r.h - 2 * SKIN };
    if (inner.w > 0 && inner.h > 0 && segRectOverlap(x1, y1, x2, y2, inner)) return false;
  }
  return true;
}

/** Ray vs AABB: smallest t >= 0 where the ray enters the rect, or null on a miss. */
function rayRectT(ox, oy, dx, dy, r) {
  let tmin = -Infinity;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-12) {
    if (ox < r.x || ox > r.x + r.w) return null;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.w - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-12) {
    if (oy < r.y || oy > r.y + r.h) return null;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.h - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin || tmax < 0) return null;
  return Math.max(tmin, 0);
}

const RAYS = 24;

/**
 * The visible cone as a filled-path polygon: the origin followed by the clipped end of
 * ~24 rays fanned across the arc, each stopped at the nearest solid or at `range`.
 * Points are in angular order, so ctx.fill() with a 'nonzero'/'evenodd' rule works directly.
 */
export function conePolygon(x, y, angle, halfAngle, range, solids) {
  const points = [{ x, y }];
  for (let i = 0; i < RAYS; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / (RAYS - 1);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let t = range;
    for (const r of solids) {
      const hit = rayRectT(x, y, dx, dy, r);
      if (hit !== null && hit < t) t = hit;
    }
    points.push({ x: x + dx * t, y: y + dy * t });
  }
  return points;
}

/** Shortest signed difference b - a, wrapped to [-PI, PI]. */
function angleDelta(b, a) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * True when (px, py) is inside the vision cone: within `range`, within `halfAngle` of
 * `angle`, and with clear line of sight back to the observer at (x, y).
 */
export function inCone(px, py, x, y, angle, halfAngle, range, solids) {
  const dx = px - x;
  const dy = py - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1e-9 && Math.abs(angleDelta(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  return losClear(x, y, px, py, solids);
}
