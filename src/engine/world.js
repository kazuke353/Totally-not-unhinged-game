// Brush-based world: axis aligned boxes, the same primitive Half-Life's
// collision hulls are built from. Handles spatial queries, ray casts and
// building render meshes with baked lightmaps.
import * as THREE from 'three';
import { bakeLightmaps } from './lightmap.js';
import { createWorldMaterial } from './materials.js';

const CELL = 4;
let BRUSH_ID = 0;

// Face indices: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
export const FACE_AXIS = [0, 0, 1, 1, 2, 2];
export const FACE_SIGN = [1, -1, 1, -1, 1, -1];
const FACE_NAMES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export class Brush {
  constructor(min, max, opts = {}) {
    this.id = BRUSH_ID++;
    this.min = [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])];
    this.max = [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])];
    this.tex = opts.tex || 'concrete';
    this.faceTex = opts.faces || null; // {top, bottom, side, px, nx...}
    this.solid = opts.solid !== false;
    this.visible = opts.visible !== false;
    this.castShadow = opts.castShadow !== undefined ? opts.castShadow : true;
    this.seeThrough = !!opts.seeThrough; // AI vision & bullets pass (fences)
    this.bulletPass = !!opts.bulletPass;
    this.uvScale = opts.uvScale || 1;
    this.uvOffset = opts.uvOffset || [0, 0];
    this.skipFaces = opts.skip || 0; // bitmask of faces never drawn
    this.playerClip = !!opts.playerClip; // invisible wall that only blocks the player
    this.ladder = false;
    this.surface = opts.surface || null; // footstep material override
    this.dynamic = false; // movers/breakables
    this.owner = null; // entity owning this brush (door, breakable…)
    this.offset = [0, 0, 0]; // for movers (render offset)
    this.stamp = 0;
    this.mesh = null;
    this.noCull = !!opts.noCull;
    this.noRay = !!opts.noRay; // movement-only clip (railings)
  }
  texFor(face) {
    const f = this.faceTex;
    if (!f) return this.tex;
    const n = FACE_NAMES[face];
    if (f[n]) return f[n];
    if (face === 2 && f.top) return f.top;
    if (face === 3 && f.bottom) return f.bottom;
    if (face !== 2 && face !== 3 && f.side) return f.side;
    return this.tex;
  }
  // World-space AABB including mover offset.
  get wmin() {
    return [this.min[0] + this.offset[0], this.min[1] + this.offset[1], this.min[2] + this.offset[2]];
  }
  get wmax() {
    return [this.max[0] + this.offset[0], this.max[1] + this.offset[1], this.max[2] + this.offset[2]];
  }
}

export class World {
  constructor() {
    this.brushes = [];
    this.dynamic = [];
    this.grid = new Map();
    this.stamp = 1;
    this.group = new THREE.Group();
    this.entitySolids = null; // callback (min,max,ignore,out) => pushes AABB-likes
    this.bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    this.lightmap = null;
    this.materials = new Map();
  }

  add(brush) {
    if (brush.dynamic) this.dynamic.push(brush);
    else {
      this.brushes.push(brush);
      if (brush.solid || brush.ladder || brush.visible) this._insert(brush);
    }
    for (let a = 0; a < 3; a++) {
      this.bounds.min[a] = Math.min(this.bounds.min[a], brush.min[a]);
      this.bounds.max[a] = Math.max(this.bounds.max[a], brush.max[a]);
    }
    return brush;
  }

  _key(cx, cz) {
    return cx * 73856093 ^ cz * 19349663;
  }
  _insert(b) {
    const x0 = Math.floor(b.min[0] / CELL), x1 = Math.floor(b.max[0] / CELL);
    const z0 = Math.floor(b.min[2] / CELL), z1 = Math.floor(b.max[2] / CELL);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const k = this._key(x, z);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(b);
      }
  }

  // Collect static brushes whose XZ footprint touches the region.
  query(min, max, out = [], filter = null) {
    const s = ++this.stamp;
    const x0 = Math.floor(min[0] / CELL), x1 = Math.floor(max[0] / CELL);
    const z0 = Math.floor(min[2] / CELL), z1 = Math.floor(max[2] / CELL);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const arr = this.grid.get(this._key(x, z));
        if (!arr) continue;
        for (const b of arr) {
          if (b.stamp === s) continue;
          b.stamp = s;
          if (b.max[0] < min[0] || b.min[0] > max[0] || b.max[1] < min[1] || b.min[1] > max[1] || b.max[2] < min[2] || b.min[2] > max[2]) continue;
          if (filter && !filter(b)) continue;
          out.push(b);
        }
      }
    return out;
  }

  // Solids (AABB-like objects with min/max arrays) relevant for movement.
  gatherSolids(min, max, ignore, out, forPlayer = false) {
    out.length = 0;
    this.query(min, max, out, (b) => b.solid && (forPlayer || !b.playerClip));
    for (const b of this.dynamic) {
      if (!b.solid) continue;
      const bm = b.wmin, bx = b.wmax;
      if (bx[0] < min[0] || bm[0] > max[0] || bx[1] < min[1] || bm[1] > max[1] || bx[2] < min[2] || bm[2] > max[2]) continue;
      out.push({ min: bm, max: bx, brush: b, owner: b.owner });
    }
    if (this.entitySolids) this.entitySolids(min, max, ignore, out);
    return out;
  }

  pointSolid(x, y, z) {
    const out = this.query([x, y, z], [x, y, z], [], (b) => b.solid && !b.playerClip);
    for (const b of out) if (x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]) return true;
    return false;
  }

  boxFree(min, max, ignore = null, forPlayer = false) {
    const arr = this.gatherSolids(min, max, ignore, [], forPlayer);
    for (const s of arr) {
      if (s.max[0] > min[0] + 1e-4 && s.min[0] < max[0] - 1e-4 && s.max[1] > min[1] + 1e-4 && s.min[1] < max[1] - 1e-4 && s.max[2] > min[2] + 1e-4 && s.min[2] < max[2] - 1e-4) return false;
    }
    return true;
  }

  // Ray vs world. opts: {maxDist, shadow (only shadow casters), sight (skip seeThrough), bullet, dynamic(bool)}
  raycast(ox, oy, oz, dx, dy, dz, maxDist, opts = {}) {
    let best = maxDist, hit = null;
    const s = ++this.stamp;
    const test = (b, bmin, bmax) => {
      if (opts.shadow && !b.castShadow) return;
      if (!opts.shadow && !b.solid && !b.visible) return;
      if (!opts.shadow && !b.solid) return;
      if (b.playerClip || b.noRay) return;
      if (opts.sight && b.seeThrough) return;
      if (opts.bullet && b.bulletPass) return;
      const r = rayBox(ox, oy, oz, dx, dy, dz, bmin, bmax, best);
      if (r && r.t < best) {
        best = r.t;
        hit = { t: r.t, normal: r.normal, brush: b };
      }
    };
    // 2D DDA across the XZ grid.
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(dx) > 1e-9 ? Math.abs(CELL / dx) : Infinity;
    const tDeltaZ = Math.abs(dz) > 1e-9 ? Math.abs(CELL / dz) : Infinity;
    let tMaxX = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / Math.abs(dx)) : Infinity;
    let tMaxZ = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / Math.abs(dz)) : Infinity;
    let t = 0;
    for (let iter = 0; iter < 512; iter++) {
      const arr = this.grid.get(this._key(cx, cz));
      if (arr) {
        for (const b of arr) {
          if (b.stamp === s) continue;
          b.stamp = s;
          test(b, b.min, b.max);
        }
      }
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
      } else {
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        cz += stepZ;
      }
      if (t > best) break;
    }
    if (opts.dynamic !== false) {
      for (const b of this.dynamic) {
        if (opts.shadow) continue;
        test(b, b.wmin, b.wmax);
      }
    }
    if (hit) {
      hit.point = [ox + dx * hit.t, oy + dy * hit.t, oz + dz * hit.t];
    }
    return hit;
  }

  // True when there's nothing opaque between two points.
  visible(a, b, opts = { sight: true }) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return true;
    return !this.raycast(a[0], a[1], a[2], dx / d, dy / d, dz / d, d - 0.05, opts);
  }

  // Build render meshes + bake lighting.
  async build(textures, mapLighting, sharedUniforms, onProgress) {
    this.textureInfo = textures;
    const faces = [];
    const all = this.brushes.concat(this.dynamic);
    const occluders = all.filter((b) => b.solid && b.visible && b.castShadow && !b.dynamic);
    for (const b of all) {
      if (!b.visible) continue;
      for (let f = 0; f < 6; f++) {
        if (b.skipFaces & (1 << f)) continue;
        if (!b.dynamic && !b.noCull && this._faceHidden(b, f)) continue;
        faces.push(makeFace(b, f));
      }
    }
    this._occluders = occluders;
    const lm = await bakeLightmaps(this, faces, mapLighting, onProgress);
    this.lightmap = lm;

    // Group faces by (texture, owner mesh group)
    const groups = new Map();
    for (const face of faces) {
      const b = face.brush;
      const texName = b.texFor(face.f);
      const groupKey = (b.dynamic || b.ownMesh ? 'b' + b.id : 'static') + '|' + texName;
      let g = groups.get(groupKey);
      if (!g) groups.set(groupKey, (g = { texName, brush: b.dynamic || b.ownMesh ? b : null, faces: [] }));
      g.faces.push(face);
    }
    for (const g of groups.values()) {
      const info = textures[g.texName] || textures.concrete;
      const geo = buildGeometry(g.faces, info, lm);
      const mat = this._material(info, lm.texture, sharedUniforms);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = !!g.brush;
      if (info.mode === 'glass') mesh.renderOrder = 2;
      if (g.brush) {
        g.brush.meshes = g.brush.meshes || [];
        g.brush.meshes.push(mesh);
      }
      if (!g.brush) mesh.updateMatrix();
      this.group.add(mesh);
    }
  }

  _material(info, lmTex, shared) {
    const key = info.name;
    if (!this.materials.has(key)) this.materials.set(key, createWorldMaterial(info, lmTex, shared));
    return this.materials.get(key);
  }

  // A face is hidden if an opaque solid brush covers it completely.
  _faceHidden(b, f) {
    const a = FACE_AXIS[f], s = FACE_SIGN[f];
    const plane = s > 0 ? b.max[a] : b.min[a];
    const ua = a === 0 ? 2 : 0, va = a === 1 ? 2 : 1;
    const qmin = [0, 0, 0], qmax = [0, 0, 0];
    qmin[a] = plane - 0.01; qmax[a] = plane + 0.01;
    qmin[ua] = b.min[ua]; qmax[ua] = b.max[ua];
    qmin[va] = b.min[va]; qmax[va] = b.max[va];
    const cands = this.query(qmin, qmax, [], (o) => o !== b && o.solid && o.visible && !o.dynamic && o.castShadow && !isTransparent(o));
    for (const o of cands) {
      // other brush must occupy the space in front of the face
      const inFront = s > 0 ? o.min[a] <= plane + 1e-3 && o.max[a] > plane + 1e-3 : o.max[a] >= plane - 1e-3 && o.min[a] < plane - 1e-3;
      if (!inFront) continue;
      if (o.min[ua] <= b.min[ua] + 1e-3 && o.max[ua] >= b.max[ua] - 1e-3 && o.min[va] <= b.min[va] + 1e-3 && o.max[va] >= b.max[va] - 1e-3) return true;
    }
    // Faces pointing down at the very bottom of the world are never seen.
    if (f === 3 && plane <= this.bounds.min[1] + 1e-3) return true;
    return false;
  }

  setMoverOffset(brush, x, y, z) {
    brush.offset[0] = x;
    brush.offset[1] = y;
    brush.offset[2] = z;
    if (brush.meshes) for (const m of brush.meshes) m.position.set(x, y, z);
  }
  hideBrush(brush) {
    brush.solid = false;
    if (brush.meshes) for (const m of brush.meshes) m.visible = false;
  }
  showBrush(brush) {
    brush.solid = true;
    if (brush.meshes) for (const m of brush.meshes) m.visible = true;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of this.materials.values()) m.dispose();
    if (this.lightmap) this.lightmap.texture.dispose();
  }
}

function isTransparent(b) {
  return b.seeThrough || b.transparent;
}

// Face descriptor used by the baker and mesh builder.
function makeFace(b, f) {
  const a = FACE_AXIS[f], s = FACE_SIGN[f];
  const ua = a === 0 ? 2 : 0, va = a === 1 ? 2 : 1;
  const plane = s > 0 ? b.max[a] : b.min[a];
  const origin = [0, 0, 0];
  origin[a] = plane;
  origin[ua] = b.min[ua];
  origin[va] = b.min[va];
  const normal = [0, 0, 0];
  normal[a] = s;
  return {
    brush: b,
    f,
    a,
    ua,
    va,
    origin,
    normal,
    w: b.max[ua] - b.min[ua],
    h: b.max[va] - b.min[va],
    lm: null,
  };
}

function buildGeometry(faces, info, lm) {
  const pos = [], nor = [], uv = [], lmuv = [], idx = [];
  const ts = info.size, tsv = info.size * info.aspect;
  for (const face of faces) {
    const b = face.brush;
    const { a, ua, va, origin, w, h, f } = face;
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const base = pos.length / 3;
    const sc = b.uvScale, off = b.uvOffset;
    for (const [s, t] of corners) {
      const p = origin.slice();
      p[ua] += s * w;
      p[va] += t * h;
      pos.push(p[0], p[1], p[2]);
      nor.push(face.normal[0], face.normal[1], face.normal[2]);
      let u, v;
      if (info.uv === 'fit') {
        // fit the whole texture across the face, oriented for the viewer
        if (a === 1) {
          u = s;
          v = f === 2 ? 1 - t : t;
        } else {
          const flip = (a === 0 && f === 0) || (a === 2 && f === 5);
          u = flip ? 1 - s : s;
          v = t;
        }
      } else {
        // world aligned
        if (a === 0) {
          u = (f === 0 ? -p[2] : p[2]) / ts;
          v = p[1] / tsv;
        } else if (a === 2) {
          u = (f === 4 ? p[0] : -p[0]) / ts;
          v = p[1] / tsv;
        } else {
          u = p[0] / ts;
          v = (f === 2 ? -p[2] : p[2]) / tsv;
        }
        u = u / sc + off[0];
        v = v / sc + off[1];
      }
      uv.push(u, v);
      const r = face.lm;
      lmuv.push((r.x + 1.5 + s * (r.nu - 1)) / lm.width, (r.y + 1.5 + t * (r.nv - 1)) / lm.height);
    }
    // winding: make triangles face along the normal
    const sgn = FACE_SIGN[f];
    // ua x va orientation check
    const cross = crossSign(ua, va, a);
    if (sgn * cross > 0) idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('lmuv', new THREE.Float32BufferAttribute(lmuv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// Sign of (e_ua x e_va) along axis a.
function crossSign(ua, va, a) {
  const e = (i) => [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
  const u = e(ua), v = e(va);
  const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return c[a];
}

// Slab ray/AABB test returning entry distance and face normal.
export function rayBox(ox, oy, oz, dx, dy, dz, min, max, maxT = Infinity) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) {
      if (o[a] < min[a] || o[a] > max[a]) return null;
    } else {
      const inv = 1 / d[a];
      let t1 = (min[a] - o[a]) * inv, t2 = (max[a] - o[a]) * inv;
      let s = -1;
      if (t1 > t2) {
        const tt = t1; t1 = t2; t2 = tt; s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nAxis = a;
        nSign = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (nAxis < 0) {
    // origin inside the box
    return { t: 0, normal: [-dx, -dy, -dz] };
  }
  const n = [0, 0, 0];
  n[nAxis] = nSign;
  return { t: tmin, normal: n };
}
