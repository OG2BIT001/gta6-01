// The HUD: wallet and health, the wanted stars, the mission banner, phone toasts, the
// arrest meter, and the minimap — the whole city at a glance, with the player, the law
// and the job on it.
import { COAST_Y, VIEW, WORLD } from './config.js';
import { ROAD_XS, ROAD_YS, districtAt } from './world.js';
import { currentObjective } from './missions.js';

const MAP = { x: VIEW.width - 236, y: VIEW.height - 186, w: 216, h: 162 };

/** Project a world point onto the minimap. */
function mapPoint(x, y) {
  return {
    x: MAP.x + (x / WORLD.width) * MAP.w,
    y: MAP.y + (y / WORLD.height) * MAP.h,
  };
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd23e';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,20,30,0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10,14,22,${alpha})`;
  ctx.fillRect(x, y, w, h);
}

/** Draw everything that floats above the world during play. */
export function drawHUD(ctx, game) {
  const player = game.player;
  const police = game.police;

  // Wallet and day clock, top left.
  panel(ctx, 14, 14, 208, 58);
  ctx.fillStyle = '#7be382';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 26, 44);
  ctx.fillStyle = '#cfd6de';
  ctx.font = '500 13px system-ui, sans-serif';
  const hour = Math.floor(game.timeOfDay);
  const minute = Math.floor((game.timeOfDay - hour) * 60);
  ctx.fillText(`${districtAt(player.x, player.y)}  ·  ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, 26, 64);

  // Wanted stars, top right; they flash while the law has eyes on Rook.
  if (police.stars > 0) {
    panel(ctx, VIEW.width - 232, 14, 218, 58);
    const flash = police.seenAgo < 1.5 && Math.floor(game.time * 6) % 2 === 0;
    for (let i = 0; i < 5; i += 1) {
      const filled = i < police.stars;
      if (filled && flash) {
        ctx.fillStyle = 'rgba(255,80,80,0.25)';
        ctx.fillRect(VIEW.width - 222 + i * 42, 22, 40, 40);
      }
      star(ctx, VIEW.width - 202 + i * 42, 42, 15, filled);
    }
    if (police.seenAgo > 4) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOSING THEM…', VIEW.width - 123, 66);
      ctx.textAlign = 'left';
    }
  }

  // The job banner, top centre.
  const objective = currentObjective(game);
  if (objective) {
    const dist = Math.hypot(player.x - objective.x, player.y - objective.y);
    const text = objective.banner;
    ctx.font = '600 16px system-ui, sans-serif';
    const w = Math.min(620, ctx.measureText(text).width + 90);
    panel(ctx, (VIEW.width - w) / 2, 14, w, 40, 0.6);
    ctx.fillStyle = objective.mission ? '#ffd23e' : '#9fd8ff';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`${Math.round(dist / 10)}m`, VIEW.width / 2 + w / 2 - 26, 40);
    ctx.textAlign = 'left';
  }

  // Health and hardware, bottom left.
  panel(ctx, 14, VIEW.height - 74, 250, 60);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(26, VIEW.height - 62, 226, 14);
  ctx.fillStyle = player.health > 30 ? '#53c95e' : '#e84a3c';
  ctx.fillRect(26, VIEW.height - 62, 226 * (player.health / 100), 14);
  ctx.fillStyle = '#e8ecf0';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('HEALTH', 26, VIEW.height - 52 + 26);
  if (player.hasPistol) {
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'right';
    ctx.fillText(`PISTOL · ${player.ammo}`, 252, VIEW.height - 52 + 26);
    ctx.textAlign = 'left';
  }

  // The arrest meter, centre bottom, while the law has hands on Rook.
  if (police.bustTimer > 0.05 && !player.busted) {
    const frac = Math.min(1, police.bustTimer / 1.7);
    panel(ctx, VIEW.width / 2 - 130, VIEW.height - 120, 260, 34, 0.7);
    ctx.fillStyle = '#e84a3c';
    ctx.fillRect(VIEW.width / 2 - 118, VIEW.height - 108, 236 * frac, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', VIEW.width / 2, VIEW.height - 92);
    ctx.textAlign = 'left';
  }

  // A one-line prompt when there is something to do where Rook stands.
  if (game.promptText) {
    ctx.font = '600 16px system-ui, sans-serif';
    const w = ctx.measureText(game.promptText).width + 36;
    panel(ctx, (VIEW.width - w) / 2, VIEW.height - 108, w, 34, 0.65);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(game.promptText, VIEW.width / 2, VIEW.height - 86);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, game, objective);
  drawToasts(ctx, game);

  // Hurt vignette.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,30,30,${player.hurtFlash * 0.55})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

/** The minimap: roads, water, the law, the job and Rook. */
function drawMinimap(ctx, game, objective) {
  const player = game.player;
  ctx.fillStyle = 'rgba(12,18,26,0.82)';
  ctx.fillRect(MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 26);
  // Land and water.
  ctx.fillStyle = '#39543e';
  ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
  ctx.fillStyle = '#2e7fa8';
  const wy = MAP.y + (COAST_Y / WORLD.height) * MAP.h;
  ctx.fillRect(MAP.x, wy, MAP.w, MAP.y + MAP.h - wy);
  // Roads.
  ctx.strokeStyle = 'rgba(220,220,210,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const rx of ROAD_XS) {
    const p = mapPoint(rx, 0);
    ctx.moveTo(p.x, MAP.y);
    ctx.lineTo(p.x, wy);
  }
  for (const ry of ROAD_YS) {
    const p = mapPoint(0, ry);
    ctx.moveTo(MAP.x, p.y);
    ctx.lineTo(MAP.x + MAP.w, p.y);
  }
  ctx.stroke();
  // The job.
  if (objective) {
    const p = mapPoint(objective.x, objective.y);
    const pulse = 3.5 + Math.sin(game.time * 5) * 1.2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // The law.
  for (const car of game.cars) {
    if (car.driver !== 'cop') continue;
    const p = mapPoint(car.x, car.y);
    ctx.fillStyle = Math.floor(game.time * 4) % 2 === 0 ? '#3a7bd9' : '#e84a3c';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  // Rook.
  const p = mapPoint(player.x, player.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3.6);
  ctx.lineTo(-4, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#cfd6de';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('PORT SOLANA', MAP.x + 2, MAP.y + MAP.h + 15);
}

/** Phone toasts from Mara and the city, stacked under the wallet. */
function drawToasts(ctx, game) {
  let y = 84;
  for (const toast of game.toasts) {
    const alpha = toast.age > toast.life - 0.6 ? Math.max(0, (toast.life - toast.age) / 0.6) : 1;
    ctx.globalAlpha = alpha;
    panel(ctx, 14, y, 330, 52, 0.62);
    ctx.fillStyle = '#ffd23e';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(toast.title.toUpperCase(), 26, y + 20);
    ctx.fillStyle = '#e8ecf0';
    ctx.font = '500 12.5px system-ui, sans-serif';
    wrapText(ctx, toast.body, 26, y + 38, 306, 14, 2);
    ctx.globalAlpha = 1;
    y += 60;
  }
}

/** Draw up to `maxLines` lines of wrapped text. */
export function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = trial;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}
