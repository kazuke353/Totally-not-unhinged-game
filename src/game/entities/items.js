// Pickups, wall chargers, explosive barrels, elevators.
import * as THREE from 'three';
import { Entity } from './base.js';
import { Brush } from '../../engine/world.js';
import { audio } from '../../engine/audio.js';
import { kit, C, meshOf, entityMaterial } from '../modelkit.js';
import { buildPickupModel, buildWeaponModel } from '../weaponmodels.js';
import { WEAPONS } from '../weapons.js';
import { moveBody } from '../../engine/physics.js';
import { rand, clamp, damp } from '../../engine/util.js';

export const ITEMS = {
  medkit: { name: 'MEDKIT', model: 'medkit', sound: 'medkit', apply: (p) => p.heal(25) },
  battery: { name: 'H.O.P. BATTERY', model: 'battery', sound: 'battery', apply: (p) => p.addArmor(20) },
  ammo_9mm: { name: '9MM AMMO', model: 'ammo_9mm', sound: 'pickup_ammo', apply: (p) => p.weapons.addAmmo('9mm', 34) },
  ammo_9mmbox: { name: '9MM AMMO BOX', model: 'ammo_9mm', scale: 1.6, sound: 'pickup_ammo', apply: (p) => p.weapons.addAmmo('9mm', 100) },
  ammo_shells: { name: 'SHOTGUN SHELLS', model: 'ammo_shells', sound: 'pickup_ammo', apply: (p) => p.weapons.addAmmo('shells', 12) },
  ammo_rockets: { name: 'ROCKETS', model: 'ammo_rockets', sound: 'pickup_ammo', apply: (p) => p.weapons.addAmmo('rockets', 2) },
  ammo_argrenades: { name: 'AR GRENADES', model: 'ammo_argrenades', sound: 'pickup_ammo', apply: (p) => p.weapons.addAmmo('argrenades', 2) },
  ammo_grenades: {
    name: 'HAND GRENADES', model: 'ammo_grenades', sound: 'pickup_ammo',
    apply: (p) => {
      if (!p.weapons.has('grenade')) {
        p.weapons.owned.add('grenade');
        p.game.app.hud.pickup('HAND GRENADES', 'weapon');
      }
      return p.weapons.addAmmo('grenades', 2);
    },
  },
  keycard_red: { name: 'RED KEYCARD', model: 'keycard_red', sound: 'pickup_weapon', key: 'red' },
  keycard_blue: { name: 'BLUE KEYCARD', model: 'keycard_blue', sound: 'pickup_weapon', key: 'blue' },
  launchkey: { name: 'LAUNCH KEY', model: 'launchkey', sound: 'pickup_weapon', key: 'launch' },
};
for (const w of ['pistol', 'smg', 'shotgun', 'rpg', 'grenade']) {
  ITEMS['weapon_' + w] = { name: WEAPONS[w].name, weapon: w, sound: 'pickup_weapon' };
}

export class Pickup extends Entity {
  constructor(game, d) {
    super(game, d);
    this.taken = false;
    this.info = ITEMS[d.item];
    this.t = rand(0, 6);
    this.pos = new THREE.Vector3(...d.pos);
    this.vy = 0;
  }
  spawn() {
    if (!this.info) {
      console.warn('unknown item', this.def.item);
      this.removed = true;
      return;
    }
    const g = this.game;
    this.mat = entityMaterial(g.shared);
    let m;
    if (this.info.weapon) {
      m = buildWeaponModel(this.info.weapon, this.mat);
      m.scale.setScalar(1.4);
      m.rotation.z = Math.PI / 2;
      const wrap = new THREE.Group();
      wrap.add(m);
      m = wrap;
    } else m = buildPickupModel(this.info.model, this.mat);
    if (this.info.scale) m.scale.setScalar(this.info.scale);
    this.mesh = new THREE.Group();
    this.mesh.add(m);
    this.inner = m;
    g.entGroup.add(this.mesh);
    // settle on the floor
    const hit = g.world.raycast(this.pos.x, this.pos.y + 0.3, this.pos.z, 0, -1, 0, 20, {});
    this.floorY = hit ? hit.point[1] : this.pos.y;
    if (!this.def.drop) this.pos.y = this.floorY;
    else this.vy = 2;
    const L = g.sampleLight([this.pos.x, this.floorY + 0.2, this.pos.z], [0, 0, 0]);
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.8 + 0.12, L[1] * 0.8 + 0.12, L[2] * 0.8 + 0.12);
    this.mat.uniforms.uDirCol.value.set(L[0] * 0.4, L[1] * 0.4, L[2] * 0.4);
    this._place(0);
  }
  _place(dt) {
    this.t += dt;
    const bob = Math.sin(this.t * 2.2) * 0.05 + 0.15;
    this.mesh.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    this.mesh.rotation.y = this.t * 1.2;
    // soft pulsing tint so items read in dark corners
    if (this.mat) {
      const k = 0.04 + Math.sin(this.t * 3) * 0.03;
      this.mat.uniforms.uTint.value.set(k, k * 0.8, k * 0.4);
    }
  }
  update(dt) {
    if (this.taken || !this.info) return;
    if (this.def.drop && this.pos.y > this.floorY) {
      this.vy -= 15 * dt;
      this.pos.y = Math.max(this.floorY, this.pos.y + this.vy * dt);
    }
    this._place(dt);
    const p = this.game.player;
    if (!p || !p.alive) return;
    const dx = p.body.pos.x - this.pos.x, dz = p.body.pos.z - this.pos.z;
    const dy = this.pos.y - p.body.pos.y;
    if (dx * dx + dz * dz < 1.0 && dy > -0.5 && dy < p.body.height + 0.3) this.tryTake(p);
  }
  tryTake(p) {
    const info = this.info;
    let took = false;
    if (info.weapon) {
      const fresh = p.weapons.give(info.weapon);
      took = true;
      this.game.app.hud.pickup(info.name, fresh ? 'weapon' : 'ammo');
    } else if (info.key) {
      p.addKey(info.key);
      took = true;
      this.game.app.hud.pickup(info.name, 'key');
      this.game.hint(`PICKED UP ${info.name}`, 2.5);
    } else {
      const n = info.apply(p);
      took = n > 0;
      if (took) this.game.app.hud.pickup(info.name, this.def.item);
    }
    if (!took) return;
    this.taken = true;
    audio.play(info.sound || 'pickup', { volume: 0.8 });
    this.game.app.hud.flash('pickup');
    this.mesh.visible = false;
    if (this.def.item === 'battery' && !this.game.flags.firstBattery) {
      this.game.flags.firstBattery = true;
      this.game.after(0.4, () => p.hev('battery', 'H.O.P. suit power restored. Pouch armour online.', 999));
    }
    this.fireTargets(p);
    this.removed = true;
    this.purge = true;
  }
  save() {
    return { taken: this.taken, pos: this.pos.toArray() };
  }
  load(s) {
    if (s.taken) {
      this.taken = true;
      this.removed = true;
      if (this.mesh) this.mesh.visible = false;
    }
    if (s.pos) this.pos.fromArray(s.pos);
  }
}

// ------------------------------------------------------------------ wall charger
export class Charger extends Entity {
  constructor(game, d) {
    super(game, d);
    this.kind = d.kind || 'health';
    this.capacity = d.capacity ?? (this.kind === 'health' ? 50 : 75);
    this.left = this.capacity;
    this.loop = null;
    this.tick = 0;
  }
  spawn() {
    const g = this.game, d = this.def;
    this.mat = entityMaterial(g.shared);
    const col = this.kind === 'health' ? C('#c02020') : C('#e2761a');
    const body = C('#5a5f62');
    this.liquid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.06), new THREE.MeshBasicMaterial({ color: this.kind === 'health' ? 0xff3030 : 0xffa020 }));
    const parts = [
      kit.box(0.6, 0.8, 0.22, body, { p: [0, 0, 0.11] }),
      kit.box(0.5, 0.12, 0.05, C('#2a2c2e'), { p: [0, 0.3, 0.23] }),
      kit.box(0.2, 0.5, 0.04, C('#111'), { p: [0, -0.04, 0.23] }),
      kit.box(0.6, 0.06, 0.24, col, { p: [0, 0.4, 0.11] }),
      kit.box(0.12, 0.12, 0.06, col, { p: [0.2, -0.25, 0.23] }),
      kit.box(0.12, 0.12, 0.06, col, { p: [-0.2, -0.25, 0.23] }),
    ];
    if (this.kind === 'health') parts.push(kit.box(0.04, 0.12, 0.02, C('#fff'), { p: [0, 0.3, 0.26] }), kit.box(0.12, 0.04, 0.02, C('#fff'), { p: [0, 0.3, 0.26] }));
    this.mesh = new THREE.Group();
    this.mesh.add(meshOf(parts, this.mat));
    this.liquid.position.set(0, -0.04, 0.26);
    this.mesh.add(this.liquid);
    this.mesh.position.set(...d.pos);
    const f = d.facing || [0, 0, 1];
    this.mesh.rotation.y = Math.atan2(f[0], f[2]);
    g.entGroup.add(this.mesh);
    const L = g.sampleLight([d.pos[0] + f[0] * 0.8, d.pos[1], d.pos[2] + f[2] * 0.8], [0, 0, 0]);
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.8 + 0.1, L[1] * 0.8 + 0.1, L[2] * 0.8 + 0.1);
    this.mat.uniforms.uDirCol.value.set(L[0] * 0.4, L[1] * 0.4, L[2] * 0.4);
    this._level();
  }
  _level() {
    const k = this.left / this.capacity;
    this.liquid.scale.y = Math.max(0.02, k);
    this.liquid.position.y = -0.04 - (1 - k) * 0.2;
  }
  useBox() {
    const p = this.def.pos;
    return { min: [p[0] - 0.45, p[1] - 0.5, p[2] - 0.45], max: [p[0] + 0.45, p[1] + 0.5, p[2] + 0.45] };
  }
  use() {
    if (this.left <= 0) return false;
    return true;
  }
  useLabel() {
    return this.left > 0 ? (this.kind === 'health' ? 'HOLD: HEALTH' : 'HOLD: SUIT POWER') : 'EMPTY';
  }
  update(dt) {
    const g = this.game, p = g.player;
    const using = p && p.alive && p.useTarget === this && g.input.is('use');
    let charging = false;
    if (using && this.left > 0) {
      const need = this.kind === 'health' ? p.health < 100 : p.armor < 100;
      if (need) {
        charging = true;
        this.tick -= dt;
        if (this.tick <= 0) {
          this.tick = 0.1;
          const n = Math.min(1, this.left);
          const got = this.kind === 'health' ? p.heal(n) : p.addArmor(n);
          this.left -= got;
          this._level();
        }
      }
    }
    if (using && this.left <= 0 && !this._deniedT) {
      audio.play('denied', { pos: this.def.pos, volume: 0.5 });
      this._deniedT = 1;
    }
    if (this._deniedT) this._deniedT = Math.max(0, this._deniedT - dt);
    if (charging && !this.loop) this.loop = audio.play('charger_loop', { pos: this.def.pos, loop: true, volume: 0.6 });
    if (!charging && this.loop) {
      this.loop.stop();
      this.loop = null;
    }
  }
  destroy() {
    super.destroy();
    if (this.loop) this.loop.stop();
  }
  save() {
    return { left: this.left };
  }
  load(s) {
    this.left = s.left;
    this._level();
  }
}

// ------------------------------------------------------------------ explosive barrel
export class Barrel extends Entity {
  constructor(game, d) {
    super(game, d);
    this.health = 22;
    this.solid = true;
    this.surface = 'metal';
    this.body = { pos: new THREE.Vector3(...d.pos), vel: new THREE.Vector3(), half: 0.3, height: 0.95, onGround: true, stepHeight: 0.1, ignore: this };
    this.exploding = false;
  }
  spawn() {
    const g = this.game;
    this.mat = entityMaterial(g.shared);
    const red = C('#a8261a');
    const parts = [
      kit.cyl(0.3, 0.3, 0.95, red, { p: [0, 0.475, 0] }, 10),
      kit.cyl(0.31, 0.31, 0.05, C('#5a1410'), { p: [0, 0.3, 0] }, 10),
      kit.cyl(0.31, 0.31, 0.05, C('#5a1410'), { p: [0, 0.65, 0] }, 10),
      kit.box(0.3, 0.2, 0.02, C('#e0c020'), { p: [0, 0.48, 0.3] }),
      kit.box(0.12, 0.12, 0.022, C('#111'), { p: [0, 0.48, 0.302] }),
      kit.cyl(0.05, 0.05, 0.04, C('#333'), { p: [0.15, 0.96, 0] }, 6),
    ];
    this.mesh = meshOf(parts, this.mat);
    g.entGroup.add(this.mesh);
    this._sync();
  }
  _sync() {
    this.mesh.position.copy(this.body.pos);
  }
  getBox() {
    if (this.exploding) return null;
    const p = this.body.pos;
    return { min: [p.x - 0.3, p.y, p.z - 0.3], max: [p.x + 0.3, p.y + 0.95, p.z + 0.3] };
  }
  getHitboxes() {
    const b = this.getBox();
    return b ? [{ ...b, group: 'body' }] : null;
  }
  center() {
    const p = this.body.pos;
    return [p.x, p.y + 0.5, p.z];
  }
  radius() {
    return 0.3;
  }
  damage(n, dir, attacker, group, type) {
    if (this.exploding) return;
    this.health -= n;
    this.lastAttacker = attacker;
    if (type === 'bullet' && Math.random() < 0.3) this.game.fx.sparks(this.center(), [0, 1, 0], 3);
    if (this.health <= 0) {
      this.exploding = true;
      this.solid = false;
      this.game.after(type === 'explosion' ? rand(0.1, 0.3) : 0.05, () => this.boom());
    }
  }
  knockback(dir, f) {
    this.body.vel.x += dir[0] * f * 0.7;
    this.body.vel.z += dir[2] * f * 0.7;
    this.body.vel.y += Math.max(0, dir[1]) * f * 0.3;
    audio.play('hit_metal', { pos: this.center(), volume: 0.7, rate: 0.6 });
  }
  boom() {
    const c = this.center();
    this.mesh.visible = false;
    this.removed = true;
    this.game.explode(c, 5.5, 110, this.lastAttacker || this, 1.2);
    this.game.fx.metalChunks([c[0] - 0.3, c[1] - 0.4, c[2] - 0.3], [c[0] + 0.3, c[1] + 0.4, c[2] + 0.3], 6);
  }
  update(dt) {
    if (this.exploding) return;
    const b = this.body;
    if (Math.abs(b.vel.x) + Math.abs(b.vel.z) > 0.01 || !b.onGround) {
      b.vel.y -= 20 * dt;
      const res = moveBody(this.game.world, b, dt, { stickDown: false });
      if (b.onGround) {
        b.vel.x *= Math.max(0, 1 - 3 * dt);
        b.vel.z *= Math.max(0, 1 - 3 * dt);
      }
      if (res.hitWall) audio.play('hit_metal', { pos: this.center(), volume: 0.4, rate: 0.5 });
      this.mesh.rotation.y += (Math.abs(b.vel.x) + Math.abs(b.vel.z)) * dt * 2;
      this._sync();
    }
  }
  save() {
    return { pos: this.body.pos.toArray(), exploded: this.exploding };
  }
  load(s) {
    this.body.pos.fromArray(s.pos);
    if (s.exploded) {
      this.exploding = true;
      this.removed = true;
      this.mesh.visible = false;
    }
    this._sync();
  }
}

// ------------------------------------------------------------------ elevator / lift
export class Elevator extends Entity {
  constructor(game, d) {
    super(game, d);
    this.stops = d.stops || [0, 5];
    this.stopIdx = d.startStop || 0;
    this.y = this.stops[this.stopIdx];
    this.moving = false;
    this.speed = d.speed ?? 2.2;
    this.loop = null;
  }
  preBuild(world) {
    const d = this.def;
    this.brush = new Brush(d.min, d.max, { tex: d.tex || 'metal_floor', faces: d.faces, surface: 'metal' });
    this.brush.dynamic = true;
    this.brush.owner = this;
    this.brush.moveDelta = [0, 0, 0];
    world.add(this.brush);
    this.extra = (d.extra || []).map((e) => {
      const b = new Brush(e.min, e.max, { tex: e.tex || 'metal_panel', surface: 'metal' });
      b.dynamic = true;
      b.owner = this;
      b.moveDelta = [0, 0, 0];
      world.add(b);
      return b;
    });
  }
  spawn() {
    this._apply();
  }
  _apply() {
    for (const b of [this.brush, ...this.extra]) {
      const old = b.offset[1];
      b.moveDelta = [0, this.y - old, 0];
      this.game.world.setMoverOffset(b, 0, this.y, 0);
    }
  }
  trigger() {
    if (this.moving) return;
    if (this.def.once && this.used) return;
    this.used = true;
    this.stopIdx = (this.stopIdx + 1) % this.stops.length;
    this.moving = true;
    this.loop = audio.play('elevator_loop', { pos: this.center(), loop: true, volume: 0.6 });
    audio.play('door_stop', { pos: this.center(), volume: 0.5 });
  }
  center() {
    const a = this.brush.wmin, b = this.brush.wmax;
    return [(a[0] + b[0]) / 2, b[1] + 1, (a[2] + b[2]) / 2];
  }
  update(dt) {
    if (!this.moving) {
      for (const b of [this.brush, ...this.extra]) b.moveDelta = [0, 0, 0];
      return;
    }
    const target = this.stops[this.stopIdx];
    const d = target - this.y;
    const step = Math.sign(d) * Math.min(Math.abs(d), this.speed * dt);
    this.y += step;
    this._apply();
    if (this.loop) this.loop.setPos(this.center());
    if (Math.abs(target - this.y) < 1e-4) {
      this.y = target;
      this.moving = false;
      if (this.loop) this.loop.stop();
      this.loop = null;
      audio.play('door_stop', { pos: this.center(), volume: 0.8 });
      this.fireTargets(this.game.player, this.def.arriveTargets ? this.def.arriveTargets[this.stopIdx] : this.target);
    }
  }
  navBlocked() {
    return false;
  }
  destroy() {
    if (this.loop) this.loop.stop();
  }
  save() {
    return { y: this.y, stopIdx: this.stopIdx, moving: this.moving, used: this.used };
  }
  load(s) {
    this.y = s.y;
    this.stopIdx = s.stopIdx;
    this.moving = false;
    this.used = s.used;
    if (s.moving) this.y = this.stops[this.stopIdx];
    this._apply();
  }
}
