// Original synthesized sound cues (Web Audio). No external or official audio files are used.
let ctx: AudioContext | null = null;
let enabled = (() => {
  try {
    return localStorage.getItem('tkt:sound') !== 'off';
  } catch {
    return true;
  }
})();

export function soundEnabled() {
  return enabled;
}
export function setSoundEnabled(v: boolean) {
  enabled = v;
  try {
    localStorage.setItem('tkt:sound', v ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0, slide = 0) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  card: () => tone(660, 0.08, 'triangle', 0.05),
  draw: () => tone(520, 0.06, 'sine', 0.035),
  damage: () => {
    tone(140, 0.25, 'sawtooth', 0.06, 0, -60);
    tone(90, 0.3, 'sine', 0.08);
  },
  heal: () => {
    tone(660, 0.18, 'sine', 0.05);
    tone(990, 0.22, 'sine', 0.04, 0.08);
  },
  turn: () => {
    tone(220, 0.6, 'sine', 0.05);
    tone(330, 0.6, 'sine', 0.03, 0.02);
  },
  yourTurn: () => {
    tone(392, 0.15, 'triangle', 0.06);
    tone(523, 0.25, 'triangle', 0.06, 0.12);
  },
  death: () => tone(110, 1.0, 'sine', 0.09, 0, -50),
  judge: () => tone(880, 0.12, 'triangle', 0.04),
  skill: () => {
    tone(740, 0.1, 'triangle', 0.04);
    tone(988, 0.14, 'triangle', 0.04, 0.07);
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.05, i * 0.12)),
};
