// First-person view model: furry kangaroo forearms holding the current
// weapon, rendered in a separate pass so it never clips into walls.
import * as THREE from 'three';
import { kit, C, meshOf, bone, entityMaterial } from './modelkit.js';
import { buildWeaponModel } from './weaponmodels.js';
import { damp, clamp } from '../engine/util.js';

const FUR = C('#a85a30');
const PAW = C('#4a2c1c');
const SUIT = C('#e2761a');
const GLOVE = C('#c81e14');

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
      const arm = bone(this.sway);
      arm.add(
        meshOf(
          [
            kit.limb(0.07, 0.055, 0.5, FUR, { r: [Math.PI / 2, 0, 0] }, 7),
            kit.cyl(0.075, 0.08, 0.12, SUIT, { p: [0, 0, -0.05], r: [Math.PI / 2, 0, 0] }, 8),
          ],
          this.mat
        )
      );
      const paw = bone(arm, 0, 0, 0.5);
      paw.add(meshOf([kit.ball(0.06, 0.05, 0.07, PAW), kit.cone(0.012, 0.05, C('#1a1210'), { p: [0.02, -0.03, 0.06], r: [Math.PI / 2, 0, 0] }, 4), kit.cone(0.012, 0.05, C('#1a1210'), { p: [-0.02, -0.03, 0.06], r: [Math.PI / 2, 0, 0] }, 4)], this.mat));
      const glove = meshOf([kit.ball(0.11, 0.1, 0.12, GLOVE), kit.cyl(0.07, 0.075, 0.07, C('#f0f0f0'), { p: [0, 0, -0.1], r: [Math.PI / 2, 0, 0] }, 8)], this.mat);
      paw.add(glove);
      this.arms.push({ s, arm, paw, glove });
    }
    // a big foot for kicks
    this.foot = bone(this.sway);
    this.foot.add(meshOf([kit.box(0.16, 0.1, 0.7, FUR, { p: [0, 0, 0.3] }), kit.box(0.12, 0.08, 0.16, PAW, { p: [0, 0, 0.7] })], this.mat));
    this.foot.visible = false;
    this.weaponMount = bone(this.sway, 0.12, -0.14, -0.35);
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
    this.mat.uniforms.uAmbient.value.set(L[0] * 0.7 + 0.12, L[1] * 0.7 + 0.12, L[2] * 0.7 + 0.12);
    this.mat.uniforms.uDirCol.value.set(L[0] * 0.4, L[1] * 0.4, L[2] * 0.4);
  }
  setWeapon(id) {
    for (const w of Object.values(this.weapons)) w.visible = false;
    if (!this.weapons[id] && id !== 'fists') {
      const w = buildWeaponModel(id, this.mat);
      w.scale.setScalar(1.6);
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
    // project the view model muzzle into the world: just use the eye + forward
    const e = player.eye();
    const f = player.forwardVec(new THREE.Vector3());
    const r = player.rightVec();
    return [e[0] + f.x * 0.6 + r[0] * 0.12, e[1] + f.y * 0.6 - 0.12, e[2] + f.z * 0.6 + r[2] * 0.12];
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
    const by = Math.abs(Math.sin(this.bob * Math.PI)) * 0.035 * bobAmt;
    const bx = Math.sin(this.bob * Math.PI) * 0.015 * bobAmt;
    this.recoilK = damp(this.recoilK, 0, 12, dt);
    this.landK = damp(this.landK, 0, 8, dt);
    // sway from mouse
    const dy = p.yaw - this.lastYaw, dp = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw;
    this.lastPitch = p.pitch;
    this.swayV.x = damp(this.swayV.x, clamp(dy * 2, -0.08, 0.08), 8, dt);
    this.swayV.y = damp(this.swayV.y, clamp(dp * 2, -0.08, 0.08), 8, dt);
    const breathe = Math.sin(this.t * 1.6) * 0.004;
    this.sway.position.set(bx + this.swayV.x, -by + breathe - this.landK * 0.06 + this.swayV.y * -0.5, this.recoilK * 0.06);
    this.sway.rotation.set(this.recoilK * 0.12, 0, 0);
    let lower = 0;
    const k = this.act ? this.actT / this.actDur : 0;
    if (this.act === 'switch') lower = Math.sin(k * Math.PI) * 0.35;
    if (this.act === 'reload') lower = Math.sin(k * Math.PI) * 0.12;
    this.root.position.set(0, -lower, 0);
    this.weaponMount.rotation.set(0, 0, this.act === 'reload' ? Math.sin(k * Math.PI) * 0.6 : 0);
    // arms
    const fists = this.id === 'fists';
    const [R, L] = this.arms;
    if (fists) {
      R.arm.position.set(0.22, -0.3, -0.25);
      L.arm.position.set(-0.22, -0.3, -0.25);
      R.arm.rotation.set(0.35, -0.2, 0);
      L.arm.rotation.set(0.35, 0.2, 0);
      if (this.act === 'punch') {
        const jab = Math.sin(Math.min(1, k * 1.5) * Math.PI);
        const arm = p.weapons.punchSide > 0 ? R : L;
        arm.arm.position.z -= jab * 0.35;
        arm.arm.position.x *= 1 - jab * 0.6;
        arm.arm.rotation.x = 0.35 - jab * 0.3;
      }
    } else {
      R.arm.position.set(0.24, -0.4, -0.05);
      R.arm.rotation.set(0.15, -0.35, 0);
      L.arm.position.set(-0.1, -0.42, -0.1);
      L.arm.rotation.set(0.2, 0.25, 0);
    }
    this.foot.visible = this.act === 'kick';
    if (this.foot.visible) {
      const kk = Math.sin(Math.min(1, k * 1.4) * Math.PI);
      this.foot.position.set(0, -0.9 + kk * 0.65, -0.3 - kk * 0.3);
      this.foot.rotation.set(-0.3 + kk * 0.2, 0, 0);
    }
    // camera
    const vc = this.game.app.renderer.vmCamera;
    vc.position.set(0, 0, 0);
    vc.rotation.set(0, 0, 0);
  }
}
