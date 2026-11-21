// All of the game's sound is synthesised with WebAudio: an engine hum, a two-tone siren,
// noise-burst gunfire, interface blips and a slow synthwave loop. No audio files, nothing
// sampled, and everything is silent when there is no AudioContext (headless captures).

/** Create the sound engine. Every method is safe to call before the context unlocks. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  /** A standing engine voice whose pitch follows speed; call with on=false to park it. */
  function engine(speed01, on) {
    if (!on) {
      if (engineNodes) {
        engineNodes.gain.gain.value = 0;
      }
      return;
    }
    if (!ensure()) return;
    if (!engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      osc.connect(filter).connect(gain).connect(master);
      osc.start();
      engineNodes = { osc, gain };
    }
    engineNodes.osc.frequency.value = 55 + speed01 * 165;
    engineNodes.gain.gain.value = 0.05 + speed01 * 0.05;
  }

  /** A standing two-tone siren for as long as a chase is on screen. */
  function siren(on) {
    if (!on) {
      if (sirenNodes) {
        sirenNodes.gain.gain.value = 0;
      }
      return;
    }
    if (!ensure()) return;
    if (!sirenNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.frequency.value = 820;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, gain };
    }
    sirenNodes.gain.gain.value = 0.028;
  }

  /** The music loop: a four-chord synthwave pattern, one bar per second-ish. */
  const CHORDS = [
    [110.0, 220.0, 261.63, 329.63], // Am
    [87.31, 174.61, 220.0, 261.63], // F
    [98.0, 196.0, 246.94, 293.66], // G
    [82.41, 164.81, 207.65, 246.94], // Em
  ];
  function music(on) {
    if (on) {
      if (musicTimer || !ensure()) return;
      musicStep = 0;
      musicTimer = window.setInterval(() => {
        if (!ctx) return;
        const chord = CHORDS[Math.floor(musicStep / 8) % CHORDS.length];
        const stepInBar = musicStep % 8;
        if (stepInBar % 2 === 0) tone(chord[0], 0.42, 'triangle', 0.16);
        tone(chord[1 + (stepInBar % 3)], 0.22, 'sawtooth', 0.045);
        if (stepInBar === 0) tone(chord[0] / 2, 0.9, 'sine', 0.12);
        musicStep += 1;
      }, 240);
    } else if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock: ensure,
    engine,
    siren,
    music,
    shot() {
      noise(0.14, 0.5, 2600);
      tone(140, 0.08, 'square', 0.2, 60);
    },
    punch() {
      noise(0.07, 0.3, 700);
    },
    crash(intensity = 1) {
      noise(0.22, 0.3 * intensity, 500);
      tone(70, 0.18, 'sine', 0.3 * intensity, 40);
    },
    pickup() {
      tone(880, 0.09, 'square', 0.14);
      tone(1320, 0.12, 'square', 0.12, null, 0.07);
    },
    cash() {
      tone(1046, 0.08, 'square', 0.13);
      tone(1568, 0.14, 'square', 0.13, null, 0.08);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.12, null, i * 0.09));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.2, 'square', 0.12, null, i * 0.11));
    },
    ui() {
      tone(660, 0.06, 'square', 0.1);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
