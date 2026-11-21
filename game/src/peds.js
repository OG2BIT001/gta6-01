// Pedestrians: Solana's walkers. They stroll the sidewalks, flee from danger, fall when
// hurt (and drop a little cash), and a few of them — mission debtors' muscle — fight back.
// Police officers on foot are pedestrians with cop set, driven by police.js instead.
import { COAST_Y, WORLD } from './config.js';
import { ROAD_XS, ROAD_YS, hitsBuilding } from './world.js';

const SHIRTS = ['#e86a5a', '#5a8ae8', '#f2d13a', '#4ecb8a', '#e8e8ec', '#b45ae8', '#e89a3a', '#3ac9d9', '#e85a9a'];
const PANTS = ['#2e3440', '#5a4632', '#3a4a6a', '#6a6a72', '#20242c', '#7a6a4a'];

/** Create one pedestrian at a pose. */
export function makePed(rng, x, y, cop = false) {
  return {
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    health: cop ? 120 : 60,
    cop,
    thug: false,
    state: 'walk', // walk | flee | down | chase | hold
    shirt: cop ? '#2a3c5e' : rng.pick(SHIRTS),
    pants: cop ? '#22293a' : rng.pick(PANTS),
    skin: rng.pick(['#f2c79b', '#c98d5e', '#8a5a34', '#6e4525', '#ffd9b3']),
    walkLine: null,
    retarget: rng.range(1, 5),
    downTimer: 0,
    panic: 0,
    punchCooldown: 0,
    id: 0,
  };
}

/** A sidewalk line a pedestrian can stroll: fixed x (vertical) or fixed y (horizontal). */
function randomWalkLine(rng) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(ROAD_XS);
    return { axis: 'v', at: rx + (rng.chance(0.5) ? -79 : 79), dir: rng.chance(0.5) ? 1 : -1 };
  }
  const ry = rng.pick(ROAD_YS.filter((y) => y <= 3000));
  return { axis: 'h', at: ry + (rng.chance(0.5) ? -79 : 79), dir: rng.chance(0.5) ? 1 : -1 };
}

/** Spawn the ambient crowd on the sidewalks. */
export function spawnPeds(rng, world, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const line = randomWalkLine(rng);
    const along = rng.range(120, WORLD.width - 120);
    const x = line.axis === 'v' ? line.at : along;
    const y = line.axis === 'v' ? rng.range(120, COAST_Y - 120) : line.at;
    if (hitsBuilding(world, x, y, 12)) continue;
    const ped = makePed(rng, x, y);
    ped.walkLine = line;
    ped.id = i + 1;
    peds.push(ped);
  }
  return peds;
}

/** Move a pedestrian with building collision; returns false when fully blocked. */
function movePed(ped, dt, world, speed, angle) {
  const nx = ped.x + Math.cos(angle) * speed * dt;
  const ny = ped.y + Math.sin(angle) * speed * dt;
  if (!hitsBuilding(world, nx, ny, 10) && ny < COAST_Y + 60) {
    ped.x = nx;
    ped.y = ny;
    ped.angle = angle;
    ped.speed = speed;
    return true;
  }
  ped.speed = 0;
  return false;
}

/**
 * Advance one ambient pedestrian. `threat` is a point to flee from (or null); thugs and
 * officers are steered by their own systems and skipped here.
 */
export function updatePed(rng, ped, dt, world, threat) {
  if (ped.cop || ped.thug) return;
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    ped.speed = 0;
    if (ped.downTimer <= 0) {
      ped.state = 'walk';
      ped.health = 30;
    }
    return;
  }
  ped.retarget -= dt;

  if (threat) {
    const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
    if (d < 170) ped.state = 'flee';
    else if (ped.state === 'flee' && d > 260) ped.state = 'walk';
  }

  if (ped.state === 'flee' && threat) {
    const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    if (!movePed(ped, dt, world, 205, away)) {
      movePed(ped, dt, world, 205, away + (rng.chance(0.5) ? 0.9 : -0.9));
    }
    return;
  }

  // Stroll the walk line; at its end or on a whim, pick another.
  if (!ped.walkLine || ped.retarget <= 0) {
    ped.walkLine = randomWalkLine(rng);
    ped.retarget = rng.range(6, 16);
    // Join the new line at the nearest point.
    if (ped.walkLine.axis === 'v') ped.x += (ped.walkLine.at - ped.x) * 0.9;
    else ped.y += (ped.walkLine.at - ped.y) * 0.9;
  }
  const line = ped.walkLine;
  if (line.axis === 'v') {
    const angle = line.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (!movePed(ped, dt, world, 74, angle)) line.dir *= -1;
    if (ped.y < 60 || ped.y > COAST_Y - 40) line.dir *= -1;
  } else {
    const angle = line.dir > 0 ? 0 : Math.PI;
    if (!movePed(ped, dt, world, 74, angle)) line.dir *= -1;
    if (ped.x < 60 || ped.x > WORLD.width - 60) line.dir *= -1;
  }
}
