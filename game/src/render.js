// The renderer: Port Solana from above — avenues and palms, rooftops and neon, traffic
// and crowds, and Rook in the middle of it. Everything is drawn with plain canvas shapes
// from the world data, in world space under a camera that follows the player.
import { CITY, COAST_Y, COLORS, VIEW, WORLD } from './config.js';
import { ROAD_XS, ROAD_YS, districtAt } from './world.js';
import { currentObjective } from './missions.js';

const HALF_ROAD = CITY.road / 2;

/** How dark the world is at a time of day: 0 in daylight, 1 in deep night. */
export function darknessAt(timeOfDay) {
  if (timeOfDay >= 7 && timeOfDay <= 17.5) return 0;
  if (timeOfDay >= 19.5 || timeOfDay <= 5) return 1;
  if (timeOfDay > 17.5) return (timeOfDay - 17.5) / 2;
  return (7 - timeOfDay) / 2;
}

/** Centre the camera on the player with a little lookahead, clamped to the world. */
export function computeCamera(game) {
  const focus = game.player;
  const lead = game.player.driving ? 0.42 : 0.2;
  const tx = focus.x + (game.player.driving ? game.player.car.vx * lead : 0);
  const ty = focus.y + (game.player.driving ? game.player.car.vy * lead : 0);
  game.camera.x = Math.min(WORLD.width - VIEW.width, Math.max(0, tx - VIEW.width / 2));
  game.camera.y = Math.min(WORLD.height - VIEW.height, Math.max(0, ty - VIEW.height / 2));
}

function visible(game, x, y, pad = 80) {
  const c = game.camera;
  return x > c.x - pad && x < c.x + VIEW.width + pad && y > c.y - pad && y < c.y + VIEW.height + pad;
}

/** Draw the whole world and everything in it (not the HUD: hud.js does that). */
export function drawWorld(ctx, game) {
  computeCamera(game);
  const cam = game.camera;
  ctx.fillStyle = COLORS.sidewalk;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, game);
  drawRoads(ctx, game);
  drawProps(ctx, game);
  drawSkids(ctx, game);
  drawPickups(ctx, game);
  drawObjectiveBeacon(ctx, game);
  for (const car of game.cars) if (visible(game, car.x, car.y, 90)) drawCar(ctx, game, car);
  for (const ped of game.peds) if (visible(game, ped.x, ped.y, 40)) drawPed(ctx, game, ped);
  if (!game.player.driving && !game.player.dead) drawPlayer(ctx, game);
  drawBullets(ctx, game);
  drawParticles(ctx, game);
  ctx.restore();
  drawLighting(ctx, game);
}

/** Land, sea and the blocks between the roads. */
function drawGround(ctx, game) {
  const cam = game.camera;
  // The bay.
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(cam.x, COAST_Y, VIEW.width, WORLD.height - COAST_Y + 800);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(cam.x, COAST_Y + 26, VIEW.width, WORLD.height - COAST_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 7; i += 1) {
    const y = COAST_Y + 60 + i * 42 + Math.sin(game.time * 0.7 + i * 1.7) * 5;
    ctx.moveTo(cam.x + (i % 3) * 260, y);
    ctx.lineTo(cam.x + (i % 3) * 260 + 190, y);
  }
  ctx.stroke();
  // The beach.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(cam.x, COAST_Y - 64, VIEW.width, 64);
  // Piers.
  for (const pier of game.world.piers) {
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = pier.y + 12; y < pier.y + pier.h; y += 24) ctx.fillRect(pier.x, y, pier.w, 3);
  }
  // Block interiors: pavement, parks and lots.
  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const x = col * CITY.block + HALF_ROAD + CITY.sidewalk;
      const y = row * CITY.block + HALF_ROAD + CITY.sidewalk;
      const w = CITY.block - CITY.road - CITY.sidewalk * 2;
      const h = CITY.block - CITY.road - CITY.sidewalk * 2;
      if (!visible(game, x + w / 2, y + h / 2, 460)) continue;
      const district = districtAt(x + w / 2, y + h / 2);
      ctx.fillStyle = district === 'Downtown' || district === 'Cielo District' ? '#a8a294' : '#b3ac9c';
      ctx.fillRect(x, y, w, h);
    }
  }
  for (const park of game.world.parks) {
    ctx.fillStyle = park.kind === 'beach' ? COLORS.sand : COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  for (const lot of game.world.lots) {
    ctx.fillStyle = COLORS.asphaltDark;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(230,228,215,0.4)';
    ctx.lineWidth = 2;
    for (const bay of lot.bays) {
      ctx.strokeRect(bay.x - 20, bay.y - 24, 40, 48);
    }
  }
}

/** Avenues, lane dashes and crosswalks. */
function drawRoads(ctx, game) {
  const cam = game.camera;
  ctx.fillStyle = COLORS.asphalt;
  for (const rx of ROAD_XS) {
    if (rx + HALF_ROAD < cam.x || rx - HALF_ROAD > cam.x + VIEW.width) continue;
    ctx.fillRect(rx - HALF_ROAD, cam.y, CITY.road, VIEW.height);
  }
  for (const ry of ROAD_YS) {
    if (ry >= COAST_Y) continue;
    if (ry + HALF_ROAD < cam.y || ry - HALF_ROAD > cam.y + VIEW.height) continue;
    ctx.fillRect(cam.x, ry - HALF_ROAD, VIEW.width, CITY.road);
  }
  // Lane dashes.
  ctx.fillStyle = 'rgba(232,228,210,0.55)';
  for (const rx of ROAD_XS) {
    if (rx + HALF_ROAD < cam.x || rx - HALF_ROAD > cam.x + VIEW.width) continue;
    for (let y = Math.floor(cam.y / 48) * 48; y < cam.y + VIEW.height; y += 48) {
      if (ROAD_YS.some((ry) => Math.abs(y - ry) < 92)) continue;
      ctx.fillRect(rx - 2, y, 4, 24);
    }
  }
  for (const ry of ROAD_YS) {
    if (ry >= COAST_Y) continue;
    for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + VIEW.width; x += 48) {
      if (ROAD_XS.some((rx) => Math.abs(x - rx) < 92)) continue;
      ctx.fillRect(x, ry - 2, 24, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(217,213,200,0.5)';
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      if (ry >= COAST_Y || !visible(game, rx, ry, 120)) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx + i * 22 - 7, ry - HALF_ROAD - 14, 14, 9);
        ctx.fillRect(rx + i * 22 - 7, ry + HALF_ROAD + 5, 14, 9);
      }
    }
  }
}

/** Palms, trees, lamps, containers, signs — and every building. */
function drawProps(ctx, game) {
  const world = game.world;
  for (const b of world.buildings) {
    if (!visible(game, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const lift = Math.min(26, 4 + b.floors * 1.1);
    ctx.fillStyle = 'rgba(20,20,30,0.20)';
    ctx.fillRect(b.x + lift * 0.55, b.y + lift * 0.8, b.w, b.h);
    ctx.fillStyle = COLORS.buildingWall;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    if (b.kind === 'tower') {
      ctx.fillRect(b.x + b.w * 0.32, b.y + b.h * 0.3, b.w * 0.36, b.h * 0.4);
      ctx.fillRect(b.x + 12, b.y + 12, 16, 10);
      ctx.fillRect(b.x + b.w - 30, b.y + b.h - 22, 16, 10);
    } else if (b.kind === 'house') {
      ctx.fillRect(b.x + b.w / 2 - 2, b.y + 4, 4, b.h - 8);
    } else if (b.kind === 'warehouse') {
      for (let x = b.x + 18; x < b.x + b.w - 10; x += 30) ctx.fillRect(x, b.y + 5, 3, b.h - 10);
    }
    if (b.sign) {
      ctx.fillStyle = 'rgba(12,14,20,0.88)';
      const label = b.sign;
      ctx.font = '700 17px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 20;
      ctx.fillRect(b.x + b.w / 2 - w / 2, b.y - 13, w, 25);
      ctx.fillStyle = '#ffd23e';
      ctx.textAlign = 'center';
      ctx.fillText(label, b.x + b.w / 2, b.y + 5);
      ctx.textAlign = 'left';
    }
  }
  for (const prop of world.props) {
    if (!visible(game, prop.x, prop.y, 60)) continue;
    if (prop.kind === 'palm') {
      ctx.strokeStyle = COLORS.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.lineTo(prop.x + prop.lean * 30, prop.y - 12);
      ctx.stroke();
      ctx.strokeStyle = COLORS.palmLeaf;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + prop.lean;
        ctx.moveTo(prop.x + prop.lean * 30, prop.y - 12);
        ctx.lineTo(prop.x + prop.lean * 30 + Math.cos(a) * 17, prop.y - 12 + Math.sin(a) * 9 + 4);
      }
      ctx.stroke();
    } else if (prop.kind === 'tree') {
      ctx.fillStyle = 'rgba(20,20,30,0.18)';
      ctx.beginPath();
      ctx.arc(prop.x + 4, prop.y + 5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.treeLeaf;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(prop.x - 5, prop.y - 5, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'lamp') {
      ctx.fillStyle = '#565d66';
      ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
    } else if (prop.kind === 'container') {
      ctx.fillStyle = prop.color;
      ctx.fillRect(prop.x, prop.y, 46, 20);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x, prop.y, 46, 20);
    } else if (prop.kind === 'sign') {
      ctx.fillStyle = '#ff5c96';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prop.text, prop.x, prop.y);
      ctx.textAlign = 'left';
    }
  }
}

function drawSkids(ctx, game) {
  ctx.strokeStyle = 'rgba(18,18,22,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (const s of game.effects.skids) {
    if (!visible(game, s.x1, s.y1, 60)) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
}

function drawPickups(ctx, game) {
  for (const pickup of game.pickups) {
    if (!visible(game, pickup.x, pickup.y, 40)) continue;
    const bob = Math.sin(game.time * 3.4 + pickup.phase) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    if (pickup.kind === 'cash') {
      ctx.fillStyle = '#2f9e4f';
      ctx.fillRect(pickup.x - 9, pickup.y - 6 + bob, 18, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pickup.x, pickup.y + 4 + bob);
      ctx.textAlign = 'left';
    } else if (pickup.kind === 'health') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(pickup.x - 9, pickup.y - 9 + bob, 18, 18);
      ctx.fillStyle = '#e84a3c';
      ctx.fillRect(pickup.x - 2.5, pickup.y - 6 + bob, 5, 12);
      ctx.fillRect(pickup.x - 6, pickup.y - 2.5 + bob, 12, 5);
    } else {
      ctx.fillStyle = '#e8862a';
      ctx.fillRect(pickup.x - 9, pickup.y - 6 + bob, 18, 12);
    }
  }
}

/** The gold beacon on the current job, and the standing side-work markers. */
function drawObjectiveBeacon(ctx, game) {
  const objective = currentObjective(game);
  if (objective && visible(game, objective.x, objective.y, 200)) {
    const pulse = 0.55 + Math.sin(game.time * 4.2) * 0.25;
    ctx.fillStyle = `rgba(255,210,62,${0.16 * pulse + 0.08})`;
    ctx.fillRect(objective.x - 16, objective.y - 320, 32, 320);
    ctx.strokeStyle = `rgba(255,210,62,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 26 + Math.sin(game.time * 4.2) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.save();
    ctx.translate(objective.x, objective.y - 44 + Math.sin(game.time * 4.2) * 4);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
  // Side-work chips: taxi at the hotel, the race at the arcade, the shop and the store.
  const chips = [
    { at: game.world.places.hotel, text: 'TAXI', color: '#f2b63a', show: !game.missions.sideJob },
    { at: game.world.places.arcade, text: 'RACE', color: '#e8e8ec', show: !game.missions.sideJob },
    { at: game.world.places.chopshop, text: '$', color: '#2f9e4f', show: true },
    { at: game.world.places.supply, text: '+', color: '#e8862a', show: true },
  ];
  for (const chip of chips) {
    if (!chip.show || !chip.at || !visible(game, chip.at.x, chip.at.y, 120)) continue;
    const bob = Math.sin(game.time * 2.6 + chip.at.x) * 3;
    ctx.font = '700 12px system-ui, sans-serif';
    const w = ctx.measureText(chip.text).width + 14;
    ctx.fillStyle = 'rgba(10,14,22,0.8)';
    ctx.fillRect(chip.at.x - w / 2, chip.at.y - 66 + bob, w, 20);
    ctx.fillStyle = chip.color;
    ctx.textAlign = 'center';
    ctx.fillText(chip.text, chip.at.x, chip.at.y - 52 + bob);
    ctx.textAlign = 'left';
  }
}

/** One car, nose along +x in its own frame. */
export function drawCar(ctx, game, car) {
  const spec = car.spec;
  const L = spec.length;
  const W = spec.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(15,15,22,0.28)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 5, L, W);
  // Wheels.
  ctx.fillStyle = '#14161a';
  const ww = 9;
  const wh = 5;
  ctx.fillRect(-L / 2 + 4, -W / 2 - 2, ww, wh);
  ctx.fillRect(-L / 2 + 4, W / 2 - 3, ww, wh);
  ctx.fillRect(L / 2 - 13, -W / 2 - 2, ww, wh);
  ctx.fillRect(L / 2 - 13, W / 2 - 3, ww, wh);
  // Body.
  ctx.fillStyle = car.dead ? '#3c4046' : car.color;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -W / 2 + 3);
  ctx.lineTo(L / 2 - 7, -W / 2 + 3);
  ctx.lineTo(L / 2, -W / 2 + 8);
  ctx.lineTo(L / 2, W / 2 - 8);
  ctx.lineTo(L / 2 - 7, W / 2 - 3);
  ctx.lineTo(-L / 2, W / 2 - 3);
  ctx.closePath();
  ctx.fill();
  if (car.type === 'copcar') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-L * 0.08, -W / 2 + 2, L * 0.24, W - 4);
    const phase = Math.sin(game.time * 11 + car.lightPhase) > 0;
    ctx.fillStyle = phase ? '#e84a3c' : '#7a1620';
    ctx.fillRect(-4, -W / 2 + 4, 8, 6);
    ctx.fillStyle = phase ? '#2a4a8a' : '#3a7bd9';
    ctx.fillRect(-4, W / 2 - 10, 8, 6);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#141821';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#f2b63a';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.type === 'armored') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-L / 2 + 6, -W / 2 + 4, L - 14, 4);
    ctx.fillRect(-L / 2 + 6, W / 2 - 8, L - 14, 4);
  }
  // Glasshouse.
  ctx.fillStyle = '#1b2634';
  ctx.fillRect(L * 0.16, -W / 2 + 4, 8, W - 8);
  ctx.fillRect(-L * 0.3, -W / 2 + 4, 7, W - 8);
  ctx.fillStyle = 'rgba(10,12,16,0.35)';
  ctx.fillRect(-L * 0.14, -W / 2 + 3, L * 0.3, W - 6);
  ctx.restore();

  // Headlights after dark.
  if (darknessAt(game.timeOfDay) > 0.25 && !car.dead) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(255,240,180,0.10)';
    ctx.beginPath();
    ctx.moveTo(L / 2, -W / 2 + 3);
    ctx.lineTo(L / 2 + 120, -W / 2 - 16);
    ctx.lineTo(L / 2 + 120, W / 2 + 16);
    ctx.lineTo(L / 2, W / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** One pedestrian: a shirt, a head, and somewhere to be. */
export function drawPed(ctx, game, ped) {
  if (ped.state === 'down') {
    ctx.fillStyle = 'rgba(15,15,22,0.2)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 13, ped.y + Math.sin(ped.angle) * 13, 4.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const bob = ped.speed > 4 ? Math.sin(game.time * 11 + ped.id * 2.3) * 1.6 : 0;
  ctx.fillStyle = 'rgba(15,15,22,0.22)';
  ctx.beginPath();
  ctx.arc(ped.x + 2, ped.y + 3, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.pants;
  ctx.beginPath();
  ctx.arc(ped.x - Math.sin(ped.angle) * bob * 0.4, ped.y + Math.cos(ped.angle) * bob * 0.4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 2.5, ped.y + Math.sin(ped.angle) * 2.5, 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (ped.cop) {
    ctx.fillStyle = '#1d2c47';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(ped.x - 1, ped.y - 1, 2, 2);
  }
  if (ped.thug) {
    ctx.strokeStyle = '#e84a3c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Rook: a teal jacket and a white ring, so the eye finds the player at once. */
function drawPlayer(ctx, game) {
  const player = game.player;
  const bob = player.speed > 4 ? Math.sin(player.walkCycle * 2.2) * 1.6 : 0;
  ctx.fillStyle = 'rgba(15,15,22,0.25)';
  ctx.beginPath();
  ctx.arc(player.x + 2, player.y + 3, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 10.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#27303a';
  ctx.beginPath();
  ctx.arc(player.x, player.y + bob * 0.3, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#17b8a6';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.angle) * 3, player.y + Math.sin(player.angle) * 3, 4.6, 0, Math.PI * 2);
  ctx.fill();
  if (player.hasPistol) {
    ctx.strokeStyle = '#14161a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.angle) * 6, player.y + Math.sin(player.angle) * 6);
    ctx.lineTo(player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15);
    ctx.stroke();
  }
}

function drawBullets(ctx, game) {
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of game.bullets) {
    ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

function drawParticles(ctx, game) {
  for (const p of game.effects.particles) {
    const lifeLeft = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, lifeLeft);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.grow ? 1 : lifeLeft * 0.7 + 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const t of game.effects.texts) {
    ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/** The day's light over everything: dusk warmth, night blue, lamp glow. */
function drawLighting(ctx, game) {
  const dark = darknessAt(game.timeOfDay);
  const tod = game.timeOfDay;
  if ((tod > 17 && tod < 20) || (tod > 5 && tod < 7.5)) {
    ctx.fillStyle = 'rgba(255,130,50,0.08)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  if (dark <= 0) return;
  ctx.fillStyle = `rgba(9,14,44,${dark * 0.36})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Lamp glow.
  const cam = game.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const prop of game.world.props) {
    if (prop.kind !== 'lamp' || !visible(game, prop.x, prop.y, 60)) continue;
    ctx.fillStyle = `rgba(255,205,110,${0.10 * dark})`;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,220,150,${0.16 * dark})`;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
