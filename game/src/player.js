// The player: Jules "Rook" Ferreira, on foot and behind the wheel. Movement, entering and
// stealing cars, fists and the pistol, pickups and staying alive live here; the law's
// reaction to all of it lives in police.js, fed by the events this file reports.
import { PLAYER, WORLD } from './config.js';
import { ACTION_INTERACT } from './input.js';
import { clampToLand, hitsBuilding, isWater } from './world.js';
import { carRadius, driveCar, forwardSpeed } from './cars.js';
import { fireBullet, meleeAttack } from './combat.js';
import { makePed } from './peds.js';

/** Create the player at a pose, pockets empty. */
export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.health,
    cash: 120,
    driving: false,
    car: null,
    hasPistol: false,
    ammo: 0,
    dead: false,
    busted: false,
    hurtFlash: 0,
    sinceHurt: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    walkCycle: 0,
  };
}

/** The nearest usable car within reach of a point, or null. */
export function nearestCar(game, x, y, reach = 56) {
  let best = null;
  let bestDist = reach;
  for (const car of game.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y) - carRadius(car);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  return best;
}

/** Get out of the current car, stepping to its left side. */
function exitCar(game) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  car.driver = 'none';
  const side = car.angle - Math.PI / 2;
  player.x = car.x + Math.cos(side) * (car.spec.width / 2 + 16);
  player.y = car.y + Math.sin(side) * (car.spec.width / 2 + 16);
  const clamped = clampToLand(player.x, player.y, 11);
  player.x = clamped.x;
  player.y = clamped.y;
  player.driving = false;
  player.car = null;
  game.audio.engine(0, false);
}

/** Climb into a car, stealing it if it is not already yours to take. */
function enterCar(game, car) {
  const player = game.player;
  if (car.driver === 'traffic') {
    // The driver bails out and runs.
    const driver = makePed(game.rng, car.x + 20, car.y + 10);
    driver.state = 'flee';
    driver.id = 9000 + car.id;
    game.peds.push(driver);
    game.events.push({ kind: 'stealCar', x: car.x, y: car.y, byPlayer: true });
    car.stolen = true;
    game.effects.floatText(player.x, player.y - 24, 'CAR JACKED', '#ffd76a');
  } else if (car.driver === 'parked' || car.driver === 'none') {
    game.events.push({ kind: 'stealCar', x: car.x, y: car.y, byPlayer: true });
    car.stolen = true;
  }
  car.driver = 'player';
  car.route = null;
  player.driving = true;
  player.car = car;
  game.audio.unlock();
}

/**
 * Advance the player one tick. `controls` are the held controls from input.js and
 * `actions` the one-shot action bits; mouseWorld is the cursor in world coordinates.
 */
export function updatePlayer(game, dt, controls, actions, mouseWorld) {
  const player = game.player;
  if (player.dead || player.busted) return;
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  player.sinceHurt += dt;
  if (player.sinceHurt > 6 && player.health > 0 && player.health < 100) {
    player.health = Math.min(100, player.health + 2.2 * dt);
  }
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);

  if (actions & ACTION_INTERACT) {
    if (player.driving) exitCar(game);
    else {
      const car = nearestCar(game, player.x, player.y);
      if (car) enterCar(game, car);
    }
  }

  if (player.driving) {
    const car = player.car;
    const throttle = controls.up ? 1 : controls.down ? -1 : 0;
    const steer = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
    const impact = driveCar(car, dt, throttle, steer, controls.run, game.world, game.effects);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (impact > 150) {
      game.events.push({ kind: 'hitBuilding', x: car.x, y: car.y, byPlayer: true });
      game.audio.crash(Math.min(1, impact / 320));
      if (impact > 240) {
        player.health -= (impact - 240) / 12;
        player.sinceHurt = 0;
        if (player.health <= 0) {
          player.health = 0;
          player.dead = true;
        }
      }
    }
    game.audio.engine(Math.min(1, Math.abs(forwardSpeed(car)) / car.spec.topSpeed), true);
    return;
  }

  game.audio.engine(0, false);

  // On foot: eight-way movement, facing the walk or the aim.
  let mx = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
  let my = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
  const moving = mx !== 0 || my !== 0;
  const speed = controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    if (!hitsBuilding(game.world, nx, player.y, 10) && !isWater(nx, player.y)) player.x = nx;
    if (!hitsBuilding(game.world, player.x, ny, 10) && !isWater(player.x, ny)) player.y = ny;
    player.x = Math.min(WORLD.width - 11, Math.max(11, player.x));
    player.y = Math.min(WORLD.height - 11, Math.max(11, player.y));
    player.angle = Math.atan2(my, mx);
    player.speed = speed;
    player.walkCycle += dt * (controls.run ? 11 : 8);
  } else {
    player.speed = 0;
  }

  // Cars are solid to walk into.
  for (const car of game.cars) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    const min = carRadius(car) + 9;
    if (d > 0 && d < min) {
      player.x = car.x - ((car.x - player.x) / d) * min;
      player.y = car.y - ((car.y - player.y) / d) * min;
    }
  }

  // Fighting: with a pistol, aim at the mouse and fire; otherwise swing.
  const wantsFight = controls.shoot;
  if (player.hasPistol && player.ammo > 0) {
    player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
    if (wantsFight && player.shootCooldown <= 0) {
      player.shootCooldown = 0.24;
      player.ammo -= 1;
      const spread = game.rng.range(-0.045, 0.045);
      fireBullet(game, player.x, player.y, player.angle + spread, 'player');
      game.audio.shot();
    }
  } else if (wantsFight && player.punchCooldown <= 0) {
    player.punchCooldown = 0.34;
    if (!moving) player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
    meleeAttack(game, player.x, player.y, player.angle, true);
  }

  // Pickups.
  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = game.pickups[i];
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) > 22) continue;
    if (pickup.kind === 'cash') {
      player.cash += pickup.amount;
      game.effects.floatText(player.x, player.y - 20, `+$${pickup.amount}`, '#7be382');
      game.audio.pickup();
    } else if (pickup.kind === 'health') {
      player.health = Math.min(100, player.health + 30);
      game.effects.floatText(player.x, player.y - 20, '+ HEALTH', '#7be382');
      game.audio.pickup();
    } else if (pickup.kind === 'ammo') {
      player.ammo += 12;
      game.effects.floatText(player.x, player.y - 20, '+12 AMMO', '#ffd76a');
      game.audio.pickup();
    }
    game.pickups.splice(i, 1);
  }
}
