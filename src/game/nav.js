// Navigation grid for NPCs: a 2.5D grid of walkable cells (up to 3 floors
// per column) generated from the brush world, with A* path finding.

const CS = 0.5; // cell size
const LAYERS = 3;
const AGENT_H = 1.6, AGENT_R = 0.3, STEP = 0.55;

class Heap {
  constructor() {
    this.items = [];
    this.keys = [];
  }
  push(item, key) {
    const it = this.items, k = this.keys;
    it.push(item);
    k.push(key);
    let i = it.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [it[p], it[i]] = [it[i], it[p]];
      [k[p], k[i]] = [k[i], k[p]];
      i = p;
    }
  }
  pop() {
    const it = this.items, k = this.keys;
    const top = it[0];
    const li = it.pop(), lk = k.pop();
    if (it.length) {
      it[0] = li;
      k[0] = lk;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < it.length && k[l] < k[m]) m = l;
        if (r < it.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [it[m], it[i]] = [it[i], it[m]];
        [k[m], k[i]] = [k[i], k[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

export class NavGrid {
  constructor(world) {
    this.world = world;
  }

  build() {
    const w = this.world;
    const b = w.bounds;
    this.x0 = Math.floor(b.min[0]);
    this.z0 = Math.floor(b.min[2]);
    this.nx = Math.ceil((b.max[0] - this.x0) / CS);
    this.nz = Math.ceil((b.max[2] - this.z0) / CS);
    const N = this.nx * this.nz;
    this.h = new Float32Array(N * LAYERS).fill(NaN);
    this.blockers = new Map(); // node -> entity (doors, crates)
    const solid = (br) => br.solid && !br.dynamic;
    const tmp = [];
    for (let iz = 0; iz < this.nz; iz++) {
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.x0 + (ix + 0.5) * CS, z = this.z0 + (iz + 0.5) * CS;
        tmp.length = 0;
        w.query([x - 0.01, -1e4, z - 0.01], [x + 0.01, 1e4, z + 0.01], tmp, solid);
        if (!tmp.length) continue;
        const floors = [];
        for (const br of tmp) {
          const y = br.max[1];
          if (floors.some((f) => Math.abs(f - y) < 0.05)) continue;
          floors.push(y);
        }
        floors.sort((a, c) => a - c);
        let li = 0;
        for (const y of floors) {
          if (li >= LAYERS) break;
          // buried inside another brush at this column (e.g. lower stair steps)?
          let buried = false;
          for (const br of tmp) {
            if (br.min[1] < y + AGENT_H && br.max[1] > y + 0.02) {
              buried = true;
              break;
            }
          }
          if (buried) continue;
          // clearance
          if (!this._clear(x, y, z, tmp)) continue;
          this.h[(iz * this.nx + ix) * LAYERS + li] = y;
          li++;
        }
      }
    }
    // dynamic blockers (doors, crates)
    for (const br of w.dynamic) {
      if (!br.owner) continue;
      const ix0 = Math.floor((br.min[0] - AGENT_R - this.x0) / CS), ix1 = Math.floor((br.max[0] + AGENT_R - this.x0) / CS);
      const iz0 = Math.floor((br.min[2] - AGENT_R - this.z0) / CS), iz1 = Math.floor((br.max[2] + AGENT_R - this.z0) / CS);
      for (let iz = iz0; iz <= iz1; iz++)
        for (let ix = ix0; ix <= ix1; ix++) {
          if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) continue;
          for (let l = 0; l < LAYERS; l++) {
            const n = (iz * this.nx + ix) * LAYERS + l;
            const y = this.h[n];
            if (isNaN(y)) continue;
            if (br.max[1] > y + 0.1 && br.min[1] < y + AGENT_H) this.blockers.set(n, br.owner);
          }
        }
    }
  }

  _clear(x, y, z, scratch) {
    // anything lower than a step is fine (stairs, curbs): start the box at step height
    const mn = [x - AGENT_R, y + STEP - 0.05, z - AGENT_R], mx = [x + AGENT_R, y + AGENT_H, z + AGENT_R];
    const arr = this.world.query(mn, mx, [], (br) => br.solid && !br.dynamic && !br.playerClip);
    for (const s of arr) {
      if (s.max[0] > mn[0] && s.min[0] < mx[0] && s.max[1] > mn[1] && s.min[1] < mx[1] && s.max[2] > mn[2] && s.min[2] < mx[2]) return false;
    }
    return true;
  }

  passable(n) {
    if (isNaN(this.h[n])) return false;
    const b = this.blockers.get(n);
    if (b && b.navBlocked && b.navBlocked()) return false;
    return true;
  }

  // Find the node at a world position (closest layer to y).
  nodeAt(x, y, z, search = 2) {
    const ix = Math.floor((x - this.x0) / CS), iz = Math.floor((z - this.z0) / CS);
    let best = -1, bd = 1e9;
    for (let r = 0; r <= search; r++) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = ix + dx, cz = iz + dz;
          if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) continue;
          for (let l = 0; l < LAYERS; l++) {
            const n = (cz * this.nx + cx) * LAYERS + l;
            const h = this.h[n];
            if (isNaN(h)) continue;
            const d = Math.abs(h - y) + r * 0.3;
            if (y < h - 0.6) continue;
            if (d < bd && this.passable(n)) {
              bd = d;
              best = n;
            }
          }
        }
      if (best >= 0) return best;
    }
    return best;
  }
  nodePos(n) {
    const c = Math.floor(n / LAYERS);
    const ix = c % this.nx, iz = Math.floor(c / this.nx);
    return [this.x0 + (ix + 0.5) * CS, this.h[n], this.z0 + (iz + 0.5) * CS];
  }

  _neighbors(n, out) {
    out.length = 0;
    const c = Math.floor(n / LAYERS);
    const ix = c % this.nx, iz = Math.floor(c / this.nx);
    const h = this.h[n];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const cx = ix + dx, cz = iz + dz;
        if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) continue;
        for (let l = 0; l < LAYERS; l++) {
          const m = (cz * this.nx + cx) * LAYERS + l;
          const hm = this.h[m];
          if (isNaN(hm) || Math.abs(hm - h) > STEP) continue;
          if (!this.passable(m)) continue;
          if (dx && dz) {
            // no corner cutting
            if (!this._hasNear(ix + dx, iz, h) || !this._hasNear(ix, iz + dz, h)) continue;
          }
          out.push(m, dx && dz ? 1.414 : 1);
        }
      }
    return out;
  }
  _hasNear(ix, iz, h) {
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return false;
    for (let l = 0; l < LAYERS; l++) {
      const m = (iz * this.nx + ix) * LAYERS + l;
      const hm = this.h[m];
      if (!isNaN(hm) && Math.abs(hm - h) <= STEP && this.passable(m)) return true;
    }
    return false;
  }

  // A*; returns array of [x,y,z] or null.
  path(from, to, maxNodes = 12000) {
    const s = this.nodeAt(from[0], from[1], from[2]);
    const t = this.nodeAt(to[0], to[1], to[2], 3);
    if (s < 0 || t < 0) return null;
    if (s === t) return [this.nodePos(t)];
    const tp = this.nodePos(t);
    const g = new Map();
    const came = new Map();
    const open = new Heap();
    g.set(s, 0);
    const hf = (n) => {
      const p = this.nodePos(n);
      return Math.hypot(p[0] - tp[0], p[2] - tp[2]) / CS;
    };
    open.push(s, hf(s));
    const nb = [];
    let iter = 0, found = false, closest = s, closestH = hf(s);
    while (open.size && iter++ < maxNodes) {
      const n = open.pop();
      if (n === t) {
        found = true;
        break;
      }
      const gn = g.get(n);
      this._neighbors(n, nb);
      for (let i = 0; i < nb.length; i += 2) {
        const m = nb[i];
        const ng = gn + nb[i + 1];
        const old = g.get(m);
        if (old !== undefined && old <= ng) continue;
        g.set(m, ng);
        came.set(m, n);
        const hh = hf(m);
        if (hh < closestH) {
          closestH = hh;
          closest = m;
        }
        open.push(m, ng + hh * 1.2);
      }
    }
    const end = found ? t : closest;
    if (end === s) return null;
    const nodes = [];
    for (let n = end; n !== undefined && n !== s; n = came.get(n)) nodes.push(n);
    nodes.reverse();
    return this._smooth(from, nodes.map((n) => this.nodePos(n)));
  }

  // Walkable straight line test across the grid.
  lineWalkable(a, b) {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (CS * 0.5));
    let y = a[1];
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const x = a[0] + dx * k, z = a[2] + dz * k;
      const ix = Math.floor((x - this.x0) / CS), iz = Math.floor((z - this.z0) / CS);
      if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return false;
      let ok = false;
      for (let l = 0; l < LAYERS; l++) {
        const n = (iz * this.nx + ix) * LAYERS + l;
        const h = this.h[n];
        if (!isNaN(h) && Math.abs(h - y) <= STEP && this.passable(n)) {
          y = h;
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }
    return true;
  }
  _smooth(from, pts) {
    if (pts.length < 3) return pts;
    const out = [];
    let cur = from;
    let i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 12);
      for (; j > i; j--) if (this.lineWalkable(cur, pts[j])) break;
      out.push(pts[j]);
      cur = pts[j];
      i = j + 1;
    }
    return out;
  }

  // Random walkable spot near a point (for patrols / cover search).
  randomNear(p, radius, tries = 12) {
    for (let k = 0; k < tries; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      const n = this.nodeAt(p[0] + Math.cos(a) * r, p[1], p[2] + Math.sin(a) * r, 1);
      if (n >= 0) {
        const q = this.nodePos(n);
        if (Math.abs(q[1] - p[1]) < 2.5) return q;
      }
    }
    return null;
  }
}
