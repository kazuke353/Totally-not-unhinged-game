// Audio: every sound effect is synthesised into an AudioBuffer at startup,
// positional playback through PannerNodes, procedural music rendered with an
// OfflineAudioContext, and character voices via the Web Speech API.

const SOUNDS = {};

function rnd() {
  return Math.random() * 2 - 1;
}

// One-pole filters working on a running state
class LP {
  constructor(sr, f) { this.y = 0; this.set(sr, f); }
  set(sr, f) { this.a = 1 - Math.exp((-2 * Math.PI * f) / sr); }
  p(x) { return (this.y += this.a * (x - this.y)); }
}
class HP {
  constructor(sr, f) { this.lp = new LP(sr, f); }
  p(x) { return x - this.lp.p(x); }
}
// RBJ band-pass biquad
class BP {
  constructor(sr, f, q = 1) { this.sr = sr; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.q = q;
    const w = (2 * Math.PI * Math.min(f, this.sr * 0.45)) / this.sr;
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    this.b0 = al / a0; this.b2 = -al / a0;
    this.a1 = (-2 * Math.cos(w)) / a0; this.a2 = (1 - al) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function def(name, dur, fn, opts = {}) {
  SOUNDS[name] = { dur, fn, opts };
}

const sq = (p) => (p % 1 < 0.5 ? 1 : -1);
const saw = (p) => (p % 1) * 2 - 1;
const tri = (p) => 1 - 4 * Math.abs((p % 1) - 0.5);
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ---------------------------------------------------------------- weapons
function gunshot(sr, d, n, { crack = 0.02, body = 120, bodyDecay = 0.08, tail = 0.25, lpF = 3000, gain = 1 }) {
  const lp = new LP(sr, lpF), lp2 = new LP(sr, 700), hp = new HP(sr, 400);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const nz = rnd();
    let v = hp.p(lp.p(nz)) * Math.exp(-t / crack) * 1.4;
    const f = body * (1 - Math.min(t * 4, 0.5));
    ph += f / sr;
    v += Math.sin(ph * 2 * Math.PI) * Math.exp(-t / bodyDecay) * 0.9;
    v += lp2.p(nz) * Math.exp(-t / tail) * 0.7;
    d[i] = v * gain;
  }
}
def('pistol', 0.6, (d, n, sr) => gunshot(sr, d, n, { crack: 0.015, body: 160, bodyDecay: 0.05, tail: 0.18, lpF: 5000 }));
def('smg', 0.45, (d, n, sr) => gunshot(sr, d, n, { crack: 0.012, body: 140, bodyDecay: 0.04, tail: 0.12, lpF: 4500, gain: 0.85 }));
def('rifle', 0.5, (d, n, sr) => gunshot(sr, d, n, { crack: 0.012, body: 120, bodyDecay: 0.05, tail: 0.15, lpF: 4000, gain: 0.85 }));
def('shotgun', 1.0, (d, n, sr) => gunshot(sr, d, n, { crack: 0.03, body: 90, bodyDecay: 0.12, tail: 0.35, lpF: 2500, gain: 1.15 }));
def('turret_fire', 0.3, (d, n, sr) => gunshot(sr, d, n, { crack: 0.01, body: 200, bodyDecay: 0.03, tail: 0.08, lpF: 6000, gain: 0.7 }));
def('chaingun', 0.35, (d, n, sr) => gunshot(sr, d, n, { crack: 0.012, body: 100, bodyDecay: 0.05, tail: 0.15, lpF: 3500, gain: 0.9 }));
def('empty', 0.08, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(t * 2 * Math.PI * 2600) * 0.5 + rnd() * 0.3) * Math.exp(-t / 0.008); }
});
def('reload', 0.6, (d, n, sr) => {
  const bp = new BP(sr, 2400, 3);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    for (const c of [0.0, 0.32]) if (t > c) v += bp.p(rnd()) * Math.exp(-(t - c) / 0.012) * 2.5;
    d[i] = v;
  }
});
def('pump', 0.5, (d, n, sr) => {
  const bp = new BP(sr, 1600, 2);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    for (const c of [0.0, 0.2]) if (t > c) v += bp.p(rnd()) * Math.exp(-(t - c) / 0.03) * 2;
    d[i] = v;
  }
});
def('shell_in', 0.15, (d, n, sr) => {
  const bp = new BP(sr, 3000, 4);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.015) * 2.5; }
});
def('glauncher', 0.4, (d, n, sr) => {
  let ph = 0;
  const lp = new LP(sr, 900);
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (220 - t * 300) / sr; d[i] = Math.sin(ph * 6.283) * Math.exp(-t / 0.07) + lp.p(rnd()) * Math.exp(-t / 0.1) * 0.8; }
});
def('rpg_fire', 1.2, (d, n, sr) => {
  const bp = new BP(sr, 300, 0.8);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    bp.set(300 + t * 1600, 0.8);
    ph += 70 / sr;
    d[i] = bp.p(rnd()) * env(t, 0.02, 0.4) * 1.6 + Math.sin(ph * 6.283) * Math.exp(-t / 0.12);
  }
});
def('rocket_loop', 1.0, (d, n, sr) => {
  const bp = new BP(sr, 500, 0.7);
  for (let i = 0; i < n; i++) d[i] = bp.p(rnd()) * (0.8 + 0.2 * Math.sin((i / sr) * 40 * 6.283));
}, { loop: true });
def('explosion', 2.4, (d, n, sr) => {
  const lp = new LP(sr, 1200), lp2 = new LP(sr, 160);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lp.set(sr, 2500 * Math.exp(-t * 2) + 120);
    const nz = rnd();
    ph += (55 - t * 15) / sr;
    let v = lp.p(nz) * env(t, 0.004, 0.45) * 1.6;
    v += lp2.p(nz) * env(t, 0.01, 0.9) * 2.2;
    v += Math.sin(ph * 6.283) * env(t, 0.005, 0.35) * 0.9;
    if (Math.random() < 0.002 * Math.exp(-t * 3)) v += rnd() * 0.8;
    d[i] = v;
  }
});
def('grenade_bounce', 0.15, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(t * 6.283 * 2100) + Math.sin(t * 6.283 * 3300) * 0.6) * Math.exp(-t / 0.03) * 0.5; }
});
def('pin', 0.3, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * 3500) * Math.exp(-t / 0.08) * 0.4 + rnd() * Math.exp(-t / 0.005) * 0.4; }
});
def('swing', 0.3, (d, n, sr) => {
  const bp = new BP(sr, 400, 1.2);
  for (let i = 0; i < n; i++) { const t = i / sr; bp.set(300 + t * 3000, 1.5); d[i] = bp.p(rnd()) * Math.sin(Math.min(1, t / 0.25) * Math.PI) * 1.5; }
});
def('kick_hit', 0.4, (d, n, sr) => {
  let ph = 0;
  const lp = new LP(sr, 1500);
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (110 - t * 120) / sr; d[i] = Math.sin(ph * 6.283) * Math.exp(-t / 0.09) * 1.2 + lp.p(rnd()) * Math.exp(-t / 0.03) * 1.2; }
});
def('punch_hit', 0.25, (d, n, sr) => {
  let ph = 0;
  const lp = new LP(sr, 2200);
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (160 - t * 200) / sr; d[i] = Math.sin(ph * 6.283) * Math.exp(-t / 0.05) * 0.9 + lp.p(rnd()) * Math.exp(-t / 0.02) * 1.0; }
});

// ---------------------------------------------------------------- impacts
def('ric', 0.35, (d, n, sr) => {
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (3200 - t * 4000) / sr; d[i] = (Math.sin(ph * 6.283) * Math.exp(-t / 0.08) * 0.35 + rnd() * Math.exp(-t / 0.004) * 0.6); }
});
def('hit_concrete', 0.15, (d, n, sr) => {
  const bp = new BP(sr, 1400, 1);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.02) * 2; }
});
def('hit_metal', 0.4, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(t * 6.283 * 1250) + Math.sin(t * 6.283 * 2330) * 0.7 + Math.sin(t * 6.283 * 3710) * 0.5) * Math.exp(-t / 0.07) * 0.35 + rnd() * Math.exp(-t / 0.004) * 0.5; }
});
def('hit_flesh', 0.15, (d, n, sr) => {
  const lp = new LP(sr, 600);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = lp.p(rnd()) * Math.exp(-t / 0.04) * 3; }
});
def('hit_wood', 0.2, (d, n, sr) => {
  const bp = new BP(sr, 700, 2);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.03) * 2.5 + Math.sin(t * 6.283 * 320) * Math.exp(-t / 0.04) * 0.4; }
});
def('break_wood', 0.8, (d, n, sr) => {
  const bp = new BP(sr, 900, 1.5);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = bp.p(rnd()) * Math.exp(-t / 0.08) * 2;
    for (const c of [0.05, 0.13, 0.22, 0.34]) if (t > c) v += Math.sin((t - c) * 6.283 * (250 + c * 400)) * Math.exp(-(t - c) / 0.04) * 0.5;
    d[i] = v;
  }
});
def('break_glass', 1.0, (d, n, sr) => {
  const hp = new HP(sr, 3000);
  const pings = [];
  for (let k = 0; k < 18; k++) pings.push([Math.random() * 0.5, 2500 + Math.random() * 5000]);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = hp.p(rnd()) * Math.exp(-t / 0.12) * 1.2;
    for (const [c, f] of pings) if (t > c) v += Math.sin((t - c) * 6.283 * f) * Math.exp(-(t - c) / 0.05) * 0.18;
    d[i] = v;
  }
});
def('break_metal', 0.8, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(t * 6.283 * 410) + Math.sin(t * 6.283 * 1170) * 0.6) * Math.exp(-t / 0.2) * 0.4 + rnd() * Math.exp(-t / 0.05) * 0.8; }
});
def('shell_drop', 0.2, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * 4100) * Math.exp(-t / 0.03) * 0.25 + (t > 0.07 ? Math.sin(t * 6.283 * 3900) * Math.exp(-(t - 0.07) / 0.02) * 0.15 : 0); }
});

// ---------------------------------------------------------------- player
function step(sr, d, n, f, q, dec, thump) {
  const bp = new BP(sr, f, q);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (thump - t * 80) / sr;
    d[i] = bp.p(rnd()) * Math.exp(-t / dec) * 2 + Math.sin(ph * 6.283) * Math.exp(-t / 0.05) * 0.6;
  }
}
def('step_dirt', 0.2, (d, n, sr) => step(sr, d, n, 600, 0.8, 0.04, 70));
def('step_concrete', 0.2, (d, n, sr) => step(sr, d, n, 1500, 1.2, 0.025, 80));
def('step_metal', 0.3, (d, n, sr) => {
  step(sr, d, n, 2200, 3, 0.04, 90);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] += Math.sin(t * 6.283 * 870) * Math.exp(-t / 0.06) * 0.25; }
});
def('step_wood', 0.2, (d, n, sr) => step(sr, d, n, 500, 2, 0.04, 120));
def('hop', 0.3, (d, n, sr) => {
  const bp = new BP(sr, 300, 1);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; bp.set(250 + t * 1500); ph += (90 + t * 100) / sr; d[i] = bp.p(rnd()) * Math.sin(Math.min(1, t / 0.25) * Math.PI) * 0.7 + Math.sin(ph * 6.283) * Math.exp(-t / 0.04) * 0.4; }
});
def('superhop', 0.7, (d, n, sr) => {
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 140 + 520 * (1 - Math.exp(-t * 6)) + Math.sin(t * 6.283 * 24) * 30 * Math.exp(-t * 3);
    ph += f / sr;
    d[i] = (Math.sin(ph * 6.283) * 0.6 + tri(ph * 2) * 0.2) * env(t, 0.005, 0.22);
  }
});
def('land', 0.3, (d, n, sr) => step(sr, d, n, 400, 0.7, 0.06, 60));
def('pain', 0.35, (d, n, sr) => {
  const bp = new BP(sr, 900, 2);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (190 - t * 220) / sr; d[i] = bp.p(saw(ph) + rnd() * 0.6) * env(t, 0.01, 0.12) * 2.2; }
});
def('player_die', 1.2, (d, n, sr) => {
  const bp = new BP(sr, 700, 2);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (170 - t * 90) / sr; d[i] = bp.p(saw(ph) + rnd() * 0.7) * env(t, 0.02, 0.45) * 2; }
});
def('chuff', 0.25, (d, n, sr) => {
  const bp = new BP(sr, 1100, 1.2);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * env(t, 0.01, 0.06) * 1.6; }
});
def('flashlight', 0.08, (d, n, sr) => {
  const bp = new BP(sr, 3500, 3);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.006) * 3; }
});

// ---------------------------------------------------------------- items / ui
def('pickup', 0.3, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; const f = t < 0.08 ? 880 : 1320; d[i] = sq(t * f) * 0.18 * env(t, 0.002, 0.12); }
});
def('pickup_weapon', 0.45, (d, n, sr) => {
  const bp = new BP(sr, 2000, 2);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.02) * 2 + (t > 0.1 ? sq(t * 990) * 0.14 * Math.exp(-(t - 0.1) / 0.12) : 0); }
});
def('pickup_ammo', 0.25, (d, n, sr) => {
  const bp = new BP(sr, 1800, 2);
  for (let i = 0; i < n; i++) { const t = i / sr; let v = bp.p(rnd()) * Math.exp(-t / 0.015) * 2; if (t > 0.09) v += bp.p(rnd()) * Math.exp(-(t - 0.09) / 0.015) * 2; d[i] = v; }
});
def('medkit', 0.5, (d, n, sr) => {
  const hp = new HP(sr, 2000);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = hp.p(rnd()) * env(t, 0.03, 0.12) * 0.7 + Math.sin(t * 6.283 * (600 + t * 800)) * env(t, 0.01, 0.15) * 0.25; }
});
def('battery', 0.6, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (sq(t * (300 + t * 1400)) * 0.12 + Math.sin(t * 6.283 * (600 + t * 2000)) * 0.15) * env(t, 0.01, 0.25); }
});
def('charger_loop', 0.5, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (sq(t * 220) * 0.06 + Math.sin(t * 6.283 * 440) * 0.08) * (0.7 + 0.3 * Math.sin(t * 6.283 * 8)); }
}, { loop: true });
def('denied', 0.4, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = sq(t * 110) * 0.2 * (t < 0.12 || (t > 0.18 && t < 0.3) ? 1 : 0); }
});
def('button', 0.25, (d, n, sr) => {
  const bp = new BP(sr, 2500, 3);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.01) * 2 + sq(t * 1000) * 0.15 * (t > 0.03 && t < 0.12 ? 1 : 0); }
});
def('beep', 0.15, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * 1700) * 0.3 * (t < 0.1 ? 1 : 0); }
});
def('hev_beep', 0.35, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = sq(t * 1500) * 0.1 * ((t < 0.08 || (t > 0.14 && t < 0.22)) ? 1 : 0); }
});
def('hit_tick', 0.06, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(t * 6.283 * 2800) * 0.5 + Math.sin(t * 6.283 * 4100) * 0.3) * Math.exp(-t / 0.012) * 0.6; }
});
def('ui_click', 0.06, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = sq(t * 1800) * 0.12 * Math.exp(-t / 0.015); }
});
def('ui_hover', 0.04, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * 1200) * 0.08 * Math.exp(-t / 0.01); }
});
def('weapon_select', 0.08, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = sq(t * 1400) * 0.08 * (t < 0.04 ? 1 : 0); }
});
def('message', 0.5, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * (t < 0.15 ? 660 : 990)) * 0.15 * env(t, 0.005, 0.2); }
});
def('radio', 0.2, (d, n, sr) => {
  const bp = new BP(sr, 2500, 1);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * (t < 0.09 ? 1 : 0) * 0.8 + sq(t * 1200) * 0.06 * (t < 0.03 ? 1 : 0); }
});

// ---------------------------------------------------------------- world
def('door_move', 1.2, (d, n, sr) => {
  const lp = new LP(sr, 300);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += 55 / sr; d[i] = (lp.p(rnd()) * 1.5 + saw(ph) * 0.15) * env(t, 0.05, 0.6); }
});
def('door_stop', 0.4, (d, n, sr) => {
  let ph = 0;
  const lp = new LP(sr, 800);
  for (let i = 0; i < n; i++) { const t = i / sr; ph += 70 / sr; d[i] = Math.sin(ph * 6.283) * Math.exp(-t / 0.08) * 0.8 + lp.p(rnd()) * Math.exp(-t / 0.05); }
});
def('blastdoor', 4.0, (d, n, sr) => {
  const lp = new LP(sr, 120);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (38 + Math.sin(t * 3) * 3) / sr; d[i] = (lp.p(rnd()) * 3 + saw(ph) * 0.2 + sq(t * 2.5) * 0.02) * env(t, 0.3, 2.0); }
});
def('hum_loop', 2.0, (d, n, sr) => {
  const lp = new LP(sr, 200);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * 60) * 0.15 + Math.sin(t * 6.283 * 120) * 0.08 + lp.p(rnd()) * 0.3; }
}, { loop: true });
def('wind_loop', 4.0, (d, n, sr) => {
  const bp = new BP(sr, 400, 0.5);
  for (let i = 0; i < n; i++) { const t = i / sr; const m = 0.6 + 0.4 * Math.sin((t / 4) * 6.283) * Math.sin((t / 4) * 6.283 * 3 + 1); bp.set(300 + 200 * m, 0.6); d[i] = bp.p(rnd()) * m * 0.9; }
}, { loop: true });
def('alarm', 1.0, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; const f = t < 0.5 ? 640 : 480; d[i] = (sq(t * f) * 0.5 + saw(t * f * 1.01) * 0.3) * 0.22; }
}, { loop: true });
def('siren', 3.0, (d, n, sr) => {
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (500 + 300 * Math.sin((t / 3) * 6.283)) / sr; d[i] = (Math.sin(ph * 6.283) + sq(ph) * 0.2) * 0.25; }
}, { loop: true });
def('elevator_loop', 1.0, (d, n, sr) => {
  const lp = new LP(sr, 150);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = saw(t * 48) * 0.12 + lp.p(rnd()) * 0.5; }
}, { loop: true });
def('spark', 0.4, (d, n, sr) => {
  const hp = new HP(sr, 2500);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = hp.p(rnd()) * (Math.random() < 0.3 ? 1 : 0.2) * Math.exp(-t / 0.1) * 1.4; }
});
def('zap', 0.5, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (sq(t * 120 + Math.random() * 0.3) * 0.4 + rnd() * 0.3) * Math.exp(-t / 0.15); }
});
def('turret_ping', 0.5, (d, n, sr) => {
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(t * 6.283 * 2200) * 0.3 * env(t, 0.002, 0.15); }
});
def('turret_spin', 0.8, (d, n, sr) => {
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / sr; ph += (200 + t * 600) / sr; d[i] = saw(ph) * 0.12 * env(t, 0.05, 0.5); }
});
def('heli_loop', 1.0, (d, n, sr) => {
  const lp = new LP(sr, 300);
  for (let i = 0; i < n; i++) { const t = i / sr; const whop = Math.pow(0.5 + 0.5 * Math.sin(t * 6.283 * 11), 3); d[i] = lp.p(rnd()) * (0.4 + whop * 1.8) + Math.sin(t * 6.283 * 1800) * 0.03 + saw(t * 90) * 0.05; }
}, { loop: true });
def('launch_roar', 3.0, (d, n, sr) => {
  const lp = new LP(sr, 400), lp2 = new LP(sr, 80);
  for (let i = 0; i < n; i++) { const t = i / sr; const nz = rnd(); d[i] = lp.p(nz) * 1.6 + lp2.p(nz) * 3 + (Math.random() < 0.01 ? rnd() * 0.5 : 0); }
}, { loop: true });
def('valve_loop', 1.0, (d, n, sr) => {
  const hp = new HP(sr, 1500);
  for (let i = 0; i < n; i++) d[i] = hp.p(rnd()) * 0.3;
}, { loop: true });
def('fire_loop', 2.0, (d, n, sr) => {
  const lp = new LP(sr, 700);
  for (let i = 0; i < n; i++) d[i] = lp.p(rnd()) * 1.4 + (Math.random() < 0.003 ? rnd() * 0.6 : 0);
}, { loop: true });
def('geiger', 0.05, (d, n, sr) => {
  for (let i = 0; i < n; i++) d[i] = rnd() * Math.exp(-(i / sr) / 0.002) * 0.6;
});

// ---------------------------------------------------------------- creatures
function voice(sr, d, n, f0, f1, formants, dur, noiseAmt = 0.3, gain = 1.6) {
  const bps = formants.map((f) => new BP(sr, f, 4));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const k = Math.min(1, t / dur);
    ph += (f0 + (f1 - f0) * k) / sr;
    const src = saw(ph) + rnd() * noiseAmt;
    let v = 0;
    for (const b of bps) v += b.p(src);
    d[i] = v * env(t, 0.015, dur * 0.4) * gain;
  }
}
def('soldier_pain', 0.4, (d, n, sr) => voice(sr, d, n, 140, 95, [600, 1100, 2400], 0.3));
def('soldier_pain2', 0.4, (d, n, sr) => voice(sr, d, n, 170, 120, [700, 1200, 2600], 0.25));
def('soldier_die', 0.9, (d, n, sr) => voice(sr, d, n, 150, 70, [550, 900, 2300], 0.7));
def('soldier_alert', 0.4, (d, n, sr) => voice(sr, d, n, 130, 170, [650, 1150, 2500], 0.3, 0.2));
def('dingo_bark', 0.3, (d, n, sr) => voice(sr, d, n, 420, 300, [900, 1800, 3200], 0.15, 0.5, 1.8));
def('dingo_growl', 0.8, (d, n, sr) => {
  voice(sr, d, n, 90, 80, [400, 900], 0.8, 1.2, 1.2);
  for (let i = 0; i < n; i++) d[i] *= 0.6 + 0.4 * Math.sin((i / sr) * 6.283 * 22);
});
def('dingo_yelp', 0.4, (d, n, sr) => voice(sr, d, n, 700, 1100, [1200, 2500], 0.25, 0.3, 1.4));
def('dingo_howl', 1.6, (d, n, sr) => voice(sr, d, n, 380, 520, [800, 1600], 1.4, 0.1, 1.2));
def('dingo_bite', 0.2, (d, n, sr) => {
  const bp = new BP(sr, 1800, 1);
  for (let i = 0; i < n; i++) { const t = i / sr; d[i] = bp.p(rnd()) * Math.exp(-t / 0.02) * 2.5; }
});

// ---------------------------------------------------------------- engine
export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.ready = false;
    this.volume = 0.8;
    this.musicVolume = 0.5;
    this.voices = true;
    this.loops = new Set();
    this.music = null;
    this.musicBuffers = {};
    this.speechVoice = null;
    this.listenerPos = [0, 0, 0];
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);
    const sr = ctx.sampleRate;
    for (const [name, s] of Object.entries(SOUNDS)) {
      const n = Math.floor(s.dur * sr);
      const data = new Float32Array(n);
      s.fn(data, n, sr);
      // normalise peaks a bit and fade out
      let peak = 0;
      for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
      const g = peak > 1 ? 0.95 / peak : 1;
      const fade = s.opts.loop ? 0 : Math.min(n, Math.floor(sr * 0.01));
      for (let i = 0; i < n; i++) {
        let v = data[i] * g;
        if (i > n - fade) v *= (n - i) / fade;
        data[i] = v;
      }
      if (s.opts.loop) {
        // crossfade loop seam
        const xf = Math.floor(sr * 0.05);
        for (let i = 0; i < xf; i++) {
          const k = i / xf;
          data[i] = data[i] * k + data[n - xf + i] * (1 - k);
        }
      }
      const b = ctx.createBuffer(1, n, sr);
      b.copyToChannel(data, 0);
      this.buffers[name] = b;
    }
    this.ready = true;
    this._pickVoice();
    if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => this._pickVoice();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setListener(pos, fwd, up = [0, 1, 0]) {
    this.listenerPos = pos;
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(pos[0], t);
      l.positionY.setValueAtTime(pos[1], t);
      l.positionZ.setValueAtTime(pos[2], t);
      l.forwardX.setValueAtTime(fwd[0], t);
      l.forwardY.setValueAtTime(fwd[1], t);
      l.forwardZ.setValueAtTime(fwd[2], t);
      l.upX.setValueAtTime(up[0], t);
      l.upY.setValueAtTime(up[1], t);
      l.upZ.setValueAtTime(up[2], t);
    } else {
      l.setPosition(pos[0], pos[1], pos[2]);
      l.setOrientation(fwd[0], fwd[1], fwd[2], up[0], up[1], up[2]);
    }
  }

  // opts: {pos, volume, rate, loop, range}
  play(name, opts = {}) {
    if (!this.ready) return null;
    const b = this.buffers[name];
    if (!b) return null;
    const ctx = this.ctx;
    if (opts.pos) {
      const dx = opts.pos[0] - this.listenerPos[0], dy = opts.pos[1] - this.listenerPos[1], dz = opts.pos[2] - this.listenerPos[2];
      const range = opts.range || 60;
      if (!opts.loop && dx * dx + dy * dy + dz * dz > range * range) return null;
    }
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = !!opts.loop;
    src.playbackRate.value = (opts.rate || 1) * (opts.norand ? 1 : 0.94 + Math.random() * 0.12);
    const gain = ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    src.connect(gain);
    let panner = null;
    if (opts.pos) {
      panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = opts.ref || 3;
      panner.rolloffFactor = opts.rolloff || 1.1;
      panner.maxDistance = 200;
      this._setPannerPos(panner, opts.pos);
      gain.connect(panner);
      panner.connect(this.sfx);
    } else gain.connect(this.sfx);
    src.start();
    const h = {
      src,
      gain,
      panner,
      stop: () => {
        try {
          src.stop();
        } catch (e) {}
        this.loops.delete(h);
      },
      setPos: (p) => panner && this._setPannerPos(panner, p),
      setVolume: (v) => (gain.gain.value = v),
      setRate: (r) => (src.playbackRate.value = r),
    };
    if (opts.loop) this.loops.add(h);
    return h;
  }

  _setPannerPos(p, pos) {
    if (p.positionX) {
      const t = this.ctx.currentTime;
      p.positionX.setValueAtTime(pos[0], t);
      p.positionY.setValueAtTime(pos[1], t);
      p.positionZ.setValueAtTime(pos[2], t);
    } else p.setPosition(pos[0], pos[1], pos[2]);
  }

  stopAllLoops() {
    for (const h of [...this.loops]) h.stop();
    this.loops.clear();
  }

  // ---------------------------------------------------------- speech
  _pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    const en = vs.filter((v) => /^en/i.test(v.lang));
    this.voicesList = en.length ? en : vs;
    this.speechVoice = this.voicesList.find((v) => /female|samantha|zira|uk english female|karen/i.test(v.name)) || this.voicesList[0] || null;
    this.maleVoice = this.voicesList.find((v) => /male|daniel|david|uk english male|fred/i.test(v.name) && !/female/i.test(v.name)) || this.voicesList[1] || this.speechVoice;
    this.ausVoice = this.voicesList.find((v) => /en-AU/i.test(v.lang)) || this.maleVoice;
  }

  say(text, kind = 'hev', force = false) {
    if (!this.voices || !('speechSynthesis' in window)) return;
    const s = window.speechSynthesis;
    if (kind === 'hev' || kind === 'koala' || force) s.cancel();
    else if (s.speaking || s.pending) return;
    const u = new SpeechSynthesisUtterance(text);
    if (kind === 'hev') {
      u.voice = this.speechVoice;
      u.rate = 1.0;
      u.pitch = 0.75;
      u.volume = 0.8 * this.volume;
    } else if (kind === 'soldier') {
      u.voice = this.ausVoice || this.maleVoice;
      u.rate = 1.25;
      u.pitch = 0.55;
      u.volume = 0.7 * this.volume;
    } else if (kind === 'koala') {
      u.voice = this.maleVoice;
      u.rate = 0.78;
      u.pitch = 0.45;
      u.volume = 0.9 * this.volume;
    } else {
      u.voice = this.maleVoice;
      u.rate = 1.1;
      u.pitch = 1.3;
      u.volume = 0.8 * this.volume;
    }
    try {
      s.speak(u);
    } catch (e) {}
  }
  stopSpeech() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ---------------------------------------------------------- music
  async playMusic(name, loop = false) {
    if (!this.ready) return;
    this.stopMusic();
    const token = (this._musicToken = {});
    let buf = this.musicBuffers[name];
    if (!buf) {
      const { renderTrack } = await import('./music.js');
      buf = await renderTrack(name, this.ctx.sampleRate);
      if (!buf) return;
      this.musicBuffers[name] = buf;
    }
    if (this._musicToken !== token) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);
    src.connect(g);
    g.connect(this.musicGain);
    src.start();
    this.music = { src, g, name };
  }
  stopMusic(fade = 1.5) {
    this._musicToken = null;
    if (!this.music) return;
    const { src, g } = this.music;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    try {
      src.stop(t + fade + 0.05);
    } catch (e) {}
    this.music = null;
  }
}

export const audio = new Audio();
