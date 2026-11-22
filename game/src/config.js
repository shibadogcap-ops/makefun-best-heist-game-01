// Every tuning number and colour in one place for MIDNIGHT VAULT, a top-down stealth heist.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const WORLD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 92,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  chaseSpeed: 118,
  viewRange: 215,
  viewHalfAngle: 0.62,
  turnRate: 2.6,
};

export const CAMERA = {
  viewRange: 190,
  viewHalfAngle: 0.5,
  sweepSpeed: 0.55,
  sweepArc: 1.05,
};

/** The alarm meter fills as guards and cameras spot the thief; at max, the heist is blown. */
export const ALARM = {
  max: 100,
  guardFill: 26,
  cameraFill: 15,
  decay: 7,
  gemRaise: 22,
};

export const TOOLS = {
  coins: 3,
  emps: 2,
  empSeconds: 10,
};

/** Moody midnight-blue museum/vault interior, gold loot, warm guard cones. */
export const COLOURS = {
  floor: '#161d33',
  floorAlt: '#1b2340',
  wall: '#0b0f1e',
  wallTop: '#26304f',
  cover: '#2b3554',
  vent: '#070a14',
  loot: '#f2c94c',
  lootTaken: '#454e66',
  thief: '#8ef0d2',
  guard: '#ff8a3d',
  guardAlert: '#ff4d4d',
  coneGuard: 'rgba(255, 150, 60, 0.15)',
  coneGuardHot: 'rgba(255, 90, 60, 0.30)',
  coneCamera: 'rgba(120, 200, 255, 0.13)',
  coneCameraHot: 'rgba(255, 90, 90, 0.26)',
  alarm: '#ff3b30',
  alarmHot: '#ff7a5c',
  text: '#e8ecf4',
  dim: '#8b93a8',
  accent: '#7aa2ff',
};
