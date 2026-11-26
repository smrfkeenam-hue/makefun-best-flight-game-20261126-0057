# Skyline Courier — Best Flight Game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/smrfkeenam-hue/makefun-best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/smrfkeenam-hue/makefun-best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A golden-hour flight game, built for the [Best Flight Game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a little red-and-cream prop plane through a valley at sunset: thread the rings, deliver the mail, and grease one perfect landing.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. No network, no build step, no libraries — plain canvas 2D.

- **1 · Ring Run** — thread all 10 rings, then land on the runway.
- **2 · Courier Dash** — drop low over three town beacons before the fuel runs out.
- **3 · Sunset Landing** — take off, come back around, and land on the centreline.

## Controls

| Key | Action |
| --- | --- |
| ↑ / W, ↓ / S | Pitch up / down |
| ← → / A D | Bank left / right |
| Shift | Throttle up |
| Ctrl | Throttle down |
| Mouse drag | Steer toward the cursor |
| P | Pause · M mute · R restart · Enter fly |

Watch the HUD: airspeed and throttle left, altitude and vertical speed right, a heading tape along the bottom, fuel at lower left. Below 26 knots she stalls — nose down, throttle up. Landings need to be slow, soft and on the pavement.

## How it is built

- `game/src/config.js` — every tuning number in one place.
- `game/src/world.js` — the seeded valley: fields, trees, hills, clouds, rings, towns.
- `game/src/physics.js` — the arcade flight model: lift, stall, ground effect, landings.
- `game/src/input.js` — keyboard and mouse, nothing else.
- `game/src/audio.js` — synthesized engine hum and beeps (WebAudio, no files).
- `game/src/render.js` — sky, terrain, plane and the chase camera.
- `game/src/hud.js` — instruments, menu and results screens.
- `game/src/main.js` — the loop, missions and scoring.

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier` from `vendor/makefun-game.ts`.
