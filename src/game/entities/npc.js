// Shared NPC behaviour: physics body, path following, perception, damage.
import * as THREE from 'three';
import { Entity } from './base.js';
import { moveBody, unstick } from '../../engine/physics.js';
import { entityMaterial } from '../modelkit.js';
import { audio } from '../../engine/audio.js';
import { approachAngle, clamp, rand, wrapAngle } from '../../engine/util.js';

export class NPC extends Entity {
  constructor(game, d, o = {}) {
    super(game, d);
    this.isNPC = true;
    this.alive = true;
    this.solid = true;
    this.fleshy = true;
    this.bloodColor = [0.55, 0.02, 0.02];
    this.maxHealth = (d.health ?? o.health ?? 60) * game.diff.enemyHp;
    this.health = this.maxHealth;
    this.body = {
      pos: new THREE.Vector3(...d.pos),
      vel: new THREE.Vector3(),
      half: o.half ?? 0.32,
      height: o.height ?? 1.8,
      onGround: false,
      stepHeight: 0.46,
      ignore: this,
      forPlayer: false,
    };
    this.yaw = d.yaw ?? 0; // facing angle: forward = (sin yaw, 0, cos yaw)
    this.state = d.state || 'idle';
    this.enemy = null;
    this.lastSeen = null;
    this.lastSeenTime = -100;
    this.canSee = false;
    this.seeT = rand(0, 0.2);
    this.path = null;
    this.pathGoal = null;
    this.pathT = 0;
    this.stuckT = 0;
    this.speed = 0;
    this.lightT = 0;
    this.deadT = 0;
    this.stagger = 0;
    this.fov = o.fov ?? 0.35; // cos of half angle
    this.sight = o.sight ?? 45;
    this.dropItems = d.drop || null;
    this.ambush = !!d.ambush; // stay put until alerted
    this.deaf = !!d.deaf;
  }

  spawn() {
    this.mat = entityMaterial(this.game.shared);
    this.model = this.buildModel(this.mat);
    this.mesh = this.model.root;
    this.game.entGroup.add(this.mesh);
    unstick(this.game.world, this.body);
    this.home = this.body.pos.toArray();
    this._sync(0);
  }

  // --- geometry ---------------------------------------------------------
  getBox() {
    if (!this.alive) return null;
    const b = this.body;
    return { min: [b.pos.x - b.half, b.pos.y, b.pos.z - b.half], max: [b.pos.x + b.half, b.pos.y + b.height, b.pos.z + b.half] };
  }
  center() {
    const b = this.body;
    return [b.pos.x, b.pos.y + b.height * 0.6, b.pos.z];
  }
  eye() {
    const b = this.body;
    return [b.pos.x, b.pos.y + b.height * 0.9, b.pos.z];
  }
  radius() {
    return this.body.half;
  }
  getHitboxes() {
    if (!this.alive) return null;
    const b = this.body;
    const h = b.height;
    const hx = b.half;
    return [
      { min: [b.pos.x - 0.14, b.pos.y + h * 0.82, b.pos.z - 0.14], max: [b.pos.x + 0.14, b.pos.y + h * 1.0, b.pos.z + 0.14], group: 'head' },
      { min: [b.pos.x - hx, b.pos.y, b.pos.z - hx], max: [b.pos.x + hx, b.pos.y + h * 0.82, b.pos.z + hx], group: 'body' },
    ];
  }
  forward() {
    return [Math.sin(this.yaw), 0, Math.cos(this.yaw)];
  }

  // --- perception -------------------------------------------------------
  look(dt) {
    this.seeT -= dt;
    if (this.seeT > 0) return this.canSee;
    this.seeT = 0.15 + Math.random() * 0.1;
    const p = this.game.player;
    this.canSee = false;
    if (!p || !p.alive || this.game.cutscene?.hidePlayer || this.game.notarget) return false;
    const e = this.eye(), c = p.center();
    const dx = c[0] - e[0], dy = c[1] - e[1], dz = c[2] - e[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > this.sight) return false;
    const f = this.forward();
    const cos = (dx * f[0] + dz * f[2]) / (Math.hypot(dx, dz) || 1);
    const alert = this.state !== 'idle' && this.state !== 'patrol';
    // close proximity is always noticed
    if (!alert && cos < this.fov && dist > 3) return false;
    // crouched & in darkness at range = harder to notice
    if (!alert && p.crouched && dist > 12 && (p.light[0] + p.light[1] + p.light[2]) < 0.6) return false;
    if (!this.game.world.visible(e, c) && !this.game.world.visible(e, p.eye())) return false;
    this.canSee = true;
    return true;
  }
  hear(pos, radius, source) {
    if (!this.alive || this.deaf) return;
    if (source && source.isNPC) return;
    const b = this.body.pos;
    const d = Math.hypot(pos[0] - b.x, pos[1] - b.y, pos[2] - b.z);
    if (d > radius) return;
    this.onHeard(pos, source);
  }
  onHeard(pos, source) {
    if (this.state === 'idle' || this.state === 'patrol') {
      this.lastSeen = pos.slice();
      this.lastSeenTime = this.game.time - 2;
      this.alertTo(pos);
    }
  }
  alertTo() {}
  onAlarm(on) {
    if (!on || !this.alive) return;
    const p = this.game.player;
    if (!p) return;
    this.lastSeen = p.center();
    this.lastSeenTime = this.game.time - 3;
    this.alertTo(this.lastSeen, true);
  }

  // --- movement ---------------------------------------------------------
  navTo(goal, speed, dt) {
    const g = this.game;
    this.pathT -= dt;
    const b = this.body.pos;
    if (!this.path || this.pathT <= 0 || !this.pathGoal || Math.hypot(goal[0] - this.pathGoal[0], goal[2] - this.pathGoal[2]) > 1.5) {
      this.path = g.nav.path([b.x, b.y, b.z], goal);
      this.pathGoal = goal.slice();
      this.pathT = 1.2 + Math.random() * 0.6;
    }
    if (!this.path || !this.path.length) {
      // direct
      return this.steer(goal, speed, dt);
    }
    let wp = this.path[0];
    while (this.path.length > 1 && Math.hypot(wp[0] - b.x, wp[2] - b.z) < 0.45) {
      this.path.shift();
      wp = this.path[0];
    }
    const arrived = this.path.length === 1 && Math.hypot(wp[0] - b.x, wp[2] - b.z) < 0.5;
    if (arrived) {
      this.path = null;
      this.speed = 0;
      return true;
    }
    this.steer(wp, speed, dt);
    return false;
  }
  steer(target, speed, dt, face = true) {
    const b = this.body;
    const dx = target[0] - b.pos.x, dz = target[2] - b.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) {
      this.speed = 0;
      return true;
    }
    this.wish = [dx / d, dz / d];
    this.speed = speed;
    if (face) this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), dt * 8);
    return false;
  }
  stop() {
    this.speed = 0;
    this.wish = null;
  }
  physics(dt) {
    const b = this.body;
    const g = this.game;
    if (this.stagger > 0) this.stagger -= dt;
    const accel = b.onGround ? 14 : 2;
    let tx = 0, tz = 0;
    if (this.wish && this.speed > 0 && this.stagger <= 0) {
      tx = this.wish[0] * this.speed;
      tz = this.wish[1] * this.speed;
    }
    // separation from other NPCs
    for (const e of g.entities) {
      if (e === this || !e.isNPC || !e.alive || !e.body) continue;
      const ox = b.pos.x - e.body.pos.x, oz = b.pos.z - e.body.pos.z;
      const dd = ox * ox + oz * oz;
      if (dd < 1.1 && dd > 1e-4) {
        const k = (1.1 - dd) * 2;
        tx += (ox / Math.sqrt(dd)) * k;
        tz += (oz / Math.sqrt(dd)) * k;
      }
    }
    b.vel.x += (tx - b.vel.x) * Math.min(1, accel * dt);
    b.vel.z += (tz - b.vel.z) * Math.min(1, accel * dt);
    b.vel.y -= 20 * dt;
    const before = b.pos.clone();
    const res = moveBody(g.world, b, dt);
    // stuck detection -> repath / hop
    const moved = before.distanceTo(b.pos);
    if (this.speed > 0.5 && moved < this.speed * dt * 0.2) {
      this.stuckT += dt;
      if (this.stuckT > 0.6) {
        this.stuckT = 0;
        this.path = null;
        this.pathT = 0;
        this.onStuck && this.onStuck();
      }
    } else this.stuckT = 0;
    return res;
  }
  knockback(dir, f) {
    if (!this.alive) {
      return;
    }
    this.body.vel.x += dir[0] * f;
    this.body.vel.z += dir[2] * f;
    this.body.vel.y += Math.max(0.5, dir[1]) * f * 0.45;
    this.body.onGround = false;
    this.stagger = 0.5 + f * 0.03;
  }

  // nearest live grenade threatening us
  grenadeThreat() {
    const b = this.body.pos;
    for (const e of this.game.entities) {
      if ((e.type !== 'grenade') || e.removed || e.owner === this) continue;
      const d = Math.hypot(e.pos.x - b.x, e.pos.z - b.z);
      if (d < 4.5 && e.age > 0.2) return e;
    }
    return null;
  }

  // --- damage -----------------------------------------------------------
  damage(amount, dir, attacker, group, type, point) {
    if (!this.alive) {
      if (type === 'explosion' && amount > 40 && !this.gibbed) this.gib();
      return;
    }
    let m = 1;
    if (group === 'head') m = 3;
    const dmg = amount * m;
    this.health -= dmg;
    this.lastHitDir = dir;
    this.onPain(dmg, attacker, type);
    if (attacker && attacker === this.game.player) {
      this.lastSeen = attacker.center();
      this.lastSeenTime = this.game.time;
      if (this.state === 'idle' || this.state === 'patrol') this.alertTo(this.lastSeen, true);
    }
    if (this.health <= 0) {
      this.die(dir, type, attacker, dmg, group);
      if (attacker === this.game.player && group === 'head') this.game.app.hud.headshot();
    }
  }
  onPain() {}
  die(dir, type, attacker, dmg, group) {
    this.alive = false;
    this.solid = false;
    this.state = 'dead';
    this.deadT = 0;
    this.deathDir = dir || [0, 0, 1];
    this.stop();
    if (attacker === this.game.player) this.game.stats.kills++;
    this.onDeath(type, dmg, group);
    if (this.dropItems) {
      const items = Array.isArray(this.dropItems) ? this.dropItems : [this.dropItems];
      const c = this.center();
      items.forEach((it, i) => this.game.spawnEntity({ type: 'pickup', item: it, pos: [c[0] + (i - (items.length - 1) / 2) * 0.4, c[1], c[2]], drop: true, target: i === 0 ? this.def.dropTarget : undefined }));
    }
    this.fireTargets(attacker);
    if (type === 'explosion' && dmg > 50 && this.gibbable !== false) this.gib();
  }
  onDeath() {}
  gib() {
    this.gibbed = true;
    this.game.fx.gibs(this.body.pos.toArray(), 9);
    audio.play('hit_flesh', { pos: this.center(), volume: 1, rate: 0.6 });
    this.mesh.visible = false;
  }

  _sync(dt) {
    const b = this.body;
    this.mesh.position.copy(b.pos);
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = 0.2 + Math.random() * 0.1;
      const L = this.game.sampleLight([b.pos.x, b.pos.y + 0.2, b.pos.z], [0, 0, 0]);
      this.mat.uniforms.uAmbient.value.set(L[0] * 0.8 + 0.1, L[1] * 0.8 + 0.1, L[2] * 0.8 + 0.1);
      this.mat.uniforms.uDirCol.value.set(L[0] * 0.55 + 0.04, L[1] * 0.55 + 0.04, L[2] * 0.55 + 0.04);
    }
    // hit flash
    const t = this.mat.uniforms.uTint.value;
    t.multiplyScalar(Math.exp(-dt * 12));
  }
  flash() {
    this.mat.uniforms.uTint.value.set(0.35, 0.05, 0.05);
  }

  save() {
    return {
      pos: this.body.pos.toArray(),
      yaw: this.yaw,
      health: this.health,
      alive: this.alive,
      state: this.state,
      gibbed: !!this.gibbed,
      lastSeen: this.lastSeen,
    };
  }
  load(s) {
    this.body.pos.fromArray(s.pos);
    this.yaw = s.yaw;
    this.health = s.health;
    this.state = s.state;
    this.lastSeen = s.lastSeen;
    if (!s.alive) {
      this.alive = false;
      this.solid = false;
      this.state = 'dead';
      this.deadT = 99;
      this.deathDir = [0, 0, 1];
      this.onDeath('load', 0);
      if (s.gibbed) {
        this.gibbed = true;
        this.mesh.visible = false;
      }
    }
    this._sync(0);
  }
}
