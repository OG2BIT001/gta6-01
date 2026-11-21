// The Port Solana Police Department: a heat-and-stars wanted model fed by witnessed
// crimes, interceptor cars that hunt the player, officers who bail out and fight on foot,
// and the busted arrest when they pin a slow player down.
import { WANTED } from './config.js';
import { buildingAt } from './world.js';
import { driveCar, forwardSpeed, makeCar, putOnRoad } from './cars.js';
import { damagePlayer, fireBullet } from './combat.js';
import { makePed } from './peds.js';

/** Crime event kinds and the heat each is worth when witnessed. */
const CRIME_HEAT = {
  stealCar: WANTED.crimes.stealCar,
  hitPed: WANTED.crimes.hitPed,
  downPed: WANTED.crimes.downPed,
  hitCar: WANTED.crimes.hitCar,
  hitCopCar: WANTED.crimes.hitCopCar,
  assault: WANTED.crimes.assault,
  assaultCop: WANTED.crimes.assault * 1.8,
  shoot: WANTED.crimes.shoot,
  downCop: WANTED.crimes.downCop,
  hitBuilding: WANTED.crimes.hitBuilding,
  alarm: WANTED.crimes.missionAlarm,
};

/** Create the wanted-system state. */
export function createPolice() {
  return {
    heat: 0,
    stars: 0,
    seenAgo: 99,
    spawnTimer: 0,
    bustTimer: 0,
    searchNote: '',
  };
}

/** Stars for a heat level: 0 below the first threshold, up to 5. */
export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < WANTED.starHeat.length; i += 1) {
    if (heat >= WANTED.starHeat[i]) stars = i;
  }
  return stars;
}

/** Line of sight between two points: blocked when a building stands at the midpoint. */
function losClear(world, x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return !buildingAt(world, mx, my);
}

/** Does anyone — officer or civilian — see this point from close by? */
function witnessed(game, x, y) {
  for (const car of game.cars) {
    if (car.driver === 'cop' && Math.hypot(car.x - x, car.y - y) < WANTED.witnessRadius) return true;
  }
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < WANTED.witnessRadius * 0.82) return true;
  }
  return false;
}

/** Feed the tick's events into the heat model. */
export function observeEvents(game) {
  const police = game.police;
  for (const event of game.events) {
    const base = CRIME_HEAT[event.kind] ?? 0;
    if (base <= 0) continue;
    const seen = witnessed(game, event.x, event.y);
    police.heat += seen ? base : base * (event.kind === 'downCop' ? 0.6 : 0.12);
    if (seen && event.kind !== 'hitBuilding') police.seenAgo = 0;
  }
  game.events.length = 0;
}

/** Spawn an interceptor on a road a few blocks from the player. */
function spawnCopCar(game) {
  const player = game.player;
  const car = makeCar(game.rng, 'copcar', 0, 0, 0, 'cop');
  putOnRoad(game.rng, car);
  // Re-seat it near the player: same avenue or street, off-screen.
  const angle = game.rng.range(0, Math.PI * 2);
  const dist = game.rng.range(560, 760);
  car.x = Math.min(4700, Math.max(100, player.x + Math.cos(angle) * dist));
  car.y = Math.min(3200, Math.max(100, player.y + Math.sin(angle) * dist));
  game.cars.push(car);
  return car;
}

/** An officer climbs out of a stopped interceptor and fights on foot. */
function bailOut(game, car) {
  car.driver = 'none';
  const officer = makePed(game.rng, car.x + 18, car.y + 14, true);
  officer.id = 7000 + car.id;
  officer.state = 'chase';
  officer.shootCooldown = game.rng.range(0.4, 1.2);
  game.peds.push(officer);
}

/** Steer a police car at the player with ordinary driving physics. */
function chaseWithCar(game, car, dt) {
  const player = game.player;
  const targetX = player.x + (player.driving ? player.car.vx * 0.4 : 0);
  const targetY = player.y + (player.driving ? player.car.vy * 0.4 : 0);
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const dist = Math.hypot(player.x - car.x, player.y - car.y);
  const throttle = dist > 60 ? 1 : 0.25;
  driveCar(car, dt, throttle, steer, Math.abs(diff) > 2.2, game.world, game.effects);
  // Close enough to a player on foot: the officer gets out.
  if (!player.driving && dist < 110 && Math.abs(forwardSpeed(car)) < 60) bailOut(game, car);
}

/** Steer one on-foot officer: close in, keep a firing distance, shoot or swing. */
function chaseOnFoot(game, officer, dt) {
  const player = game.player;
  const dist = Math.hypot(player.x - officer.x, player.y - officer.y);
  officer.angle = Math.atan2(player.y - officer.y, player.x - officer.x);
  officer.shootCooldown = (officer.shootCooldown ?? 0) - dt;
  const wantDist = game.police.stars >= 2 ? 150 : 26;
  if (dist > wantDist + 8) {
    const nx = officer.x + Math.cos(officer.angle) * 196 * dt;
    const ny = officer.y + Math.sin(officer.angle) * 196 * dt;
    if (!buildingAt(game.world, nx, ny)) {
      officer.x = nx;
      officer.y = ny;
    }
    officer.speed = 196;
  } else {
    officer.speed = 0;
    if (game.police.stars >= 2 && officer.shootCooldown <= 0 && losClear(game.world, officer.x, officer.y, player.x, player.y)) {
      officer.shootCooldown = game.rng.range(0.8, 1.5);
      const spread = game.rng.range(-0.09, 0.09);
      fireBullet(game, officer.x, officer.y, officer.angle + spread, 'cop');
      game.audio.shot();
    } else if (dist < 30 && officer.shootCooldown <= 0) {
      officer.shootCooldown = 0.9;
      damagePlayer(game, 5);
      game.effects.impact(player.x, player.y);
    }
  }
}

/** Advance the whole wanted system one tick. */
export function updatePolice(game, dt) {
  const police = game.police;
  const player = game.player;
  observeEvents(game);
  police.stars = starsForHeat(police.heat);

  // Who can see the player right now?
  let seen = false;
  for (const car of game.cars) {
    if (car.driver !== 'cop') continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < WANTED.copSight && losClear(game.world, car.x, car.y, player.x, player.y)) seen = true;
  }
  for (const ped of game.peds) {
    if (!ped.cop || ped.state === 'down') continue;
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < WANTED.copSight * 0.7 && losClear(game.world, ped.x, ped.y, player.x, player.y)) seen = true;
  }
  if (seen) police.seenAgo = 0;
  else police.seenAgo += dt;

  // Heat drains: slowly under eyes, fast when lost.
  if (police.stars > 0) {
    const rate = police.seenAgo < 4 ? WANTED.decayPerSecond * 0.25 : police.seenAgo > 9 ? WANTED.decayHiddenPerSecond : WANTED.decayPerSecond;
    police.heat = Math.max(0, police.heat - rate * dt);
    police.stars = starsForHeat(police.heat);
  }

  // Reinforcements while the stars are up.
  const copCars = game.cars.filter((c) => c.driver === 'cop');
  const footCops = game.peds.filter((p) => p.cop && p.state !== 'down');
  police.spawnTimer -= dt;
  if (police.stars > 0 && !player.dead && !player.busted) {
    const carCap = Math.min(6, police.stars + 1);
    if (copCars.length < carCap && police.spawnTimer <= 0) {
      spawnCopCar(game);
      police.spawnTimer = Math.max(1.2, 4.5 - police.stars);
    }
    if (police.stars >= 3 && footCops.length < police.stars && copCars.length > 0 && police.spawnTimer <= 0) {
      bailOut(game, copCars[0]);
      police.spawnTimer = 3;
    }
  }

  // Drive and steer the law.
  for (const car of game.cars) {
    if (car.driver === 'cop' && !car.dead) chaseWithCar(game, car, dt);
  }
  for (const ped of game.peds) {
    if (ped.cop && ped.state === 'chase') chaseOnFoot(game, ped, dt);
  }
  game.audio.siren(copCars.length > 0 && police.stars > 0);

  // The arrest: pin a slow player with an officer or a bumper nearby.
  let pinning = false;
  if (police.stars > 0 && !player.dead) {
    if (!player.driving && Math.abs(player.speed) < 46) {
      for (const ped of game.peds) {
        if (ped.cop && ped.state !== 'down' && Math.hypot(ped.x - player.x, ped.y - player.y) < 40) pinning = true;
      }
    }
    if (player.driving && Math.abs(forwardSpeed(player.car)) < 26) {
      for (const car of copCars) {
        if (Math.hypot(car.x - player.x, car.y - player.y) < 74) pinning = true;
      }
    }
  }
  if (pinning) {
    police.bustTimer += dt;
    if (police.bustTimer > 1.7) {
      player.busted = true;
      game.audio.siren(false);
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }

  // When the heat dies, the law drifts away: interceptors rejoin traffic, officers leave.
  if (police.stars === 0) {
    for (const car of game.cars) {
      if (car.driver === 'cop') {
        car.driver = 'traffic';
        car.route = null;
      }
    }
    for (let i = game.peds.length - 1; i >= 0; i -= 1) {
      if (game.peds[i].cop) game.peds.splice(i, 1);
    }
  }
}
