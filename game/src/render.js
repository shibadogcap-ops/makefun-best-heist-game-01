// Renderer for MIDNIGHT VAULT: one drawFrame(ctx, state) paints the whole logical
// 1280x720 playfield for whatever screen the game is on. Everything is deterministic —
// animation breathes off state.time only, never Math.random or Date.now.
//
// Layout of this file, top to bottom:
//   imports + palette helpers        drawFrame + screen dispatch
//   floor / walls / furniture        cones (cameras + guards)
//   loot, noise, actors, HUD         title / caught / escape / help / pause
import { WORLD, COLOURS, GUARD, CAMERA } from './config.js';
import { conePolygon, inCone } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_ESCAPE = 'escape';

/* ------------------------------------------------------------------ helpers */

/** '$1,234' style money, tolerant of undefined/NaN. */
export function formatMoney(n) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return `$${v.toLocaleString('en-US')}`;
}

function alpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mix two 'rgba(...)' strings by t (0 = a, 1 = b). */
function mixColour(a, b, t) {
  const pa = a.match(/[\d.]+/g).map(Number);
  const pb = b.match(/[\d.]+/g).map(Number);
  return `rgba(${Math.round(pa[0] + (pb[0] - pa[0]) * t)}, ${Math.round(
    pa[1] + (pb[1] - pa[1]) * t,
  )}, ${Math.round(pa[2] + (pb[2] - pa[2]) * t)}, ${pa[3] + (pb[3] - pa[3]) * t})`;
}

function fillPath(ctx, points, style) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

function text(ctx, str, x, y, { size = 14, colour = COLOURS.text, align = 'left', weight = 'normal' } = {}) {
  ctx.font = `${weight} ${size}px "Courier New", monospace`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* --------------------------------------------------------------------- floor */

/** Two-tone checker floor plus faint grid lines, clipped to the world. */
function drawFloor(ctx) {
  ctx.fillStyle = COLOURS.floor;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const tile = 80;
  ctx.fillStyle = COLOURS.floorAlt;
  for (let ty = 0; ty < WORLD.height / tile; ty += 1) {
    for (let tx = 0; tx < WORLD.width / tile; tx += 1) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }
  ctx.strokeStyle = alpha(COLOURS.wallTop, 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += tile) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
  }
  for (let y = 0; y <= WORLD.height; y += tile) {
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
  }
  ctx.stroke();
}

/** Walls: dark fill with a lighter top edge so thickness reads as height. */
function drawWalls(ctx, walls) {
  for (const w of walls) {
    ctx.fillStyle = COLOURS.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLOURS.wallTop;
    ctx.fillRect(w.x, w.y, w.w, Math.min(4, w.h));
  }
}

/* --------------------------------------------------------------- furniture */

function drawCover(ctx, cover) {
  const { x, y, w, h, kind } = cover;
  if (kind === 'case') {
    // Glass display case: blue pane with a gold rim.
    ctx.fillStyle = alpha('#7aa2ff', 0.22);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOURS.loot;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = alpha('#7aa2ff', 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, y + 4);
    ctx.lineTo(x + w * 0.25, y + h - 4);
    ctx.moveTo(x + w * 0.75, y + 4);
    ctx.lineTo(x + w * 0.75, y + h - 4);
    ctx.stroke();
    return;
  }
  if (kind === 'pillar') {
    ctx.fillStyle = '#39415f';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#4b5578';
    ctx.fillRect(x, y, w, 4);
    ctx.strokeStyle = '#222a45';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    return;
  }
  // 'desk' (and any unknown kind): wood.
  ctx.fillStyle = '#5a3d2b';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#6e4c35';
  ctx.fillRect(x, y, w, 4);
  ctx.strokeStyle = '#3d2818';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 4);
  ctx.lineTo(x + w - 4, y + 4);
  ctx.stroke();
}

/** A vent grate: dark slats with a VENT label. */
function drawVent(ctx, vent) {
  ctx.fillStyle = COLOURS.vent;
  ctx.fillRect(vent.x, vent.y, vent.w, vent.h);
  ctx.strokeStyle = '#1c2338';
  ctx.lineWidth = 2;
  ctx.strokeRect(vent.x + 1, vent.y + 1, vent.w - 2, vent.h - 2);
  ctx.beginPath();
  for (let i = 1; i < 4; i += 1) {
    const sx = vent.x + (vent.w / 4) * i;
    ctx.moveTo(sx, vent.y + 3);
    ctx.lineTo(sx, vent.y + vent.h - 3);
  }
  ctx.stroke();
  text(ctx, 'VENT', vent.x + vent.w / 2, vent.y + vent.h / 2, {
    size: 8,
    colour: COLOURS.dim,
    align: 'center',
  });
}

/** Exit zone: green glow, a simple van glyph, and a GETAWAY VAN label. */
function drawExit(ctx, exit, time) {
  const pulse = 0.16 + 0.08 * Math.sin(time * 3);
  ctx.fillStyle = alpha('#3ddc84', pulse);
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.strokeStyle = alpha('#3ddc84', 0.7);
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x + 1, exit.y + 1, exit.w - 2, exit.h - 2);
  // Van: body + cab + wheels, drawn in the zone's centre.
  const cx = exit.x + exit.w / 2;
  const cy = exit.y + exit.h / 2;
  ctx.fillStyle = '#3ddc84';
  ctx.fillRect(cx - 34, cy - 10, 48, 20); // cargo
  ctx.fillRect(cx + 14, cy - 7, 18, 14); // cab
  ctx.fillStyle = COLOURS.wall;
  ctx.beginPath();
  ctx.arc(cx - 18, cy + 10, 5, 0, Math.PI * 2);
  ctx.arc(cx + 16, cy + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'GETAWAY VAN', cx, exit.y - 10, { size: 10, colour: '#3ddc84', align: 'center' });
}

/** Optional room name plates when the level carries a rooms list. */
function drawRooms(ctx, rooms) {
  if (!rooms) return;
  for (const room of rooms) {
    const label = room.label ?? room.name;
    const x = room.x ?? room.cx ?? 0;
    const y = room.y ?? room.cy ?? 0;
    text(ctx, label, x, y, {
      size: 26,
      colour: alpha(COLOURS.text, 0.12),
      align: 'center',
      weight: 'bold',
    });
  }
}

/* --------------------------------------------------------------------- cones */

/** Camera cone: hot colour while it currently sees the thief, faint grey when EMP'd. */
function drawCameraCone(ctx, cam, state) {
  const solids = state.solids;
  const sees =
    !cam.disabled &&
    inCone(
      state.thief.x,
      state.thief.y,
      cam.x,
      cam.y,
      cam.angle,
      CAMERA.viewHalfAngle,
      CAMERA.viewRange * (state.thief.sneaking ? 0.7 : 1),
      solids,
    );
  let fill;
  if (cam.disabled > 0) fill = alpha(COLOURS.dim, 0.05);
  else fill = sees ? COLOURS.coneCameraHot : COLOURS.coneCamera;
  const points = conePolygon(cam.x, cam.y, cam.angle, CAMERA.viewHalfAngle, CAMERA.viewRange, solids);
  fillPath(ctx, points, fill);
}

/** Camera body plus an LED that flips hot while it is seeing the thief. */
function drawCameraBody(ctx, cam, state, time) {
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.rotate(cam.angle);
  ctx.fillStyle = cam.disabled > 0 ? COLOURS.dim : '#9fb4d8';
  ctx.fillRect(-7, -4, 14, 8);
  ctx.fillStyle = COLOURS.accent;
  ctx.beginPath();
  ctx.arc(8, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // LED dot: red while disabled, green normally, hot blink while seeing.
  const sees =
    cam.disabled <= 0 &&
    inCone(
      state.thief.x,
      state.thief.y,
      cam.x,
      cam.y,
      cam.angle,
      CAMERA.viewHalfAngle,
      CAMERA.viewRange,
      state.solids,
    );
  const blink = sees && Math.sin(time * 14) > 0;
  ctx.fillStyle = cam.disabled > 0 ? COLOURS.dim : blink ? '#ff5a5a' : '#39d353';
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Guard cone, blending from calm warm to hot red as suspicion climbs. */
function drawGuardCone(ctx, guard, state) {
  const solids = state.solids;
  const points = conePolygon(
    guard.x,
    guard.y,
    guard.angle,
    GUARD.viewHalfAngle,
    GUARD.viewRange,
    solids,
  );
  const t = Math.min(1, guard.suspicion);
  fillPath(ctx, points, mixColour(COLOURS.coneGuard, COLOURS.coneGuardHot, t));
}

/* -------------------------------------------------------------------- loot */

/**
 * Loot sprites: untaken pieces glow (the major gem is a big cyan diamond with a
 * time-based sparkle); taken pieces fade to dim outlines.
 */
function drawLoot(ctx, loot, time) {
  const cx = loot.x + loot.w / 2;
  const cy = loot.y + loot.h / 2;
  const pulse = 0.65 + 0.35 * Math.sin(time * 3 + loot.x * 0.01);

  if (loot.taken) {
    ctx.strokeStyle = alpha(COLOURS.lootTaken, 0.8);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(loot.x, loot.y, loot.w, loot.h);
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  if (loot.major) {
    const r = Math.max(loot.w, loot.h) * 0.9;
    // Outer glow ring.
    ctx.strokeStyle = alpha('#5ef2ff', 0.5 * pulse);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25 + Math.sin(time * 2.4) * 3, 0, Math.PI * 2);
    ctx.stroke();
    // The diamond itself.
    ctx.fillStyle = '#5ef2ff';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.62);
    ctx.lineTo(r * 0.45, 0);
    ctx.lineTo(0, r * 0.62);
    ctx.lineTo(-r * 0.45, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alpha('#ffffff', 0.75);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.lineTo(r * 0.2, 0);
    ctx.lineTo(0, r * 0.3);
    ctx.lineTo(-r * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    // Time-based sparkle: two star glints orbiting the gem.
    for (let i = 0; i < 2; i += 1) {
      const a = time * 1.8 + i * Math.PI;
      const sx = Math.cos(a) * r * 0.95;
      const sy = Math.sin(a) * r * 0.7;
      const s = 3 + Math.sin(time * 6 + i * 2) * 1.2;
      ctx.fillStyle = alpha('#ffffff', 0.5 + 0.5 * Math.sin(time * 5 + i));
      ctx.beginPath();
      ctx.moveTo(sx, sy - s);
      ctx.lineTo(sx + s * 0.4, sy - s * 0.4);
      ctx.lineTo(sx + s, sy);
      ctx.lineTo(sx + s * 0.4, sy + s * 0.4);
      ctx.lineTo(sx, sy + s);
      ctx.lineTo(sx - s * 0.4, sy + s * 0.4);
      ctx.lineTo(sx - s, sy);
      ctx.lineTo(sx - s * 0.4, sy - s * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Standard treasure: gold glow plus a coin glyph.
    ctx.fillStyle = alpha(COLOURS.loot, 0.35 * pulse);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(loot.w, loot.h) * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLOURS.loot;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(loot.w, loot.h) * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5b1e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(loot.w, loot.h) * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------- noise */

/** Expanding ring where a coin just clattered (or an EMP/footstep landed). */
function drawNoiseRipple(ctx, noise, time) {
  if (!noise) return;
  const at = noise.t ?? noise.time ?? noise.until ?? time;
  const age = time - at;
  if (age < 0 || age > 1.4) return;
  const k = age / 1.4;
  ctx.strokeStyle = alpha('#ffd27a', 0.55 * (1 - k));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(noise.x, noise.y, 8 + k * 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = alpha('#ffd27a', 0.3 * (1 - k));
  ctx.beginPath();
  ctx.arc(noise.x, noise.y, 8 + k * 30, 0, Math.PI * 2);
  ctx.stroke();
}

/* ------------------------------------------------------------------- actors */

function drawGuard(ctx, guard, time) {
  const alerted = guard.suspicion >= 1 || guard.mode === 'chase' || guard.mode === 'alert';
  const body = alerted ? COLOURS.guardAlert : COLOURS.guard;

  // Uniform circle + facing tick.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a1c10';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cap brim in the facing direction.
  ctx.save();
  ctx.translate(guard.x, guard.y);
  ctx.rotate(guard.angle);
  ctx.fillStyle = alerted ? '#7a1f1f' : '#6b3a17';
  ctx.beginPath();
  ctx.arc(0, 0, GUARD.radius * 0.62, -0.7, 0.7);
  ctx.lineTo(GUARD.radius + 4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Suspicion pips: "!" once curious, "!!" once hunting.
  if (guard.suspicion > 0.45 || alerted) {
    const marks = alerted ? '!!' : '!';
    const bob = Math.sin(time * 10) * 1.5;
    text(ctx, marks, guard.x, guard.y - GUARD.radius - 10 + bob, {
      size: alerted ? 16 : 13,
      colour: alerted ? COLOURS.guardAlert : '#ffd27a',
      align: 'center',
      weight: 'bold',
    });
  }
}

function drawThief(ctx, thief, state) {
  const { x, y } = thief;

  // Sneak shadow while hidden behind cover.
  if (thief.hidden) {
    ctx.fillStyle = alpha('#000000', 0.35);
    ctx.beginPath();
    ctx.ellipse(x, y + thief.radius * 0.6, thief.radius * 1.1, thief.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Teal hooded circle with a hood peak toward the facing angle.
  ctx.fillStyle = COLOURS.thief;
  ctx.beginPath();
  ctx.arc(x, y, thief.radius ?? 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d5c4c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(thief.angle);
  ctx.fillStyle = '#1d5c4c';
  ctx.beginPath();
  ctx.moveTo(thief.radius, 0);
  ctx.lineTo(thief.radius * 0.35, -thief.radius * 0.55);
  ctx.lineTo(thief.radius * 0.35, thief.radius * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Sack on the back once the gem is bagged.
  if (state.gemTaken) {
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath();
    ctx.arc(x - Math.cos(thief.angle) * 8, y - Math.sin(thief.angle) * 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/* ---------------------------------------------------------------------- HUD */

const ALARM_BAR_W = 260;
const ALARM_BAR_H = 14;
const STAGE_WORDS = ['CALM', 'NOTICED', 'HUNTED'];
const STAGE_COLOURS = [COLOURS.text, COLOURS.accent, COLOURS.alarm];

/** Top bar: ALARM meter, stage word, banked money, coins and EMPs. */
function drawHud(ctx, state) {
  const pad = 14;
  const barY = pad + 6;

  // ALARM label + meter.
  text(ctx, 'ALARM', pad, barY + ALARM_BAR_H / 2, { size: 13, colour: COLOURS.dim, weight: 'bold' });
  const bx = pad + 56;
  const by = barY;
  ctx.fillStyle = alpha('#000000', 0.45);
  roundRect(ctx, bx, by, ALARM_BAR_W, ALARM_BAR_H, 4);
  ctx.fill();
  const level = Math.max(0, Math.min(100, state.alarm?.level ?? 0));
  const hot = level > 70;
  const fillW = Math.max(2, (level / 100) * ALARM_BAR_W);
  ctx.fillStyle = hot && Math.sin(state.time * 12) > -0.2 ? COLOURS.alarmHot : COLOURS.alarm;
  if (fillW > 0) {
    roundRect(ctx, bx, by, fillW, ALARM_BAR_H, 4);
    ctx.fill();
  }
  ctx.strokeStyle = alpha(COLOURS.text, 0.25);
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, ALARM_BAR_W, ALARM_BAR_H, 4);
  ctx.stroke();

  // Stage word.
  const stage = Math.max(0, Math.min(2, state.alarm?.stage ?? 0));
  text(ctx, STAGE_WORDS[stage], bx + ALARM_BAR_W + 14, by + ALARM_BAR_H / 2, {
    size: 14,
    colour: STAGE_COLOURS[stage],
    weight: 'bold',
  });

  // Banked money, coin count, EMP count — top right.
  const tx = WORLD.width - pad;
  text(ctx, formatMoney(state.banked), tx, by + ALARM_BAR_H / 2, {
    size: 16,
    colour: COLOURS.loot,
    align: 'right',
    weight: 'bold',
  });
  const thief = state.thief ?? {};
  text(ctx, `COINS ${thief.coins ?? 0}`, tx, by + ALARM_BAR_H + 14, {
    size: 12,
    colour: COLOURS.dim,
    align: 'right',
  });
  text(ctx, `EMPS ${thief.emps ?? 0}`, tx, by + ALARM_BAR_H + 30, {
    size: 12,
    colour: COLOURS.dim,
    align: 'right',
  });

  // Bottom objective line + controls hint.
  const objective = state.gemTaken ? 'Get to the van!' : 'Grab the Star Sapphire';
  text(ctx, objective, WORLD.width / 2, WORLD.height - 34, {
    size: 15,
    colour: state.gemTaken ? '#3ddc84' : COLOURS.text,
    align: 'center',
    weight: 'bold',
  });
  text(ctx, 'WASD move · SHIFT sneak · CLICK coin toss · F EMP · E vent · H help · P pause', WORLD.width / 2, WORLD.height - 14, {
    size: 10,
    colour: COLOURS.dim,
    align: 'center',
  });
}

/* ------------------------------------------------------------------ screens */

function panel(ctx, w, h) {
  const x = (WORLD.width - w) / 2;
  const y = (WORLD.height - h) / 2;
  ctx.fillStyle = alpha('#05070f', 0.82);
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = alpha(COLOURS.accent, 0.5);
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  return { x, y, w, h };
}

function drawTitle(ctx, time) {
  ctx.fillStyle = alpha('#05070f', 0.55);
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const p = panel(ctx, 560, 380);
  const cx = WORLD.width / 2;

  text(ctx, 'MIDNIGHT VAULT', cx, p.y + 62, {
    size: 44,
    colour: COLOURS.loot,
    align: 'center',
    weight: 'bold',
  });
  text(ctx, 'a top-down heist in the dark', cx, p.y + 96, {
    size: 13,
    colour: COLOURS.dim,
    align: 'center',
  });

  const lines = [
    'Sneak the Star Sapphire out of the vault.',
    'Guards see cones. Cameras see more.',
    'Toss coins to bait patrols. EMPs blind lenses.',
    'The vent pair skips the gallery entirely.',
    'Reach the van before the alarm maxes out.',
  ];
  lines.forEach((line, i) => {
    text(ctx, line, cx, p.y + 140 + i * 22, {
      size: 13,
      colour: COLOURS.text,
      align: 'center',
    });
  });

  text(ctx, 'WASD move · SHIFT sneak · CLICK coin toss · F EMP · E vent · H help · P pause', cx, p.y + 262, {
    size: 11,
    colour: COLOURS.dim,
    align: 'center',
  });

  const blink = Math.sin(time * 4) > -0.3;
  if (blink) {
    text(ctx, 'PRESS ENTER', cx, p.y + 322, {
      size: 18,
      colour: COLOURS.accent,
      align: 'center',
      weight: 'bold',
    });
  }
}

function drawCaught(ctx, time) {
  ctx.fillStyle = alpha(COLOURS.alarm, 0.28);
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const cx = WORLD.width / 2;
  const cy = WORLD.height / 2;
  text(ctx, 'BUSTED', cx, cy - 40, {
    size: 56,
    colour: COLOURS.alarmHot,
    align: 'center',
    weight: 'bold',
  });
  text(ctx, 'The vault guards had you cornered.', cx, cy + 8, {
    size: 14,
    colour: COLOURS.text,
    align: 'center',
  });
  if (Math.sin(time * 4) > -0.3) {
    text(ctx, 'PRESS R TO TRY AGAIN', cx, cy + 52, {
      size: 15,
      colour: COLOURS.accent,
      align: 'center',
      weight: 'bold',
    });
  }
}

function drawEscape(ctx, state, time) {
  ctx.fillStyle = alpha('#0d3d24', 0.4);
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const p = panel(ctx, 480, 340);
  const cx = WORLD.width / 2;
  text(ctx, 'CLEAN GETAWAY', cx, p.y + 56, {
    size: 34,
    colour: '#3ddc84',
    align: 'center',
    weight: 'bold',
  });

  const r = state.result ?? {};
  const rows = [
    ['Loot banked', formatMoney(r.loot ?? r.banked ?? state.banked ?? 0)],
    ['Time bonus', formatMoney(r.timeBonus ?? 0)],
    ['Unseen bonus', formatMoney(r.unseenBonus ?? 0)],
    ['TOTAL', formatMoney(r.total ?? 0)],
  ];
  rows.forEach(([label, value], i) => {
    const y = p.y + 118 + i * 34;
    const last = i === rows.length - 1;
    text(ctx, label, p.x + 60, y, {
      size: last ? 15 : 13,
      colour: last ? COLOURS.loot : COLOURS.text,
      weight: last ? 'bold' : 'normal',
    });
    text(ctx, value, p.x + p.w - 60, y, {
      size: last ? 15 : 13,
      colour: last ? COLOURS.loot : COLOURS.text,
      align: 'right',
      weight: last ? 'bold' : 'normal',
    });
  });

  if (Math.sin(time * 4) > -0.3) {
    text(ctx, 'PRESS R TO RUN IT AGAIN', cx, p.y + p.h - 44, {
      size: 14,
      colour: COLOURS.accent,
      align: 'center',
      weight: 'bold',
    });
  }
}

function drawHelp(ctx) {
  const p = panel(ctx, 520, 330);
  const cx = WORLD.width / 2;
  text(ctx, 'HOW TO PLAY', cx, p.y + 44, {
    size: 20,
    colour: COLOURS.accent,
    align: 'center',
    weight: 'bold',
  });
  const rows = [
    ['WASD / ARROWS', 'move'],
    ['SHIFT', 'sneak (slower, smaller cones, cover shadow)'],
    ['CLICK / Q', 'toss a coin — noise pulls guards'],
    ['F', 'EMP — blinds every camera for a while'],
    ['E / V', 'use a vent grate pair'],
    ['H', 'toggle this help · P pause · R restart'],
    ['', ''],
    ['Goal', 'grab the Star Sapphire, reach the van'],
    ['Lose', 'alarm maxes out, or a guard catches you'],
  ];
  rows.forEach(([key, desc], i) => {
    const y = p.y + 86 + i * 26;
    if (key) {
      text(ctx, key, p.x + 50, y, { size: 13, colour: COLOURS.loot, weight: 'bold' });
    }
    text(ctx, desc, p.x + 130, y, { size: 13, colour: COLOURS.text });
  });
  text(ctx, 'PRESS H TO CLOSE', cx, p.y + p.h - 34, {
    size: 11,
    colour: COLOURS.dim,
    align: 'center',
  });
}

function drawPaused(ctx) {
  ctx.fillStyle = alpha('#05070f', 0.55);
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  text(ctx, 'PAUSED', WORLD.width / 2, WORLD.height / 2, {
    size: 40,
    colour: COLOURS.text,
    align: 'center',
    weight: 'bold',
  });
  text(ctx, 'press P to resume', WORLD.width / 2, WORLD.height / 2 + 40, {
    size: 13,
    colour: COLOURS.dim,
    align: 'center',
  });
}

/* ------------------------------------------------------------------- frame */

/** Draw the world underneath everything else: floor, furniture, exit, vents. */
function drawWorld(ctx, state) {
  const { level } = state;
  drawFloor(ctx);
  drawRooms(ctx, level.rooms);
  for (const cover of level.covers) drawCover(ctx, cover);
  drawExit(ctx, level.exit, state.time);
  drawVent(ctx, level.ventA);
  drawVent(ctx, level.ventB);
  drawWalls(ctx, level.walls);
}

/** Vision cones sit over the floor but under every actor and sprite. */
function drawCones(ctx, state) {
  for (const cam of state.cameras) drawCameraCone(ctx, cam, state);
  for (const guard of state.guards) drawGuardCone(ctx, guard, state);
}

function drawLoots(ctx, state) {
  for (const loot of state.loots ?? state.level.loots) drawLoot(ctx, loot, state.time);
}

function drawActors(ctx, state) {
  for (const guard of state.guards) drawGuard(ctx, guard, state.time);
  drawThief(ctx, state.thief, state);
}

/**
 * Paint one full frame for `state`. Dispatches on state.screen; the play screen
 * also layers the HUD, help overlay and pause veil on top of the live world.
 */
export function drawFrame(ctx, state) {
  ctx.save();
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  switch (state.screen) {
    case SCREEN_TITLE:
      drawWorld(ctx, state);
      drawTitle(ctx, state.time);
      break;
    case SCREEN_CAUGHT:
      drawWorld(ctx, state);
      drawCaught(ctx, state.time);
      break;
    case SCREEN_ESCAPE:
      drawWorld(ctx, state);
      drawEscape(ctx, state, state.time);
      break;
    case SCREEN_PLAY:
    default:
      drawWorld(ctx, state);
      drawCones(ctx, state);
      drawLoots(ctx, state);
      drawNoiseRipple(ctx, state.noise, state.time);
      drawActors(ctx, state);
      for (const cam of state.cameras) drawCameraBody(ctx, cam, state, state.time);
      drawHud(ctx, state);
      if (state.showHelp) drawHelp(ctx);
      if (state.paused) drawPaused(ctx);
      break;
  }

  ctx.restore();
}
