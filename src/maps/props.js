// Reusable brush-built props for the map builder.

// Two crossed alpha quads (bushes, dead trees).
export function cross(b, x, y, z, w, h, tex = 'spinifex') {
  b.detail(x - w / 2, y, z - 0.01, x + w / 2, y + h, z + 0.01, tex);
  b.detail(x - 0.01, y, z - w / 2, x + 0.01, y + h, z + w / 2, tex);
}

export function bush(b, x, z, s = 1, y = 0) {
  cross(b, x, y, z, 1.4 * s, 0.9 * s, 'spinifex');
}

export function deadTree(b, x, z, s = 1, y = 0) {
  b.solid(x - 0.12 * s, y, z - 0.12 * s, x + 0.12 * s, y + 1.6 * s, z + 0.12 * s, 'wood');
  cross(b, x, y + 1.0 * s, z, 3.2 * s, 3.2 * s, 'deadtree');
}

export function termiteMound(b, x, z, h = 2.2, y = 0) {
  b.solid(x - 0.55, y, z - 0.5, x + 0.55, y + h * 0.45, z + 0.5, 'rock');
  b.solid(x - 0.38, y + h * 0.45, z - 0.35, x + 0.38, y + h * 0.8, z + 0.35, 'rock');
  b.solid(x - 0.18, y + h * 0.8, z - 0.16, x + 0.2, y + h, z + 0.18, 'rock');
}

export function boulder(b, x, z, s = 1, y = 0, tex = 'rock') {
  b.solid(x - 1.1 * s, y, z - 0.9 * s, x + 1.0 * s, y + 0.9 * s, z + 1.0 * s, tex);
  b.solid(x - 0.7 * s, y + 0.9 * s, z - 0.6 * s, x + 0.6 * s, y + 1.5 * s, z + 0.5 * s, tex);
}

// Burnt-out ute (pickup truck). Long axis along x.
export function ute(b, x, z, y = 0) {
  const R = 'rust';
  b.solid(x - 2.3, y + 0.35, z - 0.9, x + 2.3, y + 0.85, z + 0.9, R); // chassis
  b.solid(x - 2.3, y + 0.85, z - 0.9, x - 0.2, y + 1.25, z - 0.82, R); // tray sides
  b.solid(x - 2.3, y + 0.85, z + 0.82, x - 0.2, y + 1.25, z + 0.9, R);
  b.solid(x - 2.3, y + 0.85, z - 0.9, x - 2.22, y + 1.25, z + 0.9, R);
  b.solid(x - 0.2, y + 0.85, z - 0.85, x + 1.2, y + 1.9, z + 0.85, R); // cab
  b.solid(x + 1.2, y + 0.85, z - 0.85, x + 2.3, y + 1.15, z + 0.85, R); // bonnet
  for (const [wx, wz] of [[-1.5, -0.95], [-1.5, 0.95], [1.5, -0.95], [1.5, 0.95]]) b.solid(x + wx - 0.4, y, z + wz - 0.15, x + wx + 0.4, y + 0.75, z + wz + 0.15, 'tire');
}

// Military truck with canvas cover. dir: 'x' (long axis x) or 'z'
export function truck(b, x, z, dir = 'x', y = 0) {
  const L = (a0, a1, w0, w1, y0, y1, tex) => {
    if (dir === 'x') b.solid(x + a0, y + y0, z + w0, x + a1, y + y1, z + w1, tex);
    else b.solid(x + w0, y + y0, z + a0, x + w1, y + y1, z + a1, tex);
  };
  L(-3.2, 3.2, -1.1, 1.1, 0.55, 1.1, 'olive'); // chassis
  L(1.6, 3.2, -1.1, 1.1, 1.1, 2.6, 'olive'); // cab
  L(3.2, 3.6, -1.0, 1.0, 0.6, 1.4, 'olive'); // grille
  L(-3.2, 1.5, -1.15, 1.15, 1.1, 3.0, 'tent'); // canvas
  for (const a of [-2.2, -0.8, 2.4]) for (const w of [-1.15, 1.15]) L(a - 0.5, a + 0.5, w - 0.2, w + 0.2, 0, 1.0, 'tire');
}

export function jeep(b, x, z, dir = 'x', y = 0) {
  const L = (a0, a1, w0, w1, y0, y1, tex) => {
    if (dir === 'x') b.solid(x + a0, y + y0, z + w0, x + a1, y + y1, z + w1, tex);
    else b.solid(x + w0, y + y0, z + a0, x + w1, y + y1, z + a1, tex);
  };
  L(-1.9, 1.9, -0.85, 0.85, 0.45, 1.05, 'olive');
  L(0.6, 0.7, -0.85, 0.85, 1.05, 1.6, 'olive'); // windscreen frame
  L(-1.6, -0.5, -0.7, 0.7, 1.05, 1.3, 'olive'); // seat
  for (const a of [-1.3, 1.3]) for (const w of [-0.9, 0.9]) L(a - 0.38, a + 0.38, w - 0.15, w + 0.15, 0, 0.75, 'tire');
}

export function fuelTank(b, x, z, y = 0) {
  b.solid(x - 3, y + 0.4, z - 1.2, x + 3, y + 2.6, z + 1.2, 'water_tank');
  b.solid(x - 2.6, y, z - 1, x - 2.2, y + 0.4, z + 1, 'metal_panel');
  b.solid(x + 2.2, y, z - 1, x + 2.6, y + 0.4, z + 1, 'metal_panel');
  b.detail(x - 1, y + 1.2, z + 1.2, x + 1, y + 1.8, z + 1.25, 'sign_nuclear');
}

// Floodlight pole with a real light source.
export function lightPole(b, x, z, h = 8, aim = [0, -1, 0], color = [1.0, 0.92, 0.75], y = 0, intensity = 2.4, radius = 22) {
  b.solid(x - 0.12, y, z - 0.12, x + 0.12, y + h, z + 0.12, 'metal_panel');
  b.detail(x - 0.5, y + h, z - 0.3, x + 0.5, y + h + 0.5, z + 0.3, 'metal_panel');
  b.detail(x - 0.45, y + h - 0.02, z - 0.25, x + 0.45, y + h, z + 0.25, 'lamp_warm');
  b.light(x + aim[0] * 0.6, y + h - 0.3, z + aim[2] * 0.6, { color, intensity, radius, fixture: null, spot: aim, cone: 110 });
  b.ent('glow', { pos: [x, y + h - 0.1, z], size: 2.2, color: [1, 0.85, 0.6], alpha: 0.55 });
}

// Wall-mounted lamp (non-solid fixture + light)
export function wallLamp(b, x, y, z, nx, nz, o = {}) {
  b.detail(x - (nz ? 0.3 : 0.06), y, z - (nx ? 0.3 : 0.06), x + (nz ? 0.3 : 0.06), y + 0.18, z + (nx ? 0.3 : 0.06), o.tex || 'lamp_warm');
  b.light(x + nx * 0.5, y - 0.1, z + nz * 0.5, { color: o.color || [1, 0.85, 0.6], intensity: o.intensity ?? 1.8, radius: o.radius ?? 9, fixture: null });
  if (o.glow !== false) b.ent('glow', { pos: [x + nx * 0.1, y + 0.08, z + nz * 0.1], size: o.glowSize || 1.3, color: o.color || [1, 0.85, 0.6], alpha: 0.45 });
}

// Chain-link fence segment with posts & barbed wire. axis 'x' or 'z'
export function fence(b, a0, a1, c, h = 4, axis = 'x', y = 0) {
  if (axis === 'x') {
    b.solid(a0, y, c - 0.03, a1, y + h, c + 0.03, 'fence');
    for (let a = a0; a <= a1 + 0.01; a += 4) b.solid(a - 0.07, y, c - 0.07, a + 0.07, y + h + 0.5, c + 0.07, 'pipe');
    b.detail(a0, y + h, c - 0.25, a1, y + h + 0.5, c + 0.25, 'barbed');
  } else {
    b.solid(c - 0.03, y, a0, c + 0.03, y + h, a1, 'fence');
    for (let a = a0; a <= a1 + 0.01; a += 4) b.solid(c - 0.07, y, a - 0.07, c + 0.07, y + h + 0.5, a + 0.07, 'pipe');
    b.detail(c - 0.25, y + h, a0, c + 0.25, y + h + 0.5, a1, 'barbed');
  }
}

export function sandbags(b, x0, z0, x1, z1, h = 1.1, y = 0) {
  b.solid(x0, y, z0, x1, y + h, z1, 'sandbag');
}

export function crateStack(b, x, z, pattern, size = 1.2, y = 0, opts = {}) {
  // pattern: array of [dx, dz, level, breakable?, spawn]
  for (const [dx, dz, lvl, brk, spawn] of pattern) {
    const cx = x + dx * size, cz = z + dz * size, cy = y + lvl * size;
    if (brk) b.crate(cx, cy, cz, size, { spawn, tex: opts.tex });
    else b.solid(cx - size / 2, cy, cz - size / 2, cx + size / 2, cy + size, cz + size / 2, opts.tex || 'crate');
  }
}

export function railingX(b, x0, x1, z, y, h = 1.0) {
  b.solid(x0, y + h - 0.06, z - 0.04, x1, y + h, z + 0.04, 'pipe');
  b.detail(x0, y + h * 0.5 - 0.03, z - 0.03, x1, y + h * 0.5 + 0.03, z + 0.03, 'pipe');
  for (let x = x0; x <= x1 + 0.01; x += 1.5) b.solid(x - 0.04, y, z - 0.04, x + 0.04, y + h, z + 0.04, 'pipe');
  b.clip(x0, y, z - 0.05, x1, y + h, z + 0.05);
}
export function railingZ(b, z0, z1, x, y, h = 1.0) {
  b.solid(x - 0.04, y + h - 0.06, z0, x + 0.04, y + h, z1, 'pipe');
  b.detail(x - 0.03, y + h * 0.5 - 0.03, z0, x + 0.03, y + h * 0.5 + 0.03, z1, 'pipe');
  for (let z = z0; z <= z1 + 0.01; z += 1.5) b.solid(x - 0.04, y, z - 0.04, x + 0.04, y + h, z + 0.04, 'pipe');
  b.clip(x - 0.05, y, z0, x + 0.05, y + h, z1);
}

// Guard watchtower: platform at y=h, ladder on the +z side.
export function watchtower(b, x, z, h = 7, y = 0) {
  const s = 2.2;
  for (const [dx, dz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    b.solid(x + dx - 0.15, y, z + dz - 0.15, x + dx + 0.15, y + h + 2.6, z + dz + 0.15, 'wood');
  }
  // cross bracing
  b.detail(x - s, y + 2.5, z - s - 0.05, x + s, y + 2.7, z - s + 0.05, 'wood');
  b.detail(x - s, y + 2.5, z + s - 0.05, x + s, y + 2.7, z + s + 0.05, 'wood');
  // platform with ladder hole at +z side
  b.solid(x - s - 0.2, y + h - 0.25, z - s - 0.2, x + s + 0.2, y + h, z + s - 1.0, { top: 'wood', side: 'wood' });
  b.solid(x - s - 0.2, y + h - 0.25, z + s - 1.0, x - 0.5, y + h, z + s + 0.2, { top: 'wood', side: 'wood' });
  b.solid(x + 0.5, y + h - 0.25, z + s - 1.0, x + s + 0.2, y + h, z + s + 0.2, { top: 'wood', side: 'wood' });
  // walls (half height) with gaps
  b.solid(x - s - 0.2, y + h, z - s - 0.2, x + s + 0.2, y + h + 1.1, z - s, 'wood');
  b.solid(x - s - 0.2, y + h, z - s, x - s, y + h + 1.1, z + s + 0.2, 'wood');
  b.solid(x + s, y + h, z - s, x + s + 0.2, y + h + 1.1, z + s + 0.2, 'wood');
  b.solid(x - s, y + h, z + s, x - 0.6, y + h + 1.1, z + s + 0.2, 'wood');
  b.solid(x + 0.6, y + h, z + s, x + s, y + h + 1.1, z + s + 0.2, 'wood');
  // roof
  b.solid(x - s - 0.6, y + h + 2.6, z - s - 0.6, x + s + 0.6, y + h + 2.8, z + s + 0.6, { side: 'corrugated', top: 'corrugated', bottom: 'wood' });
  // ladder
  b.ladder(x - 0.45, y, z + s - 0.2, x + 0.45, y + h + 0.3, z + s + 0.35);
  return { top: y + h, ladderZ: z + s + 0.3 };
}

export function waterTower(b, x, z, h = 10, y = 0) {
  const s = 2.4;
  for (const [dx, dz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.solid(x + dx - 0.18, y, z + dz - 0.18, x + dx + 0.18, y + h, z + dz + 0.18, 'metal_panel');
  b.detail(x - s, y + h * 0.5, z - s - 0.05, x + s, y + h * 0.5 + 0.15, z - s + 0.05, 'pipe');
  b.detail(x - s - 0.05, y + h * 0.5, z - s, x - s + 0.05, y + h * 0.5 + 0.15, z + s, 'pipe');
  // walkway
  b.solid(x - s - 1, y + h - 0.2, z - s - 1, x + s + 1, y + h, z + s + 1, { top: 'grate', side: 'metal_floor' }, { castShadow: true });
  b.solid(x - s, y + h, z - s, x + s, y + h + 5, z + s, 'water_tank');
  b.solid(x - s - 0.2, y + h + 5, z - s - 0.2, x + s + 0.2, y + h + 5.3, z + s + 0.2, 'rust');
  railingX(b, x - s - 1, x + s + 1, z - s - 0.95, y + h);
  railingZ(b, z - s - 1, z + s + 1, x + s + 0.95, y + h);
  railingZ(b, z - s - 1, z + s + 1, x - s - 0.95, y + h);
  b.ladder(x - 0.45, y, z + s + 1.0, x + 0.45, y + h + 0.3, z + s + 1.4);
  b.ladder(x - 0.45, y + h, z + s - 0.05, x + 0.45, y + h + 5.6, z + s + 0.3);
  return y + h + 5.3;
}

export function desk(b, x, z, y = 0, dir = 'x') {
  const [w, d] = dir === 'x' ? [1.6, 0.8] : [0.8, 1.6];
  b.solid(x - w / 2, y + 0.72, z - d / 2, x + w / 2, y + 0.78, z + d / 2, { top: 'table_top', side: 'wood' });
  b.solid(x - w / 2 + 0.05, y, z - d / 2 + 0.05, x - w / 2 + 0.12, y + 0.72, z + d / 2 - 0.05, 'metal_panel');
  b.solid(x + w / 2 - 0.12, y, z - d / 2 + 0.05, x + w / 2 - 0.05, y + 0.72, z + d / 2 - 0.05, 'metal_panel');
}
export function computer(b, x, y, z, faces = 'pz', screen = 'screen_green') {
  // small CRT monitor on a desk; screen facing given face
  b.solid(x - 0.25, y, z - 0.25, x + 0.25, y + 0.42, z + 0.25, { side: 'metal_panel', [faces]: screen });
}
export function bunk(b, x, z, y = 0, dir = 'x') {
  const [w, d] = dir === 'x' ? [2.0, 0.9] : [0.9, 2.0];
  for (const lvl of [0.35, 1.45]) b.solid(x - w / 2, y + lvl, z - d / 2, x + w / 2, y + lvl + 0.22, z + d / 2, { top: 'bunk', side: 'olive' });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.solid(x + (dx * w) / 2 - 0.04 * dx - 0.04, y, z + (dz * d) / 2 - 0.04 * dz - 0.04, x + (dx * w) / 2 - 0.04 * dx + 0.04, y + 1.9, z + (dz * d) / 2 - 0.04 * dz + 0.04, 'pipe');
}
export function lockers(b, x0, z, x1, y = 0, face = 'pz') {
  const zz = face === 'pz' ? [z - 0.5, z] : [z, z + 0.5];
  b.solid(x0, y, zz[0], x1, y + 2.0, zz[1], { side: 'metal_panel', [face]: 'locker' }, { uvScale: 1 });
}
export function shelf(b, x0, z0, x1, z1, y = 0, h = 2) {
  b.solid(x0, y, z0, x1, y + h, z1, 'shelf');
}
export function consoleDesk(b, x0, z0, x1, z1, y = 0, face = 'pz', tex = 'console') {
  b.solid(x0, y, z0, x1, y + 1.0, z1, { side: 'metal_panel', top: 'metal_panel', [face]: tex });
}
export function catwalk(b, x0, z0, x1, z1, y, o = {}) {
  b.solid(x0, y - 0.15, z0, x1, y, z1, { top: 'grate', side: 'metal_floor', bottom: 'grate' }, { castShadow: o.shadow ?? false, surface: 'metal' });
}
export function pipeRunX(b, x0, x1, y, z, r = 0.2, tex = 'pipe') {
  b.detail(x0, y - r, z - r, x1, y + r, z + r, tex);
}
export function pipeRunZ(b, z0, z1, y, x, r = 0.2, tex = 'pipe') {
  b.detail(x - r, y - r, z0, x + r, y + r, z1, tex);
}
export function pillar(b, x, z, y0, y1, s = 0.4, tex = 'concrete') {
  b.solid(x - s, y0, z - s, x + s, y1, z + s, tex);
}
