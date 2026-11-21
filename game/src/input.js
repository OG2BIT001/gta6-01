// Keyboard and mouse input. The game reads held keys and one-shot actions from here;
// screenshot scenes can replace the player with a script through setScript, which is how
// the deterministic ?shot= frames are steered.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_BUY = 8;

/** Create the input tracker bound to a canvas (for mouse position) and the window. */
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let actions = 0;
  let script = null;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  const onKeyDown = (event) => {
    if (!event.repeat) {
      pressed.add(event.code);
      if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
      if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
      if (event.code === 'KeyE') actions |= ACTION_INTERACT;
      if (event.code === 'KeyF') actions |= ACTION_BUY;
    }
    held.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  };
  const onKeyUp = (event) => held.delete(event.code);
  const onMouseMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  };
  const onMouseDown = () => {
    mouse.down = true;
    mouse.clicked = true;
    actions |= ACTION_CONFIRM;
  };
  const onMouseUp = () => {
    mouse.down = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  /** What the script (or the player) wants held this tick: named boolean controls. */
  function controls(time) {
    if (script) return script(time);
    return {
      up: held.has('KeyW') || held.has('ArrowUp'),
      down: held.has('KeyS') || held.has('ArrowDown'),
      left: held.has('KeyA') || held.has('ArrowLeft'),
      right: held.has('KeyD') || held.has('ArrowRight'),
      run: held.has('ShiftLeft') || held.has('ShiftRight'),
      interact: held.has('KeyE'),
      buy: held.has('KeyF'),
      shoot: mouse.down,
    };
  }

  return {
    mouse,
    controls,
    /** True while a keyboard code is held. */
    down: (code) => held.has(code),
    /** True only on the tick a key was first pressed. */
    pressed: (code) => pressed.has(code),
    /** Consume and return the one-shot actions since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Consume the mouse click edge. */
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
    /** End-of-tick tidy-up: clear per-tick pressed edges. */
    endTick() {
      pressed.clear();
    },
    /** Replace the player with a steering script (time in seconds) or clear it with null. */
    setScript(fn) {
      script = fn;
    },
  };
}
