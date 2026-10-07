// Weapon definitions and the player's weapon state machine.
import * as THREE from 'three';
import { audio } from '../engine/audio.js';
import { rand, clamp } from '../engine/util.js';

export const AMMO_MAX = { '9mm': 250, shells: 64, rockets: 5, grenades: 10, argrenades: 10 };
export const AMMO_NAMES = { '9mm': '9MM', shells: 'SHELLS', rockets: 'ROCKETS', grenades: 'GRENADES', argrenades: 'AR GRENADES' };

export const WEAPONS = {
  fists: { slot: 1, name: 'FISTS & FEET', model: 'fists', ammo: null, hint: 'MOUSE1: KICK   MOUSE2: JAB' },
  pistol: { slot: 2, name: '9MM PISTOL', model: 'pistol', ammo: '9mm', clip: 17, dmg: 13, rate: 0.26, spread: 0.008, reload: 1.4, sound: 'pistol', hint: 'MOUSE2: RAPID FIRE' },
  smg: { slot: 3, name: 'MP5 SMG', model: 'smg', ammo: '9mm', clip: 50, dmg: 8, rate: 0.085, spread: 0.028, auto: true, reload: 1.6, sound: 'smg', alt: 'argrenades', hint: 'MOUSE2: GRENADE LAUNCHER' },
  shotgun: { slot: 3, name: 'SHOTGUN', model: 'shotgun', ammo: 'shells', clip: 8, dmg: 7, pellets: 8, rate: 0.85, spread: 0.075, reloadShell: 0.45, sound: 'shotgun', hint: 'MOUSE2: DOUBLE BLAST' },
  rpg: { slot: 4, name: 'RPG', model: 'rpg', ammo: 'rockets', clip: 1, rate: 1.2, reload: 2.0, sound: 'rpg_fire', hint: 'LASER GUIDED. MOUSE2: TOGGLE LASER' },
  grenade: { slot: 5, name: 'HAND GRENADES', model: 'grenade', ammo: 'grenades', clip: 0, rate: 1.0, hint: 'MOUSE1: THROW   MOUSE2: ROLL' },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rpg', 'grenade'];

const _v = new THREE.Vector3();

export class WeaponSystem {
  constructor(player) {
    this.p = player;
    this.game = player.game;
    this.owned = new Set(['fists']);
    this.ammo = { '9mm': 0, shells: 0, rockets: 0, grenades: 0, argrenades: 0 };
    this.clip = { pistol: 0, smg: 0, shotgun: 0, rpg: 0 };
    this.current = 'fists';
    this.previous = 'fists';
    this.pending = null;
    this.switchT = 0;
    this.nextFire = 0;
    this.reloading = 0;
    this.reloadShells = false;
    this.kickCooldown = 0;
    this.laser = true;
    this.punchSide = 1;
    this.activeRocket = null;
  }

  get def() {
    return WEAPONS[this.current];
  }

  has(id) {
    return this.owned.has(id);
  }

  give(id, silent = false) {
    const fresh = !this.owned.has(id);
    this.owned.add(id);
    const d = WEAPONS[id];
    if (d.clip && fresh) this.clip[id] = d.clip;
    else if (d.ammo) this.addAmmo(d.ammo, id === 'shotgun' ? 8 : id === 'rpg' ? 1 : id === 'grenade' ? 3 : 25);
    if (id === 'grenade' && fresh) this.addAmmo('grenades', 2);
    if (fresh && !silent) {
      // auto switch to new toys (HL style)
      this.select(id);
      const quip = {
        pistol: '9 millimetre pistol acquired. Stored in pouch.',
        smg: 'Submachine gun acquired. Pouch capacity: concerning.',
        shotgun: 'Shotgun acquired. Please do not ask how it fits.',
        rpg: 'Rocket launcher acquired. Joey compartment reclassified as a weapons bay.',
        grenade: 'Grenades acquired. Do not hop with the pins out.',
      }[id];
      if (quip) this.game.after(0.6, () => this.p.hev('weapon_' + id, quip, 9999));
    }
    return fresh;
  }
  addAmmo(type, n) {
    const before = this.ammo[type];
    this.ammo[type] = Math.min(AMMO_MAX[type], this.ammo[type] + n);
    return this.ammo[type] - before;
  }

  canUse(id) {
    if (!this.owned.has(id)) return false;
    const d = WEAPONS[id];
    if (!d.ammo) return true;
    if (id === 'grenade') return this.ammo.grenades > 0;
    return this.clip[id] > 0 || this.ammo[d.ammo] > 0;
  }

  select(id) {
    if (!this.owned.has(id) || id === this.current || this.pending === id) return;
    if (id === 'grenade' && this.ammo.grenades <= 0) return;
    this.pending = id;
    this.switchT = 0.45;
    this.reloading = 0;
    audio.play('weapon_select', { volume: 0.6 });
  }

  slot(n) {
    const inSlot = WEAPON_ORDER.filter((w) => WEAPONS[w].slot === n && this.owned.has(w));
    if (!inSlot.length) return;
    const curIdx = inSlot.indexOf(this.pending || this.current);
    const next = inSlot[(curIdx + 1) % inSlot.length];
    this.select(next);
    this.game.app.hud.showWeaponMenu(n, next);
  }
  cycle(dir) {
    const owned = WEAPON_ORDER.filter((w) => this.canUse(w));
    if (!owned.length) return;
    let i = owned.indexOf(this.pending || this.current);
    i = (i + dir + owned.length) % owned.length;
    this.select(owned[i]);
    this.game.app.hud.showWeaponMenu(WEAPONS[owned[i]].slot, owned[i]);
  }

  // ------------------------------------------------------------------ think
  update(dt, input) {
    const p = this.p;
    this.nextFire -= dt;
    this.kickCooldown -= dt;
    if (!p.alive) return;

    if (this.pending) {
      this.switchT -= dt;
      if (this.switchT < 0.22 && this.current !== this.pending) {
        this.previous = this.current;
        this.current = this.pending;
        p.onWeaponChanged();
      }
      if (this.switchT <= 0) {
        this.pending = null;
        this.nextFire = 0.05;
      }
      return;
    }

    const d = this.def;
    // reload
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.current === 'shotgun') {
        if (input.attack && this.clip.shotgun > 0) {
          this.reloading = 0;
        } else if (this.reloading <= 0) {
          if (this.ammo.shells > 0 && this.clip.shotgun < d.clip) {
            this.clip.shotgun++;
            this.ammo.shells--;
            audio.play('shell_in', { pos: p.posArr(), volume: 0.7 });
            if (this.clip.shotgun < d.clip && this.ammo.shells > 0) this.reloading = d.reloadShell;
            else {
              audio.play('pump', { pos: p.posArr(), volume: 0.7 });
              this.nextFire = 0.4;
            }
          }
        }
      } else if (this.reloading <= 0) {
        const need = d.clip - this.clip[this.current];
        const take = Math.min(need, this.ammo[d.ammo]);
        this.clip[this.current] += take;
        this.ammo[d.ammo] -= take;
      }
      if (this.reloading > 0) return;
    }

    if (input.reload) this.startReload();

    // quick kick available with any weapon
    if (input.kick && this.kickCooldown <= 0 && this.nextFire <= 0.15) {
      this.kick();
      return;
    }
    if (input.grenade && this.ammo.grenades > 0 && this.nextFire <= 0) {
      this.throwGrenade(false);
      return;
    }

    if (this.nextFire > 0) return;
    const a1 = d.auto ? input.attackHeld : input.attack;
    const a2held = input.attack2Held, a2 = input.attack2;
    switch (this.current) {
      case 'fists':
        if (input.attackHeld && this.kickCooldown <= 0) this.kick();
        else if (a2held) this.punch();
        break;
      case 'pistol':
        if (a1) this.shoot(d.dmg, d.spread, 1, d.rate);
        else if (a2held) this.shoot(d.dmg, 0.05, 1, 0.12);
        break;
      case 'smg':
        if (input.attackHeld) this.shoot(d.dmg, d.spread, 1, d.rate);
        else if (a2) this.launchARGrenade();
        break;
      case 'shotgun':
        if (a1) this.shotgun(false);
        else if (a2) this.shotgun(true);
        break;
      case 'rpg':
        if (a1) this.fireRocket();
        if (a2) {
          this.laser = !this.laser;
          audio.play('button', { volume: 0.5 });
        }
        break;
      case 'grenade':
        if (a1) this.throwGrenade(false);
        else if (a2) this.throwGrenade(true);
        break;
    }
  }

  startReload() {
    const d = this.def;
    if (!d.clip || this.reloading > 0) return false;
    if (this.clip[this.current] >= d.clip || this.ammo[d.ammo] <= 0) return false;
    if (this.current === 'shotgun') this.reloading = 0.5;
    else this.reloading = d.reload;
    this.p.setAction('reload', this.reloading + 0.1);
    audio.play(this.current === 'shotgun' ? 'shell_in' : 'reload', { pos: this.p.posArr(), volume: 0.7 });
    return true;
  }

  useClip() {
    const id = this.current;
    if (this.clip[id] <= 0) {
      if (!this.startReload()) {
        audio.play('empty', { volume: 0.6 });
        this.nextFire = 0.3;
        // auto switch to something usable (HL style)
        if (this.ammo[WEAPONS[id].ammo] <= 0) {
          const alt = ['shotgun', 'smg', 'pistol', 'fists'].find((w) => w !== id && this.canUse(w));
          if (alt) this.select(alt);
        }
      }
      return false;
    }
    this.clip[id]--;
    return true;
  }

  // Direction from the muzzle/eye toward the crosshair target with spread.
  aimDir(spread, out) {
    const p = this.p;
    const o = p.shootOrigin();
    const t = p.aimPoint;
    out.set(t.x - o[0], t.y - o[1], t.z - o[2]).normalize();
    if (spread > 0) {
      // speed makes you less accurate (kangaroo hops are bouncy)
      const sp = spread * (1 + Math.min(1, p.speedH() / 8) * 0.6) * (p.crouched ? 0.6 : 1);
      const r = new THREE.Vector3(out.z, 0, -out.x).normalize();
      const u = new THREE.Vector3().crossVectors(r, out).normalize();
      const a = Math.random() * Math.PI * 2, m = Math.sqrt(Math.random()) * sp;
      out.addScaledVector(r, Math.cos(a) * m).addScaledVector(u, Math.sin(a) * m).normalize();
    }
    return out;
  }

  shoot(dmg, spread, pellets, rate) {
    if (!this.useClip()) return;
    const p = this.p, g = this.game;
    this.nextFire = rate;
    const d = this.def;
    audio.play(d.sound, { pos: p.posArr(), volume: 0.9 });
    const o = p.shootOrigin();
    const muzzle = p.muzzlePos();
    g.stats.shots++;
    for (let i = 0; i < pellets; i++) {
      this.aimDir(spread, _v);
      g.bullet(o, [_v.x, _v.y, _v.z], 120, dmg, p, { tracer: i === 0 && Math.random() < 0.6, tracerFrom: muzzle });
    }
    g.fx.muzzle(muzzle, this.current === 'shotgun' ? 1.4 : 1);
    g.fx.shellCasing(muzzle, p.rightVec(), this.current === 'shotgun' ? [0.8, 0.15, 0.1] : [1, 0.8, 0.4]);
    g.noise(p.posArr(), 30, p);
    p.recoil(this.current === 'shotgun' ? 1.0 : this.current === 'smg' ? 0.25 : 0.45);
  }

  shotgun(double) {
    const d = this.def;
    if (double && this.clip.shotgun < 2) double = false;
    if (!this.useClip()) return;
    if (double) this.clip.shotgun--;
    const p = this.p, g = this.game;
    this.nextFire = double ? 1.4 : d.rate;
    audio.play('shotgun', { pos: p.posArr(), volume: 1 });
    if (double) audio.play('shotgun', { pos: p.posArr(), volume: 0.8, rate: 0.85 });
    const o = p.shootOrigin();
    const muzzle = p.muzzlePos();
    g.stats.shots++;
    const n = double ? 14 : d.pellets;
    for (let i = 0; i < n; i++) {
      this.aimDir(double ? d.spread * 1.4 : d.spread, _v);
      g.bullet(o, [_v.x, _v.y, _v.z], 60, d.dmg, p, { tracer: i < 2, tracerFrom: muzzle });
    }
    g.fx.muzzle(muzzle, double ? 2 : 1.5);
    g.noise(p.posArr(), 35, p);
    p.recoil(double ? 2.0 : 1.2);
    g.after(0.45, () => audio.play('pump', { pos: p.posArr(), volume: 0.6 }));
    if (double) p.pushBack(3);
  }

  launchARGrenade() {
    if (this.ammo.argrenades <= 0) {
      audio.play('empty', { volume: 0.6 });
      this.nextFire = 0.3;
      return;
    }
    this.ammo.argrenades--;
    const p = this.p;
    this.nextFire = 1.0;
    this.aimDir(0, _v);
    const m = p.muzzlePos();
    this.game.spawnEntity({ type: 'grenade', pos: m, vel: [_v.x * 22, _v.y * 22 + 2.5, _v.z * 22], contact: true, owner: p, fuse: 6 });
    audio.play('glauncher', { pos: p.posArr() });
    p.recoil(0.8);
  }

  fireRocket() {
    if (!this.useClip()) return;
    const p = this.p;
    this.nextFire = WEAPONS.rpg.rate;
    this.aimDir(0, _v);
    const m = p.muzzlePos();
    const r = this.game.spawnEntity({ type: 'rocket', pos: m, dir: [_v.x, _v.y, _v.z], owner: p, guided: this.laser, speed: 18 });
    this.activeRocket = r;
    audio.play('rpg_fire', { pos: p.posArr() });
    this.game.fx.muzzle(m, 1.5);
    this.game.fx.smokeTrail(m, 0.6);
    p.recoil(1.5);
    this.game.noise(p.posArr(), 30, p);
    // auto reload
    this.game.after(0.5, () => {
      if (this.current === 'rpg' && this.clip.rpg === 0 && this.ammo.rockets > 0) this.startReload();
    });
  }

  throwGrenade(roll) {
    if (this.ammo.grenades <= 0) return;
    this.ammo.grenades--;
    const p = this.p;
    this.nextFire = WEAPONS.grenade.rate;
    p.setAction('throw', 0.5);
    audio.play('pin', { pos: p.posArr(), volume: 0.6 });
    this.game.after(0.18, () => {
      this.aimDir(0, _v);
      const o = p.shootOrigin();
      const sp = roll ? 7 : 15;
      const vel = [_v.x * sp + p.body.vel.x * 0.5, _v.y * sp + (roll ? 0.5 : 3.5), _v.z * sp + p.body.vel.z * 0.5];
      this.game.spawnEntity({ type: 'grenade', pos: [o[0] + _v.x * 0.5, o[1] - 0.2, o[2] + _v.z * 0.5], vel, owner: p, fuse: 3 });
      audio.play('swing', { pos: p.posArr(), volume: 0.6 });
    });
    if (this.current === 'grenade' && this.ammo.grenades <= 0) this.game.after(0.6, () => this.cycle(-1));
  }

  // Kangaroo double-footed kick: huge damage + knockback.
  kick() {
    const p = this.p, g = this.game;
    this.kickCooldown = 0.62;
    this.nextFire = Math.max(this.nextFire, 0.5);
    p.setAction('kick', 0.6);
    audio.play('swing', { pos: p.posArr(), volume: 0.8, rate: 0.8 });
    if (Math.random() < 0.5) audio.play('chuff', { pos: p.posArr(), volume: 0.7, rate: 0.9 });
    g.after(0.17, () => this.meleeHit(48, 2.1, 0.6, 'kick', 9));
  }
  punch() {
    const p = this.p;
    this.nextFire = 0.28;
    this.punchSide = -this.punchSide;
    p.setAction('punch', 0.28);
    audio.play('swing', { pos: p.posArr(), volume: 0.5, rate: 1.4 });
    this.game.after(0.08, () => this.meleeHit(18, 1.7, 0.5, 'punch', 3));
  }

  meleeHit(dmg, range, cone, kind, force) {
    const p = this.p, g = this.game;
    if (!p.alive) return;
    const o = p.shootOrigin();
    o[1] -= kind === 'kick' ? 0.45 : 0.1;
    const f = p.forwardVec();
    const fl = Math.hypot(f.x, f.z) || 1;
    const fx = f.x / fl, fz = f.z / fl;
    const pitchY = clamp(f.y, -0.5, 0.5);
    let best = null, bestD = range + 0.6;
    for (const e of g.entities) {
      if (e.removed || !e.damage || !e.center) continue;
      if (e.meleeImmune) continue;
      const c = e.center();
      const dx = c[0] - o[0], dy = c[1] - o[1], dz = c[2] - o[2];
      const rad = e.radius ? e.radius() : 0.4;
      const dist = Math.hypot(dx, dz) - rad;
      if (dist > range || Math.abs(dy) > 1.6) continue;
      const dn = Math.hypot(dx, dz) || 1;
      const dot = (dx * fx + dz * fz) / dn;
      if (dot < cone && dist > 0.3) continue;
      if (!g.canHit(o, e, c)) continue;
      if (dist < bestD) {
        bestD = dist;
        best = e;
      }
    }
    if (best) {
      const c = best.center();
      const dir = [fx, 0.35 + pitchY * 0.5, fz];
      best.damage(dmg, dir, p, 'body', kind, c);
      if (best.knockback) best.knockback(dir, force);
      audio.play(kind === 'kick' ? 'kick_hit' : 'punch_hit', { pos: c, volume: 1 });
      if (best.fleshy) g.fx.blood(c, dir, 0.4, best.bloodColor);
      else g.fx.sparks(c, [-fx, 0.2, -fz], 4);
      if (kind === 'kick') g.fx.stars([c[0], c[1] + 0.4, c[2]]);
      g.shake = Math.max(g.shake, kind === 'kick' ? 0.35 : 0.15);
      g.noise(p.posArr(), 12, p);
      return;
    }
    // hit world?
    const hit = g.world.raycast(o[0], o[1], o[2], fx, pitchY, fz, range, { bullet: true });
    if (hit) {
      g.impactFX(hit, [fx, 0, fz]);
      audio.play(kind === 'kick' ? 'kick_hit' : 'punch_hit', { pos: hit.point, volume: 0.6 });
      g.shake = Math.max(g.shake, 0.12);
      g.noise(p.posArr(), 8, p);
    }
  }

  save() {
    return { owned: [...this.owned], ammo: { ...this.ammo }, clip: { ...this.clip }, current: this.current, laser: this.laser };
  }
  load(s) {
    this.owned = new Set(s.owned);
    this.ammo = { ...this.ammo, ...s.ammo };
    this.clip = { ...this.clip, ...s.clip };
    this.current = s.current;
    this.pending = null;
    this.reloading = 0;
    this.laser = s.laser ?? true;
  }
}
