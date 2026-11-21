// Transient visual effects: particles (sparks, smoke, dust), skid marks, muzzle flashes
// and floating text (cash gains, prompts). Pure state and spawning here; render.js draws.

const MAX_SKIDS = 700;
const MAX_PARTICLES = 420;

/** Create the effects store. */
export function createEffects() {
  const particles = [];
  const skids = [];
  const texts = [];

  function spawn(p) {
    if (particles.length < MAX_PARTICLES) particles.push(p);
  }

  return {
    particles,
    skids,
    texts,

    /** A burst of sparks, for collisions and bullet hits on metal. */
    sparks(x, y, n = 8) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 220;
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.28, age: 0, size: 2.2, color: '#ffd76a', gravity: 0, drag: 2 });
      }
    },

    /** A puff of smoke, for damaged engines and burnouts. */
    smoke(x, y, dark = false) {
      spawn({ x, y, vx: (Math.random() - 0.5) * 22, vy: -26 - Math.random() * 22, life: 0.9, age: 0, size: 7 + Math.random() * 7, color: dark ? '#3a3a40' : '#cfd4d8', gravity: -12, drag: 0.6, grow: 12 });
    },

    /** Dust kicked up on sand and grass. */
    dust(x, y) {
      spawn({ x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.5, age: 0, size: 5, color: '#d8c9a0', gravity: 0, drag: 1.4, grow: 8 });
    },

    /** A blood-free impact puff for melee hits (stylised, non-graphic). */
    impact(x, y) {
      for (let i = 0; i < 5; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 90;
        spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.22, age: 0, size: 3, color: '#f2e6c9', gravity: 0, drag: 3 });
      }
    },

    /** Record a skid segment between two points. */
    skid(x1, y1, x2, y2) {
      skids.push({ x1, y1, x2, y2 });
      if (skids.length > MAX_SKIDS) skids.splice(0, skids.length - MAX_SKIDS);
    },

    /** Floating text that rises and fades (cash, damage, prompts). */
    floatText(x, y, text, color = '#ffe27a') {
      texts.push({ x, y, text, color, age: 0, life: 1.4 });
    },

    /** Advance everything by dt seconds. */
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += (p.gravity ?? 0) * dt;
        const drag = Math.max(0, 1 - (p.drag ?? 0) * dt);
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.grow) p.size += p.grow * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.age += dt;
        t.y -= 26 * dt;
        if (t.age >= t.life) texts.splice(i, 1);
      }
    },

    clear() {
      particles.length = 0;
      texts.length = 0;
      skids.length = 0;
    },
  };
}
