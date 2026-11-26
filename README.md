# Coral Coast Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/fatarichi/best-flight-game-20261126-0057/rank.svg)](https://make.fun/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/fatarichi/best-flight-game-20261126-0057/reward.svg)](https://make.fun/best-flight-game-20261126-0057)

A chase-view flight game over an island archipelago, built for the
[make.fun best flight game bounty](https://make.fun/best-flight-game-20261126-0057).

## How to play

Open `game/index.html` in a desktop browser, or serve it locally:

```sh
node serve.ts
# game/ is on http://localhost:8080
```

- **W / S** — pitch up and down
- **A / D** — bank and turn
- **R / F** — throttle up and down
- **SPACE** — airbrake
- **G** — landing gear
- **Mouse** — steer toward the cursor (hold the button)
- **M** — sound on/off, **P** — pause

Fly every ring on the course, mind the fuel — each ring gives some
back — then land on the runway. A gentle, centred, well-aligned
touchdown pays best; a hard one costs you airframe.

## The game

Three courses over the same archipelago, each with its own sky, ring
route and landing direction:

- **Emerald Coast** (day) — 8 rings around the home island, land runway 07
- **Amber Strait** (sunset) — 8 tight rings along the strait, land runway 25
- **Mist Peaks** (dawn) — 8 high rings through the mountain valley, land runway 07

The HUD shows altitude, speed and heading, a compass tape, an
attitude ball, throttle / fuel / damage gauges, the next ring's
distance, and a minimap. Sound is procedural WebAudio — an engine hum
that follows the throttle, wind that rises with speed, a chime for
each ring, a thud for the touchdown. No audio files, no network
requests: everything the game loads lives under `game/`.

## Layout

- `game/index.html` — the shell
- `game/src/main.js` — the loop and the state machine
- `game/src/config.js` — tuning and the three courses
- `game/src/world.js` — the archipelago, the runway and its approaches
- `game/src/plane.js` — the flight model: throttle, pitch, roll, fuel, damage
- `game/src/render.js` — the pseudo-3D chase view: sky, sea, terrain, runway, rings
- `game/src/aircraft.js` — the jet, drawn in screen space
- `game/src/hud.js` — instruments, menu and debrief
- `game/src/audio.js` — procedural sound
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — screenshot staging (`?shot=cover|rings|landing|menu`)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` and writes `dossier.json`
- `serve.ts` — a tiny static server for local play
- `shots.json` — the four screenshots and the query that stages each one

## Screenshots

Staged with `?shot=` and taken from the game's own code running in a
browser — real renders, never edited:

1. `1-cover.jpg` — mid-flight on Emerald Coast, ring 3 ahead, the home island and runway beyond
2. `2-rings.jpg` — threading a ring
3. `3-landing.jpg` — short final, gear down
4. `4-menu.jpg` — the course menu

## License

MIT — see [LICENSE](LICENSE).
