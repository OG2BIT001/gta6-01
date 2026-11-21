// Screenshot scenes. Open the game with ?shot=<name>&seed=<n> and it builds a staged,
// deterministic scene — scripted inputs drive the same simulation a player drives —
// settles it for a fixed number of ticks, draws one frame, and sets
// window.__shotReady = true. The headless harness in ../../headless/ uses exactly this
// hook to rasterise the shipped screenshots from the game's own draw calls.
import { makeCar } from './cars.js';
import { makePed } from './peds.js';
import { startStoryMission } from './missions.js';

/** How many fixed ticks each scene runs before its frame is taken. */
export const SHOT_TICKS = { title: 110, drive: 170, chase: 125, foot: 140 };

/** Park a police interceptor near a point, aimed at the action. */
function stageCopCar(game, x, y, angle) {
  const car = makeCar(game.rng, 'copcar', x, y, angle);
  car.driver = 'cop';
  car.targetX = game.player.x;
  car.targetY = game.player.y;
  game.cars.push(car);
  return car;
}

/** A steering script: full throttle, with an occasional weave between lanes. */
function cruise(weave) {
  return (t) => ({
    up: true,
    down: false,
    left: Math.sin(t * weave) < -0.92,
    right: Math.sin(t * weave) > 0.92,
    run: false,
    interact: false,
    buy: false,
    shoot: false,
  });
}

/** Stage one named scene on a freshly built game. */
export function setupShot(game, name) {
  const player = game.player;
  if (name === 'title') {
    game.state = 'title';
    game.timeOfDay = 17.9;
    return;
  }
  game.state = 'play';
  if (name === 'drive') {
    // First job, opening beat: Rook is already rolling east through Old Solana in a
    // red coupe, and the gold beacon waits at Mara's garage across the city.
    startStoryMission(game);
    const coupe = makeCar(game.rng, 'coupe', 1150, 1233, 0, 'player');
    coupe.color = '#d94f3d';
    game.cars.push(coupe);
    player.driving = true;
    player.car = coupe;
    player.x = coupe.x;
    player.y = coupe.y;
    game.timeOfDay = 16.6;
    game.input.setScript(cruise(0));
  } else if (name === 'chase') {
    // Four stars over the Cielo District at nightfall: Rook's Vela GT runs west with
    // two interceptors on the tail and a third swinging in from the eastbound lane.
    game.missions.storyIndex = 5;
    game.missions.storyComplete = true;
    const car = makeCar(game.rng, 'racer', 3400, 2367, Math.PI, 'player');
    car.color = '#e8b53a';
    game.cars.push(car);
    player.driving = true;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    game.police.heat = 320;
    game.police.seenAgo = 0;
    stageCopCar(game, 3680, 2367, Math.PI);
    stageCopCar(game, 3790, 2433, Math.PI);
    stageCopCar(game, 2980, 2433, 0);
    game.timeOfDay = 19.9;
    game.input.setScript(cruise(0));
  } else if (name === 'foot') {
    // Debt Run, first collection: Rook walks into the marker on foot, pistol up — the
    // stage flips to the fight on the first tick and Mara's collectors close in.
    game.missions.storyIndex = 2;
    startStoryMission(game);
    player.x = 900;
    player.y = 748;
    player.hasPistol = true;
    player.ammo = 30;
    player.cash = 870;
    game.timeOfDay = 11.4;
    game.input.mouse.x = 660;
    game.input.mouse.y = 210;
    // Set dressing the simulation supports: a drunk down on the pavement, his dropped
    // cash beside him, and a bystander about to bolt when the trouble starts.
    const downed = makePed(game.rng, 866, 726);
    downed.state = 'down';
    downed.downTimer = 999;
    game.peds.push(downed);
    game.pickups.push({ kind: 'cash', x: 872, y: 776, amount: 35, phase: 1.3, life: 999 });
    const runner = makePed(game.rng, 952, 706);
    runner.state = 'flee';
    runner.fleeFrom = { x: player.x, y: player.y };
    game.peds.push(runner);
  }
}
