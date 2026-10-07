// Map building DSL.
//
// Levels are described Hammer-style but with a twist: interiors are carved
// out of the void by declaring "air" volumes. The builder wraps every air
// volume in a shell of wall/floor/ceiling brushes, automatically leaving
// openings wherever two air volumes touch (doorways, windows, stairwells).
// Detail (pillars, crates, props, terrain) is added as explicit solids.
import { Brush } from '../engine/world.js';
import { TEXTURE_INFO } from '../engine/textures.js';

const EPS = 1e-4;

function overlap(a, b, eps = EPS) {
  return (
    a.max[0] > b.min[0] + eps && a.min[0] < b.max[0] - eps &&
    a.max[1] > b.min[1] + eps && a.min[1] < b.max[1] - eps &&
    a.max[2] > b.min[2] + eps && a.min[2] < b.max[2] - eps
  );
}

function subtractBox(a, b) {
  if (!overlap(a, b)) return [a];
  const out = [];
  const cur = { min: a.min.slice(), max: a.max.slice(), data: a.data };
  for (let ax = 0; ax < 3; ax++) {
    if (b.min[ax] > cur.min[ax] + EPS) {
      const p = { min: cur.min.slice(), max: cur.max.slice(), data: a.data };
      p.max[ax] = b.min[ax];
      out.push(p);
      cur.min[ax] = b.min[ax];
    }
    if (b.max[ax] < cur.max[ax] - EPS) {
      const p = { min: cur.min.slice(), max: cur.max.slice(), data: a.data };
      p.min[ax] = b.max[ax];
      out.push(p);
      cur.max[ax] = b.max[ax];
    }
  }
  return out;
}

export class MapBuilder {
  constructor(id) {
    this.id = id;
    this.airs = [];
    this.carves = [];
    this.solids = [];
    this.lights = [];
    this.ents = [];
    this.ladders = [];
    this.lighting = { ambient: [0.12, 0.12, 0.13], luxel: 0.5 };
    this.sky = null;
    this.fog = null;
    this.spawn = { pos: [0, 0, 0], yaw: 0 };
    this.title = '';
    this.music = null;
    this.ambientSound = null;
  }

  // ---- volumes ------------------------------------------------------------
  air(x0, y0, z0, x1, y1, z1, o = {}) {
    const a = {
      min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
      floor: o.floor || 'concrete',
      ceil: o.ceil || 'ceiling',
      wall: o.wall || 'concrete_wall',
      n: o.n, s: o.s, e: o.e, w: o.w,
      noCeil: !!o.noCeil,
      noFloor: !!o.noFloor,
      noWalls: o.noWalls || '', // e.g. 'nsew'
      t: o.t ?? 0.4,
      floorSurface: o.floorSurface,
      wallOffset: o.wallOffset ?? null,
      outer: !!o.outer, // outdoor/enclosing volume: never carves other shells
      ext: o.ext || null, // exterior texture for outward faces
      roof: o.roof || null,
    };
    this.airs.push(a);
    return a;
  }

  // Opening cut through generated shells (doorways, windows). No shell of its own.
  carve(x0, y0, z0, x1, y1, z1) {
    this.carves.push({
      min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
    });
  }

  // Explicit solid brush.
  solid(x0, y0, z0, x1, y1, z1, tex = 'concrete', o = {}) {
    const info = TEXTURE_INFO[typeof tex === 'string' ? tex : tex.side || 'concrete'];
    const opts = { ...o };
    if (typeof tex === 'object') {
      opts.faces = tex;
      opts.tex = tex.side || tex.top || 'concrete';
    } else opts.tex = tex;
    if (info && (info.mode === 'alpha' || info.mode === 'glass')) {
      if (opts.castShadow === undefined) opts.castShadow = false;
      if (info.mode === 'alpha') {
        opts.seeThrough = opts.seeThrough ?? true;
        opts.bulletPass = opts.bulletPass ?? true;
      }
      if (info.mode === 'glass') opts.seeThrough = opts.seeThrough ?? true;
    }
    if (info && info.mode === 'fullbright' && opts.castShadow === undefined) opts.castShadow = false;
    const b = new Brush([x0, y0, z0], [x1, y1, z1], opts);
    if (info && (info.mode === 'glass' || info.mode === 'alpha')) b.transparent = true;
    this.solids.push(b);
    return b;
  }

  // Non-solid decoration (still drawn and lit).
  detail(x0, y0, z0, x1, y1, z1, tex, o = {}) {
    return this.solid(x0, y0, z0, x1, y1, z1, tex, { solid: false, castShadow: false, ...o });
  }

  // Invisible blocker.
  clip(x0, y0, z0, x1, y1, z1, o = {}) {
    return this.solid(x0, y0, z0, x1, y1, z1, 'black', { visible: false, castShadow: false, noRay: true, ...o });
  }

  // ---- helpers ------------------------------------------------------------
  // Staircase rising along dir ('+x','-x','+z','-z') from y0 to y1.
  stairs(x0, z0, x1, z1, y0, y1, dir, tex = 'concrete', o = {}) {
    const steps = Math.max(1, Math.round((y1 - y0) / (o.rise || 0.25)));
    const rise = (y1 - y0) / steps;
    const along = dir[1] === 'x' ? 0 : 2;
    const lo = along === 0 ? x0 : z0, hi = along === 0 ? x1 : z1;
    const run = (hi - lo) / steps;
    const forward = dir[0] === '+';
    for (let i = 0; i < steps; i++) {
      const top = y0 + rise * (i + 1);
      const s0 = forward ? lo + run * i : hi - run * (i + 1);
      const s1 = forward ? hi : hi - run * i;
      const a0 = forward ? s0 : lo;
      const a1 = forward ? hi : s1;
      // each step is a block from the base to its top, spanning to the high end
      if (along === 0) this.solid(a0, y0 - (o.base ?? 0), z0, a1, top, z1, { top: tex, side: o.side || tex }, { surface: o.surface });
      else this.solid(x0, y0 - (o.base ?? 0), a0, x1, top, a1, { top: tex, side: o.side || tex }, { surface: o.surface });
    }
  }

  light(x, y, z, o = {}) {
    const l = {
      pos: [x, y, z],
      color: o.color || [1, 0.95, 0.85],
      intensity: o.intensity ?? 1.6,
      radius: o.radius ?? 10,
    };
    if (o.spot) {
      l.spot = o.spot;
      l.cone = o.cone ?? 70;
    }
    this.lights.push(l);
    const fx = o.fixture === undefined ? 'light' : o.fixture;
    if (fx) {
      const sx = o.fw ?? 1.2, sz = o.fd ?? 0.35;
      const fy = o.fy ?? y + 0.12;
      if (o.wall) {
        // wall lamp facing a direction
        const [wx, wz] = o.wall;
        const hw = 0.25;
        this.detail(x - hw - Math.abs(wz) * 0.2, y - 0.15, z - hw - Math.abs(wx) * 0.2, x + hw + Math.abs(wz) * 0.2, y + 0.15, z + hw + Math.abs(wx) * 0.2, fx);
      } else {
        this.detail(x - sx / 2, fy, z - sz / 2, x + sx / 2, fy + 0.06, z + sz / 2, fx);
      }
    }
    return l;
  }

  ent(type, props = {}) {
    const e = { type, ...props };
    this.ents.push(e);
    return e;
  }

  ladder(x0, y0, z0, x1, y1, z1, o = {}) {
    this.ladders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
    if (o.visual !== false) {
      // rails + rungs as non-solid detail
      const alongX = x1 - x0 > z1 - z0;
      if (alongX) {
        const zc = (z0 + z1) / 2;
        this.detail(x0, y0, zc - 0.04, x0 + 0.08, y1, zc + 0.04, 'pipe');
        this.detail(x1 - 0.08, y0, zc - 0.04, x1, y1, zc + 0.04, 'pipe');
        for (let y = y0 + 0.3; y < y1; y += 0.4) this.detail(x0, y, zc - 0.03, x1, y + 0.05, zc + 0.03, 'pipe');
      } else {
        const xc = (x0 + x1) / 2;
        this.detail(xc - 0.04, y0, z0, xc + 0.04, y1, z0 + 0.08, 'pipe');
        this.detail(xc - 0.04, y0, z1 - 0.08, xc + 0.04, y1, z1, 'pipe');
        for (let y = y0 + 0.3; y < y1; y += 0.4) this.detail(xc - 0.03, y, z0, xc + 0.03, y + 0.05, z1, 'pipe');
      }
    }
  }

  // Large flat ground tiled into chunks so lightmaps keep resolution.
  ground(x0, z0, x1, z1, y, tex = 'dirt', chunk = 16, depth = 1, o = {}) {
    for (let x = x0; x < x1; x += chunk)
      for (let z = z0; z < z1; z += chunk)
        this.solid(x, y - depth, z, Math.min(x + chunk, x1), y, Math.min(z + chunk, z1), tex, o);
  }

  // Crate helper: breakable or static.
  crate(x, y, z, size = 1, o = {}) {
    const h = size / 2;
    if (o.breakable === false) return this.solid(x - h, y, z - h, x + h, y + size * (o.hmul || 1), z + h, o.tex || 'crate');
    return this.ent('breakable', {
      min: [x - h, y, z - h],
      max: [x + h, y + size * (o.hmul || 1), z + h],
      tex: o.tex || 'crate',
      health: o.health ?? 20,
      material: o.material || 'wood',
      spawn: o.spawn,
      targetname: o.targetname,
      target: o.target,
    });
  }

  // ---- compile ----------------------------------------------------------------
  compileShells() {
    const shells = [];
    const sides = [
      { a: 0, s: 1, key: 'e' },
      { a: 0, s: -1, key: 'w' },
      { a: 1, s: 1, key: 'top' },
      { a: 1, s: -1, key: 'bottom' },
      { a: 2, s: 1, key: 's' },
      { a: 2, s: -1, key: 'n' },
    ];
    // inner volumes first so their shells win over enclosing outdoor volumes
    const ordered = this.airs.filter((a) => !a.outer).concat(this.airs.filter((a) => a.outer));
    for (const A of ordered) {
      const t = A.t;
      for (const sd of sides) {
        if (sd.key === 'top' && A.noCeil) continue;
        if (sd.key === 'bottom' && A.noFloor) continue;
        if (A.noWalls.includes(sd.key)) continue;
        const min = [A.min[0] - t, A.min[1] - t, A.min[2] - t];
        const max = [A.max[0] + t, A.max[1] + t, A.max[2] + t];
        if (A.noCeil) max[1] = A.max[1];
        if (sd.s > 0) {
          min[sd.a] = A.max[sd.a];
          max[sd.a] = A.max[sd.a] + t;
        } else {
          min[sd.a] = A.min[sd.a] - t;
          max[sd.a] = A.min[sd.a];
        }
        let tex;
        const ext = A.ext || A.wall;
        if (sd.key === 'top') tex = { side: ext, top: A.roof || ext, bottom: A.ceil };
        else if (sd.key === 'bottom') tex = { side: ext, top: A.floor, bottom: ext };
        else {
          const wt = A[sd.key] || A.wall;
          // inward facing face gets the interior texture
          const inward = { e: 'nx', w: 'px', s: 'nz', n: 'pz' }[sd.key];
          tex = { side: ext, top: ext, bottom: ext, [inward]: wt, inner: wt };
        }
        let frags = [{ min, max, data: { tex, air: A, key: sd.key } }];
        for (const C of this.airs.concat(this.carves)) {
          if (C === A || C.outer) continue;
          const nf = [];
          for (const f of frags) nf.push(...subtractBox(f, C));
          frags = nf;
          if (!frags.length) break;
        }
        shells.push(...frags);
      }
    }
    // make shells disjoint so coplanar faces don't fight
    const accepted = [];
    for (const s of shells) {
      let frags = [s];
      for (const o of accepted) {
        if (!overlap(s, o)) continue;
        const nf = [];
        for (const f of frags) nf.push(...subtractBox(f, o));
        frags = nf;
        if (!frags.length) break;
      }
      for (const f of frags) {
        const sz = [f.max[0] - f.min[0], f.max[1] - f.min[1], f.max[2] - f.min[2]];
        if (sz[0] < 0.005 || sz[1] < 0.005 || sz[2] < 0.005) continue;
        accepted.push(f);
      }
    }
    const brushes = [];
    for (const f of accepted) {
      const { tex, air } = f.data;
      const wallInfo = TEXTURE_INFO[tex.inner || tex.side];
      let uvOffset = [0, 0];
      if (wallInfo && wallInfo.uv === 'world' && f.data.key !== 'bottom' && f.data.key !== 'top') {
        const base = air.wallOffset ?? air.min[1];
        uvOffset = [0, -base / (wallInfo.size * wallInfo.aspect)];
      }
      const b = new Brush(f.min, f.max, {
        tex: tex.side,
        faces: tex,
        uvOffset,
        surface: f.data.key === 'bottom' ? air.floorSurface : undefined,
      });
      b.fromShell = true;
      brushes.push(b);
    }
    return brushes;
  }

  compile() {
    const shell = this.compileShells();
    return {
      id: this.id,
      brushes: shell.concat(this.solids),
      lights: this.lights,
      ents: this.ents,
      ladders: this.ladders,
      lighting: { ...this.lighting, lights: this.lights },
      sky: this.sky,
      fog: this.fog,
      spawn: this.spawn,
      title: this.title,
      music: this.music,
      ambientSound: this.ambientSound,
      ambientVolume: this.ambientVolume,
      ending: this.ending,
    };
  }
}
