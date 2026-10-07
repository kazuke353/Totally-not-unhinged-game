// Procedural texture factory. Every surface in the game is painted here at
// load time with a deliberately low resolution, so the world gets that
// chunky late-90s software-renderer look without shipping any image files.
import * as THREE from 'three';
import { mulberry32, makeFbm, clamp } from './util.js';

const FONT = '"Arial Black", "Arial Bold", Gadget, sans-serif';
const COND = '"Arial Narrow", "Arial", sans-serif';

function rgb(r, g, b, a = 1) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

class Painter {
  constructor(w, h, seed) {
    this.w = w;
    this.h = h;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingEnabled = false;
    this.glow = null; // lazily created emission mask
  }
  r(a = 0, b = 1) {
    return a + this.rng() * (b - a);
  }
  fill(c) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(0, 0, this.w, this.h);
    return this;
  }
  rect(x, y, w, h, c) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(x, y, w, h);
    return this;
  }
  line(x0, y0, x1, y1, c, wd = 1) {
    const g = this.ctx;
    g.strokeStyle = c;
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    return this;
  }
  circle(x, y, rad, c) {
    const g = this.ctx;
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    return this;
  }
  text(str, x, y, size, c, font = FONT, align = 'center') {
    const g = this.ctx;
    g.font = `bold ${size}px ${font}`;
    g.fillStyle = c;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(str, x, y);
    return this;
  }
  // Raised/inset panel edges.
  bevel(x, y, w, h, light, dark, t = 1) {
    this.rect(x, y, w, t, light);
    this.rect(x, y, t, h, light);
    this.rect(x, y + h - t, w, t, dark);
    this.rect(x + w - t, y, t, h, dark);
    return this;
  }
  rivet(x, y, light = 'rgba(255,255,255,0.35)', dark = 'rgba(0,0,0,0.45)') {
    this.rect(x, y, 2, 2, dark);
    this.rect(x, y, 1, 1, light);
    return this;
  }
  // Per pixel operations -------------------------------------------------
  pixels(fn) {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        fn(d, i, x, y);
      }
    }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }
  grain(amount = 12) {
    const rng = this.rng;
    return this.pixels((d, i) => {
      const n = (rng() - 0.5) * 2 * amount;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    });
  }
  // Multiply brightness by tileable fractal noise.
  mottle(amount = 0.25, period = 4, oct = 4, seedOff = 0) {
    const f = makeFbm(this.seed + 17 + seedOff, period, oct);
    const w = this.w, h = this.h;
    return this.pixels((d, i, x, y) => {
      const n = 1 + (f(x / w, y / h) - 0.5) * 2 * amount;
      d[i] = clamp(d[i] * n, 0, 255);
      d[i + 1] = clamp(d[i + 1] * n, 0, 255);
      d[i + 2] = clamp(d[i + 2] * n, 0, 255);
    });
  }
  // Tint toward a color in noisy blotches (rust, dirt, stains).
  blotch(color, amount = 0.6, threshold = 0.55, period = 4, seedOff = 3) {
    const f = makeFbm(this.seed + 91 + seedOff, period, 4);
    const w = this.w, h = this.h;
    return this.pixels((d, i, x, y) => {
      const n = f(x / w, y / h);
      if (n > threshold) {
        const t = clamp((n - threshold) / (1 - threshold) * 2.5, 0, 1) * amount;
        d[i] = d[i] + (color[0] - d[i]) * t;
        d[i + 1] = d[i + 1] + (color[1] - d[i + 1]) * t;
        d[i + 2] = d[i + 2] + (color[2] - d[i + 2]) * t;
      }
    });
  }
  // Vertical grime streaks running down from the top.
  drips(count = 10, color = [0, 0, 0], alpha = 0.18) {
    for (let k = 0; k < count; k++) {
      const x = Math.floor(this.r(0, this.w));
      const len = this.r(this.h * 0.15, this.h * 0.7);
      const wd = Math.floor(this.r(1, 3));
      const g = this.ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, rgb(color[0], color[1], color[2], alpha));
      g.addColorStop(1, rgb(color[0], color[1], color[2], 0));
      this.ctx.fillStyle = g;
      this.ctx.fillRect(x, 0, wd, len);
    }
    return this;
  }
  // Darken toward bottom edge (dirt accumulation).
  grime(alpha = 0.3, from = 0.7) {
    const g = this.ctx.createLinearGradient(0, this.h * from, 0, this.h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(20,14,8,${alpha})`);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.w, this.h);
    return this;
  }
  speckle(count, colors, size = 1) {
    for (let k = 0; k < count; k++) {
      const c = colors[Math.floor(this.r(0, colors.length))];
      const s = typeof size === 'number' ? size : Math.floor(this.r(size[0], size[1] + 1));
      this.rect(Math.floor(this.r(0, this.w)), Math.floor(this.r(0, this.h)), s, s, c);
    }
    return this;
  }
  posterize(levels = 24) {
    const q = 255 / (levels - 1);
    return this.pixels((d, i) => {
      d[i] = Math.round(d[i] / q) * q;
      d[i + 1] = Math.round(d[i + 1] / q) * q;
      d[i + 2] = Math.round(d[i + 2] / q) * q;
    });
  }
  // Emission mask helpers (for 'glow' materials).
  glowCtx() {
    if (!this.glow) {
      const c = document.createElement('canvas');
      c.width = this.w;
      c.height = this.h;
      this.glow = c.getContext('2d');
      this.glow.fillStyle = '#000';
      this.glow.fillRect(0, 0, this.w, this.h);
    }
    return this.glow;
  }
  glowRect(x, y, w, h, color, strength = 1) {
    this.rect(x, y, w, h, color);
    const g = this.glowCtx();
    const v = Math.round(255 * strength);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, y, w, h);
    return this;
  }
  glowText(str, x, y, size, color, font = COND, align = 'left') {
    this.text(str, x, y, size, color, font, align);
    const g = this.glowCtx();
    g.font = `bold ${size}px ${font}`;
    g.fillStyle = '#fff';
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(str, x, y);
    return this;
  }
}

// Kangaroo silhouette used on posters and signs.
function drawRoo(p, cx, cy, s, color) {
  const g = p.ctx;
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.fillStyle = color;
  g.beginPath();
  // body
  g.ellipse(0, 4, 9, 13, -0.35, 0, Math.PI * 2);
  g.fill();
  // head
  g.beginPath();
  g.ellipse(6, -12, 4, 3, 0.3, 0, Math.PI * 2);
  g.fill();
  // ears
  g.beginPath();
  g.moveTo(4, -14); g.lineTo(3, -21); g.lineTo(6, -15); g.fill();
  g.beginPath();
  g.moveTo(6, -14); g.lineTo(7, -21); g.lineTo(8, -14); g.fill();
  // neck
  g.fillRect(2, -11, 4, 6);
  // tail
  g.beginPath();
  g.moveTo(-6, 12); g.quadraticCurveTo(-18, 18, -22, 22); g.lineTo(-20, 24); g.quadraticCurveTo(-12, 20, -3, 16); g.fill();
  // legs
  g.beginPath();
  g.moveTo(-2, 12); g.lineTo(10, 22); g.lineTo(14, 22); g.lineTo(14, 20); g.lineTo(4, 10); g.fill();
  // arms
  g.fillRect(6, -4, 6, 2);
  g.restore();
}

function trefoil(p, cx, cy, r, fg, bg) {
  const g = p.ctx;
  p.circle(cx, cy, r, bg);
  g.fillStyle = fg;
  for (let k = 0; k < 3; k++) {
    const a0 = -Math.PI / 2 + k * (Math.PI * 2 / 3) - 0.5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r * 0.85, a0, a0 + 1.0);
    g.closePath();
    g.fill();
  }
  p.circle(cx, cy, r * 0.22, bg);
  p.circle(cx, cy, r * 0.14, fg);
}

// ---------------------------------------------------------------------------
// Texture definitions. Each returns a painter; options define how the world
// maps and shades it.
// size: metres covered by one tile (world mapped)
// mode: opaque | alpha | glow | fullbright | glass
// uv: world | fit
// ---------------------------------------------------------------------------
const DEFS = {};
function def(name, opts, paint) {
  DEFS[name] = { opts, paint };
}

// ---------- outdoor ----------
def('dirt', { w: 128, size: 4 }, (p) => {
  p.fill('#8e4426').mottle(0.28, 4, 5).blotch([150, 92, 52], 0.5, 0.58, 3);
  p.speckle(260, ['#6b2f19', '#b3653a', '#5a2a16', '#c27a4a'], [1, 2]);
  // dry grass strands
  for (let k = 0; k < 40; k++) {
    const x = p.r(0, 128), y = p.r(0, 128);
    p.line(x, y, x + p.r(-3, 3), y - p.r(2, 5), 'rgba(196,170,96,0.7)', 1);
  }
  p.grain(10);
});
def('dirt_dark', { w: 128, size: 4 }, (p) => {
  p.fill('#5e2d1a').mottle(0.3, 4, 5).blotch([90, 60, 40], 0.5, 0.55);
  p.speckle(300, ['#3b1c10', '#7a4026', '#8a5a3a', '#9a8f80'], [1, 2]);
  p.grain(10);
});
def('dirt_road', { w: 128, size: 4 }, (p) => {
  p.fill('#9d6040').mottle(0.2, 4, 5).blotch([120, 80, 60], 0.4, 0.6);
  for (let k = 0; k < 8; k++) {
    const y = p.r(0, 128);
    p.line(0, y, 128, y + p.r(-6, 6), 'rgba(70,35,20,0.25)', p.r(1, 4));
  }
  p.speckle(200, ['#5a3020', '#c08060', '#aa9a88'], [1, 2]);
  p.grain(9);
});
def('rock', { w: 128, size: 5 }, (p) => {
  // layered sandstone strata
  const f = makeFbm(p.seed + 5, 4, 4);
  p.fill('#a04a28');
  p.pixels((d, i, x, y) => {
    const n = f(x / 128, y / 128);
    const band = Math.sin((y / 128) * Math.PI * 2 * 5 + n * 6) * 0.5 + 0.5;
    const base = [168 - band * 40, 78 - band * 20 + n * 18, 40 - band * 10];
    const m = 0.8 + n * 0.45;
    d[i] = clamp(base[0] * m, 0, 255);
    d[i + 1] = clamp(base[1] * m, 0, 255);
    d[i + 2] = clamp(base[2] * m, 0, 255);
  });
  for (let k = 0; k < 9; k++) {
    let x = p.r(0, 128), y = p.r(0, 128);
    for (let s = 0; s < 6; s++) {
      const nx = x + p.r(-8, 8), ny = y + p.r(2, 10);
      p.line(x, y, nx, ny, 'rgba(50,18,8,0.55)', 1);
      x = nx; y = ny;
    }
  }
  p.grain(9);
});
def('rock_dark', { w: 128, size: 5 }, (p) => {
  p.fill('#6e3420').mottle(0.35, 4, 5, 2).blotch([60, 35, 30], 0.6, 0.5);
  for (let k = 0; k < 12; k++) {
    const y = p.r(0, 128);
    p.line(0, y, 128, y + p.r(-5, 5), 'rgba(30,10,4,0.35)', 1);
  }
  p.grain(12);
});
def('asphalt', { w: 128, size: 4 }, (p) => {
  p.fill('#3d3b39').mottle(0.18, 4, 4).speckle(500, ['#2a2928', '#555250', '#4a4846', '#6a6560'], 1);
  for (let k = 0; k < 5; k++) {
    let x = p.r(0, 128), y = p.r(0, 128);
    for (let s = 0; s < 8; s++) {
      const nx = x + p.r(-6, 6), ny = y + p.r(-6, 6);
      p.line(x, y, nx, ny, 'rgba(15,15,15,0.6)', 1);
      x = nx; y = ny;
    }
  }
  p.grain(6);
});
def('road', { w: 128, size: 8 }, (p) => {
  p.fill('#3a3836').mottle(0.16, 4, 4).speckle(600, ['#272625', '#53504d', '#45423f'], 1);
  for (let x = 0; x < 128; x += 32) p.rect(x + 4, 62, 20, 4, '#c8a020');
  p.rect(0, 4, 128, 2, '#b0b0a8');
  p.rect(0, 122, 128, 2, '#b0b0a8');
  p.grain(7);
});
def('concrete', { w: 128, size: 4 }, (p) => {
  p.fill('#8a8783').mottle(0.16, 4, 5).blotch([110, 100, 88], 0.4, 0.6).speckle(300, ['#77746f', '#9a9893', '#6a6762'], 1);
  p.line(0, 0, 128, 0, 'rgba(0,0,0,0.25)', 2).line(0, 0, 0, 128, 'rgba(0,0,0,0.25)', 2);
  p.grain(7);
});
def('concrete_dark', { w: 128, size: 4 }, (p) => {
  p.fill('#5d5b58').mottle(0.2, 4, 5).blotch([70, 62, 52], 0.5, 0.55).speckle(300, ['#4a4845', '#6f6d69'], 1);
  p.line(0, 0, 128, 0, 'rgba(0,0,0,0.3)', 2).line(0, 0, 0, 128, 'rgba(0,0,0,0.3)', 2);
  p.grain(8);
});
def('bunker', { w: 128, size: 4 }, (p) => {
  p.fill('#8f8a7c').mottle(0.2, 4, 5).blotch([120, 104, 80], 0.5, 0.55);
  for (let y = 0; y < 128; y += 32) p.line(0, y + 0.5, 128, y + 0.5, 'rgba(40,36,30,0.45)', 1);
  for (let k = 0; k < 6; k++) p.circle(p.r(4, 124), Math.floor(p.r(0, 4)) * 32 + 16, 1.5, 'rgba(30,30,30,0.6)');
  p.drips(14, [70, 40, 20], 0.25).grain(9);
});
def('metal_panel', { w: 128, size: 3 }, (p) => {
  p.fill('#6b7177').mottle(0.12, 4, 4);
  for (let y = 0; y < 128; y += 64)
    for (let x = 0; x < 128; x += 64) {
      p.bevel(x, y, 64, 64, 'rgba(255,255,255,0.18)', 'rgba(0,0,0,0.45)', 2);
      for (const [rx, ry] of [[5, 5], [57, 5], [5, 57], [57, 57]]) p.rivet(x + rx, y + ry);
    }
  p.blotch([90, 80, 70], 0.4, 0.62).grime(0.25).grain(7);
});
def('metal_blue', { w: 128, size: 3 }, (p) => {
  p.fill('#4f6274').mottle(0.12, 4, 4);
  for (let y = 0; y < 128; y += 64)
    for (let x = 0; x < 128; x += 32) {
      p.bevel(x, y, 32, 64, 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.5)', 1);
      p.rivet(x + 3, y + 3); p.rivet(x + 27, y + 59);
    }
  p.grime(0.3).grain(6);
});
def('metal_floor', { w: 64, size: 1.5 }, (p) => {
  p.fill('#686b6c').mottle(0.12, 2, 3);
  for (let y = 0; y < 64; y += 8)
    for (let x = 0; x < 64; x += 8) {
      const o = (y / 8) % 2 ? 4 : 0;
      p.line(x + o + 1, y + 5, x + o + 5, y + 1, 'rgba(210,210,210,0.6)', 1.4);
      p.line(x + o + 2, y + 6, x + o + 6, y + 2, 'rgba(20,20,20,0.5)', 1);
    }
  p.blotch([70, 60, 50], 0.4, 0.6).grain(6);
});
def('rust', { w: 128, size: 3 }, (p) => {
  p.fill('#6d4630').mottle(0.3, 4, 5).blotch([140, 70, 30], 0.7, 0.5).blotch([60, 50, 45], 0.5, 0.6, 4, 9);
  p.speckle(200, ['#3c2014', '#a0582a', '#c07040'], [1, 2]).grain(10);
});
def('corrugated', { w: 64, size: 2 }, (p) => {
  p.fill('#8a8e7a');
  for (let x = 0; x < 64; x += 8) {
    p.rect(x, 0, 3, 64, 'rgba(255,255,255,0.18)');
    p.rect(x + 5, 0, 3, 64, 'rgba(0,0,0,0.25)');
  }
  p.mottle(0.15, 2, 3).blotch([130, 80, 40], 0.6, 0.6).drips(8, [90, 50, 20], 0.3).grain(7);
});
def('corrugated_green', { w: 64, size: 2 }, (p) => {
  p.fill('#55603e');
  for (let x = 0; x < 64; x += 8) {
    p.rect(x, 0, 3, 64, 'rgba(255,255,255,0.14)');
    p.rect(x + 5, 0, 3, 64, 'rgba(0,0,0,0.28)');
  }
  p.mottle(0.15, 2, 3).blotch([110, 80, 50], 0.5, 0.62).grain(7);
});
def('hazard', { w: 64, size: 1 }, (p) => {
  p.fill('#1b1a17');
  const g = p.ctx;
  g.fillStyle = '#d6a51c';
  for (let k = -64; k < 128; k += 32) {
    g.beginPath();
    g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 + 64, 64); g.lineTo(k + 64, 64);
    g.fill();
  }
  p.mottle(0.18, 2, 3).blotch([60, 50, 40], 0.5, 0.6).grain(8);
});
def('fence', { w: 64, size: 1.4, mode: 'alpha' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#a9adae';
  g.lineWidth = 1.5;
  for (let k = -64; k <= 64; k += 16) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke();
    g.beginPath(); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke();
  }
  g.strokeStyle = 'rgba(60,60,60,1)';
  g.lineWidth = 0.6;
  for (let k = -64; k <= 64; k += 16) {
    g.beginPath(); g.moveTo(k + 1, 0); g.lineTo(k + 65, 64); g.stroke();
  }
});
def('barbed', { w: 64, size: 1, mode: 'alpha' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#8f8f8a';
  g.lineWidth = 1.2;
  for (let c = 0; c < 4; c++) {
    g.beginPath();
    for (let x = 0; x <= 64; x++) {
      const y = 32 + Math.sin((x / 64) * Math.PI * 4 + c * 1.6) * 24;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let k = 0; k < 18; k++) {
    const x = p.r(0, 64), y = p.r(10, 54);
    g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.stroke();
  }
});
def('sandbag', { w: 64, size: 1.2 }, (p) => {
  p.fill('#4a3d28');
  for (let row = 0; row < 4; row++) {
    const o = row % 2 ? 16 : 0;
    for (let x = -32; x < 96; x += 32) {
      const bx = x + o, by = row * 16;
      p.ctx.fillStyle = '#b09a6a';
      p.ctx.beginPath();
      p.ctx.ellipse(bx + 16, by + 8, 15, 7, 0, 0, Math.PI * 2);
      p.ctx.fill();
      p.rect(bx + 4, by + 2, 24, 2, 'rgba(255,255,255,0.12)');
      p.rect(bx + 6, by + 12, 20, 2, 'rgba(0,0,0,0.18)');
    }
  }
  p.mottle(0.18, 2, 3).grain(14);
});
def('crate', { w: 64, size: 1, uv: 'fit' }, (p) => {
  p.fill('#9c7442');
  for (let y = 0; y < 64; y += 8) {
    p.rect(0, y, 64, 1, 'rgba(60,35,15,0.6)');
    p.rect(0, y + 1, 64, 1, 'rgba(255,220,160,0.15)');
  }
  p.mottle(0.18, 2, 4);
  // frame
  p.rect(0, 0, 64, 7, '#7a5530').rect(0, 57, 64, 7, '#7a5530').rect(0, 0, 7, 64, '#7a5530').rect(57, 0, 7, 64, '#7a5530');
  p.bevel(0, 0, 64, 64, 'rgba(255,220,170,0.35)', 'rgba(30,15,5,0.6)', 1);
  p.bevel(7, 7, 50, 50, 'rgba(30,15,5,0.5)', 'rgba(255,220,170,0.2)', 1);
  // diagonal brace
  p.line(9, 55, 55, 9, '#7a5530', 7).line(9, 55, 55, 9, 'rgba(255,220,170,0.15)', 1);
  for (const [x, y] of [[3, 3], [59, 3], [3, 59], [59, 59]]) p.rivet(x, y);
  p.text('THIS SIDE UP', 32, 61, 4, 'rgba(40,20,5,0.6)', COND);
  p.grain(8);
});
def('crate_ammo', { w: 64, size: 1, uv: 'fit' }, (p) => {
  p.fill('#4f5a34').mottle(0.15, 2, 4);
  p.bevel(0, 0, 64, 64, 'rgba(255,255,220,0.25)', 'rgba(0,0,0,0.6)', 2);
  p.rect(0, 14, 64, 3, 'rgba(0,0,0,0.35)').rect(0, 47, 64, 3, 'rgba(0,0,0,0.35)');
  p.text('AMMO', 32, 26, 12, 'rgba(225,215,170,0.85)');
  p.text('5.56MM  ODF', 32, 38, 6, 'rgba(225,215,170,0.7)', COND);
  for (const [x, y] of [[4, 4], [58, 4], [4, 58], [58, 58]]) p.rivet(x, y);
  p.blotch([90, 70, 40], 0.5, 0.62).grain(8);
});
def('crate_metal', { w: 64, size: 1, uv: 'fit' }, (p) => {
  p.fill('#5d666b').mottle(0.12, 2, 4);
  p.bevel(0, 0, 64, 64, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)', 3);
  p.bevel(10, 10, 44, 44, 'rgba(0,0,0,0.4)', 'rgba(255,255,255,0.2)', 2);
  p.rect(28, 2, 8, 60, 'rgba(0,0,0,0.15)');
  p.text('▲ ODF ▲', 32, 32, 7, 'rgba(230,190,40,0.8)', COND);
  p.grime(0.3).grain(7);
});
def('wood', { w: 64, size: 2 }, (p) => {
  p.fill('#7d5634');
  for (let y = 0; y < 64; y += 8) {
    p.rect(0, y, 64, 1, 'rgba(40,20,10,0.7)');
    const o = p.r(0, 64);
    p.rect(o, y, 1, 8, 'rgba(40,20,10,0.6)');
  }
  p.mottle(0.2, 2, 4).pixels((d, i, x, y) => {
    const s = Math.sin(x * 0.4 + Math.sin(y * 0.3) * 2) * 8;
    d[i] += s; d[i + 1] += s * 0.7; d[i + 2] += s * 0.4;
  }).grain(8);
});
def('tent', { w: 64, size: 2 }, (p) => {
  p.fill('#5b6040').mottle(0.2, 2, 4);
  for (let y = 0; y < 64; y += 2) p.rect(0, y, 64, 1, 'rgba(0,0,0,0.06)');
  for (let x = 0; x < 64; x += 2) p.rect(x, 0, 1, 64, 'rgba(255,255,255,0.04)');
  p.blotch([90, 80, 60], 0.4, 0.6).grime(0.2).grain(8);
});
def('olive', { w: 64, size: 2 }, (p) => {
  p.fill('#4c5434').mottle(0.15, 2, 4).blotch([80, 70, 50], 0.5, 0.62).speckle(60, ['#3a3f28', '#606844'], 1).grime(0.25).grain(6);
});
def('tire', { w: 32, size: 0.5 }, (p) => {
  p.fill('#1e1e1e');
  for (let y = 0; y < 32; y += 4) p.rect(0, y, 32, 2, '#2c2c2c');
  p.grain(8);
});
def('canvas_roof', { w: 64, size: 3 }, (p) => {
  p.fill('#6b6a4a').mottle(0.2, 2, 4).grain(8);
});
def('water_tank', { w: 64, size: 2 }, (p) => {
  p.fill('#8e9396').mottle(0.12, 2, 4);
  for (let y = 0; y < 64; y += 16) p.rect(0, y, 64, 2, 'rgba(0,0,0,0.3)');
  for (let x = 2; x < 64; x += 8) for (let y = 4; y < 64; y += 16) p.rivet(x, y);
  p.drips(10, [110, 60, 20], 0.35).grain(6);
});
def('spinifex', { w: 64, size: 1, mode: 'alpha', uv: 'fit' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  for (let k = 0; k < 80; k++) {
    const x0 = 32 + p.r(-10, 10), a = p.r(-1.3, 1.3), len = p.r(20, 58);
    g.strokeStyle = `rgb(${p.r(150, 200)},${p.r(150, 180)},${p.r(70, 100)})`;
    g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x0, 64); g.lineTo(x0 + Math.sin(a) * len, 64 - Math.cos(a) * len); g.stroke();
  }
});
def('deadtree', { w: 64, size: 1, mode: 'alpha', uv: 'fit' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#5a4a3a';
  const branch = (x, y, a, len, w) => {
    if (len < 3) return;
    const nx = x + Math.sin(a) * len, ny = y - Math.cos(a) * len;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
    branch(nx, ny, a - p.r(0.3, 0.7), len * 0.7, w * 0.7);
    branch(nx, ny, a + p.r(0.3, 0.7), len * 0.68, w * 0.7);
  };
  branch(32, 64, 0, 20, 5);
});

// ---------- indoor ----------
def('tile_floor', { w: 64, size: 2 }, (p) => {
  for (let y = 0; y < 64; y += 32)
    for (let x = 0; x < 64; x += 32) {
      const alt = ((x + y) / 32) % 2;
      p.rect(x, y, 32, 32, alt ? '#8c8676' : '#a39d8a');
      p.bevel(x, y, 32, 32, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.3)', 1);
    }
  p.mottle(0.12, 2, 4).speckle(80, ['rgba(60,50,40,0.5)', 'rgba(255,255,255,0.2)'], 1).grain(6);
});
def('tile_white', { w: 64, size: 1.2 }, (p) => {
  p.fill('#b9bcb8');
  for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) p.bevel(x, y, 16, 16, 'rgba(255,255,255,0.35)', 'rgba(0,0,0,0.25)', 1);
  p.mottle(0.08, 2, 3).blotch([150, 140, 110], 0.3, 0.62).grain(5);
});
def('office_wall', { w: 128, size: 3 }, (p) => {
  p.fill('#a8a088');
  p.mottle(0.1, 4, 4);
  // lower wainscot (bottom 36%)
  p.rect(0, 82, 128, 46, '#6c5b45');
  p.rect(0, 80, 128, 3, '#3e3226');
  p.rect(0, 83, 128, 1, 'rgba(255,255,255,0.15)');
  for (let x = 0; x < 128; x += 32) p.rect(x, 84, 1, 44, 'rgba(0,0,0,0.25)');
  p.grime(0.2, 0.85).grain(6);
});
def('lab_wall', { w: 128, size: 3 }, (p) => {
  p.fill('#9ea6a8').mottle(0.08, 4, 4);
  for (let x = 0; x < 128; x += 64) p.bevel(x, 0, 64, 128, 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.3)', 1);
  p.rect(0, 86, 128, 6, '#2c4a6a');
  p.rect(0, 92, 128, 36, '#6f7a7d');
  p.grime(0.2, 0.85).grain(5);
});
def('concrete_wall', { w: 128, size: 4 }, (p) => {
  p.fill('#7c8286').mottle(0.12, 4, 5);
  p.rect(0, 0, 128, 80, '#868c8f');
  p.rect(0, 80, 128, 48, '#5a6064');
  p.rect(0, 86, 128, 5, '#b8901e');
  p.rect(0, 80, 128, 1, 'rgba(0,0,0,0.4)');
  for (let x = 0; x < 128; x += 64) p.rect(x, 0, 1, 128, 'rgba(0,0,0,0.25)');
  p.blotch([90, 85, 75], 0.3, 0.62).drips(6, [40, 30, 20], 0.15).grain(6);
});
def('ceiling', { w: 64, size: 1.2 }, (p) => {
  p.fill('#bdb9ad');
  p.speckle(220, ['rgba(80,80,70,0.5)', 'rgba(120,115,100,0.5)'], 1);
  p.bevel(0, 0, 64, 64, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.45)', 2);
  p.blotch([150, 130, 90], 0.4, 0.68).grain(4);
});
def('carpet', { w: 64, size: 2 }, (p) => {
  p.fill('#4c5462').mottle(0.15, 2, 4).grain(16).blotch([60, 55, 50], 0.3, 0.6);
});
def('door', { w: 64, h: 128, uv: 'fit' }, (p) => {
  p.fill('#6a7276').mottle(0.08, 2, 4);
  p.bevel(0, 0, 64, 128, 'rgba(255,255,255,0.25)', 'rgba(0,0,0,0.6)', 3);
  p.rect(18, 18, 28, 26, '#1a2228');
  p.rect(20, 20, 24, 22, '#3a5060');
  p.rect(22, 22, 8, 18, 'rgba(255,255,255,0.12)');
  p.bevel(16, 16, 32, 30, 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.2)', 2);
  p.rect(48, 66, 8, 4, '#2a2a2a').rect(48, 66, 8, 1, '#999');
  p.rect(6, 96, 52, 20, 'rgba(0,0,0,0.12)');
  p.grime(0.3, 0.8).grain(6);
});
def('door_red', { w: 64, h: 128, uv: 'fit' }, (p) => {
  p.fill('#6a6466').mottle(0.08, 2, 4);
  p.bevel(0, 0, 64, 128, 'rgba(255,255,255,0.25)', 'rgba(0,0,0,0.6)', 3);
  p.rect(0, 50, 64, 14, '#8a1a14').rect(0, 52, 64, 2, 'rgba(255,255,255,0.2)');
  p.text('RESTRICTED', 32, 57, 7, '#f0e0d0', COND);
  p.rect(18, 14, 28, 26, '#1a2228').rect(20, 16, 24, 22, '#3a5060');
  p.rect(48, 72, 8, 4, '#2a2a2a');
  p.grime(0.3, 0.8).grain(6);
});
def('door_blast', { w: 128, h: 128, uv: 'fit' }, (p) => {
  p.fill('#6d6a5e').mottle(0.14, 4, 4);
  for (let y = 0; y < 128; y += 32) p.bevel(0, y, 128, 32, 'rgba(255,255,255,0.18)', 'rgba(0,0,0,0.5)', 2);
  const g = p.ctx;
  g.save();
  g.beginPath(); g.rect(0, 0, 128, 14); g.rect(0, 114, 128, 14); g.clip();
  g.fillStyle = '#d6a51c';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1b1a17';
  for (let k = -128; k < 256; k += 20) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 10, 0); g.lineTo(k + 138, 128); g.lineTo(k + 128, 128); g.fill(); }
  g.restore();
  p.rect(62, 0, 4, 128, 'rgba(0,0,0,0.6)');
  p.text('B-01', 32, 64, 18, 'rgba(220,210,190,0.75)');
  p.text('B-01', 96, 64, 18, 'rgba(220,210,190,0.75)');
  p.drips(16, [70, 40, 20], 0.3).grain(8);
});
def('door_elevator', { w: 64, h: 128, uv: 'fit' }, (p) => {
  p.fill('#8a8f92');
  p.pixels((d, i, x) => { const s = Math.sin(x * 1.3) * 6; d[i] += s; d[i + 1] += s; d[i + 2] += s; });
  p.rect(31, 0, 2, 128, 'rgba(0,0,0,0.6)');
  p.bevel(0, 0, 64, 128, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.5)', 2);
  p.grain(5);
});
def('door_garage', { w: 128, h: 128, uv: 'fit' }, (p) => {
  p.fill('#7a7f70');
  for (let y = 0; y < 128; y += 12) { p.rect(0, y, 128, 2, 'rgba(0,0,0,0.4)'); p.rect(0, y + 2, 128, 1, 'rgba(255,255,255,0.2)'); }
  p.mottle(0.15, 4, 4).drips(10, [90, 50, 20], 0.3).grain(7);
});
def('vent', { w: 64, size: 1.2 }, (p) => {
  p.fill('#7e8487').mottle(0.1, 2, 4);
  p.rect(0, 0, 64, 2, 'rgba(0,0,0,0.45)').rect(0, 2, 64, 1, 'rgba(255,255,255,0.3)');
  p.rect(0, 0, 2, 64, 'rgba(0,0,0,0.35)');
  for (let x = 4; x < 64; x += 10) p.rivet(x, 5);
  p.blotch([60, 55, 50], 0.5, 0.58).grain(6);
});
def('vent_grate', { w: 64, size: 1, uv: 'fit', mode: 'alpha' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  p.rect(0, 0, 64, 64, '#6a6f72');
  for (let y = 6; y < 58; y += 6) g.clearRect(6, y, 52, 3);
  p.bevel(0, 0, 64, 64, '#9aa0a4', '#3a3d40', 2);
  for (const [x, y] of [[2, 2], [60, 2], [2, 60], [60, 60]]) p.rivet(x, y);
});
def('grate', { w: 64, size: 1, mode: 'alpha' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#5d6264';
  for (let k = 0; k < 64; k += 8) { g.fillRect(k, 0, 2, 64); g.fillRect(0, k, 64, 2); }
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let k = 0; k < 64; k += 8) g.fillRect(k, 0, 1, 64);
});
def('light', { w: 32, size: 1, uv: 'fit', mode: 'fullbright' }, (p) => {
  p.fill('#e8eef0').rect(0, 0, 32, 3, '#9aa').rect(0, 29, 32, 3, '#9aa').rect(0, 0, 3, 32, '#9aa').rect(29, 0, 3, 32, '#9aa');
  p.rect(4, 15, 24, 2, '#c8d4d8').grain(3);
});
def('lamp_warm', { w: 32, size: 1, uv: 'fit', mode: 'fullbright' }, (p) => {
  p.fill('#ffe6a0').rect(0, 0, 32, 2, '#a08040').rect(0, 30, 32, 2, '#a08040').grain(4);
});
def('light_red', { w: 32, size: 1, uv: 'fit', mode: 'fullbright' }, (p) => {
  p.fill('#ff3020').rect(0, 0, 32, 3, '#601008').rect(0, 29, 32, 3, '#601008').grain(4);
});
def('light_blue', { w: 32, size: 1, uv: 'fit', mode: 'fullbright' }, (p) => {
  p.fill('#90c8ff').rect(0, 0, 32, 3, '#405070').rect(0, 29, 32, 3, '#405070').grain(3);
});
def('console', { w: 128, h: 64, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#3d4448').mottle(0.1, 2, 4);
  p.bevel(0, 0, 128, 64, 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.6)', 2);
  p.rect(6, 6, 50, 30, '#101614');
  p.glowRect(8, 8, 46, 26, '#1d4a2a', 0.9);
  for (let k = 0; k < 5; k++) p.glowRect(10, 11 + k * 5, p.r(12, 40), 2, '#7af090', 1);
  for (let row = 0; row < 3; row++)
    for (let c = 0; c < 8; c++) {
      const cols = ['#e03a2a', '#e8c030', '#40c050', '#3a80e0', '#dddddd'];
      const col = cols[Math.floor(p.r(0, cols.length))];
      if (p.r() > 0.4) p.glowRect(64 + c * 7, 8 + row * 9, 4, 4, col, 0.9);
      else p.rect(64 + c * 7, 8 + row * 9, 4, 4, '#222');
    }
  for (let c = 0; c < 6; c++) {
    p.rect(8 + c * 19, 44, 14, 14, '#25292b');
    p.bevel(8 + c * 19, 44, 14, 14, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)', 1);
    p.rect(12 + c * 19, 48, 6, 6, c % 2 ? '#8a2018' : '#5a5a5a');
  }
  p.grain(5);
});
def('screen_green', { w: 64, h: 48, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#0b120d');
  p.glowRect(2, 2, 60, 44, '#0f2a16', 0.8);
  const lines = ['ODF NET v2.1', '> LOGIN: ****', '> SILO 7 ONLINE', '> THREAT: ROO?', '> STATUS: OK', '> _'];
  lines.forEach((l, i) => p.glowText(l, 4, 7 + i * 7, 5.5, '#6cf08a', COND));
  for (let y = 0; y < 48; y += 2) p.rect(0, y, 64, 1, 'rgba(0,0,0,0.25)');
});
def('screen_radar', { w: 64, h: 48, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#061008');
  p.glowRect(0, 0, 64, 48, '#082010', 0.7);
  const g = p.ctx;
  g.strokeStyle = '#3bd060';
  for (let r = 6; r < 24; r += 6) { g.beginPath(); g.arc(32, 24, r, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(32, 24); g.lineTo(52, 12); g.stroke();
  p.glowRect(40, 14, 3, 3, '#f04030', 1).glowRect(20, 30, 2, 2, '#80ff90', 1);
  const gg = p.glowCtx();
  gg.strokeStyle = '#999';
  for (let r = 6; r < 24; r += 6) { gg.beginPath(); gg.arc(32, 24, r, 0, Math.PI * 2); gg.stroke(); }
});
def('screen_cctv', { w: 64, h: 48, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#222');
  p.glowRect(1, 1, 62, 46, '#5a6a6a', 0.75);
  p.rect(1, 30, 62, 17, '#3a4444').rect(10, 12, 14, 18, '#4a5555').rect(40, 6, 18, 24, '#455050');
  drawRoo(p, 32, 24, 0.55, 'rgba(20,20,20,0.85)');
  p.glowText('CAM 04', 4, 6, 5, '#e8e8e8');
  p.glowText('● REC', 44, 6, 5, '#ff3030');
  for (let y = 0; y < 48; y += 2) p.rect(0, y, 64, 1, 'rgba(0,0,0,0.22)');
  p.grain(14);
});
def('screen_missile', { w: 64, h: 48, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#100808');
  p.glowRect(1, 1, 62, 46, '#200a08', 0.7);
  p.glowRect(28, 8, 8, 32, '#c8c8c8', 1);
  p.glowRect(30, 4, 4, 4, '#ff4030', 1);
  p.glowText('SILO 7', 4, 8, 6, '#ff9040');
  p.glowText('ARMED', 40, 40, 6, '#ff3020');
});
def('server', { w: 64, size: 2, mode: 'glow' }, (p) => {
  p.fill('#1d2124');
  for (let y = 0; y < 64; y += 8) {
    p.rect(2, y + 1, 60, 6, '#2e3438');
    p.bevel(2, y + 1, 60, 6, 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.5)', 1);
    for (let k = 0; k < 5; k++) {
      const c = p.r() > 0.3 ? (p.r() > 0.5 ? '#30ff60' : '#ffb020') : '#ff3020';
      if (p.r() > 0.3) p.glowRect(6 + k * 4, y + 3, 2, 2, c, 1);
    }
    for (let k = 0; k < 6; k++) p.rect(34 + k * 4, y + 2, 2, 4, '#15181a');
  }
  p.grain(4);
});
def('locker', { w: 64, h: 128, uv: 'fit' }, (p) => {
  p.fill('#5b6a58').mottle(0.1, 2, 4);
  p.bevel(0, 0, 64, 128, 'rgba(255,255,255,0.25)', 'rgba(0,0,0,0.6)', 2);
  for (let y = 10; y < 34; y += 4) p.rect(14, y, 36, 2, 'rgba(0,0,0,0.55)');
  p.rect(50, 60, 4, 12, '#2a2a2a');
  p.grime(0.25, 0.8).grain(7);
});
def('glass', { w: 32, size: 2, mode: 'glass' }, (p) => {
  p.fill('rgba(160,200,215,1)');
  p.line(4, 28, 14, 18, 'rgba(255,255,255,1)', 2).line(10, 30, 24, 16, 'rgba(255,255,255,1)', 1);
});
def('black', { w: 8, size: 1 }, (p) => p.fill('#080808'));
def('white_paint', { w: 64, size: 2 }, (p) => p.fill('#c8c8c0').mottle(0.08, 2, 4).grain(5));
def('silo_wall', { w: 128, size: 4 }, (p) => {
  p.fill('#5f6062').mottle(0.16, 4, 5);
  for (let y = 0; y < 128; y += 32) {
    p.rect(0, y, 128, 6, '#4a4b4d');
    p.rect(0, y, 128, 1, 'rgba(255,255,255,0.18)');
    p.rect(0, y + 6, 128, 1, 'rgba(0,0,0,0.4)');
  }
  for (let x = 0; x < 128; x += 32) for (let y = 3; y < 128; y += 32) p.rivet(x + 16, y);
  p.drips(18, [40, 30, 20], 0.25).blotch([70, 60, 50], 0.4, 0.6).grain(7);
});
def('pipe', { w: 32, size: 1 }, (p) => {
  p.fill('#7a7d6e');
  p.pixels((d, i, x) => { const s = Math.cos((x / 32) * Math.PI * 2) * 30; d[i] += s; d[i + 1] += s; d[i + 2] += s; });
  p.rect(0, 28, 32, 4, '#3a3a34').grain(5);
});
def('pipe_red', { w: 32, size: 1 }, (p) => {
  p.fill('#8a3024');
  p.pixels((d, i, x) => { const s = Math.cos((x / 32) * Math.PI * 2) * 30; d[i] += s; d[i + 1] += s; d[i + 2] += s; });
  p.grain(5);
});
def('brick', { w: 64, size: 2 }, (p) => {
  p.fill('#5a4a40');
  for (let row = 0; row < 8; row++) {
    const o = row % 2 ? 8 : 0;
    for (let x = -16; x < 64; x += 16) {
      const c = 120 + p.r(-20, 20);
      p.rect(x + o + 1, row * 8 + 1, 14, 6, rgb(c, c * 0.5, c * 0.38));
    }
  }
  p.mottle(0.15, 2, 4).grain(8);
});
def('rubber', { w: 64, size: 2 }, (p) => {
  p.fill('#2b2d2e').mottle(0.15, 2, 4);
  for (let y = 0; y < 64; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 64; x += 4) p.rect(x, y, 1, 1, '#3c3f40');
  p.grain(5);
});
def('generator', { w: 128, h: 64, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#4c5848').mottle(0.12, 2, 4);
  p.bevel(0, 0, 128, 64, 'rgba(255,255,255,0.25)', 'rgba(0,0,0,0.6)', 2);
  for (let x = 10; x < 70; x += 6) p.rect(x, 10, 3, 44, 'rgba(0,0,0,0.5)');
  p.rect(80, 10, 38, 20, '#1c1c1c');
  p.glowRect(82, 12, 34, 16, '#2a1a08', 0.6);
  p.glowText('480V', 84, 20, 8, '#ffb030');
  p.glowRect(84, 38, 6, 6, '#30ff60', 1).glowRect(96, 38, 6, 6, '#ff3020', 1);
  p.text('⚡ DANGER', 99, 54, 7, '#e0c020', COND);
  p.grime(0.3).grain(6);
});
def('button', { w: 32, size: 1, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#3a3e40').bevel(0, 0, 32, 32, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)', 2);
  p.circle(16, 16, 9, '#222');
  p.ctx.fillStyle = '#d02818';
  p.ctx.beginPath(); p.ctx.arc(16, 16, 7, 0, Math.PI * 2); p.ctx.fill();
  const g = p.glowCtx(); g.fillStyle = '#aaa'; g.beginPath(); g.arc(16, 16, 7, 0, Math.PI * 2); g.fill();
  p.circle(14, 14, 2, 'rgba(255,255,255,0.4)');
});
def('button_on', { w: 32, size: 1, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#3a3e40').bevel(0, 0, 32, 32, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)', 2);
  p.circle(16, 16, 9, '#222');
  p.ctx.fillStyle = '#30e050';
  p.ctx.beginPath(); p.ctx.arc(16, 16, 7, 0, Math.PI * 2); p.ctx.fill();
  const g = p.glowCtx(); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 7, 0, Math.PI * 2); g.fill();
});
def('keypad_red', { w: 32, size: 1, uv: 'fit', mode: 'glow' }, (p) => {
  p.fill('#2f3335').bevel(0, 0, 32, 32, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)', 2);
  p.rect(6, 5, 20, 8, '#111').glowRect(8, 7, 16, 4, '#ff3020', 1);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) p.rect(8 + x * 6, 16 + y * 5, 4, 3, '#777');
});
def('missile', { w: 128, h: 128, uv: 'fit' }, (p) => {
  p.fill('#d8d8d2').mottle(0.06, 2, 4);
  p.rect(0, 10, 128, 6, '#1b1b1b').rect(0, 100, 128, 10, '#1b1b1b');
  p.rect(0, 58, 128, 3, '#b02018');
  p.text('O D F', 32, 40, 14, '#1b1b1b');
  p.text('SILO 7', 96, 40, 11, '#1b1b1b');
  p.text('☢', 64, 80, 20, '#c8a020');
  p.grain(4);
});
def('flag', { w: 64, h: 32, uv: 'fit' }, (p) => {
  p.fill('#1b2a6a');
  p.rect(0, 0, 28, 16, '#20307a');
  p.line(0, 0, 28, 16, '#fff', 3).line(28, 0, 0, 16, '#fff', 3).line(0, 0, 28, 16, '#c02020', 1).line(28, 0, 0, 16, '#c02020', 1);
  p.rect(12, 0, 4, 16, '#fff').rect(0, 6, 28, 4, '#fff').rect(13, 0, 2, 16, '#c02020').rect(0, 7, 28, 2, '#c02020');
  for (const [x, y] of [[44, 8], [52, 14], [40, 20], [50, 24], [46, 16]]) p.text('✦', x, y, 6, '#fff');
  p.text('✦', 14, 25, 9, '#fff');
  p.grain(6);
});

// ---------- signage & posters ----------
function sign(name, w, h, paint) {
  def(name, { w, h, uv: 'fit' }, (p) => { paint(p); p.grain(5); });
}
sign('sign_restricted', 128, 64, (p) => {
  p.fill('#e8e4d8').bevel(0, 0, 128, 64, '#fff', '#888', 2);
  p.rect(4, 4, 120, 18, '#b01818');
  p.text('WARNING', 64, 13, 13, '#fff');
  p.text('RESTRICTED AREA', 64, 31, 10, '#1a1a1a');
  p.text('DEADLY FORCE AUTHORISED', 64, 43, 7, '#1a1a1a', COND);
  p.text('OUTBACK DEFENCE FORCE', 64, 54, 6, '#b01818', COND);
  p.drips(5, [100, 60, 30], 0.2);
});
sign('sign_noroos', 64, 64, (p) => {
  p.fill('#f0eee4').bevel(0, 0, 64, 64, '#fff', '#888', 2);
  drawRoo(p, 30, 34, 1.0, '#1a1a1a');
  const g = p.ctx;
  g.strokeStyle = '#c01818'; g.lineWidth = 6;
  g.beginPath(); g.arc(32, 32, 25, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.stroke();
});
sign('sign_silo', 64, 64, (p) => {
  p.fill('#d6a51c').bevel(0, 0, 64, 64, '#ffe080', '#806010', 2);
  trefoil(p, 32, 26, 16, '#151515', '#d6a51c');
  p.text('SILO 7', 32, 54, 10, '#151515');
});
sign('sign_nuclear', 64, 64, (p) => {
  p.fill('#151515');
  trefoil(p, 32, 30, 22, '#d6a51c', '#151515');
  p.text('CAUTION', 32, 58, 8, '#d6a51c');
});
function roomSign(name, label, bg = '#2a4a7a') {
  sign(name, 128, 32, (p) => {
    p.fill(bg).bevel(0, 0, 128, 32, 'rgba(255,255,255,0.35)', 'rgba(0,0,0,0.5)', 2);
    p.text(label, 64, 17, label.length > 12 ? 11 : 14, '#f2f2f2');
  });
}
roomSign('sign_security', 'SECURITY');
roomSign('sign_armory', 'ARMOURY', '#7a2a1a');
roomSign('sign_barracks', 'BARRACKS');
roomSign('sign_mess', 'MESS HALL');
roomSign('sign_generator', 'GENERATOR', '#7a5a10');
roomSign('sign_launch', 'LAUNCH CONTROL', '#7a1a1a');
roomSign('sign_elevator', 'ELEVATOR ▼ SILO');
roomSign('sign_lab', 'R&D: PROJECT EMU', '#3a5a3a');
roomSign('sign_fuel', 'FUEL SYSTEMS', '#7a5a10');
roomSign('sign_server', 'SERVER ROOM');
roomSign('sign_level1', 'SILO LEVEL 1');
roomSign('sign_level2', 'SILO LEVEL 2');
roomSign('sign_level3', 'SILO LEVEL 3');
roomSign('sign_commander', 'BASE COMMANDER', '#4a3a1a');
roomSign('sign_exit', 'EXIT', '#1a7a2a');
roomSign('sign_comms', 'COMMS', '#3a4a5a');
def('sign_roocross', { w: 64, h: 64, uv: 'fit', mode: 'alpha' }, (p) => {
  const g = p.ctx;
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#1a1a1a';
  g.beginPath(); g.moveTo(32, 1); g.lineTo(63, 32); g.lineTo(32, 63); g.lineTo(1, 32); g.closePath(); g.fill();
  g.fillStyle = '#e8b818';
  g.beginPath(); g.moveTo(32, 4); g.lineTo(60, 32); g.lineTo(32, 60); g.lineTo(4, 32); g.closePath(); g.fill();
  drawRoo(p, 31, 33, 0.95, '#1a1a1a');
  p.grain(6);
});
sign('poster_wanted', 64, 96, (p) => {
  p.fill('#d8cba0').mottle(0.12, 2, 4);
  p.text('WANTED', 32, 12, 13, '#3a1a0a');
  p.rect(8, 22, 48, 44, '#efe6c8').bevel(8, 22, 48, 44, '#fff', '#8a7a5a', 1);
  drawRoo(p, 30, 46, 1.0, '#3a2a1a');
  p.text('KANGAROO', 32, 74, 9, '#3a1a0a');
  p.text('ARMED & BOUNCY', 32, 83, 6, '#7a1a0a', COND);
  p.text('$10,000 REWARD', 32, 91, 6, '#3a1a0a', COND);
});
sign('poster_safety', 64, 96, (p) => {
  p.fill('#e0e0d8');
  p.rect(0, 0, 64, 20, '#1a5a2a');
  p.text('SAFETY', 32, 10, 12, '#fff');
  p.text('NO HOPPING', 32, 34, 8, '#1a1a1a');
  p.text('IN CORRIDORS', 32, 44, 8, '#1a1a1a');
  drawRoo(p, 30, 70, 0.7, '#555');
  p.text('312 DAYS WITHOUT', 32, 88, 5, '#1a1a1a', COND);
  p.text('A ROO INCIDENT', 32, 93, 5, '#1a1a1a', COND);
});
sign('poster_emu', 64, 96, (p) => {
  p.fill('#2a2a3a');
  p.text('REMEMBER', 32, 10, 9, '#e8c040');
  p.text('1932', 32, 24, 16, '#e8e8e8');
  const g = p.ctx; g.fillStyle = '#111';
  g.beginPath(); g.ellipse(32, 60, 12, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(40, 38, 3, 20); g.beginPath(); g.ellipse(43, 37, 4, 3, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(27, 66, 2, 14); g.fillRect(35, 66, 2, 14);
  p.text('NEVER AGAIN', 32, 88, 8, '#e8c040');
});
sign('whiteboard', 128, 64, (p) => {
  p.fill('#ececec').bevel(0, 0, 128, 64, '#aaa', '#555', 3);
  p.text('OPERATION: PERIMETER', 64, 10, 7, '#2040a0', COND);
  const g = p.ctx; g.strokeStyle = '#c02020'; g.lineWidth = 1.5;
  g.strokeRect(14, 18, 30, 20); g.strokeRect(70, 22, 40, 26);
  g.beginPath(); g.moveTo(44, 28); g.lineTo(70, 34); g.stroke();
  drawRoo(p, 92, 36, 0.4, '#c02020');
  p.text('??!', 112, 22, 8, '#c02020');
  p.text('DO NOT FEED THE ROO', 40, 52, 6, '#202020', COND);
  p.text('FUEL CODE: 0451', 96, 58, 6, '#2040a0', COND);
});
sign('map_board', 128, 64, (p) => {
  p.fill('#d0c8a8').bevel(0, 0, 128, 64, '#e8e0c8', '#5a4a30', 3);
  p.rect(10, 8, 108, 48, '#c2b48c');
  p.rect(20, 14, 30, 16, 'rgba(60,60,60,0.5)').rect(60, 14, 40, 30, 'rgba(60,60,60,0.5)').rect(30, 36, 20, 14, 'rgba(160,30,30,0.6)');
  p.text('YOU ARE HERE', 40, 54, 5, '#a01010', COND);
  p.circle(40, 46, 2, '#d01010');
});
sign('vending', 64, 128, (p) => {
  p.fill('#a01818').bevel(0, 0, 64, 128, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)', 2);
  p.rect(6, 10, 34, 80, '#1a1a1a');
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) p.rect(9 + c * 10, 14 + r * 15, 8, 10, ['#e0c020', '#2060c0', '#20a040', '#e06020'][(r + c) % 4]);
  p.text('VEGEMITE', 32, 100, 8, '#ffe040');
  p.text('COLD DRINKS', 32, 112, 6, '#fff', COND);
  p.rect(46, 30, 12, 20, '#222').rect(48, 34, 8, 3, '#e8e8e8');
});
sign('bunk', 64, 32, (p) => {
  p.fill('#5a6648').mottle(0.15, 2, 4);
  p.rect(0, 0, 64, 6, '#e0e0d8');
  p.rect(2, 8, 60, 22, '#4a5638');
  p.rect(4, 9, 16, 8, '#d8d8cc');
});
sign('table_top', 64, 64, (p) => { p.fill('#8a7a62').mottle(0.1, 2, 4).bevel(0, 0, 64, 64, '#a89878', '#4a3a28', 2); });
sign('shelf', 64, 64, (p) => {
  p.fill('#4a4f52');
  for (let y = 0; y < 64; y += 16) {
    p.rect(0, y + 14, 64, 2, '#6a7072');
    for (let x = 2; x < 62; x += p.r(5, 10)) {
      const h = p.r(6, 12);
      p.rect(x, y + 14 - h, 4, h, ['#8a3020', '#d0b050', '#3a5a8a', '#e0e0d0', '#4a7a3a'][Math.floor(p.r(0, 5))]);
    }
  }
});

// ---------------------------------------------------------------------------

export const TEXTURE_INFO = {};

export function generateTextures(settings = {}) {
  const out = {};
  let seed = 1000;
  for (const [name, { opts, paint }] of Object.entries(DEFS)) {
    const w = opts.w || 64, h = opts.h || w;
    const p = new Painter(w, h, seed++ * 7);
    paint(p);
    const mode = opts.mode || 'opaque';
    const img = p.ctx.getImageData(0, 0, w, h).data;
    let glow = null;
    if (mode === 'glow') glow = p.glow ? p.glow.getImageData(0, 0, w, h).data : null;
    // Flip vertically so canvas "top" maps to v = 1 (up in the world).
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const sy = h - 1 - y;
      for (let x = 0; x < w; x++) {
        const si = (sy * w + x) * 4, di = (y * w + x) * 4;
        data[di] = img[si];
        data[di + 1] = img[si + 1];
        data[di + 2] = img[si + 2];
        if (mode === 'glow') data[di + 3] = glow ? glow[si] : 0;
        else if (mode === 'alpha') data[di + 3] = img[si + 3];
        else if (mode === 'glass') data[di + 3] = 255;
        else data[di + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    applyFilter(tex, mode, settings.smoothTextures);
    tex.needsUpdate = true;
    tex.name = name;
    const info = {
      name,
      tex,
      mode,
      uv: opts.uv || 'world',
      size: opts.size || 2,
      aspect: h / w,
      canvas: p.canvas,
    };
    out[name] = info;
    TEXTURE_INFO[name] = info;
  }
  return out;
}

export function applyFilter(tex, mode, smooth) {
  if (mode === 'alpha') {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
  } else {
    tex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
    tex.minFilter = smooth ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
}

// Small textures used for sprites / particles / decals, packed in one atlas.
export function generateFxAtlas() {
  const S = 64, N = 8; // 8x8 grid of 64px cells
  const c = document.createElement('canvas');
  c.width = c.height = S * N;
  const g = c.getContext('2d');
  const cell = (i, fn) => {
    const x = (i % N) * S, y = Math.floor(i / N) * S;
    g.save();
    g.translate(x, y);
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    fn(g);
    g.restore();
  };
  const rng = mulberry32(77);
  const radial = (g, stops) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  };
  // 0: soft glow
  cell(0, (g) => radial(g, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]));
  // 1: spark
  cell(1, (g) => radial(g, [[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0)']]));
  // 2: smoke puff
  cell(2, (g) => {
    for (let k = 0; k < 14; k++) {
      const x = 32 + (rng() - 0.5) * 26, y = 32 + (rng() - 0.5) * 26, r = 8 + rng() * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
  });
  // 3: blood splat (particle)
  cell(3, (g) => {
    g.fillStyle = '#fff';
    for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(32 + (rng() - 0.5) * 30, 32 + (rng() - 0.5) * 30, 3 + rng() * 9, 0, 7); g.fill(); }
  });
  // 4: muzzle flash star
  cell(4, (g) => {
    g.translate(32, 32);
    for (let k = 0; k < 7; k++) {
      g.rotate((Math.PI * 2) / 7);
      const gr = g.createLinearGradient(0, 0, 30, 0);
      gr.addColorStop(0, 'rgba(255,255,230,1)');
      gr.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, -4); g.lineTo(28 + rng() * 4, 0); g.lineTo(0, 4); g.fill();
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 14);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = gr; g.fillRect(-32, -32, 64, 64);
  });
  // 5: fire ball
  cell(5, (g) => {
    for (let k = 0; k < 12; k++) {
      const x = 32 + (rng() - 0.5) * 24, y = 32 + (rng() - 0.5) * 24, r = 8 + rng() * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,240,180,0.9)');
      gr.addColorStop(0.5, 'rgba(255,140,30,0.5)');
      gr.addColorStop(1, 'rgba(160,30,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
  });
  // 6: bullet hole decal (multiply: white = no change)
  cell(6, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 18);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.35, '#111'); gr.addColorStop(0.5, '#777'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 7: blood decal
  cell(7, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#7a0a06';
    for (let k = 0; k < 10; k++) { g.beginPath(); g.arc(32 + (rng() - 0.5) * 34, 32 + (rng() - 0.5) * 34, 2 + rng() * 9, 0, 7); g.fill(); }
    g.beginPath(); g.arc(32, 32, 13, 0, 7); g.fill();
  });
  // 8: scorch decal
  cell(8, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, '#0a0a0a'); gr.addColorStop(0.5, '#3a3a3a'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 9: debris chunk (grey square-ish)
  cell(9, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(14, 20); g.lineTo(44, 10); g.lineTo(54, 40); g.lineTo(24, 54); g.fill(); });
  // 10: dust puff (soft)
  cell(10, (g) => radial(g, [[0, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
  // 11: laser dot
  cell(11, (g) => radial(g, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]));
  // 12: zzz / star (stun)
  cell(12, (g) => { g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✦', 32, 34); });
  // 13: light cone gradient (vertical)
  cell(13, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 14: shell casing
  cell(14, (g) => { g.fillStyle = '#e0b040'; g.fillRect(26, 16, 12, 32); g.fillStyle = '#a07020'; g.fillRect(26, 42, 12, 6); });
  // 15: wood splinter / glass shard
  cell(15, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(10, 50); g.lineTo(30, 8); g.lineTo(54, 40); g.fill(); });

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  return { tex, cells: N };
}
