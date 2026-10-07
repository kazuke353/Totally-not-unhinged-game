// Procedural soundtrack in the style of late-90s industrial/electronic game
// music. Each track is rendered once with an OfflineAudioContext.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx, dur = 1) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function reverb(ctx, seconds = 2.2, decay = 2.5) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const conv = ctx.createConvolver();
  conv.buffer = b;
  return conv;
}

class Kit {
  constructor(ctx, out, wet) {
    this.ctx = ctx;
    this.out = out;
    this.wet = wet;
    this.noise = noiseBuffer(ctx, 1);
  }
  synth(t, dur, midi, o = {}) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const a = o.attack ?? 0.01, r = o.release ?? 0.15, vol = o.gain ?? 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + r);
    let node = g;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.q ?? 4;
      f.frequency.setValueAtTime(o.cutoff, t);
      if (o.cutoffEnd) f.frequency.exponentialRampToValueAtTime(o.cutoffEnd, t + dur + r);
      g.connect(f);
      node = f;
    }
    const voices = o.unison || 1;
    for (let v = 0; v < voices; v++) {
      const osc = ctx.createOscillator();
      osc.type = o.type || 'sawtooth';
      osc.frequency.setValueAtTime(mtof(midi), t);
      osc.detune.value = voices > 1 ? (v - (voices - 1) / 2) * (o.spread ?? 12) : 0;
      if (o.glide) osc.frequency.exponentialRampToValueAtTime(mtof(midi + o.glide), t + dur);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + r + 0.05);
    }
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node.connect(p);
      node = p;
    }
    node.connect(this.out);
    if (o.wet && this.wet) {
      const s = ctx.createGain();
      s.gain.value = o.wet;
      node.connect(s);
      s.connect(this.wet);
    }
  }
  kick(t, vol = 0.9) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + 0.32);
  }
  noiseHit(t, dur, vol, type, freq, q = 1, wet = 0) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.out);
    if (wet && this.wet) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w);
      w.connect(this.wet);
    }
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }
  snare(t, vol = 0.5) {
    this.noiseHit(t, 0.18, vol, 'bandpass', 1800, 0.8, 0.3);
    this.synth(t, 0.02, 50, { type: 'triangle', gain: vol * 0.5, release: 0.08 });
  }
  hat(t, vol = 0.15, open = false) {
    this.noiseHit(t, open ? 0.2 : 0.05, vol, 'highpass', 7000, 1);
  }
  clap(t, vol = 0.4) {
    for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.012, 0.12, vol, 'bandpass', 1200, 1.2, 0.4);
  }
}

const TRACKS = {
  // Brooding menu theme: slow pads + glassy arpeggio
  menu: {
    dur: 48,
    build(k) {
      const prog = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]];
      const bar = 6;
      for (let i = 0; i < 8; i++) {
        const ch = prog[i % 4];
        const t = i * bar;
        for (const n of ch) k.synth(t, bar - 0.5, n, { type: 'sawtooth', gain: 0.035, attack: 1.5, release: 2, cutoff: 900, q: 1, unison: 3, spread: 14, wet: 0.6 });
        k.synth(t, bar - 0.2, ch[0] - 12, { type: 'triangle', gain: 0.12, attack: 0.5, release: 1.5 });
        if (i >= 2) {
          for (let s = 0; s < 12; s++) {
            const n = ch[(s * 3) % 4] + 12 + (s % 3 === 2 ? 12 : 0);
            k.synth(t + s * 0.5, 0.2, n, { type: 'square', gain: 0.025, release: 0.4, cutoff: 2400, wet: 0.7, pan: Math.sin(s) * 0.5 });
          }
        }
        if (i >= 4) for (let s = 0; s < 6; s++) k.hat(t + s + 0.5, 0.04);
      }
    },
  },
  // Chapter intro sting: driving arp with pulsing bass
  explore: {
    dur: 34,
    build(k) {
      const bpm = 110, b = 60 / bpm;
      const prog = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]];
      for (let bar = 0; bar < 15; bar++) {
        const ch = prog[Math.floor(bar / 2) % 4];
        const t0 = bar * 4 * b;
        const fade = bar > 12 ? (15 - bar) / 3 : 1;
        for (let s = 0; s < 16; s++) {
          const t = t0 + s * b / 4;
          const n = ch[[0, 1, 2, 3, 2, 1][s % 6]] + 12;
          k.synth(t, b / 5, n, { type: 'sawtooth', gain: 0.03 * fade, cutoff: 1200 + 1800 * Math.sin(bar * 0.4) ** 2, q: 6, release: 0.1, wet: 0.35, pan: s % 2 ? 0.3 : -0.3 });
        }
        for (let s = 0; s < 8; s++) k.synth(t0 + s * b / 2, b / 3, ch[0] - 12, { type: 'sawtooth', gain: 0.07 * fade, cutoff: 500, q: 3, release: 0.05 });
        if (bar >= 4 && bar < 13) {
          for (let q = 0; q < 4; q++) k.kick(t0 + q * b, 0.5 * fade);
          for (let q = 0; q < 8; q++) k.hat(t0 + q * b / 2 + b / 4, 0.06 * fade);
        }
        if (bar % 2 === 0) for (const n of ch) k.synth(t0, b * 7, n, { type: 'triangle', gain: 0.025 * fade, attack: 1, release: 1.5, wet: 0.5 });
      }
    },
  },
  // Combat loop: 140bpm industrial breakbeat
  action: {
    dur: 27.43,
    build(k) {
      const bpm = 140, b = 60 / bpm;
      const bassline = [38, 38, 50, 38, 41, 38, 48, 46];
      for (let bar = 0; bar < 16; bar++) {
        const t0 = bar * 4 * b;
        const root = [0, 0, -2, 3][Math.floor(bar / 4) % 4];
        // drums
        k.kick(t0, 0.85);
        k.kick(t0 + b * 1.5, 0.7);
        k.kick(t0 + b * 2.5, 0.7);
        k.snare(t0 + b, 0.45);
        k.snare(t0 + b * 3, 0.45);
        if (bar % 4 === 3) { k.snare(t0 + b * 3.5, 0.3); k.snare(t0 + b * 3.75, 0.35); }
        for (let s = 0; s < 8; s++) k.hat(t0 + s * b / 2, s % 2 ? 0.07 : 0.12, s === 7);
        // bass
        for (let s = 0; s < 8; s++) k.synth(t0 + s * b / 2, b / 2.4, bassline[s] + root, { type: 'sawtooth', gain: 0.11, cutoff: 900, cutoffEnd: 200, q: 8, release: 0.04 });
        // stabs
        if (bar >= 4) {
          for (const off of [0, 0.75, 2.5]) for (const n of [62, 65, 69]) k.synth(t0 + off * b, b / 4, n + root, { type: 'square', gain: 0.022, cutoff: 2600, release: 0.12, wet: 0.3 });
        }
        if (bar >= 8) {
          const lead = [74, 72, 69, 72, 74, 77, 76, 72];
          k.synth(t0 + 0.0, b * 1.5, lead[bar % 8] + root, { type: 'sawtooth', gain: 0.035, cutoff: 3000, q: 2, unison: 2, spread: 10, release: 0.3, wet: 0.4, glide: bar % 2 ? -2 : 0 });
        }
      }
    },
  },
  // Launch countdown: urgent 155bpm
  finale: {
    dur: 24.77,
    build(k) {
      const bpm = 155, b = 60 / bpm;
      for (let bar = 0; bar < 16; bar++) {
        const t0 = bar * 4 * b;
        const root = [0, 0, 3, -2][Math.floor(bar / 2) % 4];
        for (let q = 0; q < 4; q++) k.kick(t0 + q * b, 0.85);
        k.clap(t0 + b, 0.35);
        k.clap(t0 + b * 3, 0.35);
        for (let s = 0; s < 16; s++) k.hat(t0 + s * b / 4, s % 4 === 2 ? 0.12 : 0.05);
        for (let s = 0; s < 16; s++) k.synth(t0 + s * b / 4, b / 6, (s % 4 === 0 ? 36 : 48) + root, { type: 'sawtooth', gain: 0.08, cutoff: 1400, cutoffEnd: 300, q: 10, release: 0.03 });
        for (let s = 0; s < 8; s++) k.synth(t0 + s * b / 2, b / 4, [72, 75, 79, 75, 84, 79, 75, 72][s] + root, { type: 'square', gain: 0.022, cutoff: 3500, release: 0.08, wet: 0.35, pan: s % 2 ? 0.4 : -0.4 });
        if (bar % 4 === 0) k.synth(t0, b * 15, 60 + root, { type: 'sawtooth', gain: 0.04, attack: 2, cutoff: 1500, unison: 3, spread: 18, wet: 0.6 });
      }
    },
  },
  // Triumphant ending
  ending: {
    dur: 40,
    build(k) {
      const prog = [[48, 55, 60, 64], [53, 57, 60, 65], [55, 59, 62, 67], [48, 55, 60, 64], [45, 52, 57, 60], [53, 57, 60, 65], [55, 59, 62, 67], [55, 60, 64, 67]];
      const bar = 4.5;
      for (let i = 0; i < 8; i++) {
        const t = i * bar;
        const ch = prog[i];
        for (const n of ch) k.synth(t, bar - 0.2, n, { type: 'sawtooth', gain: 0.04, attack: 0.6, release: 1.2, cutoff: 1800, q: 1, unison: 3, spread: 12, wet: 0.6 });
        k.synth(t, bar - 0.1, ch[0] - 12, { type: 'triangle', gain: 0.14, attack: 0.05, release: 1 });
        const mel = [72, 76, 79, 76, 77, 81, 79, 74];
        k.synth(t + bar * 0.5, bar * 0.45, mel[i], { type: 'square', gain: 0.035, cutoff: 3000, attack: 0.05, release: 0.8, wet: 0.6 });
        if (i >= 2) {
          k.kick(t, 0.6);
          k.kick(t + bar / 2, 0.5);
          k.snare(t + bar / 4, 0.25);
          k.snare(t + (bar * 3) / 4, 0.25);
        }
      }
    },
  },
};

export async function renderTrack(name, sr) {
  const T = TRACKS[name];
  if (!T) return null;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return null;
  const ctx = new OAC(2, Math.floor(sr * T.dur), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 3;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(comp);
  comp.connect(ctx.destination);
  const wet = reverb(ctx);
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.5;
  wet.connect(wetGain);
  wetGain.connect(master);
  const k = new Kit(ctx, master, wet);
  T.build(k);
  return await ctx.startRendering();
}
