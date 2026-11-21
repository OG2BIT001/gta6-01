// Cars: the factory, the arcade driving physics, traffic that follows the road grid, and
// collisions. A car is a small state object; the player-driven car, traffic, parked cars
// and police interceptors all run through the same physics.
import { CAR_TYPES, COAST_Y, WORLD } from './config.js';
import { ROAD_XS, ROAD_YS, hitsBuilding, isWater } from './world.js';

let nextId = 1;

/** The lane offset from a road's centre line for right-hand traffic. */
const LANE = 33;
/** Streets traffic may use: the coast road (y = 3000) is the last one before the beach. */
const TRAFFIC_YS = ROAD_YS.filter((y) => y <= 3000);

/** Create a car of a type at a pose. driver: 'traffic' | 'parked' | 'cop' | 'player' | 'none'. */
export function makeCar(rng, type, x, y, angle, driver = 'none') {
  const spec = CAR_TYPES[type];
  return {
    id: nextId++,
    type,
    spec,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    speed: 0,
    steer: 0,
    color: rng.pick(spec.colors),
    health: 100,
    driver,
    route: null,
    waitTimer: 0,
    smokeTimer: 0,
    lightPhase: rng.range(0, Math.PI * 2),
    hornTimer: 0,
    dead: false,
  };
}

/** A car's collision radius. */
export function carRadius(car) {
  return car.spec.length * 0.38;
}

/** The speed along the car's nose (negative in reverse). */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/** Put a car on a road lane: axis 'v' travels along y on a vertical avenue, 'h' along x. */
export function putOnRoad(rng, car, axis = null, dir = null) {
  const useAxis = axis ?? (rng.chance(0.5) ? 'v' : 'h');
  const useDir = dir ?? (rng.chance(0.5) ? 1 : -1);
  if (useAxis === 'v') {
    const rx = rng.pick(ROAD_XS);
    car.x = rx + (useDir > 0 ? -LANE : LANE);
    car.y = rng.range(120, COAST_Y - 160);
    car.angle = useDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.route = { axis: 'v', dir: useDir, line: rx };
  } else {
    const ry = rng.pick(TRAFFIC_YS);
    car.y = ry + (useDir > 0 ? LANE : -LANE);
    car.x = rng.range(120, WORLD.width - 120);
    car.angle = useDir > 0 ? 0 : Math.PI;
    car.route = { axis: 'h', dir: useDir, line: ry };
  }
  car.vx = 0;
  car.vy = 0;
  return car;
}

/** Spawn the ambient traffic fleet, spread over the road grid. */
export function spawnTraffic(rng, world, count) {
  const types = ['coupe', 'sedan', 'sedan', 'wagon', 'pickup', 'van', 'taxi'];
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const car = makeCar(rng, rng.pick(types), 0, 0, 0, 'traffic');
    putOnRoad(rng, car);
    car.x += rng.range(-6, 6);
    cars.push(car);
  }
  return cars;
}

/** Spawn parked cars: in the lots' bays and parallel-parked along quiet streets. */
export function spawnParked(rng, world, count) {
  const types = ['coupe', 'sedan', 'wagon', 'pickup', 'van', 'racer'];
  const cars = [];
  const bays = [];
  for (const lot of world.lots) for (const bay of lot.bays) bays.push(bay);
  for (let i = bays.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [bays[i], bays[j]] = [bays[j], bays[i]];
  }
  for (const bay of bays) {
    if (cars.length >= count || !rng.chance(0.55)) continue;
    cars.push(makeCar(rng, rng.pick(types), bay.x, bay.y, bay.angle, 'parked'));
  }
  let guard = 0;
  while (cars.length < count && guard < 300) {
    guard += 1;
    const rx = rng.pick(ROAD_XS);
    const y = rng.range(140, COAST_Y - 200);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = rx + side * 52;
    if (hitsBuilding(world, x, y, 20)) continue;
    cars.push(makeCar(rng, rng.pick(types), x, y, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'parked'));
  }
  return cars;
}

/**
 * Shared arcade physics: throttle/steer in [-1, 1], handbrake for slides. Returns impact
 * speed when the car struck a building or the water's edge, else 0.
 */
export function driveCar(car, dt, throttle, steer, handbrake, world, effects) {
  const spec = car.spec;
  const fwd = forwardSpeed(car);
  let impact = 0;

  // Engine and brakes.
  if (throttle > 0) {
    car.vx += Math.cos(car.angle) * spec.accel * throttle * dt;
    car.vy += Math.sin(car.angle) * spec.accel * throttle * dt;
  } else if (throttle < 0) {
    if (fwd > 12) {
      car.vx -= Math.cos(car.angle) * spec.accel * 1.4 * dt;
      car.vy -= Math.sin(car.angle) * spec.accel * 1.4 * dt;
    } else {
      car.vx += Math.cos(car.angle) * spec.accel * 0.55 * throttle * dt;
      car.vy += Math.sin(car.angle) * spec.accel * 0.55 * throttle * dt;
    }
  }

  // Clamp to the top speed along the nose.
  const speedNow = Math.hypot(car.vx, car.vy);
  const maxSpeed = spec.topSpeed * (car.health < 35 ? 0.55 : 1);
  if (speedNow > maxSpeed) {
    car.vx = (car.vx / speedNow) * maxSpeed;
    car.vy = (car.vy / speedNow) * maxSpeed;
  }

  // Steering turns the nose in proportion to forward speed; grip kills sideways slide.
  const steerAuthority = Math.max(-1, Math.min(1, fwd / 90));
  car.angle += steer * spec.grip * 0.62 * steerAuthority * dt * (handbrake ? 1.5 : 1);
  car.steer = steer;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const along = car.vx * fx + car.vy * fy;
  const sideX = car.vx - fx * along;
  const sideY = car.vy - fy * along;
  const gripKeep = handbrake ? 0.86 : 0.62;
  car.vx = fx * along + sideX * Math.pow(gripKeep, dt * 60);
  car.vy = fy * along + sideY * Math.pow(gripKeep, dt * 60);
  // Rolling drag.
  const drag = Math.pow(0.55, dt) * (handbrake ? 0.9 : 1);
  if (throttle === 0) {
    car.vx *= drag;
    car.vy *= drag;
  }
  if (Math.abs(along) > 130 && Math.abs(steer) > 0.4 && effects) {
    const rearX = car.x - fx * spec.length * 0.36;
    const rearY = car.y - fy * spec.length * 0.36;
    const px = -fy * spec.width * 0.4;
    const py = fx * spec.width * 0.4;
    effects.skid(rearX + px, rearY + py, rearX + px - car.vx * dt, rearY + py - car.vy * dt);
    effects.skid(rearX - px, rearY - py, rearX - px - car.vx * dt, rearY - py - car.vy * dt);
    if (Math.random() < 0.3) effects.smoke(rearX, rearY);
  }

  const prevX = car.x;
  const prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = forwardSpeed(car);

  // Buildings and the bay stop a car hard.
  const r = carRadius(car);
  if (hitsBuilding(world, car.x, car.y, r * 0.8) || isWater(car.x, car.y) || car.x < r || car.y < r || car.x > WORLD.width - r || car.y > WORLD.height - r) {
    impact = Math.abs(fwd);
    car.x = prevX;
    car.y = prevY;
    car.vx = -car.vx * 0.22;
    car.vy = -car.vy * 0.22;
    car.speed = forwardSpeed(car);
    if (impact > 40 && effects) effects.sparks(car.x + fx * r, car.y + fy * r, 10);
  }
  return impact;
}

/** Push two cars apart and trade a little velocity; returns the impact speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const min = (carRadius(a) + carRadius(b)) * 0.92;
  if (dist >= min) return 0;
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
  const trade = 0.32;
  const avn = a.vx * nx + a.vy * ny;
  const bvn = b.vx * nx + b.vy * ny;
  a.vx += (bvn - avn) * trade * nx;
  a.vy += (bvn - avn) * trade * ny;
  b.vx += (avn - bvn) * trade * nx;
  b.vy += (avn - bvn) * trade * ny;
  return rel;
}

/** The point a traffic driver aims at: its lane, a little ahead, bending toward a turn. */
function trafficTarget(rng, car, crossings) {
  const route = car.route;
  if (!route) return { x: car.x, y: car.y };
  if (route.axis === 'v') {
    const laneX = route.line + (route.dir > 0 ? -LANE : LANE);
    return { x: laneX, y: car.y + route.dir * 120 };
  }
  const laneY = route.line + (route.dir > 0 ? LANE : -LANE);
  return { x: car.x + route.dir * 120, y: laneY };
}

/**
 * Advance one traffic car: follow its lane, slow for whatever is ahead (the game passes a
 * list of blockers as {x, y} points), and turn at some intersections. `rng` must be the
 * world's deterministic generator in screenshot scenes.
 */
export function updateTrafficCar(rng, car, dt, world, blockers, effects) {
  if (!car.route) putOnRoad(rng, car);
  const route = car.route;

  // At an intersection, sometimes turn onto the crossing road.
  const crossings = route.axis === 'v' ? TRAFFIC_YS : ROAD_XS;
  for (const c of crossings) {
    const along = route.axis === 'v' ? car.y : car.x;
    if (Math.abs(along - c) < 7 && Math.abs((route.axis === 'v' ? car.x : car.y) - route.line) < HALF_ROAD_CHECK) {
      if (rng.chance(0.34)) {
        if (route.axis === 'v') {
          const dir = rng.chance(0.5) ? 1 : -1;
          car.route = { axis: 'h', dir, line: c };
          car.angle = dir > 0 ? 0 : Math.PI;
        } else {
          const dir = rng.chance(0.5) ? 1 : -1;
          car.route = { axis: 'v', dir, line: c };
          car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      break;
    }
  }

  // Slow down when something is close ahead.
  let throttle = 0.62;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const b of blockers) {
    const dx = b.x - car.x;
    const dy = b.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (ahead > 0 && ahead < 74 && side < 20) {
      throttle = ahead < 40 ? -0.4 : 0.05;
      break;
    }
  }
  if (car.waitTimer > 0) {
    car.waitTimer -= dt;
    throttle = -0.2;
  }

  const target = trafficTarget(rng, car, crossings);
  let steer = 0;
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  steer = Math.max(-1, Math.min(1, diff * 2.4));
  const speedFactor = Math.max(0.35, 1 - Math.abs(forwardSpeed(car)) / car.spec.topSpeed);
  driveCar(car, dt, throttle * speedFactor + 0.18, steer, false, world, effects);
}

const HALF_ROAD_CHECK = 66;
