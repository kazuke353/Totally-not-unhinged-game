// First-person view model: furry kangaroo forearms holding the current
// weapon, rendered in a separate pass so it never clips into walls.
// Camera space: +X right, +Y up, -Z forward.
import * as THREE from 'three';
import { kit, C, meshOf, bone, entityMaterial } from './modelkit.js';
import { buildWeaponModel } from './weaponmodels.js';
import { damp, clamp } from '../engine/util.js';

const FUR = C('#a85a30');
const FUR_D = C('#7c3f20');
const PAW = C('#4a2c1c');
const SUIT = C('#e2761a');
const SUIT_D = C('#34373b');
const GLOVE = C('#c81e14');
const FWD = new THREE.Vector3(0, 0, -1);
const _d = new THREE.Vector3();

// where each weapon sits and where the paws grab it (camera space)
const POSES = {
  fists: { mount: [0, 0, 0], r: [0.21, -0.2, -0.42], l: [-0.21, -0.22, -0.4] },
  pistol: { mount: [0.12, -0.2, -0.46], r: [0.12, -0.25, -0.44], l: [0.08, -0.27, -0.42] },
  smg: { mount: [0.14, -0.17, -0.38], r: [0.14, -0.23, -0.36], l: [0.1, -0.22, -0.68] },
  shotgun: { mount: [0.14, -0.17, -0.36], r: [0.14, -0.24, -0.34], l: [0.12, -0.21, -0.74] },
  rpg: { mount: [0.26, -0.2, -0.12], r: [0.26, -0.27, -0.12], l: [0.22, -0.27, -0.42], scale: 0.85 },
  grenade: { mount: [0.18, -0.2, -0.38], r: [0.18, -0.24, -0.36], l: [-0.2, -0.3, -0.36] },
};

export class ViewModel {
  constructor(game) {
    this.game = game;
    this.mat = entityMaterial(game.shared);
    this.root = new THREE.Group();
    this.sway = new THREE.Group();
    this.root.add(this.sway);
    game.vmScene.add(this.root);
    this.arms = [];
    for (const s of [1, -1]) {
      const shoulder = new THREE.Vector3(0.26 * s, -0.48, 0.12);
      const arm = bone(this.sway);
      // unit length forearm along -Z, scaled to reach the hand target
      const g = new THREE.Group();
      g.add(
        meshOf(
          [
            kit.cyl(0.055, 0.075, 1, FUR, { p: [0, 0, -0.5], r: [Math.PI / 2, 0, 0] }, 8),
            kit.cyl(0.08, 0.085, 0.18, SUIT, { p: [0, 0, -0.09], r: [Math.PI / 2, 0, 0] }, 8),
            kit.cyl(0.086, 0.086, 0.03, SUIT_D, { p: [0, 0, -0.18], r: [Math.PI / 2, 0, 0] }, 8),
          ],
          this.mat
        )
      );
      arm.add(g);
      const paw = bone(this.sway);
      paw.add(
        meshOf(
          [
            kit.ball(0.055, 0.045, 0.065, PAW),
            kit.cone(0.011, 0.045, C('#1a1210'), { p: [0.022, -0.025, -0.055], r: [-Math.PI / 2, 0, 0] }, 4),
            kit.cone(0.011, 0.045, C('#1a1210'), { p: [-0.022, -0.025, -0.055], r: [-Math.PI / 2, 0, 0] }, 4),
            kit.ball(0.02, 0.03, 0.03, FUR_D, { p: [0.05 * s, 0.01, -0.02] }, 5, 4),
          ],
          this.mat
        )
      );
      const glove = meshOf([kit.ball(0.09, 0.082, 0.1, GLOVE, { p: [0, 0, -0.03] }, 9, 7), kit.cyl(0.062, 0.066, 0.06, C('#f0f0f0'), { p: [0, 0, 0.06], r: [Math.PI / 2, 0, 0] }, 9), kit.ball(0.035, 0.035, 0.035, GLOVE, { p: [0.07 * s, -0.01, -0.02] }, 6, 4)], this.mat);
      paw.add(glove);
      this.arms.push({ s, shoulder, arm, paw, glove, target: new THREE.Vector3() });
    }
    // a big hind foot for kicks
    this.foot = bone(this.sway);
    this.foot.add(meshOf([kit.box(0.2, 0.12, 0.8, FUR, { p: [0, 0, -0.35] }), kit.box(0.16, 0.1, 0.18, PAW, { p: [0, -0.01, -0.8] }), kit.cone(0.02, 0.07, C('#1a1210'), { p: [0, -0.02, -0.92], r: [-Math.PI / 2, 0, 0] }, 4)], this.mat));
    this.foot.visible = false;
    this.weaponMount = bone(this.sway);
    this.weapons = {};
    this.id = 'fists';
    this.t = 0;
    this.bob = 0;
    this.recoilK = 0;
    this.landK = 0;
    this.act = null;
    this.actT = 0;
    this.actDur = 1;
    this.lastYaw = 0;
    this.lastPitch = 0;
    this.swayV = new THREE.Vector2();
    this.root.visible = false;
  }
  destroy() {
    this.game.vmScene.remove(this.root);
  }
  visible(v) {
    this.root.visible = v;
  }
  setLight(L) {
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.7 + 0.14, L[1] * 0.7 + 0.13, L[2] * 0.7 + 0.12);
    this.mat.uniforms.uDirCol.value.set(L[0] * 0.4 + 0.05, L[1] * 0.4 + 0.05, L[2] * 0.4 + 0.05);
    this.mat.uniforms.uDir.value.set(0.3, 0.8, 0.5).normalize();
  }
  setWeapon(id) {
    for (const w of Object.values(this.weapons)) w.visible = false;
    if (!this.weapons[id] && id !== 'fists') {
      const w = buildWeaponModel(id, this.mat);
      w.rotation.y = Math.PI; // models point +Z, the view looks down -Z
      w.scale.setScalar((POSES[id] && POSES[id].scale) || 1.25);
      this.weaponMount.add(w);
      this.weapons[id] = w;
    }
    if (this.weapons[id]) this.weapons[id].visible = true;
    this.id = id;
    for (const a of this.arms) a.glove.visible = id === 'fists';
  }
  action(name, dur) {
    this.act = name;
    this.actT = 0;
    this.actDur = dur;
  }
  recoil(k) {
    this.recoilK = Math.min(2, this.recoilK + k);
  }
  land(k) {
    this.landK = Math.max(this.landK, k);
  }
  muzzleWorld(renderer, player) {
    const e = player.eye();
    const f = player.forwardVec(new THREE.Vector3());
    const r = player.rightVec();
    return [e[0] + f.x * 0.7 + r[0] * 0.14, e[1] + f.y * 0.7 - 0.14, e[2] + f.z * 0.7 + r[2] * 0.14];
  }
  _reach(A) {
    const t = A.target;
    _d.subVectors(t, A.shoulder);
    const len = _d.length();
    _d.divideScalar(len || 1);
    A.arm.position.copy(A.shoulder);
    A.arm.quaternion.setFromUnitVectors(FWD, _d);
    A.arm.scale.set(1, 1, len);
    A.paw.position.copy(t);
    A.paw.quaternion.copy(A.arm.quaternion);
  }
  update(dt, p) {
    if (!this.root.visible) return;
    this.t += dt;
    if (this.act) {
      this.actT += dt;
      if (this.actT > this.actDur) this.act = null;
    }
    const speed = p.speedH();
    const ground = p.body.onGround;
    this.bob += dt * clamp(1.2 + speed * 0.2, 1.4, 2.7) * (ground && speed > 0.5 ? 1 : 0);
    const bobAmt = ground ? Math.min(1, speed / 6) : 0;
    const by = Math.abs(Math.sin(this.bob * Math.PI)) * 0.03 * bobAmt;
    const bx = Math.sin(this.bob * Math.PI) * 0.012 * bobAmt;
    this.recoilK = damp(this.recoilK, 0, 12, dt);
    this.landK = damp(this.landK, 0, 8, dt);
    const dy = p.yaw - this.lastYaw, dp = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw;
    this.lastPitch = p.pitch;
    this.swayV.x = damp(this.swayV.x, clamp(dy * 1.5, -0.05, 0.05), 8, dt);
    this.swayV.y = damp(this.swayV.y, clamp(dp * 1.5, -0.05, 0.05), 8, dt);
    const breathe = Math.sin(this.t * 1.6) * 0.004;
    const air = ground ? 0 : clamp(-p.body.vel.y * 0.004, -0.03, 0.03);
    this.sway.position.set(bx + this.swayV.x, -by + breathe - this.landK * 0.05 - this.swayV.y * 0.5 + air, this.recoilK * 0.05);
    this.sway.rotation.set(this.recoilK * 0.1, this.swayV.x * 0.5, 0);
    const k = this.act ? this.actT / this.actDur : 0;
    let lower = 0;
    if (this.act === 'switch') lower = Math.sin(k * Math.PI) * 0.35;
    if (this.act === 'reload') lower = Math.sin(k * Math.PI) * 0.1;
    this.root.position.set(0, -lower, 0);

    const pose = POSES[this.id] || POSES.pistol;
    this.weaponMount.position.set(...pose.mount);
    this.weaponMount.rotation.set(0, 0, this.act === 'reload' ? Math.sin(k * Math.PI) * 0.7 : 0);
    const [R, Lf] = this.arms;
    R.target.set(...pose.r);
    Lf.target.set(...pose.l);
    if (this.id === 'fists') {
      // boxing guard, with a jab on punch
      R.target.y += Math.sin(this.t * 3) * 0.008;
      Lf.target.y -= Math.sin(this.t * 3) * 0.008;
      if (this.act === 'punch') {
        const jab = Math.sin(Math.min(1, k * 1.6) * Math.PI);
        const A = p.weapons.punchSide > 0 ? R : Lf;
        A.target.z -= jab * 0.3;
        A.target.x *= 1 - jab * 0.7;
        A.target.y += jab * 0.06;
      }
    } else if (this.act === 'reload') {
      Lf.target.y -= Math.sin(k * Math.PI) * 0.12;
      Lf.target.z += Math.sin(k * Math.PI) * 0.15;
    }
    if (this.act === 'throw') {
      const tk = Math.sin(Math.min(1, k * 1.3) * Math.PI);
      R.target.set(0.2, -0.1 + tk * 0.15, -0.3 - tk * 0.25);
    }
    if (this.act === 'kick') {
      // paws go up for balance while the foot swings up from below
      R.target.y += 0.05;
      Lf.target.y += 0.05;
    }
    this._reach(R);
    this._reach(Lf);
    this.foot.visible = this.act === 'kick';
    if (this.foot.visible) {
      const kk = Math.sin(Math.min(1, k * 1.5) * Math.PI);
      this.foot.position.set(0.02, -0.95 + kk * 0.68, -0.2 - kk * 0.25);
      this.foot.rotation.set(0.5 - kk * 0.55, 0, 0);
    }
    const vc = this.game.app.renderer.vmCamera;
    vc.position.set(0, 0, 0);
    vc.rotation.set(0, 0, 0);
  }
}
