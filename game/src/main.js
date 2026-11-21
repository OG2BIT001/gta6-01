// Port Solana: Neon Heat — the boot and the loop. A fixed-step simulation (1/60 s)
// drives the city; the renderer draws whatever state the game is in: title, play,
// pause, help, wasted, busted. Screenshot scenes (?shot=…) reuse the same loop with
// scripted inputs and a fixed tick budget, then flag window.__shotReady.
import { POPULATION, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_BUY, ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { carRadius, collideCars, spawnParked, spawnTraffic, updateTrafficCar } from './cars.js';
import { spawnPeds, updatePed } from './peds.js';
import { createPlayer, nearestCar, updatePlayer } from './player.js';
import { createPolice, updatePolice } from './police.js';
import {
  createMissions,
  missionStartTarget,
  startRace,
  startStoryMission,
  startTaxi,
  updateMissions,
  updateSideJobs,
} from './missions.js';
import { damageCar, damagePed, damagePlayer, updateBullets } from './combat.js';
import { clearSave, loadSave, saveGame } from './save.js';
import { drawWorld } from './render.js';
import { drawHUD } from './hud.js';
import { drawBusted, drawHelp, drawPaused, drawTitle, drawWasted } from './screens.js';
import { SHOT_TICKS, setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();

/** Build a whole fresh city and everyone in it. */
function createGame(seed) {
  const rng = createRandom(seed);
  const world = createWorld(rng);
  const game = {
    rng,
    world,
    input,
    audio,
    time: 0,
    timeOfDay: 9.6,
    state: 'title',
    camera: { x: 0, y: 0 },
    cars: [],
    peds: [],
    bullets: [],
    pickups: [],
    events: [],
    toasts: [],
    effects: createEffects(),
    player: createPlayer(world.places.start.x, world.places.start.y),
    police: createPolice(),
    missions: createMissions(),
    promptText: '',
    saveDirty: false,
    lastViolence: -99,
    menuIndex: 0,
    pauseIndex: 0,
    titleItems: ['New Game', 'How to Play'],
    pauseItems: ['Resume', 'Save Game', 'How to Play', 'Quit to Title'],
    returnTo: 'title',
    overKind: null,
    shotName: null,
    shotTicks: 0,
    /** A phone toast: Mara, the city, or the game itself talking to Rook. */
    notify(title, body) {
      this.toasts.push({ title, body, age: 0, life: 5.5 });
      if (this.toasts.length > 3) this.toasts.shift();
    },
    /** The combat entry point other systems use to hurt the player. */
    damagePlayer(amount) {
      return damagePlayer(this, amount);
    },
  };
  game.cars.push(...spawnTraffic(rng, world, POPULATION.traffic));
  game.cars.push(...spawnParked(rng, world, POPULATION.parked));
  game.peds.push(...spawnPeds(rng, world, POPULATION.peds));
  return game;
}

/** Start playing: a fresh run, or a saved one applied over a fresh city. */
function newRun(data) {
  game = createGame((Math.random() * 1e9) | 0);
  window.__game = game;
  input.setScript(null);
  if (data) {
    game.player.cash = data.cash;
    game.player.hasPistol = !!data.hasPistol;
    game.player.ammo = data.ammo | 0;
    game.player.x = data.x;
    game.player.y = data.y;
    game.missions.storyIndex = Math.min(5, data.storyIndex | 0);
    game.missions.storyComplete = !!data.storyComplete;
    game.missions.taxiDone = data.taxiDone | 0;
    game.missions.chopDone = data.chopDone | 0;
    game.missions.raceBest = data.raceBest || 0;
    game.notify('Welcome back', 'Port Solana kept your parking spot.');
  } else {
    game.notify('Mara Voss', 'Rook. Work, if you want it — follow the gold marker to my garage.');
  }
  game.state = 'play';
  audio.music(true);
}

/** The law and the hospital both send Rook back to the same curb, lighter. */
function respawn() {
  const player = game.player;
  if (game.overKind === 'wasted') {
    player.cash = Math.max(0, player.cash - 100);
    game.notify('Solana General', 'Patched up. $100. Whatever happened out there — walk it off.');
  } else {
    player.cash = Math.max(0, player.cash - 150);
    player.hasPistol = false;
    player.ammo = 0;
    game.notify('PSPD', 'Fine paid: $150. The pistol stays with the city. Drive safe, Rook.');
  }
  if (player.car) player.car.driver = 'none';
  player.driving = false;
  player.car = null;
  player.health = 100;
  player.dead = false;
  player.busted = false;
  player.x = game.world.places.start.x;
  player.y = game.world.places.start.y;
  game.police.heat = 0;
  game.police.bustTimer = 0;
  game.cars = game.cars.filter((c) => c.driver !== 'cop');
  game.peds = game.peds.filter((p) => !p.cop);
  game.state = 'play';
  saveGame(game);
}

// ---------------------------------------------------------------- the loop

let game = createGame(20261124);
window.__game = game;

/** Advance the world behind the menus: traffic rolls, crowds stroll. */
function stepAmbient(dt) {
  game.time += dt;
  game.timeOfDay = (game.timeOfDay + dt / 150) % 24;
  stepTraffic(dt);
  for (const ped of game.peds) updatePed(game.rng, ped, dt, game.world, null);
  game.effects.update(dt);
}

/** Traffic and the collisions that come with it. Shared by play and ambient modes. */
function stepTraffic(dt) {
  const blockers = [];
  for (const car of game.cars) blockers.push({ x: car.x, y: car.y });
  for (const ped of game.peds) if (ped.state !== 'down') blockers.push({ x: ped.x, y: ped.y });
  blockers.push({ x: game.player.x, y: game.player.y });
  for (const car of game.cars) {
    if (car.driver === 'traffic' && !car.dead) updateTrafficCar(game.rng, car, dt, game.world, blockers, game.effects);
  }
  // Bumpers meet: every pair, once, with consequences scaled by the closing speed.
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy > 130 * 130) continue;
      const impact = collideCars(a, b);
      if (impact < 60) continue;
      const byPlayer = game.player.driving && (a === game.player.car || b === game.player.car);
      if (impact > 130) {
        damageCar(game, a, impact / 16, byPlayer && b === game.player.car);
        damageCar(game, b, impact / 16, byPlayer && a === game.player.car);
        game.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
        if (byPlayer) audio.crash(Math.min(1, impact / 300));
      }
      if (byPlayer) {
        const other = a === game.player.car ? b : a;
        if (other.driver !== 'cop') game.events.push({ kind: 'hitCar', x: other.x, y: other.y, byPlayer: true });
      }
    }
  }
  // Wheels meet people, whoever is driving.
  for (const car of game.cars) {
    const speed = Math.hypot(car.vx, car.vy);
    if (speed < 115 || car.dead) continue;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < carRadius(car) + 9) {
        damagePed(game, ped, speed * 0.16, car.driver === 'player');
        ped.x += car.vx * 0.03;
        ped.y += car.vy * 0.03;
        if (car.driver === 'player') audio.crash(0.4);
      }
    }
  }
}

/** The F key's whole life: buy, hire, race — whatever the curb offers. */
function doContextAction() {
  const player = game.player;
  const places = game.world.places;
  const near = (place) => place && Math.hypot(player.x - place.x, player.y - place.y) < 110;
  if (player.driving) {
    if (!game.missions.sideJob && near(places.arcade)) startRace(game);
    return;
  }
  if (Math.hypot(player.x - places.supply.x, player.y - places.supply.y) < 84) {
    if (!player.hasPistol) {
      if (player.cash >= 150) {
        player.cash -= 150;
        player.hasPistol = true;
        player.ammo += 24;
        game.notify('Solana Supply', 'One pistol, twenty-four rounds. The city provides.');
        audio.cash();
      } else {
        game.effects.floatText(player.x, player.y - 22, 'NEED $150', '#e84a3c');
      }
    } else if (player.cash >= 40) {
      player.cash -= 40;
      player.ammo += 24;
      game.effects.floatText(player.x, player.y - 22, '+24 AMMO', '#ffd76a');
      audio.cash();
    } else {
      game.effects.floatText(player.x, player.y - 22, 'NEED $40', '#e84a3c');
    }
    return;
  }
  if (!game.missions.sideJob && near(places.hotel)) startTaxi(game);
  else if (!game.missions.sideJob && near(places.arcade)) game.notify('Street race', 'You need wheels for this one, Rook.');
}

/** The one-line prompt for whatever Rook is standing next to. */
function computePrompt() {
  const player = game.player;
  const missions = game.missions;
  const places = game.world.places;
  const dist = (p) => Math.hypot(player.x - p.x, player.y - p.y);
  if (player.driving) {
    if (player.car.stolen && player.car !== (missions.active ? missions.active.targetCar : null) && dist(places.chopshop) < 120) {
      return 'Chop shop — stop on the apron to sell';
    }
    if (!missions.sideJob && dist(places.arcade) < 120) return 'F — Street race';
    return '';
  }
  const car = nearestCar(game, player.x, player.y);
  if (car) return car.driver === 'traffic' || car.driver === 'parked' ? 'E — Steal this car' : 'E — Enter car';
  if (dist(places.supply) < 84) return player.hasPistol ? 'F — Ammo: $40 for 24 rounds' : 'F — Buy a pistol: $150';
  if (!missions.sideJob && dist(places.hotel) < 110) return 'F — Take a taxi fare';
  if (!missions.sideJob && dist(places.arcade) < 110) return 'Street race — bring a car';
  const start = missionStartTarget(game);
  if (start && Math.hypot(player.x - start.x, player.y - start.y) < 100) return "Mara's job — step into the gold marker";
  return '';
}

/** One tick of the living game. */
function stepPlay(dt) {
  const player = game.player;
  game.time += dt;
  game.timeOfDay = (game.timeOfDay + dt / 150) % 24;

  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    game.state = 'paused';
    game.pauseIndex = 0;
    audio.engine(0, false);
    audio.siren(false);
    return;
  }

  const controls = input.controls(game.time);
  const mouseWorld = { x: input.mouse.x + game.camera.x, y: input.mouse.y + game.camera.y };
  updatePlayer(game, dt, controls, actions, mouseWorld);

  // Standing in Mara's gold marker starts the next job.
  const start = missionStartTarget(game);
  if (start && Math.hypot(player.x - start.x, player.y - start.y) < 70) startStoryMission(game);
  if (actions & ACTION_BUY) doContextAction();

  stepTraffic(dt);

  // The crowd reacts to fresh violence near the player.
  for (const event of game.events) {
    if (['shoot', 'assault', 'assaultCop', 'downPed', 'downCop', 'hitPed'].includes(event.kind)) game.lastViolence = game.time;
  }
  const threat = game.time - game.lastViolence < 4 ? { x: player.x, y: player.y } : null;
  for (const ped of game.peds) updatePed(game.rng, ped, dt, game.world, threat);

  updateBullets(game, dt);
  updateMissions(game, dt);
  updateSideJobs(game, dt);
  updatePolice(game, dt);

  // Wrecks smoulder.
  for (const car of game.cars) {
    if (car.health < 45 && !car.dead) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        game.effects.smoke(car.x, car.y, car.health < 20);
        car.smokeTimer = 0.13;
      }
    }
  }

  game.effects.update(dt);
  for (const toast of game.toasts) toast.age += dt;
  game.toasts = game.toasts.filter((t) => t.age < t.life);
  game.promptText = computePrompt();
  if (game.saveDirty) saveGame(game);

  if (player.dead) {
    game.state = 'over';
    game.overKind = 'wasted';
    audio.fail();
    audio.siren(false);
    audio.engine(0, false);
  } else if (player.busted) {
    game.state = 'over';
    game.overKind = 'busted';
    audio.siren(false);
    audio.engine(0, false);
  }
}

/** Menu navigation shared by the title and pause screens. */
function stepMenu(items, indexKey, pick) {
  if (input.pressed('KeyW') || input.pressed('ArrowUp')) {
    game[indexKey] = (game[indexKey] + items.length - 1) % items.length;
    audio.ui();
  }
  if (input.pressed('KeyS') || input.pressed('ArrowDown')) {
    game[indexKey] = (game[indexKey] + 1) % items.length;
    audio.ui();
  }
  if (input.takeActions() & ACTION_CONFIRM) pick(game[indexKey]);
}

function pickTitle(index) {
  const label = game.titleItems[index];
  if (label === 'New Game') {
    clearSave();
    newRun(null);
  } else if (label === 'Continue') {
    newRun(loadSave());
  } else if (label === 'How to Play') {
    game.returnTo = 'title';
    game.state = 'help';
  }
}

function pickPause(index) {
  const label = game.pauseItems[index];
  if (label === 'Resume') {
    game.state = 'play';
  } else if (label === 'Save Game') {
    saveGame(game);
    game.notify('Saved', 'Progress written to this browser.');
    game.state = 'play';
  } else if (label === 'How to Play') {
    game.returnTo = 'paused';
    game.state = 'help';
  } else if (label === 'Quit to Title') {
    game.state = 'title';
    audio.music(false);
    audio.siren(false);
    audio.engine(0, false);
  }
}

/** One tick of dispatch, by state. */
function step(dt) {
  if (input.pressed('KeyM')) audio.toggleMute();
  if (game.shotName) {
    if (game.state === 'title') stepAmbient(dt);
    else stepPlay(dt);
    game.shotTicks += 1;
    input.endTick();
    return;
  }
  switch (game.state) {
    case 'title':
      game.titleItems = loadSave() ? ['New Game', 'Continue', 'How to Play'] : ['New Game', 'How to Play'];
      stepAmbient(dt);
      stepMenu(game.titleItems, 'menuIndex', pickTitle);
      break;
    case 'play':
      stepPlay(dt);
      break;
    case 'paused':
      stepMenu(game.pauseItems, 'pauseIndex', pickPause);
      break;
    case 'help': {
      const actions = input.takeActions();
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) game.state = game.returnTo;
      break;
    }
    case 'over':
      stepAmbient(dt);
      if (input.takeActions() & ACTION_CONFIRM) respawn();
      break;
    default:
      break;
  }
  input.endTick();
}

/** Draw the current state. */
function render() {
  drawWorld(ctx, game);
  if (game.state === 'play' || game.state === 'paused' || (game.shotName && game.state === 'play')) drawHUD(ctx, game);
  if (game.state === 'title') drawTitle(ctx, game);
  else if (game.state === 'paused') drawPaused(ctx, game);
  else if (game.state === 'help') drawHelp(ctx, game);
  else if (game.state === 'over') {
    if (game.overKind === 'wasted') drawWasted(ctx, game);
    else drawBusted(ctx, game);
  }
}

// ---------------------------------------------------------------- boot

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;
  game = createGame(seed);
  window.__game = game;
  game.shotName = shotName;
  setupShot(game, shotName);
}
window.__shotReady = false;

// Sound starts on the first real gesture (and never in screenshot scenes).
if (!shotName) {
  const unlock = () => {
    audio.unlock();
    if (game.state === 'play') audio.music(true);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

let last = performance.now() / 1000;
let acc = 0;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  let dt = now - last;
  last = now;
  if (game.shotName) {
    // Screenshot scenes run a fixed number of ticks, then hold the frame.
    if (game.shotTicks < (SHOT_TICKS[game.shotName] ?? 120)) {
      step(STEP);
      step(STEP);
    }
    render();
    if (game.shotTicks >= (SHOT_TICKS[game.shotName] ?? 120)) window.__shotReady = true;
    return;
  }
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  render();
}
requestAnimationFrame(frame);
