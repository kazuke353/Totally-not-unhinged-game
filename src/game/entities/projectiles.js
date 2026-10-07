// Grenades and rockets.
import * as THREE from 'three';
import { Entity } from './base.js';
import { audio } from '../../engine/audio.js';
import { kit, C, meshOf, entityMaterial } from '../modelkit.js';
import { rayBox } from '../../engine/world.js';
import { rand } from '../../engine/util.js';

let grenadeGeo = null, rocketGeo = null;

export class Grenade extends Entity {
  constructor(game, d) {
    super(game, d);
    this.pos = new THREE.Vector3(...d.pos);
    this.vel = new THREE.Vector3(...d.vel);
    this.fuse = d.fuse ?? 3;
    this.owner = d.owner || null;
    this.contact = !!d.contact;
    this.age = 0;
    this.blink = 0;
    this.rest = false;
  }
  spawn() {
    if (!grenadeGeo) grenadeGeo = kit.merge([kit.ball(0.07, 0.08, 0.07, C('#3c4a28'), {}, 7, 5), kit.box(0.03, 0.04, 0.03, C('#888'), { p: [0, 0.08, 0] })]);
    this.mat = entityMaterial(this.game.shared, { emissive: 0.3 });
    this.mesh = new THREE.Mesh(grenadeGeo, this.mat);
    this.mesh.position.copy(this.pos);
    this.game.entGroup.add(this.mesh);
  }
  update(dt) {
    const g = this.game;
    this.age += dt;
    this.fuse -= dt;
    if (this.fuse <= 0) return this.explode();
    // blinking light
    this.blink -= dt;
    if (this.blink <= 0) {
      this.blink = this.fuse < 1 ? 0.12 : 0.4;
      g.fx.glowSprite([this.pos.x, this.pos.y + 0.1, this.pos.z], 0.35, [1, 0.15, 0.1], 0.06);
      if (!this.contact) audio.play('beep', { pos: this.pos.toArray(), volume: 0.15, rate: 1.6, range: 20 });
    }
    if (this.rest) return;
    // AI should run from grenades
    if (this.age > 0.3 && !this.contact) g.noise(this.pos.toArray(), 0.01, this);
    this.vel.y -= 16 * dt;
    const step = this.vel.length() * dt;
    if (step < 1e-5) return;
    const dir = this.vel.clone().normalize();
    // entity hit for contact grenades
    if (this.contact && this.age > 0.05) {
      for (const e of g.entities) {
        if (e === this || e === this.owner || e.removed || !e.getHitboxes || !e.isNPC) continue;
        const hbs = e.getHitboxes();
        if (!hbs) continue;
        for (const hb of hbs) {
          const r = rayBox(this.pos.x, this.pos.y, this.pos.z, dir.x, dir.y, dir.z, hb.min, hb.max, step + 0.1);
          if (r) {
            this.pos.addScaledVector(dir, r.t);
            return this.explode();
          }
        }
      }
    }
    const hit = g.world.raycast(this.pos.x, this.pos.y, this.pos.z, dir.x, dir.y, dir.z, step + 0.08, { bullet: true });
    if (hit) {
      if (this.contact) {
        this.pos.set(hit.point[0] + hit.normal[0] * 0.1, hit.point[1] + hit.normal[1] * 0.1, hit.point[2] + hit.normal[2] * 0.1);
        return this.explode();
      }
      // reflect
      const n = new THREE.Vector3(...hit.normal);
      const vn = this.vel.dot(n);
      this.vel.addScaledVector(n, -1.55 * vn).multiplyScalar(0.55);
      this.pos.set(hit.point[0] + n.x * 0.08, hit.point[1] + n.y * 0.08, hit.point[2] + n.z * 0.08);
      if (Math.abs(vn) > 1.5) audio.play('grenade_bounce', { pos: this.pos.toArray(), volume: Math.min(1, Math.abs(vn) / 8) });
      if (n.y > 0.7 && this.vel.length() < 0.8) {
        this.rest = true;
        this.vel.set(0, 0, 0);
      }
    } else this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.x += dt * 8;
    this.mesh.rotation.z += dt * 5;
  }
  explode() {
    if (this.removed) return;
    this.removed = true;
    this.purge = true;
    this.mesh.visible = false;
    this.game.explode(this.pos.toArray(), this.contact ? 4.5 : 5, this.def.damage ?? (this.contact ? 100 : 110), this.owner, 1);
    this.destroy();
  }
  // grenades are not persisted across saves
  save() {
    return undefined;
  }
}

export class Rocket extends Entity {
  constructor(game, d) {
    super(game, d);
    this.pos = new THREE.Vector3(...d.pos);
    this.dir = new THREE.Vector3(...d.dir).normalize();
    this.speed = d.speed ?? 18;
    this.owner = d.owner || null;
    this.guided = !!d.guided;
    this.age = 0;
    this.damageAmt = d.damage ?? 150;
    this.trailT = 0;
  }
  spawn() {
    if (!rocketGeo)
      rocketGeo = kit.merge([
        kit.cyl(0.05, 0.05, 0.5, C('#4a5530'), { r: [Math.PI / 2, 0, 0] }, 7),
        kit.cone(0.05, 0.18, C('#666'), { p: [0, 0, 0.34], r: [Math.PI / 2, 0, 0] }, 7),
        kit.box(0.2, 0.01, 0.08, C('#333'), { p: [0, 0, -0.22] }),
        kit.box(0.01, 0.2, 0.08, C('#333'), { p: [0, 0, -0.22] }),
      ]);
    this.mat = entityMaterial(this.game.shared, { emissive: 0.4 });
    this.mesh = new THREE.Mesh(rocketGeo, this.mat);
    this.game.entGroup.add(this.mesh);
    this.loop = audio.play('rocket_loop', { pos: this.pos.toArray(), loop: true, volume: 0.5 });
    this.light = this.game.fx.dlight(this.pos.toArray(), [1.5, 0.9, 0.4], 6, 99, () => (this.removed ? null : this.pos.toArray()));
    this._orient();
  }
  _orient() {
    this.mesh.position.copy(this.pos);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.dir);
  }
  update(dt) {
    const g = this.game;
    this.age += dt;
    if (this.age > 8) return this.explode(null);
    // laser guidance (HL RPG): steer toward the player's crosshair
    const p = g.player;
    if (this.guided && this.owner === p && p.alive && p.weapons.current === 'rpg' && p.weapons.laser) {
      const want = p.aimPoint.clone().sub(this.pos).normalize();
      const k = Math.min(1, dt * 3.2);
      this.dir.lerp(want, k).normalize();
    } else if (this.guided && this.owner && this.owner !== p && p.alive) {
      // enemy rockets: mild homing
      const c = p.center();
      const want = new THREE.Vector3(c[0], c[1], c[2]).sub(this.pos).normalize();
      this.dir.lerp(want, Math.min(1, dt * 0.6)).normalize();
    }
    this.speed = Math.min(this.speed + dt * 12, 32);
    const step = this.speed * dt;
    // entity hit
    for (const e of [...g.entities, p]) {
      if (!e || e === this || e === this.owner || e.removed || !e.getHitboxes) continue;
      if (e === p && this.owner === p) continue;
      const hbs = e.getHitboxes();
      if (!hbs) continue;
      for (const hb of hbs) {
        const r = rayBox(this.pos.x, this.pos.y, this.pos.z, this.dir.x, this.dir.y, this.dir.z, hb.min, hb.max, step);
        if (r) {
          this.pos.addScaledVector(this.dir, r.t);
          return this.explode(e);
        }
      }
    }
    const hit = g.world.raycast(this.pos.x, this.pos.y, this.pos.z, this.dir.x, this.dir.y, this.dir.z, step, { bullet: true });
    if (hit) {
      this.pos.set(hit.point[0] - this.dir.x * 0.2, hit.point[1] - this.dir.y * 0.2, hit.point[2] - this.dir.z * 0.2);
      if (hit.brush.owner && hit.brush.owner.damage) hit.brush.owner.damage(this.damageAmt, this.dir.toArray(), this.owner, 'body', 'explosion');
      return this.explode(null);
    }
    this.pos.addScaledVector(this.dir, step);
    this._orient();
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.02;
      const back = this.pos.clone().addScaledVector(this.dir, -0.35).toArray();
      g.fx.smokeTrail(back, 0.25, [0.6, 0.58, 0.55]);
      g.fx.glowSprite(back, 0.5, [1, 0.7, 0.3], 0.04);
    }
    if (this.loop) this.loop.setPos(this.pos.toArray());
  }
  explode(direct) {
    if (this.removed) return;
    this.removed = true;
    this.purge = true;
    if (this.loop) this.loop.stop();
    this.mesh.visible = false;
    const g = this.game;
    if (direct && direct.damage) direct.damage(this.damageAmt * 0.5, this.dir.toArray(), this.owner, 'body', 'explosion');
    g.explode(this.pos.toArray(), this.owner && this.owner.isGunship ? 4 : 5, this.owner && this.owner.isGunship ? 45 : this.damageAmt, this.owner, 1.3);
    this.destroy();
  }
  destroy() {
    super.destroy();
    if (this.loop) this.loop.stop();
  }
  save() {
    return undefined;
  }
}
