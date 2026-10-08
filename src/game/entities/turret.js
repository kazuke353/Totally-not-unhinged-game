// Automated sentry guns. Floor sentries can be kicked over.
import * as THREE from 'three';
import { Entity } from './base.js';
import { kit, C, meshOf, bone, entityMaterial } from '../modelkit.js';
import { audio } from '../../engine/audio.js';
import { approachAngle, clamp, rand, wrapAngle } from '../../engine/util.js';

const _hp = new THREE.Vector3();

export class Turret extends Entity {
  constructor(game, d) {
    super(game, d);
    this.ceiling = !!d.ceiling;
    this.health = (d.health ?? 80) * game.diff.enemyHp;
    this.alive = true;
    this.active = d.active !== false; // inactive turrets wait for a trigger / alarm
    this.state = 'idle';
    this.yaw = d.yaw ?? 0;
    this.pitch = 0;
    this.scanT = rand(0, 6);
    this.spin = 0;
    this.fireT = 0;
    this.lostT = 0;
    this.tipped = 0;
    this.solid = !this.ceiling;
    this.fleshy = false;
    this.surface = 'metal';
    this.pos = d.pos;
    this.deploy = this.active ? 1 : 0;
    this.isNPC = false;
  }
  spawn() {
    const g = this.game;
    this.mat = entityMaterial(g.shared);
    const dark = C('#33373a'), mid = C('#5b6166'), hz = C('#d6a51c');
    this.root = new THREE.Group();
    this.root.position.set(...this.pos);
    const base = new THREE.Group();
    this.root.add(base);
    if (this.ceiling) {
      base.add(meshOf([kit.box(0.6, 0.12, 0.6, dark, { p: [0, -0.06, 0] }), kit.cyl(0.08, 0.08, 0.35, mid, { p: [0, -0.28, 0] }, 8)], this.mat));
    } else {
      base.add(
        meshOf(
          [
            kit.limb(0.04, 0.03, 0.75, dark, { p: [0, 0.75, 0], r: [0.5, 0, 0] }, 5),
            kit.limb(0.04, 0.03, 0.75, dark, { p: [0, 0.75, 0], r: [0.5, 2.1, 0] }, 5),
            kit.limb(0.04, 0.03, 0.75, dark, { p: [0, 0.75, 0], r: [0.5, -2.1, 0] }, 5),
            kit.cyl(0.12, 0.14, 0.15, mid, { p: [0, 0.78, 0] }, 8),
          ],
          this.mat
        )
      );
    }
    this.head = bone(this.root, 0, this.ceiling ? -0.55 : 1.0, 0);
    this.head.add(
      meshOf(
        [
          kit.box(0.34, 0.3, 0.46, mid),
          kit.box(0.36, 0.06, 0.48, hz, { p: [0, 0.12, 0] }),
          kit.cyl(0.035, 0.035, 0.42, dark, { p: [0.07, -0.02, 0.38], r: [Math.PI / 2, 0, 0] }, 6),
          kit.cyl(0.035, 0.035, 0.42, dark, { p: [-0.07, -0.02, 0.38], r: [Math.PI / 2, 0, 0] }, 6),
          kit.box(0.12, 0.08, 0.04, C('#111'), { p: [0, 0.06, 0.24] }),
        ],
        this.mat
      )
    );
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0x401010 });
    this.eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), this.eyeMat);
    this.eye.position.set(0, 0.06, 0.265);
    this.head.add(this.eye);
    this.mesh = this.root;
    g.entGroup.add(this.root);
    const L = g.sampleLight([this.pos[0], this.pos[1] + (this.ceiling ? -2 : 0.3), this.pos[2]], [0, 0, 0]);
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.8 + 0.08, L[1] * 0.8 + 0.08, L[2] * 0.8 + 0.08);
    this.mat.uniforms.uDirCol.value.set(L[0] * 0.5, L[1] * 0.5, L[2] * 0.5);
    this._pose();
  }
  headPos() {
    // where the head is drawn: it rises/lowers as it deploys and falls with a kicked-over base
    this.head.getWorldPosition(_hp);
    return [_hp.x, _hp.y, _hp.z];
  }
  center() {
    return this.headPos();
  }
  radius() {
    return 0.35;
  }
  getBox() {
    if (this.ceiling || !this.alive || this.tipped) return null;
    const p = this.pos;
    return { min: [p[0] - 0.35, p[1], p[2] - 0.35], max: [p[0] + 0.35, p[1] + 1.2, p[2] + 0.35] };
  }
  getHitboxes() {
    if (!this.alive) return null;
    const h = this.headPos();
    return [{ min: [h[0] - 0.25, h[1] - 0.2, h[2] - 0.25], max: [h[0] + 0.25, h[1] + 0.2, h[2] + 0.25], group: 'body' }];
  }
  trigger() {
    this.active = !this.active || this.def.toggle !== true;
    if (this.active) audio.play('turret_spin', { pos: this.headPos(), volume: 0.6 });
  }
  onAlarm(on) {
    if (on && this.def.alarm !== false) this.active = true;
  }
  knockback(dir, f) {
    if (this.ceiling || !this.alive) return;
    if (f >= 8 && !this.tipped) {
      // kicked over!
      this.tipped = 0.01;
      this.tipDir = Math.atan2(dir[0], dir[2]);
      audio.play('break_metal', { pos: this.headPos(), volume: 0.8 });
      this.game.fx.sparks(this.headPos(), [0, 1, 0], 10);
      this.game.hint('SENTRY KNOCKED OVER!', 1.5);
    }
  }
  damage(n, dir, attacker, group, type) {
    if (!this.alive) return;
    this.health -= n;
    if (type === 'bullet' && Math.random() < 0.4) this.game.fx.sparks(this.headPos(), [0, 1, 0], 3);
    if (!this.active && this.def.wakeOnDamage !== false) this.active = true;
    if (this.health <= 0) this.die(attacker);
  }
  die(attacker) {
    this.alive = false;
    this.solid = false;
    const h = this.headPos();
    this.game.fx.explosion(h, 0.5);
    this.game.fx.metalChunks([h[0] - 0.2, h[1] - 0.2, h[2] - 0.2], [h[0] + 0.2, h[1] + 0.2, h[2] + 0.2], 6);
    audio.play('explosion', { pos: h, volume: 0.6, rate: 1.4 });
    this.eyeMat.color.set(0x111111);
    this.head.rotation.x = 0.6;
    if (attacker === this.game.player) this.game.stats.kills++;
    this.fireTargets(attacker);
  }
  _pose() {
    this.head.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
    if (!this.ceiling) {
      this.head.position.y = 0.6 + 0.4 * this.deploy;
    } else this.head.position.y = -0.2 - 0.35 * this.deploy;
  }
  update(dt) {
    const g = this.game;
    if (!this.alive) {
      if (Math.random() < dt * 2) g.fx.smokeTrail(this.headPos(), 0.3, [0.3, 0.3, 0.3]);
      return;
    }
    if (this.tipped) {
      this.tipped = Math.min(1, this.tipped + dt * 3);
      this.root.rotation.set(this.tipped * 1.4, this.tipDir, 0, 'YXZ');
      if (Math.random() < dt * 3) g.fx.sparks(this.headPos(), [0, 1, 0], 2);
      return;
    }
    this.deploy = clamp(this.deploy + (this.active ? dt : -dt) * 1.5, 0, 1);
    this._pose();
    if (!this.active || this.deploy < 1) {
      this.eyeMat.color.set(0x301010);
      return;
    }
    const p = g.player;
    const h = this.headPos();
    let sees = false, c = null;
    if (p && p.alive && !g.cutscene?.hidePlayer && !g.notarget) {
      c = p.center();
      const dist = Math.hypot(c[0] - h[0], c[1] - h[1], c[2] - h[2]);
      if (dist < (this.def.range || 28)) {
        const want = Math.atan2(c[0] - h[0], c[2] - h[2]);
        const inArc = this.state === 'attack' || Math.abs(wrapAngle(want - this.yaw)) < 1.1;
        sees = inArc && g.world.visible(h, c);
      }
    }
    if (sees) {
      if (this.state !== 'attack') {
        this.state = 'attack';
        this.spin = 0;
        audio.play('turret_ping', { pos: h, volume: 0.9 });
        audio.play('turret_spin', { pos: h, volume: 0.7 });
      }
      this.lostT = 2;
      const want = Math.atan2(c[0] - h[0], c[2] - h[2]);
      this.yaw = approachAngle(this.yaw, want, dt * 2.2);
      const wp = Math.atan2(c[1] - h[1], Math.hypot(c[0] - h[0], c[2] - h[2]));
      this.pitch += clamp(wp - this.pitch, -dt * 2, dt * 2);
      this.spin = Math.min(1, this.spin + dt * 2.2);
      this.eyeMat.color.set(0xff2010);
      if (this.spin >= 1 && Math.abs(wrapAngle(want - this.yaw)) < 0.2) this._fire(dt, c, h);
    } else {
      this.lostT -= dt;
      if (this.lostT <= 0) {
        this.state = 'idle';
        this.scanT += dt * 0.6;
        this.yaw = (this.def.yaw ?? 0) + Math.sin(this.scanT) * 0.9;
        this.pitch *= 0.95;
        this.eyeMat.color.set(0x802010);
      }
    }
  }
  _fire(dt, c, h) {
    const g = this.game;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 0.11;
    const f = [Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)];
    const muzzle = [h[0] + f[0] * 0.6, h[1] + f[1] * 0.6 - 0.02, h[2] + f[2] * 0.6];
    const p = g.player;
    const pv = p.body.vel;
    const spread = (0.05 * (1 + Math.hypot(pv.x, pv.z) / 8)) / g.diff.accuracy;
    const dir = [f[0] + rand(-spread, spread), f[1] + rand(-spread, spread) * 0.6, f[2] + rand(-spread, spread)];
    const l = Math.hypot(...dir);
    g.bullet(muzzle, [dir[0] / l, dir[1] / l, dir[2] / l], 60, 3, this, { tracer: true, tracerFrom: muzzle, tracerColor: [1, 0.6, 0.3] });
    g.fx.muzzle(muzzle, 0.7);
    audio.play('turret_fire', { pos: muzzle, volume: 0.7 });
  }
  save() {
    return { alive: this.alive, health: this.health, active: this.active, tipped: this.tipped ? 1 : 0, tipDir: this.tipDir };
  }
  load(s) {
    this.health = s.health;
    this.active = s.active;
    if (s.tipped) {
      this.tipped = 1;
      this.tipDir = s.tipDir;
      this.root.rotation.set(1.4, this.tipDir, 0, 'YXZ');
    }
    if (!s.alive) {
      this.alive = false;
      this.solid = false;
      this.eyeMat.color.set(0x111111);
      this.head.rotation.x = 0.6;
    }
  }
}
