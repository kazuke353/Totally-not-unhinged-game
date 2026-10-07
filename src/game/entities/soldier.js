// Outback Defence Force grunt. Gas mask, helmet, camo, attitude.
import * as THREE from 'three';
import { NPC } from './npc.js';
import { kit, C, meshOf, bone } from '../modelkit.js';
import { buildWeaponModel } from '../weaponmodels.js';
import { audio } from '../../engine/audio.js';
import { moveBody } from '../../engine/physics.js';
import { approachAngle, clamp, damp, rand, pick, chance, wrapAngle } from '../../engine/util.js';

const CAMO = [C('#5d6342'), C('#424830'), C('#7a7254'), C('#353826')];
const camo = (s) => (x, y, z) => {
  const n = Math.sin(x * 23 + s) * Math.sin(y * 17 + z * 13 + s * 2) + Math.sin(z * 31 - y * 7 + s);
  return CAMO[n > 0.9 ? 2 : n > 0.2 ? 0 : n > -0.6 ? 1 : 3];
};
const VEST = C('#3a3d2c');
const MASK = C('#2c2e30');
const LENS = C('#0d1416');
const BOOT = C('#1c1a18');
const SKIN = C('#b98a6a');
const BERET = C('#8a1a14');

const LINES = {
  spot: ['Contact! Big red hopper!', 'Is that a kangaroo in a vest?!', 'Hostile roo spotted!', 'Oi! Get that marsupial!', "It's the roo! Light it up!", 'Visual on the kangaroo!'],
  grenade: ['Fire in the hole!', 'Grenade out!', 'Eat this, Skippy!'],
  cover: ['Cover me!', 'Moving!', 'Flanking!', 'Taking cover!'],
  mandown: ['Man down!', 'We lost Davo!', 'It kicked Bazza into next week!', 'Medic! Oh wait, we cut the medic budget.'],
  search: ["Where'd it hop off to?", 'Check the corners. Roos love corners.', "I've lost visual!", 'Anyone see where it went?'],
  reload: ['Reloading!', 'Changing mags!'],
  hear: ['You hear something?', 'Probably just the wind. Or a roo.', 'Something moved over there.'],
  flee: ['Grenade! Move!', 'Get clear!'],
  kicked: ['Me ribs!', 'Strewth!', 'Ow, the legs on that thing!'],
  idle: [
    'Mate, I swear I saw a kangaroo in an orange vest earlier.',
    "Six more weeks guarding this dirt. Can't wait.",
    "Sarge says the nuke's just for emergencies. What emergencies?",
    "Who trained the dingoes to salute? That's what I want to know.",
    'Reckon the roos know about the missile?',
  ],
};

let chatterT = 0;
function chatter(game, s, key, force = false) {
  if (game.cutscene) return;
  if (!s.alive && key !== 'mandown') return;
  const now = game.time;
  if (!force && now - chatterT < 5) return;
  const p = game.player;
  const b = s.body.pos;
  if (p && Math.hypot(p.body.pos.x - b.x, p.body.pos.z - b.z) > 40) return;
  chatterT = now;
  game.say('ODF GRUNT', pick(LINES[key]), { voice: 'soldier', dur: 2.5 });
}

export function buildSoldierModel(mat, variant = 'rifle', seed = 1) {
  const root = new THREE.Group();
  const hips = bone(root, 0, 0.95, 0);
  hips.add(meshOf([kit.box(0.34, 0.2, 0.22, camo(seed)), kit.box(0.36, 0.06, 0.24, VEST, { p: [0, 0.07, 0] }), kit.box(0.1, 0.1, 0.06, VEST, { p: [0.14, 0.02, 0.12] })], mat));
  const torso = bone(hips, 0, 0.08, 0);
  const torsoParts = [
    kit.box(0.4, 0.48, 0.24, camo(seed + 1), { p: [0, 0.26, 0] }),
    kit.box(0.44, 0.38, 0.3, VEST, { p: [0, 0.28, 0] }),
    kit.box(0.12, 0.12, 0.06, C('#4a4e38'), { p: [-0.11, 0.2, 0.17] }),
    kit.box(0.12, 0.12, 0.06, C('#4a4e38'), { p: [0.11, 0.2, 0.17] }),
    kit.box(0.26, 0.3, 0.1, C('#3f4430'), { p: [0, 0.3, -0.18] }),
  ];
  if (variant === 'commander') torsoParts.push(kit.box(0.1, 0.06, 0.02, C('#d8b030'), { p: [0.12, 0.42, 0.155] }));
  torso.add(meshOf(torsoParts, mat));
  const head = bone(torso, 0, 0.56, 0.02);
  const headParts = [];
  if (variant === 'commander') {
    headParts.push(
      kit.ball(0.11, 0.13, 0.12, SKIN, { p: [0, 0.08, 0] }, 8, 6),
      kit.ball(0.125, 0.04, 0.13, BERET, { p: [0.02, 0.18, -0.01], r: [0, 0, 0.2] }, 8, 4),
      kit.box(0.14, 0.03, 0.02, C('#111'), { p: [0, 0.1, 0.11] }),
      kit.box(0.09, 0.03, 0.03, C('#5a3a2a'), { p: [0, 0.02, 0.11] })
    );
  } else {
    headParts.push(
      kit.ball(0.12, 0.13, 0.13, MASK, { p: [0, 0.08, 0] }, 8, 6),
      kit.cyl(0.035, 0.035, 0.03, LENS, { p: [0.05, 0.11, 0.115], r: [Math.PI / 2, 0, 0] }, 8),
      kit.cyl(0.035, 0.035, 0.03, LENS, { p: [-0.05, 0.11, 0.115], r: [Math.PI / 2, 0, 0] }, 8),
      kit.cyl(0.04, 0.045, 0.08, C('#3c3f42'), { p: [0, 0.01, 0.14], r: [Math.PI / 2 - 0.4, 0, 0] }, 7),
      kit.ball(0.155, 0.1, 0.165, C('#4c5236'), { p: [0, 0.17, -0.01] }, 9, 5),
      kit.box(0.33, 0.02, 0.34, C('#4c5236'), { p: [0, 0.14, -0.01] })
    );
  }
  head.add(meshOf(headParts, mat));
  // arms holding the weapon in front
  const armR = bone(torso, 0.24, 0.44, 0.02);
  const armL = bone(torso, -0.24, 0.44, 0.02);
  armR.add(meshOf([kit.limb(0.06, 0.05, 0.3, camo(seed + 2), {}, 6), kit.limb(0.05, 0.045, 0.28, camo(seed + 3), { p: [0, -0.3, 0], r: [-1.3, 0, 0] }, 6), kit.ball(0.05, 0.05, 0.05, C('#2a2a26'), { p: [0, -0.32, 0.27] })], mat));
  armL.add(meshOf([kit.limb(0.06, 0.05, 0.3, camo(seed + 4), {}, 6), kit.limb(0.05, 0.045, 0.3, camo(seed + 5), { p: [0, -0.3, 0], r: [-1.45, 0, 0.35] }, 6), kit.ball(0.05, 0.05, 0.05, C('#2a2a26'), { p: [0.1, -0.31, 0.29] })], mat));
  armR.rotation.set(-0.35, 0, 0.12);
  armL.rotation.set(-0.5, 0, -0.35);
  const gunMount = bone(torso, 0.08, 0.2, 0.3);
  let gun;
  if (variant === 'shotgun') gun = buildWeaponModel('shotgun', mat);
  else {
    gun = new THREE.Group();
    gun.add(
      meshOf(
        [
          kit.box(0.05, 0.08, 0.4, C('#262829'), { p: [0, 0.03, 0.1] }),
          kit.box(0.04, 0.1, 0.05, C('#262829'), { p: [0, -0.05, 0.0], r: [-0.3, 0, 0] }),
          kit.box(0.035, 0.14, 0.05, C('#262829'), { p: [0, -0.06, 0.16], r: [0.2, 0, 0] }),
          kit.cyl(0.013, 0.013, 0.3, C('#1a1a1a'), { p: [0, 0.045, 0.43], r: [Math.PI / 2, 0, 0] }, 6),
          kit.box(0.02, 0.05, 0.12, C('#262829'), { p: [0, 0.1, 0.08] }),
          kit.box(0.05, 0.07, 0.24, C('#262829'), { p: [0, 0.0, -0.2] }),
        ],
        mat
      )
    );
    const mz = new THREE.Object3D();
    mz.position.set(0, 0.045, 0.6);
    gun.add(mz);
    gun.userData.muzzle = mz;
  }
  gunMount.add(gun);
  const legs = [];
  for (const s of [1, -1]) {
    const thigh = bone(hips, 0.1 * s, -0.05, 0);
    thigh.add(meshOf([kit.limb(0.09, 0.075, 0.45, camo(seed + 6 + s), {}, 6)], mat));
    const shin = bone(thigh, 0, -0.45, 0);
    shin.add(meshOf([kit.limb(0.07, 0.06, 0.42, camo(seed + 8 + s), {}, 6), kit.box(0.12, 0.1, 0.26, BOOT, { p: [0, -0.42, 0.05] })], mat));
    legs.push({ thigh, shin });
  }
  return { root, hips, torso, head, armR, armL, gunMount, gun, legs };
}

export class Soldier extends NPC {
  constructor(game, d) {
    super(game, d, { health: d.variant === 'commander' ? 140 : d.variant === 'shotgun' ? 70 : 60, fov: 0.3, sight: 50 });
    this.variant = d.variant || 'rifle';
    this.walkPhase = rand(0, 6);
    this.actionT = 0;
    this.action = 'none';
    this.burst = 0;
    this.burstT = 0;
    this.clip = this.variant === 'shotgun' ? 6 : 30;
    this.grenades = d.grenades ?? (this.variant === 'commander' ? 3 : 2);
    this.nextGrenade = rand(4, 8);
    this.reaction = 0;
    this.crouch = 0;
    this.crouching = false;
    this.aimPitch = 0;
    this.recoilK = 0;
    this.painK = 0;
    this.strafeDir = chance(0.5) ? 1 : -1;
    this.patrol = d.patrol || null;
    this.patrolIdx = 0;
    this.patrolWait = 0;
    this.idleLook = this.yaw;
    this.idleT = rand(2, 6);
    this.coverPos = null;
    this.investigate = null;
    this.idleChat = !!d.idleChat;
    this.chatDone = false;
    this.throwT = 0;
  }
  buildModel(mat) {
    return buildSoldierModel(mat, this.variant, (this.def.pos[0] * 7 + this.def.pos[2] * 3) | 0);
  }

  alertTo(pos, loud) {
    if (!this.alive) return;
    if (this.state === 'idle' || this.state === 'patrol') {
      this.state = 'hunt';
      this.investigate = pos.slice();
      if (!loud && chance(0.5)) chatter(this.game, this, 'hear');
    }
  }
  onPain(dmg, attacker, type) {
    this.painK = 1;
    this.flash();
    if (type === 'kick') {
      if (chance(0.5)) chatter(this.game, this, 'kicked', true);
    }
    if (this.health > 0) audio.play(chance(0.5) ? 'soldier_pain' : 'soldier_pain2', { pos: this.center(), volume: 0.9 });
    if (this.state !== 'combat') this.state = 'combat';
    // getting hurt makes cover attractive
    if (this.health < this.maxHealth * 0.5 && chance(0.4)) this.action = 'none';
  }
  onDeath(type) {
    if (type !== 'load') {
      audio.play('soldier_die', { pos: this.center(), volume: 1 });
      // nearby squadmates react
      const b = this.body.pos;
      for (const e of this.game.entities) {
        if (e instanceof Soldier && e !== this && e.alive && e.body.pos.distanceTo(b) < 25) {
          this.game.after(rand(0.4, 0.9), () => chatter(this.game, e, 'mandown'));
          break;
        }
      }
    }
  }

  spot() {
    const p = this.game.player;
    this.state = 'combat';
    this.reaction = rand(0.35, 0.7) / this.game.diff.aggression;
    this.warmup = 1.4; // first volley goes wide
    this.lastSeen = p.center();
    this.lastSeenTime = this.game.time;
    audio.play('soldier_alert', { pos: this.center(), volume: 0.8 });
    chatter(this.game, this, 'spot', true);
    // squad wakes up
    for (const e of this.game.entities) {
      if (e instanceof Soldier && e !== this && e.alive && (e.state === 'idle' || e.state === 'patrol') && e.body.pos.distanceTo(this.body.pos) < 22) {
        e.lastSeen = this.lastSeen.slice();
        e.lastSeenTime = this.game.time - 1;
        e.state = 'hunt';
        e.investigate = this.lastSeen.slice();
      }
    }
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) {
      this.deadT += dt;
      this._animDead(dt);
      this._sync(dt);
      return;
    }
    const p = g.player;
    const sees = this.look(dt);
    this.painK = Math.max(0, this.painK - dt * 4);
    this.recoilK = damp(this.recoilK, 0, 12, dt);
    if (this.warmup > 0 && this.reaction <= 0) this.warmup -= dt;

    // grenade avoidance overrides everything
    const gr = this.grenadeThreat();
    if (gr && this.state !== 'idle') {
      const b = this.body.pos;
      const away = [b.x - gr.pos.x, 0, b.z - gr.pos.z];
      const l = Math.hypot(away[0], away[2]) || 1;
      if (this.action !== 'flee') chatter(g, this, 'flee');
      this.action = 'flee';
      this.actionT = 1;
      this.crouching = false;
      this.steer([b.x + (away[0] / l) * 4, b.y, b.z + (away[2] / l) * 4], 5.5, dt, false);
      this.yaw = approachAngle(this.yaw, Math.atan2(away[0], away[2]), dt * 10);
    } else {
      switch (this.state) {
        case 'idle':
        case 'patrol':
          this._idle(dt, sees);
          break;
        case 'hunt':
          this._hunt(dt, sees);
          break;
        case 'combat':
          this._combat(dt, sees);
          break;
      }
    }
    this.physics(dt);
    this._animate(dt);
    this._sync(dt);
  }

  _idle(dt, sees) {
    const g = this.game, p = g.player;
    if (sees) return this.spot();
    if (this.patrol && this.patrol.length) {
      const t = this.patrol[this.patrolIdx];
      if (this.patrolWait > 0) {
        this.patrolWait -= dt;
        this.stop();
      } else if (this.navTo(t, 1.6, dt)) {
        this.patrolWait = rand(2, 4);
        this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
      }
    } else {
      this.stop();
      this.idleT -= dt;
      if (this.idleT <= 0) {
        this.idleT = rand(2.5, 6);
        this.idleLook = (this.def.yaw ?? 0) + rand(-0.9, 0.9);
      }
      this.yaw = approachAngle(this.yaw, this.idleLook, dt * 1.2);
    }
    // overheard banter when the roo sneaks close
    if (this.idleChat && !this.chatDone && p && p.alive) {
      const d = this.body.pos.distanceTo(p.body.pos);
      if (d < 14) {
        this.chatDone = true;
        g.say('ODF GRUNT', this.def.idleLine || pick(LINES.idle), { voice: 'soldier', dur: 4 });
      }
    }
  }

  _hunt(dt, sees) {
    const g = this.game;
    if (sees) return this.spot();
    const goal = this.investigate || this.lastSeen;
    if (!goal) {
      this.state = 'idle';
      return;
    }
    const done = this.navTo(goal, 3.2, dt);
    if (done || g.time - this.lastSeenTime > 20) {
      this.investigate = g.nav.randomNear(goal, 8);
      this.lastSeenTime = Math.min(this.lastSeenTime, g.time - 5);
      if (!this.investigate || chance(0.2)) {
        if (chance(0.5)) chatter(g, this, 'search');
        this.state = this.ambush ? 'idle' : 'hunt';
        if (!this.investigate) this.state = 'idle';
      }
    }
  }

  _combat(dt, sees) {
    const g = this.game, p = g.player;
    const b = this.body.pos;
    if (!p.alive) {
      this.stop();
      this.state = 'idle';
      return;
    }
    if (sees) {
      this.lastSeen = p.center();
      this.lastSeenTime = g.time;
    }
    if (this.reaction > 0) {
      this.reaction -= dt;
      this._faceTarget(dt, this.lastSeen);
      this.stop();
      return;
    }
    const lostFor = g.time - this.lastSeenTime;
    const target = this.lastSeen;
    const dist = Math.hypot(target[0] - b.x, target[2] - b.z);
    this.actionT -= dt;
    this.nextGrenade -= dt;

    if (this.actionT <= 0) this._chooseAction(sees, dist, lostFor);

    switch (this.action) {
      case 'shoot':
        this.stop();
        this._faceTarget(dt, target);
        if (sees) this._fire(dt, dist);
        break;
      case 'strafe': {
        const f = [target[0] - b.x, target[2] - b.z];
        const l = Math.hypot(f[0], f[1]) || 1;
        const side = [(-f[1] / l) * this.strafeDir, (f[0] / l) * this.strafeDir];
        this.steer([b.x + side[0] * 3, b.y, b.z + side[1] * 3], 3.2, dt, false);
        this._faceTarget(dt, target);
        if (sees) this._fire(dt, dist, 1.6);
        break;
      }
      case 'advance':
        this.navTo(target, 3.6, dt);
        if (sees) {
          this._faceTarget(dt, target);
          this._fire(dt, dist, 1.8);
        }
        break;
      case 'cover':
        if (this.coverPos) {
          const arrived = this.navTo(this.coverPos, 4.2, dt);
          if (arrived) {
            this.crouching = true;
            this.stop();
            this._faceTarget(dt, target);
          }
          if (sees && Math.random() < dt * 0.8) this._fire(dt, dist, 2);
        } else this.action = 'none';
        break;
      case 'hunt':
        this.crouching = false;
        if (this.navTo(target, 3.4, dt)) {
          this.state = 'hunt';
          this.investigate = g.nav.randomNear(target, 6) || target;
        }
        break;
      case 'grenade':
        this.stop();
        this._faceTarget(dt, target);
        this.throwT += dt;
        if (this.throwT > 0.45 && !this.thrown) {
          this.thrown = true;
          this._throw(target);
        }
        break;
      case 'flee':
        break;
      default:
        this.stop();
        this._faceTarget(dt, target);
    }
  }

  _chooseAction(sees, dist, lostFor) {
    const g = this.game;
    this.crouching = false;
    this.throwT = 0;
    this.thrown = false;
    const agg = g.diff.aggression;
    if (!sees) {
      if (this.grenades > 0 && this.nextGrenade <= 0 && lostFor < 6 && dist > 5 && dist < 20 && chance(0.35)) {
        this.action = 'grenade';
        this.actionT = 1.1;
        return;
      }
      if (lostFor > 1.5) {
        this.action = 'hunt';
        this.actionT = rand(2, 4);
        return;
      }
      this.action = 'none';
      this.actionT = rand(0.3, 0.8);
      return;
    }
    if (this.clip <= 0) {
      this.action = 'reload';
      this.actionT = 1.6;
      this.clip = this.variant === 'shotgun' ? 6 : 30;
      chatter(g, this, 'reload');
      audio.play('reload', { pos: this.center(), volume: 0.6 });
      return;
    }
    const hurt = this.health < this.maxHealth * 0.5;
    const r = Math.random();
    if (this.grenades > 0 && this.nextGrenade <= 0 && dist > 6 && dist < 22 && r < 0.18 * agg) {
      this.action = 'grenade';
      this.actionT = 1.1;
      return;
    }
    if ((hurt && r < 0.5) || r < 0.15) {
      this.coverPos = this._findCover();
      if (this.coverPos) {
        this.action = 'cover';
        this.actionT = rand(2.5, 4.5);
        chatter(g, this, 'cover');
        return;
      }
    }
    if (this.variant === 'shotgun' && dist > 7) {
      this.action = 'advance';
      this.actionT = rand(1.5, 3);
      return;
    }
    if (dist > 22 && r < 0.6) {
      this.action = 'advance';
      this.actionT = rand(1.5, 3);
      return;
    }
    if (r < 0.55) {
      this.action = 'shoot';
      this.crouching = chance(0.35);
      this.actionT = rand(1.0, 2.2);
    } else {
      this.action = 'strafe';
      this.strafeDir = chance(0.5) ? 1 : -1;
      this.actionT = rand(0.8, 1.6);
    }
  }

  _findCover() {
    const g = this.game, p = g.player;
    const b = this.body.pos;
    const pe = p.eye();
    let best = null, bd = 1e9;
    for (let i = 0; i < 14; i++) {
      const q = g.nav.randomNear([b.x, b.y, b.z], 9, 2);
      if (!q) continue;
      const e = [q[0], q[1] + 1.0, q[2]];
      if (g.world.visible(e, pe)) continue;
      const d = Math.hypot(q[0] - b.x, q[2] - b.z);
      // prefer nearby but not right next to the roo
      const dp = Math.hypot(q[0] - pe[0], q[2] - pe[2]);
      if (dp < 5) continue;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  _faceTarget(dt, t) {
    const b = this.body.pos;
    const dx = t[0] - b.x, dz = t[2] - b.z;
    this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), dt * 6);
    const dy = t[1] - (b.y + 1.4);
    this.aimPitch = damp(this.aimPitch, Math.atan2(dy, Math.hypot(dx, dz)), 8, dt);
  }

  _fire(dt, dist, spreadMul = 1) {
    const g = this.game, p = g.player;
    this.burstT -= dt;
    if (this.burstT > 0) return;
    const b = this.body.pos;
    const t = p.center();
    // only shoot when roughly facing the target
    const want = Math.atan2(t[0] - b.x, t[2] - b.z);
    if (Math.abs(wrapAngle(want - this.yaw)) > 0.35) return;
    if (this.clip <= 0) {
      this.actionT = 0;
      return;
    }
    const shotgun = this.variant === 'shotgun';
    if (this.burst <= 0) this.burst = shotgun ? 1 : this.variant === 'commander' ? 5 : 3;
    this.burst--;
    this.clip--;
    this.burstT = this.burst > 0 ? 0.1 : shotgun ? rand(0.9, 1.3) : rand(0.5, 1.1) / g.diff.aggression;
    const muzzle = this._muzzle();
    const pv = p.body.vel;
    const pspeed = Math.hypot(pv.x, pv.z) + Math.abs(pv.y) * 0.5;
    let spread = (shotgun ? 0.09 : 0.045) * spreadMul;
    spread *= 1 + pspeed / 7;
    spread *= 1 + dist / 40;
    spread /= g.diff.accuracy;
    if (this.crouching) spread *= 0.8;
    if (this.warmup > 0) spread *= 2.4;
    const pellets = shotgun ? 6 : 1;
    const dmg = shotgun ? 5 : this.variant === 'commander' ? 6 : 4;
    const o = this._shootOrigin();
    for (let i = 0; i < pellets; i++) {
      const dir = [t[0] - o[0] + rand(-1, 1) * spread * dist, t[1] - o[1] + rand(-1, 1) * spread * dist * 0.7, t[2] - o[2] + rand(-1, 1) * spread * dist];
      const l = Math.hypot(...dir);
      g.bullet(o, [dir[0] / l, dir[1] / l, dir[2] / l], 90, dmg, this, { tracer: i === 0, tracerFrom: muzzle });
    }
    g.fx.muzzle(muzzle, shotgun ? 1.3 : 0.9);
    audio.play(shotgun ? 'shotgun' : 'rifle', { pos: muzzle, volume: 0.9 });
    this.recoilK = 1;
  }
  _shootOrigin() {
    const b = this.body.pos;
    const f = this.forward();
    return [b.x + f[0] * 0.4, b.y + (this.crouching ? 0.95 : 1.4), b.z + f[2] * 0.4];
  }
  _muzzle() {
    const mz = this.model.gun.userData.muzzle;
    if (mz) {
      const v = new THREE.Vector3();
      mz.getWorldPosition(v);
      return [v.x, v.y, v.z];
    }
    return this._shootOrigin();
  }
  _throw(target) {
    const g = this.game;
    this.grenades--;
    this.nextGrenade = rand(8, 14);
    chatter(g, this, 'grenade', true);
    const o = this._shootOrigin();
    o[1] += 0.3;
    const dx = target[0] - o[0], dz = target[2] - o[2];
    const dh = Math.hypot(dx, dz);
    const tFlight = clamp(dh / 12, 0.6, 1.6);
    const vel = [dx / tFlight, (target[1] - o[1] + 0.5 * 16 * tFlight * tFlight) / tFlight, dz / tFlight];
    g.spawnEntity({ type: 'grenade', pos: o, vel, owner: this, fuse: tFlight + rand(0.9, 1.5), damage: 70 });
    audio.play('swing', { pos: o, volume: 0.6 });
  }
  onStuck() {
    if (this.action === 'strafe') this.strafeDir *= -1;
    else if (this.action === 'cover') this.action = 'none';
  }

  // --- animation ---------------------------------------------------------
  _animate(dt) {
    const m = this.model;
    const b = this.body;
    const sp = Math.hypot(b.vel.x, b.vel.z);
    this.walkPhase += dt * sp * 2.6;
    const k = Math.min(1, sp / 2.5);
    this.crouch = damp(this.crouch, this.crouching ? 1 : 0, 10, dt);
    // movement relative to facing for leg direction
    const f = this.forward();
    const fwdComp = sp > 0.1 ? (b.vel.x * f[0] + b.vel.z * f[2]) / sp : 1;
    const dirSign = fwdComp < -0.3 ? -1 : 1;
    for (let i = 0; i < 2; i++) {
      const ph = this.walkPhase + i * Math.PI;
      const L = m.legs[i];
      const swing = Math.sin(ph) * 0.6 * k * dirSign;
      const knee = Math.max(0, -Math.cos(ph)) * 0.9 * k;
      L.thigh.rotation.x = -swing - this.crouch * (i === 0 ? 1.5 : 0.2);
      L.shin.rotation.x = knee + this.crouch * (i === 0 ? 1.6 : 1.9);
    }
    m.hips.position.y = 0.95 - this.crouch * 0.42 + Math.abs(Math.sin(this.walkPhase)) * 0.03 * k;
    m.hips.position.z = -this.crouch * 0.12;
    m.root.rotation.set(0, this.yaw, 0);
    const lean = this.action === 'grenade' ? Math.sin(Math.min(1, this.throwT / 0.6) * Math.PI) * -0.5 : 0;
    m.torso.rotation.x = -this.aimPitch * 0.7 + this.recoilK * -0.06 + this.painK * 0.15 + lean + k * 0.08;
    m.torso.rotation.y = this.painK * 0.2;
    m.head.rotation.x = -this.aimPitch * 0.3;
    m.gunMount.position.z = 0.3 - this.recoilK * 0.05;
    // grenade throw arm
    if (this.action === 'grenade') {
      const tk = Math.min(1, this.throwT / 0.6);
      m.armR.rotation.x = -0.35 - Math.sin(tk * Math.PI) * 2.2;
    } else m.armR.rotation.x = damp(m.armR.rotation.x, -0.35, 10, dt);
  }
  _animDead(dt) {
    const m = this.model;
    const k = Math.min(1, this.deadT / 0.6);
    const e = k < 1 ? 1 - (1 - k) * (1 - k) : 1;
    // fall away from the hit direction
    const d = this.deathDir || [0, 0, 1];
    const f = this.forward();
    const back = d[0] * f[0] + d[2] * f[2] > 0 ? -1 : 1;
    m.root.rotation.set(back * -e * (Math.PI / 2 - 0.1), this.yaw, 0, 'YXZ');
    m.root.position.y = this.body.pos.y + e * 0.12;
    m.armR.rotation.x = -1.5 * e;
    m.armL.rotation.x = -1.2 * e;
    for (const L of m.legs) {
      L.thigh.rotation.x = 0.2 * e;
      L.shin.rotation.x = 0.3 * e;
    }
    m.hips.position.y = 0.95;
    // physics while dying
    const b = this.body;
    if (this.deadT < 2) {
      b.vel.x *= 0.9;
      b.vel.z *= 0.9;
      b.vel.y -= 20 * dt;
      b.height = 0.4;
      this.speed = 0;
      moveBody(this.game.world, b, dt);
    }
  }
  _sync(dt) {
    super._sync(dt);
    if (!this.alive) this.mesh.position.y = this.body.pos.y + (this.model.root.rotation.x ? 0.12 : 0);
  }
}
