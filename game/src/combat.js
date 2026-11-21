// Combat: fists, pistol shots, damage and what falls out of it. Everything reports what
// happened through game.events so the wanted system (police.js) can decide what the law
// saw, and cash drops land in game.pickups for the player to scoop up.
import { PLAYER } from './config.js';
import { buildingAt } from './world.js';
import { carRadius } from './cars.js';

/** Fire one bullet. from: 'player' | 'cop' | 'thug'. */
export function fireBullet(game, x, y, angle, from) {
  game.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * 880,
    vy: Math.sin(angle) * 880,
    life: PLAYER.pistolRange / 880,
    from,
  });
  game.effects.sparks(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16, 2);
  if (from === 'player') game.events.push({ kind: 'shoot', x, y, byPlayer: true });
}

/** Hurt the player; returns true when this blow wasted them. */
export function damagePlayer(game, amount) {
  const player = game.player;
  if (player.dead) return false;
  player.health -= amount;
  player.hurtFlash = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

/** Hurt a pedestrian (or an officer); knockdowns drop cash and raise the temperature. */
export function damagePed(game, ped, amount, byPlayer, cause = 'hit') {
  if (ped.state === 'down') return;
  ped.health -= amount;
  ped.panic = 6;
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.downTimer = ped.cop ? 9999 : game.rng.range(7, 13);
    ped.speed = 0;
    if (!ped.cop && game.rng.chance(0.75)) {
      game.pickups.push({ x: ped.x + game.rng.range(-8, 8), y: ped.y + game.rng.range(-8, 8), kind: 'cash', amount: game.rng.int(8, 42), phase: game.rng.range(0, 6) });
    }
    if (byPlayer) {
      game.events.push({ kind: ped.cop ? 'downCop' : 'downPed', x: ped.x, y: ped.y, byPlayer: true });
    }
  } else if (byPlayer) {
    game.events.push({ kind: ped.cop ? 'assaultCop' : 'assault', x: ped.x, y: ped.y, byPlayer: true });
    if (!ped.thug && !ped.cop) ped.state = 'flee';
  }
  game.effects.impact(ped.x, ped.y);
}

/** Hurt a car; a wrecked car stops, smokes and is worth nothing at the chop shop. */
export function damageCar(game, car, amount, byPlayer) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.vx = 0;
    car.vy = 0;
    game.effects.smoke(car.x, car.y, true);
  }
  if (byPlayer && car.driver === 'cop') game.events.push({ kind: 'hitCopCar', x: car.x, y: car.y, byPlayer: true });
}

/**
 * A swing of the fists from (x, y) facing `angle`: hits the nearest pedestrian or officer
 * in front. Returns true when it connected.
 */
export function meleeAttack(game, x, y, angle, byPlayer) {
  let best = null;
  let bestDist = PLAYER.punchRange + 8;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d > bestDist) continue;
    let diff = Math.atan2(ped.y - y, ped.x - x) - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) {
      best = ped;
      bestDist = d;
    }
  }
  if (!best) return false;
  damagePed(game, best, PLAYER.punchDamage, byPlayer, 'punch');
  best.x += Math.cos(angle) * 10;
  best.y += Math.sin(angle) * 10;
  game.audio.punch();
  return true;
}

/** Advance every bullet: flight, building hits, and hits on people, cars and the player. */
export function updateBullets(game, dt) {
  const bullets = game.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let gone = b.life <= 0;
    if (!gone && buildingAt(game.world, b.x, b.y)) {
      game.effects.sparks(b.x, b.y, 3);
      gone = true;
    }
    if (!gone) {
      // People.
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (b.from === 'cop' && ped.cop) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 11) {
          damagePed(game, ped, PLAYER.pistolDamage, b.from === 'player', 'shot');
          gone = true;
          break;
        }
      }
    }
    if (!gone && b.from !== 'player') {
      const p = game.player;
      const target = p.driving ? p.car : p;
      const r = p.driving ? carRadius(p.car) : 11;
      if (Math.hypot(target.x - b.x, target.y - b.y) < r) {
        if (p.driving) damageCar(game, p.car, 6, false);
        else damagePlayer(game, b.from === 'cop' ? 7 : 9);
        gone = true;
      }
    }
    if (!gone && b.from === 'player') {
      for (const car of game.cars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < carRadius(car)) {
          damageCar(game, car, PLAYER.pistolDamage * 0.6, true);
          game.effects.sparks(b.x, b.y, 4);
          gone = true;
          break;
        }
      }
    }
    if (gone) bullets.splice(i, 1);
  }
}
