// Set-piece entities for the finale: props, the nuke, the gunship boss,
// fuel valve, launch console and the ending cutscene.
import * as THREE from 'three';
import { Entity } from './base.js';
import { kit, C, meshOf, bone, entityMaterial } from '../modelkit.js';
import { Brush } from '../../engine/world.js';
import { audio } from '../../engine/audio.js';
import { approachAngle, clamp, damp, rand, lerp, chance, wrapAngle } from '../../engine/util.js';

// ------------------------------------------------------------------ models
export function buildEmu(mat) {
  const g = new THREE.Group();
  const F = C('#3a3430'), F2 = C('#5a5048'), SKIN = C('#5a7aa0'), LEG = C('#6a5a48');
  g.add(
    meshOf(
      [
        kit.ball(0.45, 0.4, 0.55, (x, y) => (y > 0.1 ? F2 : F), { p: [0, 1.15, 0] }, 9, 6),
        kit.limb(0.07, 0.05, 0.75, F2, { p: [0, 1.95, 0.32], r: [0.25, 0, 0] }, 6),
        kit.ball(0.09, 0.09, 0.13, SKIN, { p: [0, 2.0, 0.42] }, 7, 5),
        kit.cone(0.035, 0.12, C('#2a2a2a'), { p: [0, 1.98, 0.58], r: [Math.PI / 2, 0, 0] }, 5),
        kit.ball(0.02, 0.02, 0.02, C('#e8a020'), { p: [0.06, 2.03, 0.47] }, 4, 3),
        kit.ball(0.02, 0.02, 0.02, C('#e8a020'), { p: [-0.06, 2.03, 0.47] }, 4, 3),
        kit.limb(0.06, 0.04, 0.8, LEG, { p: [0.15, 0.85, 0], r: [0.1, 0, 0] }, 5),
        kit.limb(0.06, 0.04, 0.8, LEG, { p: [-0.15, 0.85, 0], r: [-0.1, 0, 0] }, 5),
        kit.box(0.14, 0.04, 0.22, LEG, { p: [0.15, 0.03, 0.06] }),
        kit.box(0.14, 0.04, 0.22, LEG, { p: [-0.15, 0.03, -0.04] }),
        // cybernetic eyepatch. Of course.
        kit.box(0.05, 0.05, 0.02, C('#c02020'), { p: [0.07, 2.04, 0.5] }),
      ],
      mat
    )
  );
  return g;
}

export function buildKMan(mat) {
  // A koala in a suit, holding a briefcase. Unsettling.
  const g = new THREE.Group();
  const FUR = C('#8d8d92'), FUR_L = C('#d8d8dc'), SUIT = C('#1c2230'), SHIRT = C('#e8e8e0'), TIE = C('#4a1a20');
  const body = bone(g, 0, 0, 0);
  body.add(
    meshOf(
      [
        kit.limb(0.09, 0.08, 0.85, SUIT, { p: [0.12, 0.85, 0] }, 7),
        kit.limb(0.09, 0.08, 0.85, SUIT, { p: [-0.12, 0.85, 0] }, 7),
        kit.box(0.14, 0.06, 0.26, C('#0e0e10'), { p: [0.12, 0.03, 0.05] }),
        kit.box(0.14, 0.06, 0.26, C('#0e0e10'), { p: [-0.12, 0.03, 0.05] }),
        kit.box(0.46, 0.62, 0.28, SUIT, { p: [0, 1.15, 0] }),
        kit.box(0.14, 0.4, 0.02, SHIRT, { p: [0, 1.25, 0.145] }),
        kit.box(0.06, 0.34, 0.025, TIE, { p: [0, 1.22, 0.15] }),
        kit.limb(0.07, 0.06, 0.55, SUIT, { p: [0.28, 1.42, 0], r: [0, 0, 0.12] }, 6),
        kit.limb(0.07, 0.06, 0.55, SUIT, { p: [-0.28, 1.42, 0], r: [0, 0, -0.12] }, 6),
        kit.ball(0.05, 0.05, 0.05, FUR, { p: [0.33, 0.85, 0] }, 5, 4),
        kit.ball(0.05, 0.05, 0.05, FUR, { p: [-0.33, 0.85, 0] }, 5, 4),
        kit.box(0.42, 0.3, 0.1, C('#2a1c12'), { p: [0.33, 0.72, 0.05] }),
        // head
        kit.ball(0.2, 0.18, 0.18, FUR, { p: [0, 1.66, 0.02] }, 9, 7),
        kit.ball(0.13, 0.13, 0.05, FUR, { p: [0.21, 1.78, -0.02] }, 8, 5),
        kit.ball(0.13, 0.13, 0.05, FUR, { p: [-0.21, 1.78, -0.02] }, 8, 5),
        kit.ball(0.09, 0.09, 0.04, FUR_L, { p: [0.21, 1.78, 0.02] }, 7, 4),
        kit.ball(0.09, 0.09, 0.04, FUR_L, { p: [-0.21, 1.78, 0.02] }, 7, 4),
        kit.ball(0.065, 0.085, 0.06, C('#151515'), { p: [0, 1.62, 0.18] }, 7, 5),
        kit.ball(0.025, 0.025, 0.02, C('#050505'), { p: [0.08, 1.71, 0.16] }, 5, 4),
        kit.ball(0.025, 0.025, 0.02, C('#050505'), { p: [-0.08, 1.71, 0.16] }, 5, 4),
      ],
      mat
    )
  );
  g.userData.body = body;
  return g;
}

function buildRadar(mat) {
  const g = new THREE.Group();
  g.add(meshOf([kit.cyl(0.3, 0.5, 3, C('#5a5f62'), { p: [0, 1.5, 0] }, 8), kit.box(1, 0.4, 1, C('#3a3f42'), { p: [0, 3.1, 0] })], mat));
  const dish = bone(g, 0, 3.4, 0);
  dish.add(meshOf([kit.cyl(2.2, 0.4, 0.8, C('#c8c8c0'), { r: [1.2, 0, 0], p: [0, 0.6, 0.3] }, 14, true), kit.cyl(0.05, 0.05, 1.6, C('#888'), { r: [1.2, 0, 0], p: [0, 1.2, 0.9] }, 5)], mat));
  g.userData.dish = dish;
  return g;
}

function buildWindmill(mat) {
  const g = new THREE.Group();
  const M = C('#8a8e90'), D = C('#4a4e50');
  const parts = [];
  // lattice tower: four tapering legs + cross braces
  const H = 9;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const top = [x * 0.25, H, z * 0.25], bot = [x * 1.2, 0, z * 1.2];
    const dx = top[0] - bot[0], dz = top[2] - bot[2];
    const len = Math.hypot(dx, H, dz);
    parts.push(kit.cyl(0.05, 0.07, len, M, { p: [(top[0] + bot[0]) / 2, H / 2, (top[2] + bot[2]) / 2], r: [Math.atan2(dz, H), 0, -Math.atan2(dx, H)] }, 5));
  }
  for (let y = 1.5; y < H; y += 2.2) {
    const w = 1.2 - (y / H) * 0.95;
    parts.push(kit.box(w * 2, 0.05, 0.05, D, { p: [0, y, w] }), kit.box(w * 2, 0.05, 0.05, D, { p: [0, y, -w] }));
    parts.push(kit.box(0.05, 0.05, w * 2, D, { p: [w, y, 0] }), kit.box(0.05, 0.05, w * 2, D, { p: [-w, y, 0] }));
  }
  parts.push(kit.box(0.5, 0.4, 0.8, D, { p: [0, H + 0.2, 0] }));
  parts.push(kit.box(0.04, 1.2, 2.2, C('#b0b4b6'), { p: [0, H + 0.4, -1.6] }));
  g.add(meshOf(parts, mat));
  const fan = bone(g, 0, H + 0.25, 0.5);
  const blades = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    blades.push(kit.box(0.28, 1.5, 0.02, C('#c4c8ca'), { p: [Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0], r: [0, 0.35, -a] }));
  }
  blades.push(kit.cyl(0.12, 0.12, 0.2, D, { r: [Math.PI / 2, 0, 0] }, 8));
  fan.add(meshOf(blades, mat));
  g.userData.fan = fan;
  return g;
}

export class Prop extends Entity {
  spawn() {
    const g = this.game, d = this.def;
    this.mat = entityMaterial(g.shared);
    if (d.model === 'emu') this.mesh = buildEmu(this.mat);
    else if (d.model === 'kman') this.mesh = buildKMan(this.mat);
    else if (d.model === 'radar') this.mesh = buildRadar(this.mat);
    else if (d.model === 'windmill') this.mesh = buildWindmill(this.mat);
    else this.mesh = new THREE.Group();
    this.mesh.position.set(...d.pos);
    this.mesh.rotation.y = d.yaw || 0;
    if (d.scale) this.mesh.scale.setScalar(d.scale);
    g.entGroup.add(this.mesh);
    const L = g.sampleLight([d.pos[0], d.pos[1] + 0.3, d.pos[2]], [0, 0, 0]);
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.8 + 0.08, L[1] * 0.8 + 0.08, L[2] * 0.8 + 0.08);
    this.mat.uniforms.uDirCol.value.set(L[0] * 0.5, L[1] * 0.5, L[2] * 0.5);
    this.t = rand(0, 10);
  }
  update(dt) {
    this.t += dt;
    if (this.mesh.userData.dish) this.mesh.userData.dish.rotation.y = this.t * 0.4;
    if (this.mesh.userData.fan) this.mesh.userData.fan.rotation.z = this.t * 1.6;
    if (this.def.model === 'emu') this.mesh.rotation.y = (this.def.yaw || 0) + Math.sin(this.t * 0.6) * 0.15;
  }
}

// ------------------------------------------------------------------ missile
let missileTex = null;
export class Missile extends Entity {
  constructor(game, d) {
    super(game, d);
    this.state = 'idle';
    this.y = 0;
    this.vy = 0;
    this.t = 0;
    this.fuelled = false;
  }
  preBuild(world) {
    const p = this.def.pos;
    this.brush = new Brush([p[0] - 1.5, p[1], p[2] - 1.5], [p[0] + 1.5, p[1] + 28, p[2] + 1.5], { tex: 'black', visible: false });
    this.brush.dynamic = true;
    this.brush.owner = this;
    world.add(this.brush);
  }
  spawn() {
    const g = this.game, d = this.def;
    if (!missileTex) missileTex = g.app.textures.missile.tex;
    this.mat = entityMaterial(g.shared, { map: missileTex });
    const W = C('#ffffff'), BK = C('#2a2a2a'), Y = C('#d8b030');
    const body = new THREE.CylinderGeometry(1.3, 1.3, 20, 16, 1, true);
    body.translate(0, 12, 0);
    const parts = [
      kit.cyl(1.3, 1.3, 20, W, { p: [0, 12, 0] }, 16, true),
      kit.cone(1.3, 4.5, C('#e8e8e2'), { p: [0, 24.25, 0] }, 16),
      kit.cyl(1.32, 1.32, 0.5, BK, { p: [0, 21.5, 0] }, 16),
      kit.cyl(1.32, 1.32, 0.5, BK, { p: [0, 4.5, 0] }, 16),
      kit.cyl(1.0, 1.4, 2, C('#3a3a3a'), { p: [0, 1, 0] }, 12),
    ];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      parts.push(kit.box(0.12, 3.5, 2.2, Y, { p: [Math.cos(a) * 1.9, 3.6, Math.sin(a) * 1.9], r: [0, -a, 0] }));
    }
    // UVs for the text band come from the textured cylinder
    const tparts = parts.map((g2) => g2);
    this.mesh = meshOf(tparts, this.mat);
    this.mesh.position.set(...d.pos);
    g.entGroup.add(this.mesh);
    this.light();
  }
  light() {
    const g = this.game, d = this.def;
    const L = g.sampleLight([d.pos[0] + 3, d.pos[1] + 0.5, d.pos[2] + 3], [0, 0, 0]);
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.9 + 0.12, L[1] * 0.9 + 0.12, L[2] * 0.9 + 0.14);
    this.mat.uniforms.uDirCol.value.set(0.35, 0.3, 0.28);
  }
  trigger() {
    this.launch();
  }
  launch() {
    if (this.state !== 'idle') return;
    this.state = 'ignite';
    this.t = 0;
    this.roar = audio.play('launch_roar', { pos: this.def.pos, loop: true, volume: 1.4, ref: 20 });
    this.game.world.hideBrush(this.brush);
  }
  update(dt) {
    const g = this.game, d = this.def;
    if (this.state === 'idle') return;
    this.t += dt;
    const base = [d.pos[0], d.pos[1] + this.y, d.pos[2]];
    if (this.state === 'ignite') {
      // smoke & fire fill the silo floor
      for (let k = 0; k < 4; k++) {
        g.fx.fire([base[0] + rand(-1, 1), base[1] + 0.5, base[2] + rand(-1, 1)], 2.2);
        g.fx.smokeTrail([base[0] + rand(-6, 6), d.pos[1] + rand(0, 3), base[2] + rand(-6, 6)], 2.2, [0.6, 0.58, 0.55]);
      }
      g.fx.dlight([base[0], base[1] + 1, base[2]], [3, 1.8, 0.8], 30, 0.05);
      g.shake = Math.max(g.shake, 0.8);
      if (this.t > 3) this.state = 'rise';
    } else if (this.state === 'rise') {
      this.vy += dt * (2 + this.vy * 0.6);
      this.y += this.vy * dt;
      for (let k = 0; k < 3; k++) {
        g.fx.fire([base[0] + rand(-0.5, 0.5), base[1] - 0.5, base[2] + rand(-0.5, 0.5)], 2.5);
        g.fx.smokeTrail([base[0] + rand(-1, 1), base[1] - 1.5, base[2] + rand(-1, 1)], 2.5, [0.65, 0.62, 0.6]);
      }
      g.fx.dlight([base[0], base[1] - 1, base[2]], [3, 1.8, 0.8], 35, 0.05);
      g.shake = Math.max(g.shake, Math.max(0, 1.2 - this.y * 0.02));
      if (this.roar) this.roar.setPos(base);
      if (this.y > 900) {
        this.state = 'gone';
        this.mesh.visible = false;
        if (this.roar) this.roar.stop();
      }
    }
    this.mesh.position.set(d.pos[0], d.pos[1] + this.y, d.pos[2]);
  }
  topPos() {
    const d = this.def;
    return [d.pos[0], d.pos[1] + this.y + 26, d.pos[2]];
  }
  destroy() {
    super.destroy();
    if (this.roar) this.roar.stop();
  }
}

// ------------------------------------------------------------------ gunship
export class Gunship extends Entity {
  constructor(game, d) {
    super(game, d);
    this.isGunship = true;
    this.alive = true;
    this.active = false;
    this.maxHealth = 1000 * game.diff.enemyHp;
    this.health = this.maxHealth;
    this.pos = new THREE.Vector3(...d.pos);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.bank = 0;
    this.state = 'hidden';
    this.t = 0;
    this.attackT = 3;
    this.burst = 0;
    this.fireT = 0;
    this.rocketT = 6;
    this.goal = new THREE.Vector3(...d.pos);
    this.goalT = 0;
    this.fleshy = false;
    this.surface = 'metal';
    this.smokeT = 0;
  }
  spawn() {
    const g = this.game;
    this.mat = entityMaterial(g.shared);
    const OL = C('#3e4630'), DK = C('#25291e'), GL = C('#20303a');
    const root = new THREE.Group();
    root.add(
      meshOf(
        [
          kit.ball(1.4, 1.3, 3.6, OL, { p: [0, 0, 0.6] }, 10, 7),
          kit.ball(1.0, 0.9, 1.6, GL, { p: [0, 0.35, 2.8] }, 8, 6),
          kit.box(0.9, 0.8, 7, OL, { p: [0, 0.3, -4.5] }),
          kit.box(0.2, 2.2, 1.4, OL, { p: [0, 1.4, -7.7] }),
          kit.box(2.6, 0.15, 0.9, OL, { p: [0, 0.9, -7.6] }),
          kit.box(5.2, 0.25, 1.1, DK, { p: [0, -0.3, 0.4] }),
          kit.cyl(0.35, 0.35, 1.8, DK, { p: [2.4, -0.7, 0.6], r: [Math.PI / 2, 0, 0] }, 8),
          kit.cyl(0.35, 0.35, 1.8, DK, { p: [-2.4, -0.7, 0.6], r: [Math.PI / 2, 0, 0] }, 8),
          kit.box(0.5, 0.5, 0.8, DK, { p: [0, -1.2, 3.0] }),
          kit.cyl(0.07, 0.07, 1.4, C('#111'), { p: [0, -1.25, 3.8], r: [Math.PI / 2, 0, 0] }, 6),
          kit.cyl(0.25, 0.3, 0.6, DK, { p: [0, 1.5, 0.4] }, 8),
          kit.box(0.15, 1.0, 0.15, DK, { p: [1.0, -1.6, 1.5] }),
          kit.box(0.15, 1.0, 0.15, DK, { p: [-1.0, -1.6, 1.5] }),
          kit.box(0.15, 0.15, 3.5, DK, { p: [1.0, -2.1, 1.0] }),
          kit.box(0.15, 0.15, 3.5, DK, { p: [-1.0, -2.1, 1.0] }),
        ],
        this.mat
      )
    );
    this.rotor = bone(root, 0, 1.85, 0.4);
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.75 });
    for (let k = 0; k < 4; k++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 7.5), bladeMat);
      bl.rotation.y = (k / 4) * Math.PI * 2;
      bl.position.set(0, 0, 0);
      const pivot = new THREE.Group();
      pivot.rotation.y = (k / 4) * Math.PI;
      pivot.add(bl);
      this.rotor.add(pivot);
    }
    this.tailRotor = bone(root, 0.25, 1.4, -7.7);
    for (let k = 0; k < 2; k++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.25), bladeMat);
      bl.rotation.x = k * Math.PI / 2;
      this.tailRotor.add(bl);
    }
    // searchlight
    const coneGeo = new THREE.ConeGeometry(4.5, 40, 16, 1, true);
    coneGeo.translate(0, -20, 0);
    const cols = [];
    const pos = coneGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 1 + pos.getY(i) / 40;
      cols.push(k * 0.3, k * 0.3, k * 0.25);
    }
    coneGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.cone.renderOrder = 13;
    this.coneHolder = bone(root, 0, -1.2, 2.6);
    this.coneHolder.add(this.cone);
    this.mesh = root;
    this.mesh.visible = false;
    g.entGroup.add(root);
    this.mat.uniforms.uAmbient.value.set(0.22, 0.24, 0.32);
    this.mat.uniforms.uDirCol.value.set(0.3, 0.32, 0.45);
  }
  center() {
    return [this.pos.x, this.pos.y, this.pos.z];
  }
  radius() {
    return 3;
  }
  getHitboxes() {
    if (!this.alive || !this.active) return null;
    const p = this.pos;
    const f = [Math.sin(this.yaw), Math.cos(this.yaw)];
    return [
      { min: [p.x - 1.7, p.y - 1.5, p.z - 1.7], max: [p.x + 1.7, p.y + 1.5, p.z + 1.7], group: 'body' },
      { min: [p.x + f[0] * 2.5 - 1.3, p.y - 1.3, p.z + f[1] * 2.5 - 1.3], max: [p.x + f[0] * 2.5 + 1.3, p.y + 1.3, p.z + f[1] * 2.5 + 1.3], group: 'body' },
      { min: [p.x - f[0] * 4.5 - 0.8, p.y - 0.6, p.z - f[1] * 4.5 - 0.8], max: [p.x - f[0] * 4.5 + 0.8, p.y + 1.2, p.z - f[1] * 4.5 + 0.8], group: 'body' },
    ];
  }
  trigger() {
    if (this.state !== 'hidden') return;
    this.state = 'arrive';
    this.active = true;
    this.mesh.visible = true;
    this.pos.set(this.def.pos[0], this.def.pos[1] + 50, this.def.pos[2] - 60);
    this.loop = audio.play('heli_loop', { pos: this.pos.toArray(), loop: true, volume: 1.6, ref: 25 });
    this.game.app.hud.boss('ODF ATTACK GUNSHIP', 1);
  }
  damage(n, dir, attacker, group, type) {
    if (!this.alive || !this.active) return;
    let m = type === 'explosion' ? 1 : type === 'bullet' ? 0.12 : 0.05;
    this.health -= n * m;
    if (type === 'bullet' && Math.random() < 0.3) this.game.fx.sparks(this.center(), [0, -1, 0], 4);
    this.game.app.hud.boss('ODF ATTACK GUNSHIP', Math.max(0, this.health / this.maxHealth));
    if (type === 'explosion' && n > 50) {
      audio.play('break_metal', { pos: this.center(), volume: 1.2 });
      if (chance(0.5)) this.game.say('ODF PILOT', ['Taking fire! Taking fire!', 'Is that a kangaroo with an RPG?!', 'Lost a stabiliser! Who arms a kangaroo?!'][Math.floor(Math.random() * 3)], { voice: 'soldier', force: true });
    }
    if (this.health <= 0) this.die();
  }
  die() {
    this.alive = false;
    this.state = 'dying';
    this.t = 0;
    this.spin = 0;
    this.game.app.hud.boss(null);
    this.game.say('ODF PILOT', "Mayday! Mayday! We're going down! Tell my mum it was a kangaroo!", { voice: 'soldier', force: true });
    this.game.stats.kills++;
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (this.state === 'hidden' || this.state === 'gone') return;
    this.t += dt;
    const home = new THREE.Vector3(...this.def.pos);
    if (this.state === 'arrive') {
      this.goal.copy(home);
      if (this.pos.distanceTo(home) < 3) {
        this.state = 'fight';
        g.say('ODF PILOT', 'Visual on the kangaroo. Weapons free!', { voice: 'soldier', force: true });
      }
    } else if (this.state === 'fight') {
      this.goalT -= dt;
      if (this.goalT <= 0) {
        this.goalT = rand(3, 6);
        const a = rand(0, Math.PI * 2), r = rand(3, 9);
        this.goal.set(home.x + Math.cos(a) * r, home.y + rand(-3, 5), home.z + Math.sin(a) * r);
      }
      this._attack(dt);
    } else if (this.state === 'dying') {
      this.spin += dt * 3;
      this.goal.set(home.x + this.t * 8, home.y - this.t * 6 + 10, home.z - this.t * 14);
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.04;
        g.fx.smokeTrail(this.pos.toArray(), 2.2, [0.15, 0.14, 0.13]);
        g.fx.fire(this.pos.toArray(), 1.8);
      }
      if (this.t > 0.6 && this.t < 0.7) g.fx.explosion(this.pos.toArray(), 1.5);
      if (this.t > 4.5) {
        this.state = 'gone';
        g.explode(this.pos.toArray(), 1, 0, null, 3);
        audio.play('explosion', { volume: 1.5, rate: 0.6 });
        g.shake = 1.5;
        this.mesh.visible = false;
        if (this.loop) this.loop.stop();
        this.fireTargets(p);
        return;
      }
    }
    // fly toward goal
    const to = this.goal.clone().sub(this.pos);
    const dist = to.length();
    const speed = this.state === 'arrive' ? 14 : this.state === 'dying' ? 18 : 6;
    const want = to.normalize().multiplyScalar(Math.min(speed, dist * 1.5));
    this.vel.lerp(want, Math.min(1, dt * 1.5));
    this.pos.addScaledVector(this.vel, dt);
    // face the player (or travel direction while dying)
    if (this.state === 'dying') this.yaw += dt * this.spin;
    else if (p.alive) {
      const c = p.center();
      this.yaw = approachAngle(this.yaw, Math.atan2(c[0] - this.pos.x, c[2] - this.pos.z), dt * 1.5);
    }
    const sideVel = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    this.bank = damp(this.bank, clamp(-sideVel * 0.06, -0.4, 0.4), 3, dt);
    const fwdVel = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw);
    this.mesh.position.copy(this.pos);
    this.mesh.position.y += Math.sin(this.t * 1.3) * 0.3;
    this.mesh.rotation.set(clamp(fwdVel * 0.04, -0.3, 0.3) + 0.15, this.yaw, this.bank, 'YXZ');
    this.rotor.rotation.y += dt * 30;
    this.tailRotor.rotation.x += dt * 40;
    // searchlight points at the player
    if (p.alive && this.state !== 'dying') {
      const c = new THREE.Vector3(...p.center());
      const local = this.mesh.worldToLocal(c.clone());
      const dir = local.sub(this.coneHolder.position).normalize();
      this.coneHolder.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    }
    if (this.loop) this.loop.setPos(this.pos.toArray());
    if (this.health < this.maxHealth * 0.5 && Math.random() < dt * 8) g.fx.smokeTrail([this.pos.x, this.pos.y + 1, this.pos.z], 1.2, [0.2, 0.2, 0.2]);
  }
  _attack(dt) {
    const g = this.game, p = g.player;
    if (!p.alive) return;
    const c = p.center();
    const gun = this._gunPos();
    const sees = g.world.visible(gun, c);
    this.attackT -= dt;
    this.rocketT -= dt;
    if (this.burst > 0) {
      this.fireT -= dt;
      if (this.fireT <= 0 && sees) {
        this.fireT = 0.09;
        this.burst--;
        const pv = p.body.vel;
        const spread = (0.06 * (1 + Math.hypot(pv.x, pv.z) / 7)) / g.diff.accuracy;
        const d = [c[0] - gun[0], c[1] - gun[1], c[2] - gun[2]];
        const l = Math.hypot(...d);
        const dir = [d[0] / l + rand(-spread, spread), d[1] / l + rand(-spread, spread), d[2] / l + rand(-spread, spread)];
        const l2 = Math.hypot(...dir);
        g.bullet(gun, [dir[0] / l2, dir[1] / l2, dir[2] / l2], 120, 4, this, { tracer: true, tracerFrom: gun, tracerColor: [1, 0.7, 0.3] });
        g.fx.muzzle(gun, 1.2);
        audio.play('chaingun', { pos: gun, volume: 1.0, ref: 15, range: 120 });
      }
    } else if (this.attackT <= 0 && sees) {
      this.burst = 14;
      this.attackT = rand(2.5, 4) / g.diff.aggression;
    }
    if (this.rocketT <= 0 && sees) {
      this.rocketT = rand(5, 8) / g.diff.aggression;
      for (const side of [-1, 1]) {
        g.after(side > 0 ? 0.35 : 0, () => {
          if (!this.alive) return;
          const r = [Math.cos(this.yaw) * 2.4 * side, -0.7, -Math.sin(this.yaw) * 2.4 * side];
          const o = [this.pos.x + r[0], this.pos.y + r[1], this.pos.z + r[2]];
          const pc = p.center();
          const d = [pc[0] - o[0] + rand(-2, 2), pc[1] - o[1], pc[2] - o[2] + rand(-2, 2)];
          g.spawnEntity({ type: 'rocket', pos: o, dir: d, owner: this, speed: 14, guided: true, damage: 45 });
          audio.play('rpg_fire', { pos: o, volume: 1.0, ref: 12, range: 120 });
        });
      }
    }
  }
  _gunPos() {
    const f = [Math.sin(this.yaw), Math.cos(this.yaw)];
    return [this.pos.x + f[0] * 4, this.pos.y - 1.2, this.pos.z + f[1] * 4];
  }
  destroy() {
    super.destroy();
    if (this.loop) this.loop.stop();
  }
  save() {
    return { state: this.state === 'arrive' || this.state === 'fight' ? 'pending' : this.state, health: this.health };
  }
  load(s) {
    if (s.state === 'pending') {
      this.state = 'hidden';
      this.health = s.health;
      this.trigger();
    } else if (s.state === 'gone' || s.state === 'dying') {
      this.state = 'gone';
      this.alive = false;
    }
  }
}

// ------------------------------------------------------------------ fuel valve (hold E)
export class Valve extends Entity {
  constructor(game, d) {
    super(game, d);
    this.progress = 0;
    this.done = false;
    this.started = false;
  }
  spawn() {
    const g = this.game, d = this.def;
    this.mat = entityMaterial(g.shared);
    this.mesh = new THREE.Group();
    this.mesh.position.set(...d.pos);
    const f = d.facing || [0, 0, 1];
    this.mesh.rotation.y = Math.atan2(f[0], f[2]);
    this.mesh.add(meshOf([kit.cyl(0.12, 0.12, 0.5, C('#5a5f62'), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.25] }, 8)], this.mat));
    this.wheel = bone(this.mesh, 0, 0, 0.5);
    const parts = [kit.cyl(0.08, 0.08, 0.12, C('#333'), { r: [Math.PI / 2, 0, 0] }, 8)];
    for (let k = 0; k < 4; k++) parts.push(kit.box(0.04, 0.6, 0.04, C('#a01818'), { r: [0, 0, (k * Math.PI) / 4] }));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      parts.push(kit.box(0.05, 0.16, 0.05, C('#c02020'), { p: [Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0], r: [0, 0, a] }));
    }
    this.wheel.add(meshOf(parts, this.mat));
    g.entGroup.add(this.mesh);
    const L = g.sampleLight([d.pos[0] + f[0], d.pos[1], d.pos[2] + f[2]], [0, 0, 0]);
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.8 + 0.1, L[1] * 0.8 + 0.1, L[2] * 0.8 + 0.1);
  }
  useBox() {
    if (this.done) return null;
    const p = this.def.pos;
    return { min: [p[0] - 0.6, p[1] - 0.6, p[2] - 0.6], max: [p[0] + 0.6, p[1] + 0.6, p[2] + 0.6] };
  }
  useLabel() {
    return `HOLD: OPEN FUEL VALVE (${Math.round(this.progress * 100)}%)`;
  }
  use() {
    return true;
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (this.done) return;
    const using = p && p.alive && p.useTarget === this && g.input.is('use');
    if (using) {
      if (!this.started) {
        this.started = true;
        this.fireTargets(p, this.def.onStart);
      }
      this.progress = Math.min(1, this.progress + dt / (this.def.time || 7));
      this.wheel.rotation.z -= dt * 2.5;
      if (!this.loop) this.loop = audio.play('valve_loop', { pos: this.def.pos, loop: true, volume: 0.7 });
      if (this.progress >= 1) {
        this.done = true;
        if (this.loop) this.loop.stop();
        this.loop = null;
        audio.play('door_stop', { pos: this.def.pos });
        this.fireTargets(p);
      }
    } else if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }
  }
  destroy() {
    super.destroy();
    if (this.loop) this.loop.stop();
  }
  save() {
    return { progress: this.progress, done: this.done, started: this.started };
  }
  load(s) {
    this.progress = s.progress;
    this.done = s.done;
    this.started = s.started;
  }
}

// ------------------------------------------------------------------ rocket ammo dispenser
export class Dispenser extends Entity {
  constructor(game, d) {
    super(game, d);
    this.t = 0;
    this.active = false;
  }
  trigger() {
    this.active = true;
  }
  update(dt) {
    if (!this.active) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.def.interval || 12;
    const g = this.game;
    const exists = g.entities.some((e) => e.type === 'pickup' && !e.removed && e.def.fromDispenser === this.id);
    if (!exists) g.spawnEntity({ type: 'pickup', item: this.def.item || 'ammo_rockets', pos: this.def.pos.slice(), fromDispenser: this.id });
  }
  save() {
    return { active: this.active };
  }
  load(s) {
    this.active = s.active;
  }
}

// ------------------------------------------------------------------ launch console
export class LaunchConsole extends Entity {
  constructor(game, d) {
    super(game, d);
    this.keyIn = false;
    this.countdown = -1;
    this.launched = false;
  }
  useBox() {
    if (this.launched || this.countdown >= 0) return null;
    const p = this.def.pos;
    return { min: [p[0] - 0.8, p[1] - 0.6, p[2] - 0.6], max: [p[0] + 0.8, p[1] + 0.6, p[2] + 0.6] };
  }
  useLabel() {
    const f = this.game.flags;
    if (!this.keyIn) return 'INSERT LAUNCH KEY';
    if (f.gunshipDead && f.doors && f.fuel) return 'TURN THE KEY';
    return 'LAUNCH STATUS';
  }
  use(player) {
    const g = this.game, f = g.flags;
    if (!this.keyIn) {
      if (!player.hasKey('launch')) {
        g.hint('LAUNCH KEY REQUIRED. The Base Commander carries it.', 3);
        return false;
      }
      this.keyIn = true;
      audio.play('button', { pos: this.def.pos });
      g.hint('LAUNCH KEY INSERTED', 2.5);
      g.fire('key_inserted', player);
    }
    if (!f.fuel) {
      g.hint('LAUNCH ABORTED: MISSILE NOT FUELLED. Open the fuel valve (Level 1, east).', 4);
      return true;
    }
    if (!f.doorsUnlocked) {
      f.doorsUnlocked = true;
      g.fire('doors_unlock', player);
      g.hint('AUTHORISATION ACCEPTED. Open the silo doors.', 4);
      return true;
    }
    if (!f.doors) {
      g.hint('LAUNCH ABORTED: SILO DOORS CLOSED. Use the door control.', 3);
      return true;
    }
    if (!f.gunshipDead) {
      g.hint('LAUNCH ABORTED: AIRSPACE OBSTRUCTED. Remove the gunship.', 3);
      return true;
    }
    // all go!
    this.countdown = 10;
    this.lastSec = 11;
    audio.play('button', { pos: this.def.pos });
    g.fire(this.target, player);
    return true;
  }
  update(dt) {
    if (this.countdown < 0 || this.launched) return;
    const g = this.game;
    this.countdown -= dt;
    const sec = Math.ceil(this.countdown);
    if (sec !== this.lastSec && sec >= 0) {
      this.lastSec = sec;
      if (sec > 0) {
        g.app.hud.message(String(sec), { dur: 0.9, sub: 'LAUNCH SEQUENCE' });
        audio.play('beep', { volume: 0.8, rate: 0.8 });
        if (sec === 10) g.say('PA SYSTEM', 'Launch sequence initiated. Ten seconds. Everybody please panic.', { voice: 'tech', force: true });
      }
    }
    if (this.countdown <= 0) {
      this.launched = true;
      startEnding(g);
    }
  }
  save() {
    return { keyIn: this.keyIn };
  }
  load(s) {
    this.keyIn = s.keyIn;
  }
}

// ------------------------------------------------------------------ ending cutscene
export function startEnding(game) {
  const g = game;
  const missile = g.entities.find((e) => e instanceof Missile);
  const ui = g.app.ui;
  audio.stopMusic(1);
  const cs = {
    t: 0,
    invulnerable: true,
    hidePlayer: true,
    phase: 0,
    kman: null,
    update(dt) {
      this.t += dt;
      const t = this.t;
      if (t > 0.1 && this.phase === 0) {
        this.phase = 1;
        missile.launch();
        g.say('H.O.P. SUIT', 'Warning. You have launched a nuclear missile. Have a nice day.', { force: true });
        // freeze all hostiles
        for (const e of g.entities) if (e.isNPC && e.alive) e.state = 'idle';
      }
      if (t > 7 && this.phase === 1) {
        this.phase = 2;
        audio.playMusic('ending');
      }
      if (t > 15 && this.phase === 2) {
        this.phase = 3;
        g.app.hud.message('TARGET: THE MOON', { dur: 4, sub: 'REASON: IT KNOWS WHAT IT DID' });
      }
      if (t > 19.5 && this.phase === 3) {
        this.phase = 4;
        if (g.sky) g.sky.material.uniforms.flash.value = 1.5;
        audio.play('explosion', { volume: 1.2, rate: 0.4 });
        g.app.hud.flash('white');
      }
      if (g.sky && this.phase >= 4) g.sky.material.uniforms.flash.value = Math.max(0, g.sky.material.uniforms.flash.value - dt * 0.6);
      if (t > 22 && this.phase === 4) {
        this.phase = 5;
        this._kman();
      }
      if (this.phase === 5) this._kmanUpdate(dt);
      if (t > 46 && this.phase === 5) {
        this.phase = 6;
        g.ended = true;
        g.app.showEnding();
      }
    },
    camera(cam, dt) {
      const t = this.t;
      const sp = g.map.ending || {};
      if (this.phase >= 5 && this.kman) {
        const k = this.kman.position;
        const a = (t - 22) * 0.05;
        cam.position.set(k.x + Math.sin(a) * 2.2, k.y + 1.6, k.z + Math.cos(a) * 2.2);
        cam.lookAt(k.x, k.y + 1.55, k.z);
        return;
      }
      if (t < 7) {
        // inside: watch the ignition from the control room window
        const c = sp.cam1 || [0, 26, -9];
        const shake = g.shake * 0.05;
        cam.position.set(c[0] + rand(-shake, shake), c[1] + rand(-shake, shake), c[2]);
        const m = missile.topPos();
        cam.lookAt(m[0], Math.min(m[1] - 6, 60), m[2]);
      } else {
        // outside on the mesa: the missile climbs toward the moon
        const c = sp.cam2 || [30, 46, 30];
        cam.position.set(c[0], c[1], c[2]);
        const m = missile.topPos();
        m[1] = Math.max(m[1], 41);
        const moon = g.sky ? g.sky.material.uniforms.moonDir.value : new THREE.Vector3(0, 1, 0);
        const k = clamp((t - 9) / 6, 0, 1);
        const look = new THREE.Vector3(m[0], m[1], m[2]).lerp(new THREE.Vector3(c[0], c[1], c[2]).addScaledVector(moon, 100), k);
        cam.lookAt(look);
      }
    },
    _kman() {
      g.app.hud.flash('white');
      // dark void with the K-Man
      g.scene.remove(g.world.group);
      if (g.sky) g.sky.visible = false;
      g.entGroup.visible = false;
      g.fx.group.visible = false;
      g.shared.fogNear.value = 1000;
      g.shared.fogFar.value = 2000;
      for (const e of g.entities) if (e.isNPC && e.mesh) e.removed = true;
      const mat = entityMaterial(g.shared);
      mat.uniforms.uAmbient.value.set(0.25, 0.25, 0.32);
      mat.uniforms.uDirCol.value.set(0.9, 0.85, 0.8);
      mat.uniforms.uDir.value.set(0.4, 0.6, 0.7).normalize();
      this.kman = buildKMan(mat);
      this.kman.position.set(0, 500, 0);
      g.scene.add(this.kman);
      const lines = [
        [0.5, 'Impressive work... Mister Skippy.'],
        [4.5, 'One kangaroo. One missile. And the moon... finally... put in its place.'],
        [10, 'I have been watching you hop. You have... potential.'],
        [14.5, 'The emus, however, have... other plans. Larger plans.'],
        [19, 'Rest now. Hop... and wait. We will be in touch.'],
      ];
      this.lines = lines.map(([at, text]) => ({ at, text, done: false }));
      this.kt = 0;
    },
    _kmanUpdate(dt) {
      this.kt += dt;
      for (const l of this.lines) {
        if (!l.done && this.kt >= l.at) {
          l.done = true;
          g.say('K-MAN', l.text, { voice: 'koala', force: true, dur: 4.5 });
        }
      }
      if (this.kman) {
        const b = this.kman.userData.body;
        b.rotation.y = Math.sin(this.kt * 0.4) * 0.1;
        // straighten the tie, as one does
        b.position.y = Math.sin(this.kt * 1.5) * 0.01;
      }
    },
  };
  g.cutscene = cs;
  g.app.hud.show(true);
}

export const EXTRA_TYPES = {
  prop: Prop,
  missile: Missile,
  gunship: Gunship,
  valve: Valve,
  dispenser: Dispenser,
  launch: LaunchConsole,
};
