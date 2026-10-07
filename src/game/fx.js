// Visual effects: point-sprite particles, decals, tracers, dynamic lights and
// physical debris chunks.
import * as THREE from 'three';
import { createParticleMaterial, MAX_DLIGHTS } from '../engine/materials.js';
import { rand, clamp } from '../engine/util.js';
import { kit, C } from './modelkit.js';
import { audio } from '../engine/audio.js';

const MAXP = 2500;
const CELL = { glow: 0, spark: 1, smoke: 2, blood: 3, flash: 4, fire: 5, hole: 6, bloodDecal: 7, scorch: 8, chunk: 9, dust: 10, dot: 11, star: 12, cone: 13, shell: 14, shard: 15 };

class ParticlePool {
  constructor(atlas, shared, additive) {
    this.n = 0;
    this.pos = new Float32Array(MAXP * 3);
    this.vel = new Float32Array(MAXP * 3);
    this.life = new Float32Array(MAXP);
    this.max = new Float32Array(MAXP);
    this.s0 = new Float32Array(MAXP);
    this.s1 = new Float32Array(MAXP);
    this.col = new Float32Array(MAXP * 4);
    this.a1 = new Float32Array(MAXP);
    this.cell = new Float32Array(MAXP * 2);
    this.rot = new Float32Array(MAXP);
    this.rotv = new Float32Array(MAXP);
    this.grav = new Float32Array(MAXP);
    this.drag = new Float32Array(MAXP);
    this.bounce = new Uint8Array(MAXP);
    this.snd = new Uint8Array(MAXP);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3);
    this.aSize = new THREE.BufferAttribute(new Float32Array(MAXP), 1);
    this.aCol = new THREE.BufferAttribute(new Float32Array(MAXP * 4), 4);
    this.aCell = new THREE.BufferAttribute(new Float32Array(MAXP * 2), 2);
    this.aRot = new THREE.BufferAttribute(new Float32Array(MAXP), 1);
    for (const a of [this.aPos, this.aSize, this.aCol, this.aCell, this.aRot]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('size', this.aSize);
    g.setAttribute('pcolor', this.aCol);
    g.setAttribute('cell', this.aCell);
    g.setAttribute('rot', this.aRot);
    g.setDrawRange(0, 0);
    this.mat = createParticleMaterial(atlas, shared, additive);
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 10;
  }
  add(p) {
    if (this.n >= MAXP) return;
    const i = this.n++;
    this.pos[i * 3] = p.pos[0]; this.pos[i * 3 + 1] = p.pos[1]; this.pos[i * 3 + 2] = p.pos[2];
    const v = p.vel || [0, 0, 0];
    this.vel[i * 3] = v[0]; this.vel[i * 3 + 1] = v[1]; this.vel[i * 3 + 2] = v[2];
    this.life[i] = 0;
    this.max[i] = p.life || 1;
    this.s0[i] = p.size || 0.2;
    this.s1[i] = p.size1 ?? this.s0[i];
    const c = p.color || [1, 1, 1, 1];
    this.col[i * 4] = c[0]; this.col[i * 4 + 1] = c[1]; this.col[i * 4 + 2] = c[2]; this.col[i * 4 + 3] = c[3] ?? 1;
    this.a1[i] = p.alpha1 ?? 0;
    const cell = p.cell || 0;
    this.cell[i * 2] = cell % 8; this.cell[i * 2 + 1] = Math.floor(cell / 8);
    this.rot[i] = p.rot ?? rand(0, 6.28);
    this.rotv[i] = p.rotv ?? 0;
    this.grav[i] = p.grav ?? 0;
    this.drag[i] = p.drag ?? 0;
    this.bounce[i] = p.bounce ? 1 : 0;
    this.snd[i] = p.sound ? 1 : 0;
  }
  update(dt, world) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const life = this.life[i] + dt;
      if (life >= this.max[i]) continue;
      // compact
      if (w !== i) {
        this.pos[w * 3] = this.pos[i * 3]; this.pos[w * 3 + 1] = this.pos[i * 3 + 1]; this.pos[w * 3 + 2] = this.pos[i * 3 + 2];
        this.vel[w * 3] = this.vel[i * 3]; this.vel[w * 3 + 1] = this.vel[i * 3 + 1]; this.vel[w * 3 + 2] = this.vel[i * 3 + 2];
        this.max[w] = this.max[i]; this.s0[w] = this.s0[i]; this.s1[w] = this.s1[i];
        for (let k = 0; k < 4; k++) this.col[w * 4 + k] = this.col[i * 4 + k];
        this.a1[w] = this.a1[i];
        this.cell[w * 2] = this.cell[i * 2]; this.cell[w * 2 + 1] = this.cell[i * 2 + 1];
        this.rot[w] = this.rot[i]; this.rotv[w] = this.rotv[i]; this.grav[w] = this.grav[i]; this.drag[w] = this.drag[i];
        this.bounce[w] = this.bounce[i]; this.snd[w] = this.snd[i];
      }
      this.life[w] = life;
      const d = Math.max(0, 1 - this.drag[w] * dt);
      this.vel[w * 3] *= d; this.vel[w * 3 + 1] *= d; this.vel[w * 3 + 2] *= d;
      this.vel[w * 3 + 1] -= this.grav[w] * dt;
      const nx = this.pos[w * 3] + this.vel[w * 3] * dt;
      const ny = this.pos[w * 3 + 1] + this.vel[w * 3 + 1] * dt;
      const nz = this.pos[w * 3 + 2] + this.vel[w * 3 + 2] * dt;
      if (this.bounce[w] && world && world.pointSolid(nx, ny, nz)) {
        // crude bounce: reflect vertical, damp
        if (!world.pointSolid(nx, this.pos[w * 3 + 1], nz)) {
          this.vel[w * 3 + 1] *= -0.35;
          this.vel[w * 3] *= 0.6; this.vel[w * 3 + 2] *= 0.6;
          if (this.snd[w] && Math.abs(this.vel[w * 3 + 1]) > 0.5) {
            audio.play('shell_drop', { pos: [nx, ny, nz], volume: 0.4, range: 15 });
            this.snd[w] = 0;
          }
        } else {
          this.vel[w * 3] *= -0.3; this.vel[w * 3 + 2] *= -0.3;
        }
        this.rotv[w] *= 0.5;
      } else {
        this.pos[w * 3] = nx; this.pos[w * 3 + 1] = ny; this.pos[w * 3 + 2] = nz;
      }
      this.rot[w] += this.rotv[w] * dt;
      w++;
    }
    this.n = w;
    const P = this.aPos.array, S = this.aSize.array, Cc = this.aCol.array, Ce = this.aCell.array, R = this.aRot.array;
    for (let i = 0; i < this.n; i++) {
      const k = this.life[i] / this.max[i];
      P[i * 3] = this.pos[i * 3]; P[i * 3 + 1] = this.pos[i * 3 + 1]; P[i * 3 + 2] = this.pos[i * 3 + 2];
      S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      Cc[i * 4] = this.col[i * 4]; Cc[i * 4 + 1] = this.col[i * 4 + 1]; Cc[i * 4 + 2] = this.col[i * 4 + 2];
      Cc[i * 4 + 3] = this.col[i * 4 + 3] + (this.a1[i] - this.col[i * 4 + 3]) * k;
      Ce[i * 2] = this.cell[i * 2]; Ce[i * 2 + 1] = this.cell[i * 2 + 1];
      R[i] = this.rot[i];
    }
    for (const a of [this.aPos, this.aSize, this.aCol, this.aCell, this.aRot]) {
      a.needsUpdate = true;
      a.clearUpdateRanges?.();
    }
    this.points.geometry.setDrawRange(0, this.n);
  }
  clear() {
    this.n = 0;
    this.points.geometry.setDrawRange(0, 0);
  }
}

const DECALS = 200;
const DECAL_VS = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const DECAL_FS = /* glsl */ `
uniform sampler2D atlas;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec3 c = texture2D(atlas, vUv).rgb;
  c = mix(c, vec3(1.0), smoothstep(fogNear, fogFar, vDepth));
  gl_FragColor = vec4(c, 1.0);
}
`;

export class FX {
  constructor(game, atlas, shared) {
    this.game = game;
    this.shared = shared;
    this.group = new THREE.Group();
    this.alpha = new ParticlePool(atlas, shared, false);
    this.add = new ParticlePool(atlas, shared, true);
    this.group.add(this.alpha.points, this.add.points);
    this.dlights = [];
    // decals
    const g = new THREE.BufferGeometry();
    this.dPos = new Float32Array(DECALS * 4 * 3);
    this.dUv = new Float32Array(DECALS * 4 * 2);
    const idx = [];
    for (let i = 0; i < DECALS; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.dPos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.dUv, 2));
    g.setIndex(idx);
    this.decalMat = new THREE.ShaderMaterial({
      uniforms: { atlas: { value: atlas.tex }, fogNear: shared.fogNear, fogFar: shared.fogFar },
      vertexShader: DECAL_VS,
      fragmentShader: DECAL_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    this.decals = new THREE.Mesh(g, this.decalMat);
    this.decals.frustumCulled = false;
    this.decals.renderOrder = 5;
    this.decalIndex = 0;
    this.decalCount = 0;
    this.group.add(this.decals);
    // tracers
    const tg = new THREE.BufferGeometry();
    this.tPos = new Float32Array(64 * 2 * 3);
    this.tCol = new Float32Array(64 * 2 * 3);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3));
    this.tracerMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracerLines = new THREE.LineSegments(tg, this.tracerMat);
    this.tracerLines.frustumCulled = false;
    this.tracers = [];
    this.group.add(this.tracerLines);
    // chunks (debris / gibs)
    this.chunks = [];
    this.chunkGeos = {};
    this.chunkMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  }

  clear() {
    this.alpha.clear();
    this.add.clear();
    this.dlights.length = 0;
    this.decalCount = 0;
    this.dPos.fill(0);
    this.decals.geometry.attributes.position.needsUpdate = true;
    this.tracers.length = 0;
    for (const c of this.chunks) this.group.remove(c.mesh);
    this.chunks.length = 0;
  }

  // ---------------------------------------------------------------- dlights
  dlight(pos, color, radius, life = 0.08, follow = null) {
    const d = { pos: [pos[0], pos[1], pos[2]], color, radius, life, max: life, follow };
    this.dlights.push(d);
    return d;
  }

  // ---------------------------------------------------------------- presets
  sparks(pos, normal, count = 8, color = [1, 0.8, 0.4]) {
    for (let i = 0; i < count; i++) {
      const v = [normal[0] * 3 + rand(-3, 3), normal[1] * 3 + rand(-1, 4), normal[2] * 3 + rand(-3, 3)];
      this.add.add({ pos, vel: v, life: rand(0.2, 0.5), size: 0.08, size1: 0.02, color: [...color, 1], alpha1: 0, cell: CELL.spark, grav: 12 });
    }
    this.add.add({ pos, life: 0.06, size: 0.5, size1: 0.2, color: [1, 0.85, 0.5, 1], cell: CELL.glow });
  }
  puff(pos, normal, color = [0.6, 0.55, 0.5], n = 3, size = 0.35) {
    for (let i = 0; i < n; i++) {
      this.alpha.add({
        pos: [pos[0] + normal[0] * 0.05, pos[1] + normal[1] * 0.05, pos[2] + normal[2] * 0.05],
        vel: [normal[0] * rand(0.5, 1.5) + rand(-0.3, 0.3), normal[1] * rand(0.5, 1.5) + rand(0, 0.5), normal[2] * rand(0.5, 1.5) + rand(-0.3, 0.3)],
        life: rand(0.5, 1.0), size: size * 0.5, size1: size * 1.8, color: [...color, 0.6], alpha1: 0, cell: CELL.smoke, drag: 2, rotv: rand(-1, 1),
      });
    }
  }
  chips(pos, normal, color, n = 4) {
    for (let i = 0; i < n; i++) {
      this.alpha.add({
        pos, vel: [normal[0] * 2 + rand(-2, 2), normal[1] * 2 + rand(0, 3), normal[2] * 2 + rand(-2, 2)],
        life: rand(0.4, 0.8), size: 0.05, size1: 0.04, color: [...color, 1], alpha1: 1, cell: CELL.chunk, grav: 14, rotv: rand(-10, 10),
      });
    }
  }
  blood(pos, dir, amount = 1, color = [0.55, 0.02, 0.02]) {
    for (let i = 0; i < 4 + amount * 4; i++) {
      this.alpha.add({
        pos, vel: [dir[0] * rand(0.5, 2.5) + rand(-1.2, 1.2), rand(-0.5, 2.5), dir[2] * rand(0.5, 2.5) + rand(-1.2, 1.2)],
        life: rand(0.3, 0.7), size: rand(0.08, 0.18), size1: 0.25, color: [...color, 1], alpha1: 0, cell: CELL.blood, grav: 9, drag: 1,
      });
    }
    this.alpha.add({ pos, life: 0.35, size: 0.3, size1: 0.6 + amount * 0.2, color: [...color, 0.8], alpha1: 0, cell: CELL.blood });
  }
  muzzle(pos, scale = 1, color = [1, 0.85, 0.5]) {
    this.add.add({ pos, life: 0.05, size: 0.45 * scale, size1: 0.35 * scale, color: [...color, 1], alpha1: 0.5, cell: CELL.flash });
    this.dlight(pos, [1.5 * color[0], 1.2 * color[1], 0.6 * color[2]], 6 * scale, 0.06);
  }
  shellCasing(pos, right, color = [1, 0.85, 0.5]) {
    this.alpha.add({
      pos, vel: [right[0] * rand(1.5, 2.5), rand(1.5, 3), right[2] * rand(1.5, 2.5)],
      life: 1.4, size: 0.05, size1: 0.05, color: [...color, 1], alpha1: 1, cell: CELL.shell, grav: 12, rotv: rand(-15, 15), bounce: true, sound: true,
    });
  }
  explosion(pos, scale = 1) {
    for (let i = 0; i < 18 * scale; i++) {
      this.add.add({
        pos: [pos[0] + rand(-0.4, 0.4) * scale, pos[1] + rand(-0.2, 0.5) * scale, pos[2] + rand(-0.4, 0.4) * scale],
        vel: [rand(-4, 4) * scale, rand(0, 5) * scale, rand(-4, 4) * scale],
        life: rand(0.35, 0.7), size: rand(1.2, 2.2) * scale, size1: 3 * scale, color: [1, 0.8, 0.5, 1], alpha1: 0, cell: CELL.fire, drag: 3, rotv: rand(-2, 2),
      });
    }
    for (let i = 0; i < 14 * scale; i++) {
      this.alpha.add({
        pos: [pos[0] + rand(-0.6, 0.6), pos[1] + rand(0, 1), pos[2] + rand(-0.6, 0.6)],
        vel: [rand(-2, 2), rand(1, 4), rand(-2, 2)],
        life: rand(1.5, 3), size: 1.5 * scale, size1: 5 * scale, color: [0.18, 0.16, 0.15, 0.75], alpha1: 0, cell: CELL.smoke, drag: 1.2, rotv: rand(-1, 1),
      });
    }
    for (let i = 0; i < 24; i++) {
      this.add.add({
        pos, vel: [rand(-12, 12), rand(2, 14), rand(-12, 12)], life: rand(0.4, 1.0), size: 0.12, size1: 0.04,
        color: [1, 0.7, 0.3, 1], alpha1: 0, cell: CELL.spark, grav: 14, bounce: true,
      });
    }
    this.add.add({ pos, life: 0.25, size: 6 * scale, size1: 9 * scale, color: [1, 0.9, 0.7, 1], alpha1: 0, cell: CELL.glow });
    this.dlight(pos, [3, 2, 1], 14 * scale, 0.6);
  }
  smokeTrail(pos, size = 0.4, color = [0.5, 0.5, 0.5]) {
    this.alpha.add({ pos, vel: [rand(-0.2, 0.2), rand(0.2, 0.6), rand(-0.2, 0.2)], life: rand(0.8, 1.6), size, size1: size * 4, color: [...color, 0.5], alpha1: 0, cell: CELL.smoke, drag: 1, rotv: rand(-1, 1) });
  }
  fire(pos, size = 0.8) {
    this.add.add({ pos: [pos[0] + rand(-0.2, 0.2), pos[1], pos[2] + rand(-0.2, 0.2)], vel: [rand(-0.3, 0.3), rand(1.2, 2.5), rand(-0.3, 0.3)], life: rand(0.3, 0.6), size, size1: size * 0.3, color: [1, 0.7, 0.35, 1], alpha1: 0, cell: CELL.fire, rotv: rand(-2, 2) });
  }
  glowSprite(pos, size, color, life = 0.05) {
    this.add.add({ pos, life, size, size1: size, color: [...color, 1], alpha1: 1, cell: CELL.glow });
  }
  dot(pos, size, color) {
    this.add.add({ pos, life: 0.001, size, size1: size, color: [...color, 1], alpha1: 1, cell: CELL.dot });
  }
  stars(pos) {
    for (let i = 0; i < 3; i++) this.add.add({ pos: [pos[0], pos[1], pos[2]], vel: [Math.cos(i * 2.1) * 0.6, 0.3, Math.sin(i * 2.1) * 0.6], life: 0.8, size: 0.18, size1: 0.1, color: [1, 0.9, 0.3, 1], alpha1: 0, cell: CELL.star, rotv: 4 });
  }
  glassShards(pos, n = 20) {
    for (let i = 0; i < n; i++)
      this.alpha.add({
        pos: [pos[0] + rand(-0.5, 0.5), pos[1] + rand(-0.5, 0.5), pos[2] + rand(-0.5, 0.5)], vel: [rand(-2, 2), rand(-1, 2), rand(-2, 2)],
        life: rand(0.6, 1.2), size: rand(0.06, 0.14), color: [0.75, 0.9, 1, 0.7], alpha1: 0.5, cell: CELL.shard, grav: 12, rotv: rand(-10, 10), bounce: true,
      });
  }

  // ---------------------------------------------------------------- decals
  decal(point, normal, kind = 'hole', size = 0.12) {
    const cellIdx = kind === 'blood' ? CELL.bloodDecal : kind === 'scorch' ? CELL.scorch : CELL.hole;
    const i = this.decalIndex;
    this.decalIndex = (this.decalIndex + 1) % DECALS;
    this.decalCount = Math.min(DECALS, this.decalCount + 1);
    const n = new THREE.Vector3(...normal);
    const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t = new THREE.Vector3().crossVectors(up, n).normalize();
    const b = new THREE.Vector3().crossVectors(n, t);
    const ang = Math.random() * Math.PI * 2;
    const tt = t.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
    const bb = new THREE.Vector3().crossVectors(n, tt);
    const c = new THREE.Vector3(...point).addScaledVector(n, 0.008);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const cu = (cellIdx % 8) / 8, cv = Math.floor(cellIdx / 8) / 8;
    corners.forEach(([u, v], k) => {
      const p = c.clone().addScaledVector(tt, u * size).addScaledVector(bb, v * size);
      this.dPos[(i * 4 + k) * 3] = p.x;
      this.dPos[(i * 4 + k) * 3 + 1] = p.y;
      this.dPos[(i * 4 + k) * 3 + 2] = p.z;
      this.dUv[(i * 4 + k) * 2] = cu + ((u + 1) / 2) * 0.125;
      this.dUv[(i * 4 + k) * 2 + 1] = cv + ((v + 1) / 2) * 0.125;
    });
    const g = this.decals.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
  }

  // ---------------------------------------------------------------- tracers
  tracer(a, b, color = [1, 0.85, 0.5], life = 0.05) {
    if (this.tracers.length >= 64) this.tracers.shift();
    // draw a short streak travelling along the path
    this.tracers.push({ a: [...a], b: [...b], color, life, max: life });
  }

  // ---------------------------------------------------------------- chunks
  chunk(pos, vel, color, size = 0.12, life = 4) {
    if (this.chunks.length > 60) {
      const old = this.chunks.shift();
      this.group.remove(old.mesh);
    }
    const key = color.join(',') + size;
    if (!this.chunkGeos[key]) this.chunkGeos[key] = kit.box(size, size * 0.7, size * 1.2, color);
    const m = new THREE.Mesh(this.chunkGeos[key], this.chunkMat);
    m.position.set(...pos);
    m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    this.group.add(m);
    this.chunks.push({ mesh: m, vel: [...vel], spin: [rand(-8, 8), rand(-8, 8), rand(-8, 8)], life, rest: false });
  }
  woodChunks(min, max, n = 10) {
    for (let i = 0; i < n; i++) {
      const p = [rand(min[0], max[0]), rand(min[1], max[1]), rand(min[2], max[2])];
      this.chunk(p, [rand(-3, 3), rand(1, 5), rand(-3, 3)], i % 2 ? C('#7a5530') : C('#9c7442'), rand(0.08, 0.2));
    }
  }
  metalChunks(min, max, n = 8) {
    for (let i = 0; i < n; i++) {
      const p = [rand(min[0], max[0]), rand(min[1], max[1]), rand(min[2], max[2])];
      this.chunk(p, [rand(-4, 4), rand(2, 7), rand(-4, 4)], i % 2 ? C('#4a4f52') : C('#2e3134'), rand(0.08, 0.22));
    }
  }
  gibs(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      this.chunk([pos[0] + rand(-0.3, 0.3), pos[1] + rand(0.2, 1.2), pos[2] + rand(-0.3, 0.3)], [rand(-5, 5), rand(3, 8), rand(-5, 5)], i % 3 ? C('#7a1010') : C('#4a5534'), rand(0.1, 0.22), 6);
    }
    this.blood(pos, [0, 1, 0], 3);
  }

  // ---------------------------------------------------------------- update
  update(dt, camera) {
    const world = this.game.world;
    this.alpha.update(dt, world);
    this.add.update(dt, world);
    // dlights
    for (const d of this.dlights) {
      d.life -= dt;
      if (d.follow) {
        const p = d.follow();
        if (p) { d.pos[0] = p[0]; d.pos[1] = p[1]; d.pos[2] = p[2]; }
      }
    }
    this.dlights = this.dlights.filter((d) => d.life > 0);
    const cam = camera.position;
    const sorted = this.dlights
      .map((d) => ({ d, k: (d.pos[0] - cam.x) ** 2 + (d.pos[1] - cam.y) ** 2 + (d.pos[2] - cam.z) ** 2 }))
      .sort((a, b) => a.k - b.k);
    const P = this.shared.dlPos.value, Cc = this.shared.dlCol.value;
    for (let i = 0; i < MAX_DLIGHTS; i++) {
      const e = sorted[i];
      if (e) {
        const f = e.d.max > 0 ? clamp(e.d.life / e.d.max, 0, 1) : 1;
        const fade = e.d.max >= 0.3 ? f : 1;
        P[i].set(e.d.pos[0], e.d.pos[1], e.d.pos[2], e.d.radius);
        Cc[i].set(e.d.color[0] * fade, e.d.color[1] * fade, e.d.color[2] * fade);
      } else {
        P[i].set(0, -9999, 0, 1);
        Cc[i].set(0, 0, 0);
      }
    }
    // tracers
    this.tracers = this.tracers.filter((t) => (t.life -= dt) > 0);
    const tp = this.tPos, tc = this.tCol;
    tp.fill(0);
    tc.fill(0);
    this.tracers.forEach((t, i) => {
      const k = 1 - t.life / t.max;
      const len = 0.35;
      const s0 = Math.min(1, k * 1.1), s1 = Math.max(0, s0 - len);
      for (let j = 0; j < 3; j++) {
        tp[i * 6 + j] = t.a[j] + (t.b[j] - t.a[j]) * s1;
        tp[i * 6 + 3 + j] = t.a[j] + (t.b[j] - t.a[j]) * s0;
        tc[i * 6 + j] = t.color[j] * 0.3;
        tc[i * 6 + 3 + j] = t.color[j];
      }
    });
    const tg = this.tracerLines.geometry;
    tg.attributes.position.needsUpdate = true;
    tg.attributes.color.needsUpdate = true;
    tg.setDrawRange(0, this.tracers.length * 2);
    // chunks
    for (const c of this.chunks) {
      c.life -= dt;
      if (c.rest) continue;
      c.vel[1] -= 16 * dt;
      const m = c.mesh;
      const nx = m.position.x + c.vel[0] * dt, ny = m.position.y + c.vel[1] * dt, nz = m.position.z + c.vel[2] * dt;
      if (world.pointSolid(nx, ny - 0.04, nz)) {
        if (!world.pointSolid(nx, m.position.y, nz)) {
          c.vel[1] *= -0.3;
          c.vel[0] *= 0.6;
          c.vel[2] *= 0.6;
          if (Math.abs(c.vel[1]) < 0.6) c.rest = true;
        } else {
          c.vel[0] *= -0.4;
          c.vel[2] *= -0.4;
        }
      } else m.position.set(nx, ny, nz);
      m.rotation.x += c.spin[0] * dt;
      m.rotation.y += c.spin[1] * dt;
      m.rotation.z += c.spin[2] * dt;
    }
    this.chunks = this.chunks.filter((c) => {
      if (c.life <= 0) {
        this.group.remove(c.mesh);
        return false;
      }
      return true;
    });
    // scale particle size to viewport
    const h = this.game.app.renderer.renderer.getDrawingBufferSize(_sz).y;
    const s = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.alpha.mat.uniforms.scale.value = s;
    this.add.mat.uniforms.scale.value = s;
  }
}
const _sz = new THREE.Vector2();
