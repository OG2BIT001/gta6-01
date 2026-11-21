// The screens over the world: title, pause, help, wasted and busted. The world keeps
// breathing behind the title — traffic rolls through Port Solana while Rook decides.
import { VIEW } from './config.js';
import { wrapText } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_OVER = 'over';

function shade(ctx, alpha) {
  ctx.fillStyle = `rgba(8,10,18,${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function centreText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW.width / 2, y);
  ctx.textAlign = 'left';
}

/** The title screen: the game's name over the living city. */
export function drawTitle(ctx, game) {
  shade(ctx, 0.42);
  // A neon sign glow behind the name.
  ctx.fillStyle = 'rgba(232,58,122,0.16)';
  ctx.fillRect(VIEW.width / 2 - 330, 118, 660, 150);
  centreText(ctx, 'PORT SOLANA', 208, '800 92px system-ui, sans-serif', '#ffffff');
  centreText(ctx, 'N E O N   H E A T', 262, '700 34px system-ui, sans-serif', '#ff5c96');
  centreText(ctx, 'An open-world crime story in a city of palms, neon and other people\u2019s cars.', 306, '500 17px system-ui, sans-serif', '#dfe6ee');

  const items = game.titleItems;
  let y = 386;
  for (let i = 0; i < items.length; i += 1) {
    const selected = i === game.menuIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(255,210,62,0.92)';
      ctx.fillRect(VIEW.width / 2 - 150, y - 26, 300, 38);
    }
    centreText(ctx, items[i], y, '700 22px system-ui, sans-serif', selected ? '#141821' : '#e8ecf0');
    y += 52;
  }
  centreText(ctx, 'WASD drive & walk · E enter/exit car · Mouse aim · Shift run/handbrake · P pause · M mute', 640, '500 14px system-ui, sans-serif', '#aeb8c4');
  centreText(ctx, 'A five-job story from fixer Mara Voss — then the city is yours.', 668, '500 14px system-ui, sans-serif', '#aeb8c4');
}

/** The pause menu. */
export function drawPaused(ctx, game) {
  shade(ctx, 0.55);
  centreText(ctx, 'PAUSED', 190, '800 54px system-ui, sans-serif', '#ffffff');
  const items = game.pauseItems;
  let y = 300;
  for (let i = 0; i < items.length; i += 1) {
    const selected = i === game.pauseIndex;
    if (selected) {
      ctx.fillStyle = 'rgba(255,210,62,0.92)';
      ctx.fillRect(VIEW.width / 2 - 150, y - 25, 300, 36);
    }
    centreText(ctx, items[i], y, '700 21px system-ui, sans-serif', selected ? '#141821' : '#e8ecf0');
    y += 50;
  }
  const stats = `Cash $${game.player.cash.toLocaleString('en-US')} · Jobs for Mara: ${game.missions.storyIndex} of 5 · Taxi fares: ${game.missions.taxiDone} · Cars stripped: ${game.missions.chopDone}`;
  centreText(ctx, stats, 610, '500 15px system-ui, sans-serif', '#aeb8c4');
}

/** The help screen: every control and every way to earn. */
export function drawHelp(ctx, game) {
  shade(ctx, 0.78);
  centreText(ctx, 'HOW TO PLAY', 92, '800 40px system-ui, sans-serif', '#ffffff');
  const lines = [
    ['Move / drive', 'W A S D or arrow keys'],
    ['Run / handbrake', 'Shift'],
    ['Enter / exit a car', 'E — any car. Stealing one is a crime, if anyone sees'],
    ['Fight', 'Click to punch. With a pistol: aim with the mouse, click to shoot'],
    ['Buy a pistol & ammo', 'Solana Supply (Cielo District) — walk up and press F'],
    ['Pause', 'P or Esc · M mutes the sound'],
    ['', ''],
    ['THE WORK', ''],
    ['Story jobs', 'Follow the gold marker. Mara Voss pays for five jobs, then free roam'],
    ['Taxi fares', 'Yellow TAXI marker at Hotel Solana — press F to take a fare'],
    ['Chop shop', 'Steal any car and deliver it to the Portside Chop Shop apron'],
    ['Street race', 'Checkered marker at the Neon Mile Arcade — press F to enter'],
    ['The law', 'Stars rise with witnessed crime and drain when no officer sees you'],
    ['', 'Get caught standing still by an officer, or die, and it costs you. Stay neon.'],
  ];
  let y = 150;
  ctx.textAlign = 'left';
  for (const [left, right] of lines) {
    if (!right && left) {
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(left, 300, y);
    } else if (left) {
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillStyle = '#e8ecf0';
      ctx.fillText(left, 300, y);
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillStyle = '#b9c4d0';
      ctx.fillText(right, 520, y);
    } else {
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillStyle = '#b9c4d0';
      wrapText(ctx, right, 300, y, 680, 20, 2);
    }
    y += 30;
  }
  centreText(ctx, 'Press P or Esc to go back', 668, '600 15px system-ui, sans-serif', '#ffd23e');
  void game;
}

/** The wasted screen: Rook wakes up at Solana General, lighter in the wallet. */
export function drawWasted(ctx, game) {
  ctx.fillStyle = 'rgba(60,6,6,0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centreText(ctx, 'WASTED', 320, '800 96px system-ui, sans-serif', '#e84a3c');
  centreText(ctx, 'Solana General patches Rook up. The bill is $100, or whatever is in the wallet.', 380, '500 18px system-ui, sans-serif', '#e8ecf0');
  centreText(ctx, 'Press Enter to wake up', 440, '700 20px system-ui, sans-serif', '#ffd23e');
  void game;
}

/** The busted screen: a fine, the car impounded, the record longer. */
export function drawBusted(ctx, game) {
  ctx.fillStyle = 'rgba(6,16,60,0.5)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centreText(ctx, 'BUSTED', 320, '800 96px system-ui, sans-serif', '#5a8ae8');
  centreText(ctx, 'The PSPD lets Rook walk — for a $150 fine, the pistol, and the day.', 380, '500 18px system-ui, sans-serif', '#e8ecf0');
  centreText(ctx, 'Press Enter to walk out', 440, '700 20px system-ui, sans-serif', '#ffd23e');
  void game;
}
