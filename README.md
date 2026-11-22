# MIDNIGHT VAULT — a top-down stealth heist

The Star Sapphire is on its pedestal in the vault wing of the Midnight Museum, and the night watch is thin — thin enough. Slip past patrol guards and sweeping security cameras, pocket the gems and side loot, and reach the getaway van before the alarm does. Every guard has a vision cone, every camera sweeps its beam, and the second you're seen the alarm meter starts to fill — at max, the heist is blown.

## How to play

- **Move:** WASD or arrow keys. **Shift** toggles sneaking — slower, but it shrinks the range at which guards and cameras can spot you.
- **Coin toss:** Q or click — clatter a coin to pull a guard's attention toward a noise.
- **EMP:** F — blind every camera for ten seconds.
- **Vent:** E or V — hop between the linked grates (one in the lobby, one inside the vault) for a sneaky route in or out.
- **Pause:** P · **Help:** H · **Restart:** R

The HUD shows the **alarm meter** (it cools off when nothing is watching you, but grabbing the Star Sapphire kicks it up hard), your **banked score**, remaining **coins and EMPs**, and the current objective. Three alert stages run CALM → NOTICED → HUNTED. Guards chase what they see and feed the meter while they hold sight; cameras do the same. Get cornered at point-blank and it's BUSTED; reach the van with the sapphire and it's a clean getaway — faster times and an untripped alarm pay bonuses.

## How it is built

Vanilla JavaScript ES modules on Canvas 2D — no build step, no dependencies. `node serve.ts` serves `game/` on port 8080.

- `game/src/main.js` — boot, the fixed-step loop (input → thief → guards → cameras → alarm), screens and scoring.
- `game/src/config.js` — every tuning number and colour: world size, speeds, vision ranges, alarm rates.
- `game/src/level.js` — the handcrafted museum floor plan: walls, display cases, loot, guard patrol routes, cameras, vents, exit.
- `game/src/thief.js` — movement with wall sliding, sneaking, loot grabs, coin tosses, EMPs, vent hops.
- `game/src/guards.js` — patrol AI: vision-driven suspicion, chase, noise investigation.
- `game/src/cameras.js` — sweeping camera beams and EMP shutdowns.
- `game/src/vision.js` — cone geometry: line-of-sight through walls, cone polygons.
- `game/src/alarm.js` — the alarm meter: exposure fill, decay, alert stages.
- `game/src/render.js` — all drawing: floor, cones, actors, HUD, title/caught/escape screens.
- `game/src/input.js` — keyboard and pointer state.
- `game/src/audio.js` — tiny WebAudio bleeps for loot, tosses, EMPs and alerts.
- `game/src/random.js` — seeded RNG for reproducible runs.
- `game/src/shots.js` — deterministic `?shot=` screenshot scenes built by replaying real game steps.
- `serve.ts` — a ~60-line static file server (Node standard library only).

![make.fun bounty](https://make.fun/badge/best-heist-game-20261122-0559.svg)
![rank](https://make.fun/badge/best-heist-game-20261122-0559/shibadogcap-ops/makefun-best-heist-game-01/rank.svg)
![reward](https://make.fun/badge/best-heist-game-20261122-0559/shibadogcap-ops/makefun-best-heist-game-01/reward.svg)

Play the bounty at https://make.fun/bounty/best-heist-game-20261122-0559
