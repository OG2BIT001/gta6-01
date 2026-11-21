// Missions and side work. Mara Voss, a fixer working out of a Portside garage, feeds Rook
// a five-job story: a stolen coupe, a hot package, three debtors, an armored van, and one
// last neon goodbye at the seaplane dock. Between jobs the city pays for taxi fares,
// chop-shop deliveries and a checkpoint race. All names and story are this game's own.
import { makeCar } from './cars.js';
import { makePed } from './peds.js';

/** A curb point on the street north of a block: where cars and people wait. */
function curb(col, row) {
  return { x: col * 600 + 300, y: row * 600 + 96 };
}

/** The story, in order. Each stage: a kind, a target, and the line the HUD shows. */
export const STORY = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: 300,
    brief: 'Mara: A buyer wants the red coupe parked up in Palms Heights. Bring it to my garage. Clean, Rook.',
    stages: [
      { kind: 'goto', at: 'garage', text: 'Meet Mara at her garage' },
      { kind: 'steal', at: 'coupe', text: 'Steal the coupe in Palms Heights' },
      { kind: 'deliver', at: 'garage', text: "Deliver the coupe to Mara's garage" },
    ],
  },
  {
    id: 'hot-package',
    title: 'Hot Package',
    reward: 450,
    brief: 'Mara: Pick up a package at the Neon Mile Arcade. Do not open it. The marina, fast — it gets loud.',
    stages: [
      { kind: 'goto', at: 'arcade', text: 'Pick up the package at the arcade' },
      { kind: 'deliverFree', at: 'marina', text: 'Get the package to Marina Verde Docks', timer: 150 },
    ],
  },
  {
    id: 'debt-run',
    title: 'Debt Run',
    reward: 600,
    brief: 'Mara: Three debtors, three neighborhoods, one afternoon. They will argue. Argue back.',
    stages: [
      { kind: 'goto', at: 'debt1', text: 'Visit debtor one: Mercado Viejo' },
      { kind: 'fight', at: 'debt1', text: 'Settle the debt in Mercado Viejo' },
      { kind: 'goto', at: 'debt2', text: 'Visit debtor two: Little Cay' },
      { kind: 'fight', at: 'debt2', text: 'Settle the debt in Little Cay' },
      { kind: 'goto', at: 'debt3', text: 'Visit debtor three: Cielo District' },
      { kind: 'fight', at: 'debt3', text: 'Settle the debt in the Cielo District' },
    ],
  },
  {
    id: 'harbor-heat',
    title: 'Harbor Heat',
    reward: 900,
    brief: 'Mara: A Bulwark armored van sits at the port terminal. It is missed already. Chop shop. Go.',
    stages: [
      { kind: 'goto', at: 'port', text: 'Go to Port Solana Terminal' },
      { kind: 'steal', at: 'van', text: 'Steal the armored van' },
      { kind: 'deliver', at: 'chopshop', text: 'Deliver the van to the chop shop' },
    ],
  },
  {
    id: 'neon-goodbye',
    title: 'Neon Goodbye',
    reward: 2000,
    brief: 'Mara: Last job, Rook. Pick me up at Hotel Solana and get me to the seaplane dock. Whatever it takes.',
    stages: [
      { kind: 'goto', at: 'hotel', text: 'Pick up Mara at Hotel Solana' },
      { kind: 'deliverFree', at: 'airport', text: 'Get Mara to the Cay Seaplane Dock' },
      { kind: 'holdout', at: 'airport', text: 'Hold the dock while the seaplane warms up', timer: 12 },
    ],
  },
];

/** Concrete spots for the named stage targets that are not PLACES. */
const SPOTS = {
  coupe: () => curb(1, 0),
  van: () => curb(7, 2),
  debt1: () => curb(1, 1),
  debt2: () => curb(4, 3),
  debt3: () => curb(5, 1),
};

/** Create the mission-system state. */
export function createMissions() {
  return {
    storyIndex: 0,
    active: null,
    sideJob: null,
    storyComplete: false,
    raceBest: 0,
    taxiDone: 0,
    chopDone: 0,
  };
}

/** Where a stage target sits: a place, a spot, or a mission entity. */
function stageTarget(game, mission, stage) {
  if ((stage.at === 'coupe' || stage.at === 'van') && stage.kind === 'steal') {
    return mission.targetCar ? { x: mission.targetCar.x, y: mission.targetCar.y } : SPOTS[stage.at]();
  }
  if (SPOTS[stage.at]) return SPOTS[stage.at]();
  return game.world.places[stage.at] ?? game.world.places.garage;
}

/** Begin the next story mission if none is running; returns true when one started. */
export function startStoryMission(game) {
  const missions = game.missions;
  if (missions.active || missions.storyIndex >= STORY.length) return false;
  const def = STORY[missions.storyIndex];
  const mission = {
    def,
    stage: 0,
    targetCar: null,
    thugs: [],
    timer: null,
    holdTimer: 0,
    startedAt: game.time,
  };
  missions.active = mission;
  enterStage(game, mission, def.stages[0]);
  game.notify(def.title, def.brief);
  game.audio.mission();
  return true;
}

/** Spawn whatever a stage needs when it becomes current. */
function enterStage(game, mission, stage) {
  mission.timer = stage.timer ?? null;
  mission.holdTimer = stage.kind === 'holdout' ? stage.timer : 0;
  if (stage.kind === 'steal' && stage.at === 'coupe') {
    const spot = SPOTS.coupe();
    mission.targetCar = makeCar(game.rng, 'coupe', spot.x, spot.y, 0, 'parked');
    mission.targetCar.color = '#d94f3d';
    game.cars.push(mission.targetCar);
  }
  if (stage.kind === 'steal' && stage.at === 'van') {
    const spot = SPOTS.van();
    mission.targetCar = makeCar(game.rng, 'armored', spot.x, spot.y, 0, 'parked');
    game.cars.push(mission.targetCar);
  }
  if (stage.kind === 'fight') {
    const spot = SPOTS[stage.at]();
    mission.thugs = [];
    for (let i = 0; i < 2; i += 1) {
      const thug = makePed(game.rng, spot.x + (i === 0 ? -26 : 26), spot.y + 18);
      thug.thug = true;
      thug.state = 'chase';
      thug.health = 80;
      thug.id = 5000 + mission.stage * 10 + i;
      game.peds.push(thug);
      mission.thugs.push(thug);
    }
  }
  if (stage.kind === 'deliverFree' && mission.def.id === 'neon-goodbye') {
    game.police.heat = Math.max(game.police.heat, 300);
  }
}

/** Pay out and close a finished story mission. */
function completeMission(game, mission) {
  const player = game.player;
  player.cash += mission.def.reward;
  game.effects.floatText(player.x, player.y - 30, `+$${mission.def.reward}`, '#7be382');
  game.audio.cash();
  game.notify('Job done', `${mission.def.title} — $${mission.def.reward} paid.`);
  if (mission.def.id === 'debt-run' && !player.hasPistol) {
    player.hasPistol = true;
    player.ammo += 48;
    game.notify('Mara', 'You earned this. A pistol, and shells. Try not to need it.');
  }
  if (mission.def.id === 'neon-goodbye') {
    game.missions.storyComplete = true;
    game.notify('Port Solana is yours', 'The story is done. The city, the work and the heat go on.');
  }
  game.missions.storyIndex += 1;
  game.missions.active = null;
  game.saveDirty = true;
}

/** Fail the running mission (a timer ran out); it can be started again. */
function failMission(game, mission) {
  game.notify('Job failed', `${mission.def.title} — Mara will call again.`);
  game.audio.fail();
  if (mission.targetCar && mission.targetCar.driver === 'parked') {
    game.cars = game.cars.filter((c) => c !== mission.targetCar);
  }
  game.missions.active = null;
}

/** Is the stage's condition met? */
function stageDone(game, mission, stage) {
  const player = game.player;
  const target = stageTarget(game, mission, stage);
  const dist = Math.hypot(player.x - target.x, player.y - target.y);
  switch (stage.kind) {
    case 'goto':
      return dist < 64;
    case 'steal':
      return mission.targetCar && mission.targetCar.driver === 'player';
    case 'deliver':
      return mission.targetCar && mission.targetCar.driver === 'player' && dist < 96;
    case 'deliverFree':
      return dist < 84;
    case 'fight':
      return mission.thugs.length > 0 && mission.thugs.every((t) => t.state === 'down');
    case 'holdout':
      return dist < 110 && mission.holdTimer <= 0;
    default:
      return false;
  }
}

/** Advance story missions, timers and thugs one tick. */
export function updateMissions(game, dt) {
  const missions = game.missions;
  const mission = missions.active;
  if (!mission) return;
  const stage = mission.def.stages[mission.stage];
  if (!stage) {
    completeMission(game, mission);
    return;
  }

  if (mission.timer !== null && stage.kind !== 'holdout') {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      failMission(game, mission);
      return;
    }
  }
  if (stage.kind === 'holdout') {
    const target = stageTarget(game, mission, stage);
    if (Math.hypot(game.player.x - target.x, game.player.y - target.y) < 110) {
      mission.holdTimer -= dt;
    }
  }

  // Debtors' muscle closes in and swings.
  if (stage.kind === 'fight') {
    for (const thug of mission.thugs) {
      if (thug.state === 'down') continue;
      const player = game.player;
      const dist = Math.hypot(player.x - thug.x, player.y - thug.y);
      thug.angle = Math.atan2(player.y - thug.y, player.x - thug.x);
      thug.punchCooldown -= dt;
      if (dist > 26) {
        thug.x += Math.cos(thug.angle) * 168 * dt;
        thug.y += Math.sin(thug.angle) * 168 * dt;
        thug.speed = 168;
      } else {
        thug.speed = 0;
        if (thug.punchCooldown <= 0 && !player.driving) {
          thug.punchCooldown = game.rng.range(0.7, 1.2);
          game.damagePlayer(6);
          game.effects.impact(player.x, player.y);
          game.audio.punch();
        }
      }
    }
  }

  if (stageDone(game, mission, stage)) {
    if (stage.kind === 'goto' && stage.at === 'arcade') {
      game.events.push({ kind: 'alarm', x: game.player.x, y: game.player.y, byPlayer: true });
      game.notify('It is heavier than it looks', 'Move. Now.');
    }
    if (stage.kind === 'steal' && stage.at === 'van') {
      game.police.heat = Math.max(game.police.heat, 170);
      game.notify('The port notices', 'Every PSPD radio just said your name.');
    }
    mission.stage += 1;
    if (mission.stage >= mission.def.stages.length) completeMission(game, mission);
    else enterStage(game, mission, mission.def.stages[mission.stage]);
  }
}

/** The current objective for the HUD: position, label and banner line, or null. */
export function currentObjective(game) {
  const missions = game.missions;
  if (missions.active) {
    const mission = missions.active;
    const stage = mission.def.stages[mission.stage];
    if (!stage) return null;
    const target = stageTarget(game, mission, stage);
    let extra = '';
    if (mission.timer !== null && stage.kind !== 'holdout') extra = ` — ${Math.max(0, Math.ceil(mission.timer))}s`;
    if (stage.kind === 'holdout') extra = ` — ${Math.max(0, Math.ceil(mission.holdTimer))}s`;
    return { x: target.x, y: target.y, label: stage.text, banner: `${mission.def.title}: ${stage.text}${extra}`, mission: true };
  }
  if (missions.sideJob) return sideObjective(game);
  if (missions.storyIndex < STORY.length) {
    const def = STORY[missions.storyIndex];
    const first = def.stages[0];
    const target = stageTarget(game, { targetCar: null, thugs: [] }, first);
    return { x: target.x, y: target.y, label: `New job: ${def.title}`, banner: `Call Mara — ${def.title}`, mission: false };
  }
  return null;
}

// ---------------------------------------------------------------- side work

/** Offer or advance side work; called when the player idles near a side marker. */
export function sideObjective(game) {
  const job = game.missions.sideJob;
  if (!job) return null;
  if (job.kind === 'taxi') {
    return job.phase === 'pickup'
      ? { x: job.ped.x, y: job.ped.y, label: 'Pick up the fare', banner: 'Taxi: pick up the fare', mission: false }
      : { x: job.dest.x, y: job.dest.y, label: 'Drop off the fare', banner: `Taxi: drop off — $${job.fare} on the meter`, mission: false };
  }
  if (job.kind === 'race') {
    const point = job.points[job.next];
    return point
      ? { x: point.x, y: point.y, label: `Checkpoint ${job.next + 1} of ${job.points.length}`, banner: `Race: ${Math.max(0, job.timeLeft).toFixed(0)}s left`, mission: false }
      : null;
  }
  return null;
}

/** Start a taxi job: a fare waits at a random curb. */
export function startTaxi(game) {
  const spots = [curb(2, 0), curb(3, 3), curb(5, 4), curb(0, 2), curb(6, 0), curb(4, 2)];
  const from = spots[game.rng.int(0, spots.length - 1)];
  let dest = spots[game.rng.int(0, spots.length - 1)];
  if (dest === from) dest = spots[(spots.indexOf(from) + 2) % spots.length];
  const ped = makePed(game.rng, from.x, from.y);
  ped.id = 9500;
  ped.state = 'hold';
  game.peds.push(ped);
  const fare = 46 + Math.round(Math.hypot(dest.x - from.x, dest.y - from.y) / 22);
  game.missions.sideJob = { kind: 'taxi', phase: 'pickup', ped, dest, fare, startedAt: game.time };
  game.notify('Taxi', `A fare is waiting. $${fare} across town.`);
}

/** Start the checkpoint race from the Neon Mile. */
export function startRace(game) {
  const points = [curb(2, 2), curb(5, 1), curb(6, 4), curb(1, 4), curb(3, 0)];
  game.missions.sideJob = { kind: 'race', points, next: 0, timeLeft: 150, par: 150 };
  game.notify('Street race', 'Five checkpoints, 150 seconds. Go.');
}

/** Advance side jobs one tick: fares, the race clock, and the chop shop's standing offer. */
export function updateSideJobs(game, dt) {
  const missions = game.missions;
  const job = missions.sideJob;
  const player = game.player;

  // The chop shop buys any stolen car driven onto its apron, job or no job.
  const chop = game.world.places.chopshop;
  const missionCar = missions.active ? missions.active.targetCar : null;
  if (player.driving && player.car.stolen && player.car !== missionCar && chop && Math.hypot(player.x - chop.x, player.y - chop.y) < 92) {
    const value = Math.round(player.car.spec.value * (0.35 + (player.car.health / 100) * 0.65));
    const sold = player.car;
    game.cars = game.cars.filter((c) => c !== sold);
    player.driving = false;
    player.car = null;
    player.x = chop.x;
    player.y = chop.y + 30;
    player.cash += value;
    missions.chopDone += 1;
    game.effects.floatText(player.x, player.y - 24, `+$${value}`, '#7be382');
    game.audio.cash();
    game.notify('Chop shop', `${sold.spec.name} stripped. $${value}. Pleasure doing business.`);
    game.saveDirty = true;
  }

  if (!job) return;
  if (job.kind === 'taxi') {
    if (job.phase === 'pickup') {
      if (player.driving && Math.hypot(player.x - job.ped.x, player.y - job.ped.y) < 58) {
        game.peds = game.peds.filter((p) => p !== job.ped);
        job.phase = 'dropoff';
        game.audio.ui();
      } else if (!player.driving && Math.hypot(player.x - job.ped.x, player.y - job.ped.y) < 30) {
        game.notify('Taxi', 'They need a car, Rook. Bring one.');
        job.phase = 'pickupWarned';
      }
    } else if (job.phase === 'pickupWarned') {
      // Re-arm the warning only once the player has a car or has walked away.
      if (player.driving || Math.hypot(player.x - job.ped.x, player.y - job.ped.y) > 60) job.phase = 'pickup';
    } else if (job.phase === 'dropoff') {
      if (player.driving && Math.hypot(player.x - job.dest.x, player.y - job.dest.y) < 64) {
        const fast = game.time - job.startedAt < 95;
        const tip = fast ? Math.round(job.fare * 0.4) : 0;
        player.cash += job.fare + tip;
        missions.taxiDone += 1;
        game.effects.floatText(player.x, player.y - 24, `+$${job.fare + tip}`, '#7be382');
        game.audio.cash();
        game.notify('Taxi', tip ? `Fare $${job.fare} plus a $${tip} tip for the hurry.` : `Fare paid: $${job.fare}.`);
        missions.sideJob = null;
        game.saveDirty = true;
      }
    }
    return;
  }
  if (job.kind === 'race') {
    job.timeLeft -= dt;
    const point = job.points[job.next];
    if (point && Math.hypot(player.x - point.x, player.y - point.y) < 84) {
      job.next += 1;
      game.audio.pickup();
      if (job.next >= job.points.length) {
        const used = job.par - job.timeLeft;
        const prize = 350;
        player.cash += prize;
        if (!missions.raceBest || used < missions.raceBest) missions.raceBest = used;
        game.notify('Race won', `${used.toFixed(1)}s — $${prize} and the Neon Mile remembers.`);
        game.audio.cash();
        missions.sideJob = null;
        game.saveDirty = true;
        return;
      }
    }
    if (job.timeLeft <= 0) {
      game.notify('Race lost', 'The checkpoints go dark. The entry fee was your pride.');
      game.audio.fail();
      missions.sideJob = null;
    }
  }
}

/** Whether a story mission can be started by reaching its first marker right now. */
export function missionStartTarget(game) {
  const missions = game.missions;
  if (missions.active || missions.storyIndex >= STORY.length) return null;
  const def = STORY[missions.storyIndex];
  return stageTarget(game, { targetCar: null, thugs: [] }, def.stages[0]);
}
