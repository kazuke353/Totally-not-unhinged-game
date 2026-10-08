// Military dingo: fast melee pack hunter with a little tactical harness.
import * as THREE from 'three';
import { NPC } from './npc.js';
import { kit, C, meshOf, bone } from '../modelkit.js';
import { audio } from '../../engine/audio.js';
import { moveBody } from '../../engine/physics.js';
import { approachAngle, clamp, damp, rand, chance } from '../../engine/util.js';

const FUR = C('#c98a48');
const FUR_L = C('#ecd9b4');
const FUR_D = C('#8a5a2c');
const HARNESS = C('#3c4230');
const NOSE = C('#151210');

function buildDingo(mat) {
  const root = new THREE.Group();
  const body = bone(root, 0, 0.55, 0);
  body.add(
    meshOf(
      [
        kit.ball(0.17, 0.17, 0.42, (x, y) => (y < -0.06 ? FUR_L : FUR), { p: [0, 0, 0] }, 9, 6),
        kit.ball(0.18, 0.12, 0.2, HARNESS, { p: [0, 0.04, 0.12] }, 8, 5),
        kit.box(0.08, 0.06, 0.1, C('#2a2e22'), { p: [0.15, 0.02, 0.1] }),
        kit.box(0.08, 0.06, 0.1, C('#2a2e22'), { p: [-0.15, 0.02, 0.1] }),
      ],
      mat
    )
  );
  const head = bone(body, 0, 0.14, 0.42);
  head.add(
    meshOf(
      [
        kit.ball(0.12, 0.11, 0.13, FUR, { p: [0, 0.02, 0] }, 8, 6),
        kit.ball(0.06, 0.055, 0.13, (x, y) => (y < -0.01 ? FUR_L : FUR), { p: [0, -0.02, 0.15] }, 7, 5),
        kit.ball(0.025, 0.02, 0.02, NOSE, { p: [0, 0.0, 0.27] }, 5, 4),
        kit.cone(0.05, 0.12, FUR, { p: [0.065, 0.13, -0.02], s: [1, 1, 0.5] }, 5),
        kit.cone(0.05, 0.12, FUR, { p: [-0.065, 0.13, -0.02], s: [1, 1, 0.5] }, 5),
        kit.ball(0.016, 0.016, 0.012, NOSE, { p: [0.05, 0.06, 0.1] }, 5, 3),
        kit.ball(0.016, 0.016, 0.012, NOSE, { p: [-0.05, 0.06, 0.1] }, 5, 3),
        kit.cyl(0.075, 0.08, 0.04, C('#7a1a14'), { p: [0, -0.07, -0.06], r: [0.4, 0, 0] }, 8),
      ],
      mat
    )
  );
  const jaw = bone(head, 0, -0.06, 0.08);
  jaw.add(meshOf([kit.box(0.08, 0.025, 0.14, FUR_L, { p: [0, 0, 0.06] })], mat));
  const legs = [];
  for (const [x, z] of [[0.1, 0.3], [-0.1, 0.3], [0.1, -0.3], [-0.1, -0.3]]) {
    const upper = bone(body, x, -0.05, z);
    upper.add(meshOf([kit.limb(0.05, 0.035, 0.3, FUR, {}, 5)], mat));
    const lower = bone(upper, 0, -0.3, 0);
    lower.add(meshOf([kit.limb(0.032, 0.028, 0.22, FUR_D, {}, 5), kit.box(0.06, 0.04, 0.08, FUR_D, { p: [0, -0.22, 0.02] })], mat));
    legs.push({ upper, lower, front: z > 0 });
  }
  const tail = bone(body, 0, 0.08, -0.4);
  tail.add(meshOf([kit.limb(0.05, 0.03, 0.35, FUR, { r: [-2.2, 0, 0] }, 6), kit.ball(0.04, 0.04, 0.06, FUR_L, { p: [0, 0.2, -0.28] }, 5, 4)], mat));
  return { root, body, head, jaw, legs, tail };
}

export class Dingo extends NPC {
  constructor(game, d) {
    super(game, d, { health: 35, half: 0.28, height: 0.8, fov: -0.2, sight: 35 });
    this.biteT = 0;
    this.leapT = 0;
    this.leaping = false;
    this.phase = rand(0, 6);
    this.barkT = rand(1, 3);
    this.circleT = 0;
    this.circleDir = chance(0.5) ? 1 : -1;
    this.sleeping = !!d.sleeping;
    this.bloodColor = [0.5, 0.03, 0.02];
  }
  buildModel(mat) {
    return buildDingo(mat);
  }
  getHitboxes() {
    if (!this.alive) return null;
    const b = this.body.pos;
    const f = this.forward();
    const dy = this.sleeping ? 0.3 : 0; // curled up on the ground
    return [
      { min: [b.x + f[0] * 0.45 - 0.13, b.y + 0.5 - dy, b.z + f[2] * 0.45 - 0.13], max: [b.x + f[0] * 0.45 + 0.13, b.y + 0.82 - dy, b.z + f[2] * 0.45 + 0.13], group: 'head' },
      { min: [b.x - 0.32, b.y + Math.max(0.02, 0.2 - dy), b.z - 0.32], max: [b.x + 0.32, b.y + 0.75 - dy, b.z + 0.32], group: 'body' },
    ];
  }
  alertTo(pos) {
    if (!this.alive) return;
    if (this.state === 'idle') {
      this.sleeping = false;
      this.state = 'combat';
      this.lastSeen = pos.slice();
      audio.play('dingo_howl', { pos: this.center(), volume: 0.8, ref: 6 });
    }
  }
  onPain(dmg, attacker, type) {
    this.flash();
    audio.play('dingo_yelp', { pos: this.center(), volume: 0.9 });
    this.sleeping = false;
    if (this.state !== 'combat') this.state = 'combat';
    if (type === 'kick') this.circleT = 1.2;
  }
  onDeath(type) {
    if (type !== 'load') audio.play('dingo_yelp', { pos: this.center(), volume: 1, rate: 0.7 });
  }
  update(dt) {
    const g = this.game;
    if (!this.alive) {
      this.deadT += dt;
      const m = this.model;
      const k = Math.min(1, this.deadT / 0.4);
      m.root.rotation.set(0, this.yaw, k * 1.5, 'YXZ');
      m.root.position.y = this.body.pos.y + k * 0.15;
      if (this.deadT < 2) {
        const b = this.body;
        b.vel.x *= 0.9;
        b.vel.z *= 0.9;
        b.vel.y -= 20 * dt;
        moveBody(g.world, b, dt);
        this.mesh.position.x = b.pos.x;
        this.mesh.position.z = b.pos.z;
      }
      return;
    }
    const p = g.player;
    const sees = this.sleeping ? false : this.look(dt);
    const b = this.body.pos;
    this.biteT -= dt;
    this.leapT -= dt;
    if (this.state === 'idle') {
      this.stop();
      if (sees) {
        this.state = 'combat';
        audio.play('dingo_bark', { pos: this.center(), volume: 1 });
      }
      // sleeping dingoes wake up if you get too close
      if (this.sleeping && p.alive && b.distanceTo(p.body.pos) < (p.crouched ? 2.5 : 6)) {
        this.sleeping = false;
        this.alertTo(p.center());
      }
    } else if (this.state === 'combat') {
      if (!p.alive) {
        this.stop();
        this.state = 'idle';
      } else {
        if (sees) {
          this.lastSeen = p.center();
          this.lastSeenTime = g.time;
        }
        const target = sees ? p.center() : this.lastSeen || p.center();
        const dist = Math.hypot(target[0] - b.x, target[2] - b.z);
        this.barkT -= dt;
        if (this.barkT <= 0) {
          this.barkT = rand(1.5, 3.5);
          audio.play(chance(0.6) ? 'dingo_bark' : 'dingo_growl', { pos: this.center(), volume: 0.9 });
        }
        if (this.circleT > 0) {
          // back off and circle after a kick / bite
          this.circleT -= dt;
          const dx = b.x - target[0], dz = b.z - target[2];
          const l = Math.hypot(dx, dz) || 1;
          const side = [-dz / l * this.circleDir, dx / l * this.circleDir];
          this.steer([b.x + (dx / l + side[0]) * 3, b.y, b.z + (dz / l + side[1]) * 3], 6, dt, false);
          this.yaw = approachAngle(this.yaw, Math.atan2(target[0] - b.x, target[2] - b.z), dt * 6);
        } else if (dist < 1.3 && Math.abs(target[1] - (b.y + 0.4)) < 1.5) {
          this.stop();
          this.yaw = approachAngle(this.yaw, Math.atan2(target[0] - b.x, target[2] - b.z), dt * 12);
          if (this.biteT <= 0) this._bite();
        } else if (dist < 4.5 && dist > 2.2 && this.leapT <= 0 && this.body.onGround && sees && chance(dt * 3)) {
          // pounce!
          const dx = target[0] - b.x, dz = target[2] - b.z;
          this.body.vel.set((dx / dist) * 9, 5.2, (dz / dist) * 9);
          this.body.onGround = false;
          this.leaping = true;
          this.leapT = 2.5;
          audio.play('dingo_growl', { pos: this.center(), volume: 1, rate: 1.3 });
        } else if (!this.leaping) {
          this.navTo(target, 7.8, dt);
          if (sees) this.yaw = approachAngle(this.yaw, Math.atan2(target[0] - b.x, target[2] - b.z), dt * 5);
        }
        if (this.leaping) {
          this.speed = 0;
          this.wish = null;
          const pc = p.center();
          if (Math.hypot(pc[0] - b.x, pc[2] - b.z) < 1.1 && this.biteT <= 0) this._bite(true);
        }
      }
    }
    if (this.leaping) {
      // free flight
      const bb = this.body;
      bb.vel.y -= 20 * dt;
      moveBody(g.world, bb, dt);
      if (bb.onGround) this.leaping = false;
    } else this.physics(dt);
    this._animate(dt);
    this._sync(dt);
  }
  _bite(leap) {
    const g = this.game, p = g.player;
    this.biteT = leap ? 1.2 : 0.85;
    audio.play('dingo_bite', { pos: this.center(), volume: 1 });
    const pc = p.center();
    const b = this.body.pos;
    if (Math.hypot(pc[0] - b.x, pc[2] - b.z) < 1.6) {
      const dir = [pc[0] - b.x, 0, pc[2] - b.z];
      const l = Math.hypot(dir[0], dir[2]) || 1;
      p.damage(leap ? 14 : 10, [dir[0] / l, 0, dir[2] / l], this, 'body', 'bite');
      g.fx.blood(pc, [0, 0, 0], 0.3);
      if (chance(0.4)) this.circleT = rand(0.6, 1.2);
    }
    this.biteAnim = 0.25;
  }
  _animate(dt) {
    const m = this.model, b = this.body;
    const sp = Math.hypot(b.vel.x, b.vel.z);
    const running = sp > 3;
    this.phase += dt * (running ? 13 : 7) * Math.min(1, sp / 2 + 0.05);
    const k = Math.min(1, sp / 4);
    m.root.rotation.set(0, this.yaw, 0);
    if (this.sleeping) {
      m.body.position.y = 0.22;
      for (const L of m.legs) {
        L.upper.rotation.x = L.front ? -1.4 : 1.3;
        L.lower.rotation.x = 0;
      }
      m.head.rotation.x = 0.4;
      m.tail.rotation.x = 0.2;
      return;
    }
    m.body.position.y = 0.55 + Math.abs(Math.sin(this.phase)) * 0.06 * k;
    m.body.rotation.x = this.leaping ? -0.3 : Math.sin(this.phase * 2) * 0.05 * k;
    m.legs.forEach((L, i) => {
      const off = (L.front ? 0 : Math.PI) + (i % 2 ? 0.6 : 0);
      if (this.leaping) {
        L.upper.rotation.x = L.front ? -1.1 : 1.0;
        L.lower.rotation.x = 0.3;
      } else {
        L.upper.rotation.x = Math.sin(this.phase + off) * 0.8 * k;
        L.lower.rotation.x = Math.max(0, Math.cos(this.phase + off)) * 0.7 * k;
      }
    });
    this.biteAnim = Math.max(0, (this.biteAnim || 0) - dt);
    m.jaw.rotation.x = this.biteAnim > 0 ? 0.6 : this.state === 'combat' ? 0.25 + Math.sin(this.phase * 0.5) * 0.1 : 0.05;
    m.head.rotation.x = this.biteAnim > 0 ? -0.3 : 0;
    m.tail.rotation.x = Math.sin(this.phase * 0.5) * 0.3;
  }
}
