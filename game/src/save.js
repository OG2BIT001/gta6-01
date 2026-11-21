// The save: one localStorage record with the story progress, the wallet, the arsenal and
// where Rook woke up. Written when a job ends, a car is stripped, or the player saves
// from the pause menu; read back by Continue on the title screen.
import { SAVE_KEY } from './config.js';

/** Write the game's progress to storage. Safe when storage is unavailable. */
export function saveGame(game) {
  const data = {
    cash: game.player.cash,
    hasPistol: game.player.hasPistol,
    ammo: game.player.ammo,
    storyIndex: game.missions.storyIndex,
    storyComplete: game.missions.storyComplete,
    taxiDone: game.missions.taxiDone,
    chopDone: game.missions.chopDone,
    raceBest: game.missions.raceBest,
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Private windows and file:// quirks: the run simply is not saved.
  }
  game.saveDirty = false;
}

/** Read a saved game, or null when there is none (or it is unreadable). */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Forget the saved game (New Game on the title screen). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to forget, then.
  }
}
