// The vault floor plan, handcrafted and fixed (no seed). 1280x720 museum at night:
//
//   +--------------------------------------------------------------+
//   |  GALLERY (display cases, pillars, cameras)   |  VAULT (gem)   |
//   |                                              |                |
//   |   doors: gallery->lobby, gallery->service,    +----------------+
//   |   gallery->office, vault->office              |  OFFICE        |
//   +------------------+                           +----------------+
//   |  LOBBY (start,   |   SERVICE WING  |  OFFICE continues down  |
//   |  exit van door)  |                  |                         |
//   +------------------+------------------+-------------------------+
//
// Two ways into the vault: the gallery doors (guarded, cameras) and the vent pair —
// ventA in the lobby and ventB inside the vault room are a linked sneaking route.

export function buildLevel() {
  // Solid partitions, 24px thick. Outer walls included; the bottom wall is split
  // around the van door at x=150..230.
  const walls = [
    { x: 0, y: 0, w: 1280, h: 24 },
    { x: 0, y: 696, w: 150, h: 24 },
    { x: 230, y: 696, w: 1050, h: 24 },
    { x: 0, y: 0, w: 24, h: 720 },
    { x: 1256, y: 0, w: 24, h: 720 },
    // Gallery / bottom-band divider (y=480..504) with doors to lobby (140..200)
    // and to the service wing (600..660).
    { x: 24, y: 480, w: 116, h: 24 },
    { x: 200, y: 480, w: 400, h: 24 },
    { x: 660, y: 480, w: 240, h: 24 },
    // Lobby / service-wing divider.
    { x: 360, y: 480, w: 24, h: 216 },
    // East wing west wall: gaps at y=120..180 (gallery->vault), y=380..440
    // (gallery->office), y=560..620 (service->office).
    { x: 900, y: 24, w: 24, h: 96 },
    { x: 900, y: 180, w: 24, h: 200 },
    { x: 900, y: 440, w: 24, h: 120 },
    { x: 900, y: 620, w: 24, h: 76 },
    // Vault / office divider (y=300..324) with a door at x=1050..1110.
    { x: 900, y: 300, w: 150, h: 24 },
    { x: 1110, y: 300, w: 146, h: 24 },
  ];

  // Display cases, pillars and desks: solid and block vision.
  const covers = [
    { x: 250, y: 150, w: 70, h: 46, kind: 'case' },
    { x: 460, y: 240, w: 70, h: 46, kind: 'case' },
    { x: 700, y: 170, w: 34, h: 34, kind: 'pillar' },
    { x: 180, y: 380, w: 90, h: 40, kind: 'desk' },
    { x: 1000, y: 400, w: 90, h: 44, kind: 'desk' },
    { x: 1140, y: 540, w: 56, h: 40, kind: 'case' },
    { x: 1000, y: 580, w: 34, h: 34, kind: 'pillar' },
    { x: 600, y: 580, w: 70, h: 44, kind: 'desk' },
  ];

  const loots = [
    { id: 'gem', x: 1140, y: 140, w: 44, h: 44, value: 5000, name: 'Star Sapphire', major: true },
    { id: 'painting1', x: 170, y: 180, w: 36, h: 48, value: 700, name: 'Moonlit Vista', major: false },
    { id: 'painting2', x: 760, y: 350, w: 36, h: 48, value: 950, name: 'Old Master', major: false },
    { id: 'cash', x: 1180, y: 620, w: 32, h: 32, value: 450, name: 'Payroll Cash', major: false },
    { id: 'gold', x: 800, y: 590, w: 36, h: 28, value: 1100, name: 'Gold Bars', major: false },
    { id: 'chalice', x: 1000, y: 500, w: 32, h: 36, value: 800, name: 'Silver Chalice', major: false },
    { id: 'tiara', x: 730, y: 300, w: 32, h: 32, value: 1200, name: 'Diamond Tiara', major: false },
  ];

  // Closed patrol loops; every waypoint sits on open floor, clear of walls and covers.
  const guardRoutes = [
    // Gallery loop around the display cases.
    [
      { x: 160, y: 110 }, { x: 600, y: 110 }, { x: 760, y: 140 },
      { x: 760, y: 320 }, { x: 600, y: 320 }, { x: 160, y: 320 },
    ],
    // Office loop.
    [
      { x: 980, y: 360 }, { x: 1240, y: 360 }, { x: 1240, y: 640 }, { x: 980, y: 640 },
    ],
    // Lobby loop, watching the entrance and van door.
    [
      { x: 70, y: 560 }, { x: 320, y: 560 }, { x: 320, y: 620 }, { x: 70, y: 620 },
    ],
    // Service-wing loop between the lobby and the office door.
    [
      { x: 420, y: 540 }, { x: 860, y: 540 }, { x: 860, y: 640 }, { x: 420, y: 640 },
    ],
  ];

  // Wall-mounted cameras sweeping key areas: the gallery floor, the vault room,
  // and the office.
  const cameras = [
    { x: 640, y: 48, baseAngle: 1.35 },
    { x: 1050, y: 48, baseAngle: 0.9 },
    { x: 1240, y: 500, baseAngle: -1.4 },
  ];

  return {
    walls,
    covers,
    loots,
    guardRoutes,
    cameras,
    // Linked vent pair: lobby grate -> vault room grate.
    ventA: { x: 56, y: 656, w: 52, h: 22 },
    ventB: { x: 1196, y: 268, w: 48, h: 20 },
    exit: { x: 120, y: 648, w: 140, h: 36 },
    start: { x: 116, y: 664 },
  };
}
