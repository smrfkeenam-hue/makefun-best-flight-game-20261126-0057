# AGENT.md — Skyline Courier

An original golden-hour flight game for the Best Flight Game bounty
(best-flight-game-20261126-0057). Built from scratch in this session: no
borrowed planes, places, music or code. The only file not written here is
`vendor/makefun-game.ts`, the kit's own dossier library, copied unchanged.

## What it is

A chase-view prop-plane game in plain canvas 2D. The player flies a valley
at sunset with three missions (Ring Run, Courier Dash, Sunset Landing),
an arcade flight model (throttle, pitch, bank, stall, ground effect, fuel),
and a full HUD: airspeed, altitude, vertical speed, heading tape, throttle
and fuel. Landings are judged on centreline offset and softness.

## Run it

Serve `game/` statically and open `game/index.html` in desktop Chrome:

```
cd game && python3 -m http.server 8080
```

No network requests, no build step, no dependencies. Screenshots live in
`screenshots/` (cover first by name): menu, takeoff, ring run and final
approach, each a real render of the game's own code via `?scene=`.

## Hand in

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
`MAKEFUN_OUTPUT_DIR` (default `/output`) and writes `dossier.json` with
`buildDossier` from `vendor/makefun-game.ts`. It is deterministic: two runs
write the same bytes.

## Controls

Arrows/WASD pitch and bank, Shift/Ctrl throttle, mouse drag to steer,
P pause, M mute, R restart, Enter to fly.
