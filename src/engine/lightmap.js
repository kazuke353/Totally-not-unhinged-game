// Lightmap "compiler": the in-browser equivalent of hlrad. Every visible
// brush face gets a grid of luxels lit by point/spot lights, the sun and the
// sky, with ray traced shadows and short-range ambient occlusion.
import * as THREE from 'three';

const CELL = 4;

function hemisphereDirs(count, seed) {
  // deterministic cosine-ish distribution on +Z hemisphere
  const dirs = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const z = 1 - (i + 0.5) / count; // cos(theta) from ~1 to ~0
    const zz = Math.sqrt(z) * 0.95 + 0.05;
    const r = Math.sqrt(Math.max(0, 1 - zz * zz));
    const phi = i * golden + seed;
    dirs.push([Math.cos(phi) * r, Math.sin(phi) * r, zz]);
  }
  return dirs;
}
const AO_DIRS = hemisphereDirs(10, 0.3);
const SKY_DIRS = hemisphereDirs(10, 1.1);

// Tangent frame for an axis aligned normal.
function frame(a, s) {
  const n = [0, 0, 0];
  n[a] = s;
  const t = [0, 0, 0], b = [0, 0, 0];
  const ua = a === 0 ? 2 : 0, va = a === 1 ? 2 : 1;
  t[ua] = 1;
  b[va] = 1;
  return { n, t, b };
}

export class Occluder {
  constructor(world) {
    this.world = world;
    this.stamp = 1;
  }
  // Fast shadow ray test: true if anything shadow-casting blocks the segment.
  occluded(ox, oy, oz, dx, dy, dz, maxDist) {
    const grid = this.world.grid;
    const s = ++this.stamp;
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tDeltaX = adx > 1e-9 ? CELL / adx : Infinity;
    const tDeltaZ = adz > 1e-9 ? CELL / adz : Infinity;
    let tMaxX = adx > 1e-9 ? (dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / adx : Infinity;
    let tMaxZ = adz > 1e-9 ? (dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / adz : Infinity;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    let t = 0;
    for (let iter = 0; iter < 400; iter++) {
      const arr = grid.get((cx * 73856093) ^ (cz * 19349663));
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b.lmStamp === s) continue;
          b.lmStamp = s;
          if (!b.castShadow) continue;
          const mn = b.min, mx = b.max;
          let t0 = 0, t1 = maxDist, a1, a2;
          if (adx < 1e-12) { if (ox <= mn[0] || ox >= mx[0]) continue; } else {
            a1 = (mn[0] - ox) * idx; a2 = (mx[0] - ox) * idx;
            if (a1 > a2) { const q = a1; a1 = a2; a2 = q; }
            if (a1 > t0) t0 = a1; if (a2 < t1) t1 = a2; if (t0 >= t1) continue;
          }
          if (Math.abs(dy) < 1e-12) { if (oy <= mn[1] || oy >= mx[1]) continue; } else {
            a1 = (mn[1] - oy) * idy; a2 = (mx[1] - oy) * idy;
            if (a1 > a2) { const q = a1; a1 = a2; a2 = q; }
            if (a1 > t0) t0 = a1; if (a2 < t1) t1 = a2; if (t0 >= t1) continue;
          }
          if (adz < 1e-12) { if (oz <= mn[2] || oz >= mx[2]) continue; } else {
            a1 = (mn[2] - oz) * idz; a2 = (mx[2] - oz) * idz;
            if (a1 > a2) { const q = a1; a1 = a2; a2 = q; }
            if (a1 > t0) t0 = a1; if (a2 < t1) t1 = a2; if (t0 >= t1) continue;
          }
          return true;
        }
      }
      if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDeltaX; cx += stepX; }
      else { t = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; }
      if (t > maxDist) break;
    }
    return false;
  }
  insideSolid(x, y, z, self) {
    const arr = this.world.grid.get((Math.floor(x / CELL) * 73856093) ^ (Math.floor(z / CELL) * 19349663));
    if (!arr) return false;
    for (const b of arr) {
      if (b === self || !b.castShadow || !b.solid) continue;
      if (x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]) return true;
    }
    return false;
  }
}

// Evaluate incident light at a point. Used by the baker and at runtime to
// light dynamic models (with fewer samples).
export function evalLight(occ, L, p, n, lights, opts) {
  let r = L.ambient[0], g = L.ambient[1], b = L.ambient[2];
  const fr = opts.frame;
  // ambient occlusion & sky visibility
  if (opts.ao && fr) {
    let occN = 0;
    for (const d of AO_DIRS) {
      const dx = fr.t[0] * d[0] + fr.b[0] * d[1] + fr.n[0] * d[2];
      const dy = fr.t[1] * d[0] + fr.b[1] * d[1] + fr.n[1] * d[2];
      const dz = fr.t[2] * d[0] + fr.b[2] * d[1] + fr.n[2] * d[2];
      if (occ.occluded(p[0], p[1], p[2], dx, dy, dz, 1.4)) occN++;
    }
    const k = 1 - (occN / AO_DIRS.length) * (L.aoStrength ?? 0.65);
    r *= k; g *= k; b *= k;
  }
  if (L.sky) {
    let vis = 0, tot = 0;
    if (fr) {
      for (const d of SKY_DIRS) {
        const dx = fr.t[0] * d[0] + fr.b[0] * d[1] + fr.n[0] * d[2];
        const dy = fr.t[1] * d[0] + fr.b[1] * d[1] + fr.n[1] * d[2];
        const dz = fr.t[2] * d[0] + fr.b[2] * d[1] + fr.n[2] * d[2];
        if (dy < 0.05) continue; // sky is only above
        tot++;
        if (!occ.occluded(p[0], p[1], p[2], dx, dy, dz, 90)) vis += dy * 0.6 + 0.4;
      }
      vis = tot ? vis / SKY_DIRS.length : 0;
    } else {
      vis = occ.occluded(p[0], p[1], p[2], 0, 1, 0, 90) ? 0 : 1;
    }
    r += L.sky[0] * vis; g += L.sky[1] * vis; b += L.sky[2] * vis;
  }
  if (L.sun) {
    const sd = L.sun.dir;
    const ndl = n ? n[0] * sd[0] + n[1] * sd[1] + n[2] * sd[2] : 0.8;
    if (ndl > 0 && !occ.occluded(p[0], p[1], p[2], sd[0], sd[1], sd[2], 250)) {
      r += L.sun.color[0] * ndl; g += L.sun.color[1] * ndl; b += L.sun.color[2] * ndl;
    }
  }
  for (const l of lights) {
    let dx = l.pos[0] - p[0], dy = l.pos[1] - p[1], dz = l.pos[2] - p[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > l.radius * l.radius) continue;
    const d = Math.sqrt(d2) || 1e-4;
    dx /= d; dy /= d; dz /= d;
    let ndl = n ? n[0] * dx + n[1] * dy + n[2] * dz : 0.7;
    if (ndl <= 0) continue;
    ndl = ndl * 0.85 + 0.15;
    let att = 1 - d / l.radius;
    att *= att;
    if (l.spot) {
      const c = -(dx * l.spot[0] + dy * l.spot[1] + dz * l.spot[2]);
      if (c < l.coneOuter) continue;
      att *= Math.min(1, (c - l.coneOuter) / Math.max(1e-3, l.coneInner - l.coneOuter));
    }
    if (occ.occluded(p[0], p[1], p[2], dx, dy, dz, d - 0.15)) continue;
    const k = l.intensity * att * ndl;
    r += l.color[0] * k; g += l.color[1] * k; b += l.color[2] * k;
  }
  return [r, g, b];
}

function normLight(l) {
  const out = {
    pos: l.pos,
    color: l.color || [1, 1, 1],
    intensity: l.intensity ?? 1.5,
    radius: l.radius ?? 10,
  };
  if (l.spot) {
    const s = l.spot;
    const m = Math.hypot(s[0], s[1], s[2]);
    out.spot = [s[0] / m, s[1] / m, s[2] / m];
    out.coneOuter = Math.cos(((l.cone ?? 60) * Math.PI) / 180 / 2);
    out.coneInner = Math.cos(((l.cone ?? 60) * Math.PI) / 180 / 2 * 0.6);
  }
  return out;
}

export async function bakeLightmaps(world, faces, L, onProgress) {
  const luxel = L.luxel || 0.5;
  const lights = (L.lights || []).map(normLight);
  const occ = new Occluder(world);
  world.occluder = occ;
  world.lighting = { ...L, lights };
  if (L.sun) {
    const d = L.sun.dir, m = Math.hypot(d[0], d[1], d[2]);
    L.sun.dir = [d[0] / m, d[1] / m, d[2] / m];
  }

  // Luxel resolution per face
  for (const f of faces) {
    const lsU = Math.max(luxel, f.w / 96), lsV = Math.max(luxel, f.h / 96);
    f.nu = Math.max(2, Math.ceil(f.w / lsU) + 1);
    f.nv = Math.max(2, Math.ceil(f.h / lsV) + 1);
  }
  // Shelf pack
  const order = faces.slice().sort((a, b) => b.nv - a.nv);
  let W = 1024;
  const totalArea = faces.reduce((s, f) => s + (f.nu + 2) * (f.nv + 2), 0);
  if (totalArea > 1024 * 900) W = 2048;
  if (totalArea > 2048 * 1800) W = 4096;
  let x = 0, y = 0, rowH = 0;
  for (const f of order) {
    const w = f.nu + 2, h = f.nv + 2;
    if (x + w > W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    f.lm = { x, y, nu: f.nu, nv: f.nv };
    x += w;
    rowH = Math.max(rowH, h);
  }
  let H = 64;
  while (H < y + rowH) H *= 2;
  const data = new Uint8Array(W * H * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  let lastYield = performance.now();
  let done = 0;
  const p = [0, 0, 0];
  for (const f of faces) {
    const { a, ua, va, origin, normal, nu, nv } = f;
    const s = normal[a];
    const fr = frame(a, s);
    // relevant lights for this face
    const cx = origin.slice();
    cx[ua] += f.w / 2;
    cx[va] += f.h / 2;
    const fRad = Math.hypot(f.w, f.h) / 2;
    const plane = origin[a];
    const fl = lights.filter((l) => {
      const dd = Math.hypot(l.pos[0] - cx[0], l.pos[1] - cx[1], l.pos[2] - cx[2]);
      return dd < l.radius + fRad && (l.pos[a] - plane) * s > -0.05;
    });
    const fullbright = isFullbright(f, world);
    const vals = new Float32Array(nu * nv * 3);
    const valid = new Uint8Array(nu * nv);
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const k = j * nu + i;
        if (fullbright) {
          vals[k * 3] = vals[k * 3 + 1] = vals[k * 3 + 2] = 1;
          valid[k] = 1;
          continue;
        }
        let u = (i / (nu - 1)) * f.w, v = (j / (nv - 1)) * f.h;
        u = Math.min(Math.max(u, 0.04), f.w - 0.04);
        v = Math.min(Math.max(v, 0.04), f.h - 0.04);
        p[0] = origin[0]; p[1] = origin[1]; p[2] = origin[2];
        p[ua] += u;
        p[va] += v;
        p[a] += s * 0.03;
        if (!f.brush.dynamic && occ.insideSolid(p[0], p[1], p[2], f.brush)) continue;
        const c = evalLight(occ, L, p, normal, fl, { ao: true, frame: fr });
        vals[k * 3] = c[0];
        vals[k * 3 + 1] = c[1];
        vals[k * 3 + 2] = c[2];
        valid[k] = 1;
      }
    }
    // dilate invalid luxels from valid neighbours
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let j = 0; j < nv; j++)
        for (let i = 0; i < nu; i++) {
          const k = j * nu + i;
          if (valid[k]) continue;
          let r = 0, g = 0, b = 0, n = 0;
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const ii = i + di, jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue;
              const kk = jj * nu + ii;
              if (valid[kk] !== 1) continue;
              r += vals[kk * 3]; g += vals[kk * 3 + 1]; b += vals[kk * 3 + 2]; n++;
            }
          if (n) {
            vals[k * 3] = r / n; vals[k * 3 + 1] = g / n; vals[k * 3 + 2] = b / n;
            valid[k] = 2;
            changed = true;
          }
        }
      for (let k = 0; k < valid.length; k++) if (valid[k] === 2) valid[k] = 1;
      if (!changed) break;
    }
    for (let k = 0; k < valid.length; k++)
      if (!valid[k]) {
        vals[k * 3] = L.ambient[0] * 0.5; vals[k * 3 + 1] = L.ambient[1] * 0.5; vals[k * 3 + 2] = L.ambient[2] * 0.5;
      }
    // write into atlas with a 1 texel border
    const r = f.lm;
    for (let j = -1; j <= nv; j++)
      for (let i = -1; i <= nu; i++) {
        const si = Math.min(Math.max(i, 0), nu - 1), sj = Math.min(Math.max(j, 0), nv - 1);
        const k = (sj * nu + si) * 3;
        const di = ((r.y + 1 + j) * W + (r.x + 1 + i)) * 4;
        data[di] = Math.min(255, vals[k] * 127.5);
        data[di + 1] = Math.min(255, vals[k + 1] * 127.5);
        data[di + 2] = Math.min(255, vals[k + 2] * 127.5);
      }
    done++;
    if (performance.now() - lastYield > 40) {
      if (onProgress) onProgress(done / faces.length);
      await new Promise((res) => setTimeout(res, 0));
      lastYield = performance.now();
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // face lookup for runtime sampling of floor light (HL1 style model lighting)
  const lookup = new Map();
  for (const f of faces) lookup.set(f.brush.id * 6 + f.f, f);
  return { texture: tex, width: W, height: H, data, lookup };
}

function isFullbright(f, world) {
  const name = f.brush.texFor(f.f);
  const info = world.textureInfo && world.textureInfo[name];
  return info && info.mode === 'fullbright';
}

// Sample the baked lightmap at a world hit (brush + point + face normal).
export function sampleLightmapAt(world, brush, point, normal) {
  const lm = world.lightmap;
  if (!lm) return null;
  let f = -1;
  if (normal[0] > 0.5) f = 0; else if (normal[0] < -0.5) f = 1;
  else if (normal[1] > 0.5) f = 2; else if (normal[1] < -0.5) f = 3;
  else if (normal[2] > 0.5) f = 4; else f = 5;
  const face = lm.lookup.get(brush.id * 6 + f);
  if (!face) return null;
  const u = (point[face.ua] - brush.offset[face.ua] - face.origin[face.ua]) / Math.max(face.w, 1e-3);
  const v = (point[face.va] - brush.offset[face.va] - face.origin[face.va]) / Math.max(face.h, 1e-3);
  const i = Math.round(Math.min(Math.max(u, 0), 1) * (face.nu - 1));
  const j = Math.round(Math.min(Math.max(v, 0), 1) * (face.nv - 1));
  const di = ((face.lm.y + 1 + j) * lm.width + (face.lm.x + 1 + i)) * 4;
  return [lm.data[di] / 127.5, lm.data[di + 1] / 127.5, lm.data[di + 2] / 127.5];
}
