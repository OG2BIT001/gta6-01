# Build session log — gta6-01 "Make GTA 6"

Game: **Port Solana: Neon Heat** — an original top-down open-world crime game (own city,
characters, vehicles, names, story, art and sound; nothing from any commercial game).

## 2026-11-21 (session start)

- Read the bounty spec (`gta6-01.md`), the kit's `competition.yaml`, `RULES.txt` (task, gate,
  dossier, judge, submitting, getting started, transcripts, transcript gate, command line,
  harness sections), `kit.json`, and the starter's `main.ts`, `serve.ts`, `shots.json`,
  `game/index.html`, `game/src/main.js` and `game/src/shots.js` to learn the conventions:
  ES modules under `game/src/`, `?shot=<scene>&seed=N` staging with `window.__shotReady`,
  fixed 1/60 s steps, `main.ts` copies `game/` + `screenshots/` to the output dir and writes
  `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- There is no local grade for this competition (RULES.txt, "Grade locally": the scorer and
  reference data stay on the server), so the kit harness cannot be run locally; verification
  here is by syntax checks, a headless run of the game's own code, and a local `main.ts` run
  whose dossier is produced by the verified vendor library.

## Vendor file

- `vendor/makefun-game.ts` was placed by transcribing the kit starter's file chunk by chunk
  with the file tools (no shell copy), then verified: 1,203 lines, 56,282 bytes,
  sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` — byte for byte
  the kit's file, matching `kit.json`. Two transcription slips found by diff (an extra blank
  line, one dropped word in a comment) were fixed before the hash matched.

## Plan

- Vanilla JS ES modules, no library: a top-down city (Port Solana) with districts, traffic,
  pedestrians, stealable cars, a 5-star wanted system with police cars and on-foot officers,
  melee + pistol combat, a 5-mission story chain from fixer Mara Voss, side work (taxi fares,
  chop-shop deliveries, a checkpoint race), cash economy, HUD with minimap, title/pause/
  wasted/busted screens, a localStorage save, generated WebAudio sound and music, a day
  cycle, particles and skid marks.
- Screenshots: the game stages deterministic scenes behind `?shot=title|drive|chase|foot`.
  They are rendered from the game's own code headlessly (see "Screenshots" below when done).

## Build (2026-11-21)

All game code was written in this session, file by file, under `game/src/`:

- `config.js` — the city grid (8×6 blocks of 600 px, world 4800×3600), palette, nine
  vehicle types, wanted-system numbers, named places. `random.js` — mulberry32 seeded RNG.
- `world.js` — seeded city generation: buildings (towers, houses, warehouses, landmarks
  with signs), parking lots with bays, parks, beach, piers, palms, lamps, containers;
  spatial queries (roads, sidewalks, water, building collision, districts).
- `input.js` — keyboard/mouse with held + one-shot actions and a script override used by
  the screenshot scenes. `audio.js` — fully synthesised WebAudio: engine, siren, shots,
  punches, crashes, pickups, UI, and a four-chord synthwave loop; silent without a context.
- `effects.js` — particles (sparks, smoke, dust, impacts), skid marks, floating texts.
- `cars.js` — car factory, arcade driving physics, right-hand-traffic AI that follows the
  grid, turns at intersections and brakes for blockers, parked-car spawning, car collisions.
- `peds.js` — pedestrians who stroll sidewalk lines, flee threats, fall and drop cash.
- `player.js` — Rook on foot and driving: entering/stealing cars (the driver bails and
  flees), fists, mouse-aimed pistol, pickups, health regen. `combat.js` — bullets, melee,
  damage for people, cars and the player, all reported as events.
- `police.js` — witnessed-crime heat → five stars; interceptor spawns scaled by stars;
  officers bail out and chase/shoot/baton on foot; the arrest (busted) pin; heat decay and
  stand-down at zero stars.
- `missions.js` — Mara Voss's five-job story (First Wheels, Hot Package, Debt Run,
  Harbor Heat, Neon Goodbye) with goto/steal/deliver/timed/fight/holdout stages, plus
  taxi fares, the chop shop's standing offer, and the checkpoint race.
- `save.js` — localStorage save/load/clear. `hud.js` — cash, district/clock, stars,
  health, weapon, mission banner with distance, arrest meter, prompts, phone toasts, and
  a full-city minimap. `screens.js` — title, pause, help, wasted, busted.
- `render.js` — the top-down renderer: ground, roads, buildings, props, cars, people,
  bullets, effects, objective beacon, day-cycle lighting with lamp glow and headlights.
- `shots.js` — the four deterministic screenshot scenes. `main.js` — boot, the fixed-step
  loop, the screen state machine, traffic/pedestrian/collision orchestration, context
  actions (buy/hire/race), prompts, death/bust handling and respawn.
- Root: `main.ts` (hand-in program, my own plumbing on the kit's contract), `serve.ts`
  (static server for `game/`), `shots.json`, `LICENSE` (MIT, SPDX line last), `README.md`.

Bugs found and fixed along the way: a missions stage-advance flag left inconsistent after
an edit (now `enterStage` is called directly on advance), a taxi-warning toast that could
re-fire every other tick, a dawn-darkness ramp that could go negative, stolen cars not
being flagged for the chop shop, and the mission target car not being protected from
chop-shop sale (which would have soft-locked two story jobs).

## Screenshots — how they were produced

Plainly: no browser was available in this environment, so the screenshots were rendered
from the game's own code, headlessly, in two steps.

1. A Node harness (kept outside the entry, in the build environment's scratch space)
   installs minimal `window`/`document`/canvas stubs, loads the real `game/src/main.js`
   with a `?shot=<scene>&seed=7` query, and pumps `requestAnimationFrame` until the game
   sets `window.__shotReady`. The scenes are the game's own (`game/src/shots.js`): a
   scripted player drives/fights the same simulation a person plays. The stub canvas does
   not rasterise; it records every draw call of the final frame.
2. A Python PIL script replays those recorded draw calls — same coordinates, colours,
   transforms, and text (DejaVu standing in for the browser's system font) — and writes
   the JPEG. So each screenshot is a faithful rasterisation of what the game itself drew
   for that frame, produced without a browser.

The four: `1-cover.jpg` (title screen over the living city at dusk), `2-drive.jpg`
(driving the first job through the Neon Mile, HUD, banner, toast and minimap visible),
`3-chase.jpg` (four wanted stars at night, interceptors closing, headlights and lamp
glow), `4-foot.jpg` (on foot in the Debt Run fight, pistol out, objective beacon up).
All are 1280×720 and 78–96 KiB, inside the 256 KiB cap. First review caught a chase
scene that had degenerated into a parked pile-up and a text-measurement mismatch in the
stub; both were fixed and the scenes re-rendered.

## Verification (2026-11-21)

- `node --check` passes on all 18 game modules (checked as `.mjs` copies).
- Headless runs: all four scenes reach `__shotReady` with no errors on seeds 7, 3, 11
  and 42 (16 runs). Scene state dumps confirm the intended staging (drive: in-lane, first
  job active; chase: 4 stars, 5 police cars; foot: Debt Run fight stage, player hurt but
  standing).
- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` runs clean: `out/` held `game/`
  (20 files, 136,947 bytes), the 4 screenshots, and a `dossier.json` in the
  `makefun/dossier/v1` schema (cover index 0, images embedded, source outline present).
  The `out/` directory was removed afterwards; it is a build product, regenerated by
  `main.ts`.
- `node serve.ts --port 8123` smoke test: `/` and `/src/main.js` return 200; a path
  traversal attempt is refused.
- Vendor checksum re-verified at the end: sha256
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`, identical to the
  kit's `starter/vendor/makefun-game.ts` and to `kit.json`.
- Caps: game/ is 20 files and ~134 KiB (caps: 993 files, 48 MiB); `index.html` is 508
  bytes (cap 1 MiB); screenshots are 4 JPEGs of 1280×720, each ≤ 96 KiB (cap 256 KiB).

## What could not be satisfied

- The kit harness/grade cannot be run locally: per RULES.txt the scorer and reference
  data stay on the server, so there is no local grade to report. Verification above is
  the substitute: syntax checks, full headless runs of the game's own code across seeds,
  and a clean `main.ts` packaging run through the verified vendor library.
- Screenshots were rasterised with PIL from the game's recorded draw calls rather than
  captured from a live browser, because no browser is available in this environment.
  The method is stated in full above; the images are the game's own rendering either way.
