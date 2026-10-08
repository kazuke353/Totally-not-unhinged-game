// The player: a red kangaroo in a stolen orange H.O.P. suit (Hazardous
// Outback Protection). Fully procedural mesh + procedural animation driven
// by two-bone IK for legs and arms, a 4 segment tail and an aimable chest.
import * as THREE from 'three';
import { kit, C, meshOf, bone, entityMaterial, zsplit } from './modelkit.js';
import { buildWeaponModel } from './weaponmodels.js';
import { damp, clamp, lerp } from '../engine/util.js';

const FUR = C('#a85a30');
const FUR_D = C('#7c3f20');
const BELLY = C('#e3cca4');
const PAW = C('#4a2c1c');
const NOSE = C('#140e0c');
const EAR_IN = C('#d29884');
const SUIT = C('#e2761a');
const SUIT_D = C('#34373b');
const SUIT_M = C('#5d6268');
const GLOVE = C('#c81e14');
const LENS = C('#5a9ab8');

export const HIP_Y = 0.62;
const L_THIGH = 0.32, L_SHIN = 0.37;
const FOOT_LEN = 0.44; // ankle to claw tip
const L_UPPER = 0.16, L_FORE = 0.15;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

// Two bone IK: returns elbow/knee position in out.
function solve2(S, T, L1, L2, pole, out, Tout) {
  const d = _v1.subVectors(T, S);
  let dist = d.length();
  const maxR = L1 + L2 - 0.002;
  const dir = d.clone().divideScalar(dist || 1);
  if (dist > maxR) dist = maxR;
  if (dist < Math.abs(L1 - L2) + 0.01) dist = Math.abs(L1 - L2) + 0.01;
  Tout.copy(S).addScaledVector(dir, dist);
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pp = _v2.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1);
  pp.normalize();
  out.copy(S).addScaledVector(dir, a).addScaledVector(pp, h);
  return out;
}

function aim(obj, from, to) {
  _v3.subVectors(to, from).normalize();
  obj.position.copy(from);
  obj.quaternion.setFromUnitVectors(DOWN, _v3);
}

export class KangarooModel {
  constructor(shared) {
    this.mat = entityMaterial(shared);
    this.mat.transparent = false;
    const m = this.mat;
    this.root = new THREE.Group();
    this.body = bone(this.root);

    // --- hips / haunches --------------------------------------------------
    this.hips = bone(this.body, 0, HIP_Y, -0.04);
    this.hips.add(
      meshOf(
        [
          kit.ball(0.2, 0.23, 0.26, (x, y, z) => (y < -0.12 && z > 0 ? BELLY : FUR), { p: [0, -0.02, -0.04] }, 9, 7),
          // utility belt
          kit.cyl(0.19, 0.2, 0.05, SUIT_D, { p: [0, 0.14, 0.02], r: [0.25, 0, 0] }, 10),
          kit.box(0.06, 0.05, 0.03, C('#b08a30'), { p: [0, 0.16, 0.2], r: [0.25, 0, 0] }),
        ],
        m
      )
    );

    // --- torso -------------------------------------------------------------
    this.torso = bone(this.hips, 0, 0.08, 0.04);
    this.torso.add(
      meshOf(
        [
          kit.ball(0.17, 0.3, 0.16, zsplit(FUR, BELLY, 0.07), { p: [0, 0.24, 0.03] }, 9, 7),
          // pouch
          kit.ball(0.12, 0.085, 0.06, C('#d6bc92'), { p: [0, 0.1, 0.15] }, 8, 5),
          kit.box(0.16, 0.008, 0.015, C('#b89a70'), { p: [0, 0.165, 0.185] }),
          // H.O.P. suit vest
          kit.ball(0.185, 0.19, 0.175, (x, y, z) => (Math.abs(x) > 0.15 ? SUIT_D : SUIT), { p: [0, 0.36, 0.02] }, 10, 7),
        ],
        m
      )
    );

    // --- chest / shoulders (aims with the camera) ---------------------------
    this.chest = bone(this.torso, 0, 0.46, 0.04);
    this.chest.add(
      meshOf(
        [
          kit.ball(0.16, 0.13, 0.15, SUIT, { p: [0, 0.03, 0.02] }, 10, 6),
          kit.cyl(0.08, 0.1, 0.06, SUIT_D, { p: [0, 0.14, 0.04] }, 9), // collar
          // chest plate with paw logo
          kit.box(0.12, 0.1, 0.03, SUIT_D, { p: [0, 0.03, 0.155] }),
          kit.ball(0.025, 0.025, 0.01, SUIT, { p: [0, 0.015, 0.172] }, 6, 4),
          kit.ball(0.012, 0.012, 0.008, SUIT, { p: [-0.03, 0.05, 0.172] }, 5, 3),
          kit.ball(0.012, 0.012, 0.008, SUIT, { p: [0, 0.062, 0.172] }, 5, 3),
          kit.ball(0.012, 0.012, 0.008, SUIT, { p: [0.03, 0.05, 0.172] }, 5, 3),
          // shoulder pads
          kit.ball(0.07, 0.05, 0.07, SUIT_M, { p: [0.15, 0.06, 0.07] }, 7, 5),
          kit.ball(0.07, 0.05, 0.07, SUIT_M, { p: [-0.15, 0.06, 0.07] }, 7, 5),
          // power pack
          kit.box(0.22, 0.26, 0.09, SUIT_D, { p: [0, -0.02, -0.17] }),
          kit.box(0.23, 0.03, 0.095, SUIT, { p: [0, 0.06, -0.17] }),
          kit.cyl(0.03, 0.03, 0.2, SUIT_M, { p: [0.08, 0.0, -0.23] }, 6),
          kit.cyl(0.03, 0.03, 0.2, SUIT_M, { p: [-0.08, 0.0, -0.23] }, 6),
        ],
        m
      )
    );

    // --- neck & head -------------------------------------------------------
    this.neck = bone(this.chest, 0, 0.13, 0.05);
    this.neck.add(meshOf([kit.cyl(0.055, 0.07, 0.14, zsplit(FUR, BELLY, 0.03), { p: [0, 0.05, 0.01], r: [0.3, 0, 0] }, 8)], m));
    this.head = bone(this.neck, 0, 0.12, 0.04);
    this.head.scale.setScalar(1.22);
    this.head.add(
      meshOf(
        [
          kit.ball(0.085, 0.085, 0.115, FUR, { p: [0, 0.03, 0.01] }, 9, 7),
          kit.ball(0.058, 0.052, 0.1, (x, y) => (y < -0.02 ? BELLY : FUR), { p: [0, 0.0, 0.12] }, 8, 6),
          kit.ball(0.026, 0.02, 0.02, NOSE, { p: [0, 0.025, 0.215] }, 6, 4),
          kit.box(0.04, 0.006, 0.04, NOSE, { p: [0, -0.03, 0.18] }),
          kit.ball(0.019, 0.022, 0.017, NOSE, { p: [0.055, 0.055, 0.085] }, 6, 4),
          kit.ball(0.019, 0.022, 0.017, NOSE, { p: [-0.055, 0.055, 0.085] }, 6, 4),
          kit.ball(0.006, 0.006, 0.004, C('#ffffff'), { p: [0.06, 0.065, 0.1] }, 4, 3),
          kit.ball(0.006, 0.006, 0.004, C('#ffffff'), { p: [-0.05, 0.065, 0.1] }, 4, 3),
          // goggles pushed up on the forehead
          kit.cyl(0.092, 0.092, 0.028, SUIT_D, { p: [0, 0.075, 0.0], r: [-0.25, 0, 0] }, 10, true),
          kit.cyl(0.03, 0.03, 0.03, SUIT_D, { p: [0.04, 0.105, 0.075], r: [1.1, 0, 0] }, 8),
          kit.cyl(0.03, 0.03, 0.03, SUIT_D, { p: [-0.04, 0.105, 0.075], r: [1.1, 0, 0] }, 8),
          kit.cyl(0.024, 0.024, 0.01, LENS, { p: [0.04, 0.115, 0.088], r: [1.1, 0, 0] }, 8),
          kit.cyl(0.024, 0.024, 0.01, LENS, { p: [-0.04, 0.115, 0.088], r: [1.1, 0, 0] }, 8),
        ],
        m
      )
    );
    this.ears = [];
    for (const s of [1, -1]) {
      const e = bone(this.head, 0.05 * s, 0.09, -0.03);
      e.add(
        meshOf(
          [
            kit.cone(0.05, 0.24, FUR, { p: [0, 0.12, 0], s: [1, 1, 0.55] }, 6),
            kit.cone(0.034, 0.18, EAR_IN, { p: [0, 0.1, 0.018], s: [1, 1, 0.4] }, 6),
          ],
          m
        )
      );
      e.rotation.set(-0.25, 0, -0.25 * s);
      this.ears.push(e);
    }

    // --- arms (IK) ---------------------------------------------------------
    this.arms = [];
    for (const s of [1, -1]) {
      const upper = bone(this.chest);
      upper.add(meshOf([kit.limb(0.045, 0.035, L_UPPER, FUR, {}, 6)], m));
      const fore = bone(this.chest);
      fore.add(meshOf([kit.limb(0.035, 0.03, L_FORE, FUR, {}, 6)], m));
      const paw = bone(this.chest);
      paw.add(
        meshOf(
          [
            kit.ball(0.035, 0.03, 0.04, PAW, { p: [0, -0.02, 0] }, 6, 4),
            kit.cone(0.008, 0.03, C('#1a1210'), { p: [0.015, -0.055, 0.01], r: [0, 0, 0] }, 4),
            kit.cone(0.008, 0.03, C('#1a1210'), { p: [-0.015, -0.055, 0.01], r: [0, 0, 0] }, 4),
          ],
          m
        )
      );
      const glove = meshOf(
        [
          kit.ball(0.07, 0.065, 0.075, GLOVE, { p: [0, -0.04, 0.01] }, 8, 6),
          kit.cyl(0.045, 0.05, 0.05, C('#f0f0f0'), { p: [0, 0.02, 0] }, 8),
          kit.ball(0.03, 0.03, 0.03, GLOVE, { p: [0.05 * s, -0.02, 0.04] }, 6, 4),
        ],
        m
      );
      paw.add(glove);
      this.arms.push({ s, upper, fore, paw, glove, shoulder: new THREE.Vector3(0.13 * s, 0.03, 0.08) });
    }

    // --- weapon mount ---------------------------------------------------------
    this.weaponMount = bone(this.chest, 0, 0, 0.3);
    this.weapons = {};
    this.weaponId = 'fists';
    this.shared = shared;

    // --- legs (IK in body space) --------------------------------------------
    this.legs = [];
    for (const s of [1, -1]) {
      const thigh = bone(this.body);
      thigh.add(
        meshOf(
          [
            kit.limb(0.12, 0.075, L_THIGH, FUR, {}, 7),
            kit.ball(0.11, 0.16, 0.12, FUR, { p: [0.0, -0.12, 0.0] }, 7, 5),
          ],
          m
        )
      );
      const shin = bone(this.body);
      shin.add(meshOf([kit.limb(0.05, 0.034, L_SHIN, FUR, {}, 6)], m));
      const foot = bone(this.body);
      foot.add(
        meshOf(
          [
            kit.box(0.075, 0.05, 0.36, (x, y, z) => (z > 0.24 ? PAW : FUR_D), { p: [0, -0.01, 0.15] }),
            kit.box(0.05, 0.04, 0.08, PAW, { p: [0, -0.012, 0.36] }),
            kit.cone(0.012, 0.05, C('#1a1210'), { p: [0, -0.02, 0.42], r: [Math.PI / 2, 0, 0] }, 4),
          ],
          m
        )
      );
      this.legs.push({ s, thigh, shin, foot, hip: new THREE.Vector3(0.11 * s, HIP_Y, -0.05) });
    }

    // --- tail ---------------------------------------------------------------
    this.tail = [];
    let parent = this.hips;
    const radii = [0.1, 0.08, 0.06, 0.045, 0.03];
    const lens = [0.26, 0.25, 0.24, 0.22];
    let pz = -0.24, py = -0.08;
    for (let i = 0; i < 4; i++) {
      const b = bone(parent, 0, py, pz);
      const g = new THREE.CylinderGeometry(radii[i + 1], radii[i], lens[i], 7, 1);
      g.translate(0, lens[i] / 2, 0);
      g.rotateX(-Math.PI / 2); // axis now along -Z
      const geo = kit.merge([finishTail(g, i)]);
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      b.add(mesh);
      this.tail.push(b);
      parent = b;
      pz = -lens[i];
      py = 0;
    }

    this.root.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });

    // animation state
    this.t = 0;
    this.hopPhase = 0;
    this.moveBlend = 0;
    this.airBlend = 0;
    this.crouchBlend = 0;
    this.lean = 0.25;
    this.bob = 0;
    this.earTwitch = 0;
    this.nextTwitch = 2;
    this.landSquash = 0;
    this.recoil = 0;
    this.deadT = 0;
    this.setWeapon('fists');
    this._tmp = { knee: new THREE.Vector3(), ank: new THREE.Vector3(), tgt: new THREE.Vector3(), elbow: new THREE.Vector3(), paw: new THREE.Vector3() };
  }

  setWeapon(id) {
    for (const w of Object.values(this.weapons)) w.visible = false;
    if (!this.weapons[id]) {
      const w = buildWeaponModel(id, this.mat);
      this.weaponMount.add(w);
      this.weapons[id] = w;
    }
    this.weapons[id].visible = id !== 'fists';
    this.weaponId = id;
    for (const a of this.arms) a.glove.visible = id === 'fists';
  }

  muzzleWorld(out) {
    const w = this.weapons[this.weaponId];
    if (w && w.userData.muzzle) return w.userData.muzzle.getWorldPosition(out);
    return this.weaponMount.getWorldPosition(out);
  }

  setLight(amb, dir) {
    this.mat.uniforms.uAmbient.value.set(amb[0], amb[1], amb[2]);
    this.mat.uniforms.uDirCol.value.set(dir[0], dir[1], dir[2]);
  }

  setOpacity(o) {
    const tr = o < 0.99;
    if (this.mat.transparent !== tr) {
      this.mat.transparent = tr;
      this.mat.depthWrite = !tr;
      this.mat.needsUpdate = true;
    }
    this.mat.uniforms.uOpacity.value = o;
    this.root.visible = o > 0.02;
  }

  // s: {yaw, pitch, speed, fwdSpeed, sideSpeed, onGround, vy, crouch, charge,
  //     action, actionT, punchSide, climbing, dead, reloading, switching, pain}
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    this.root.rotation.y = s.yaw + Math.PI;

    if (s.dead) return this._dead(dt, s);
    this.deadT = 0;
    this.root.rotation.z = 0;
    this.root.rotation.x = 0;

    const moving = s.onGround && s.speed > 0.6;
    const airborne = !s.onGround && !s.climbing;
    if (airborne && !this.wasAirborne) {
      this.takeoffY = this.root.position.y;
      if (s.vy > 1) this.takeoff = 1;
    }
    if (!airborne) this.superHop = false;
    // the super-hop knee tuck opens up on the way down so the legs are under us to land
    this.tuck = damp(this.tuck || 0, this.superHop ? clamp((s.vy + 2) / 5, 0, 1) : 0, 12, dt);
    this.wasAirborne = airborne;
    this.takeoff = Math.max(0, (this.takeoff || 0) - dt * 4);
    this.moveBlend = damp(this.moveBlend, moving ? 1 : 0, 10, dt);
    this.airBlend = damp(this.airBlend, s.onGround || s.climbing ? 0 : 1, 14, dt);
    this.crouchBlend = damp(this.crouchBlend, s.crouch ? 1 : 0, 12, dt);
    this.landSquash = damp(this.landSquash, 0, 9, dt);
    this.recoil = damp(this.recoil, 0, 14, dt);

    // hop cycle
    const freq = clamp(1.2 + s.speed * 0.2, 1.4, 2.7);
    if (moving) this.hopPhase = (this.hopPhase + dt * freq) % 1;
    else this.hopPhase = damp(this.hopPhase, 0, 6, dt);
    const ph = this.hopPhase;
    const contact = 0.32;
    let bodyY = 0, legPhase = 0; // legPhase: -1 trailing, +1 reaching forward
    if (ph < contact) {
      const k = ph / contact;
      bodyY = -Math.sin(k * Math.PI) * 0.06;
      legPhase = lerp(0.6, -0.8, k);
    } else {
      const k = (ph - contact) / (1 - contact);
      bodyY = Math.sin(k * Math.PI) * Math.min(0.26, 0.05 + s.speed * 0.03);
      legPhase = k < 0.5 ? -1 : lerp(-1, 0.6, (k - 0.5) / 0.5);
    }
    const hopY = bodyY * this.moveBlend * (1 - this.crouchBlend * 0.7);
    this.body.position.y = hopY - this.landSquash * 0.12;
    const stretch = this.takeoff * 0.1;
    this.body.scale.set(1 - stretch * 0.4, 1 + stretch, 1 - stretch * 0.4);

    // posture
    const breathe = Math.sin(t * 2.2) * 0.015;
    let lean = lerp(0.18, 0.62, this.moveBlend) + this.crouchBlend * 0.35 + this.airBlend * 0.3;
    if (moving) lean += Math.sin(ph * Math.PI * 2) * 0.06;
    let hipDrop = -this.crouchBlend * 0.22 - this.landSquash * 0.1;
    let chestAbs = -s.pitch * 0.85;
    let tailBase = lerp(-0.62, -0.18, Math.max(this.moveBlend, this.airBlend));
    tailBase -= this.crouchBlend * 0.08;
    if (moving) tailBase += Math.sin((ph + 0.15) * Math.PI * 2) * 0.12;
    if (this.airBlend > 0.01) tailBase += clamp(-s.vy * 0.03, -0.25, 0.25) * this.airBlend;

    // leg targets (in body space, relative to hips)
    let fz = 0, fy = 0.05, footPitch = 0, fwide = 0;
    // standing / hopping feet
    const groundFz = lerp(-0.12, -0.12 + legPhase * 0.18, this.moveBlend);
    fz = groundFz;
    if (moving && ph >= contact) {
      const k = (ph - contact) / (1 - contact);
      fy = 0.05 + Math.sin(k * Math.PI) * 0.12;
      footPitch = legPhase < 0 ? 0.9 : 0.2;
    }
    // airborne (real jump): legs trail back on the way up, swing under the
    // body to land; a super hop tucks the knees up to the chest
    if (this.airBlend > 0.01) {
      // 1 while rising fast -> 0 at the apex -> -1 falling fast
      const rise = clamp(s.vy / 7, -1, 1);
      let az = lerp(0.14, -0.46, Math.max(0, rise)) + Math.min(0, rise) * -0.04;
      let ay = lerp(0.1, 0.22, Math.max(0, rise));
      let ap = lerp(-0.15, 1.35, Math.max(0, rise));
      az = lerp(az, 0.22, this.tuck);
      ay = lerp(ay, 0.42, this.tuck);
      ap = lerp(ap, 0.4, this.tuck);
      fz = lerp(fz, az, this.airBlend);
      fy = lerp(fy, ay, this.airBlend);
      footPitch = lerp(footPitch, ap, this.airBlend);
      lean += lerp(rise * 0.15, 0.35, this.tuck) * this.airBlend;
      if (this.takeoff > 0) {
        // spring off: legs fully extended straight down/back
        fz = lerp(fz, -0.3, this.takeoff);
        fy = lerp(fy, -0.25, this.takeoff);
        footPitch = lerp(footPitch, 1.4, this.takeoff);
      }
    }
    // crouch: feet forward, very bent
    fz = lerp(fz, -0.06, this.crouchBlend);
    fwide = this.crouchBlend * 0.03;
    // super hop charge shiver
    let shiver = 0;
    if (s.charge > 0) shiver = Math.sin(t * 60) * 0.01 * s.charge;

    // arm targets (chest space)
    const armT = [new THREE.Vector3(0.1, -0.12, 0.2), new THREE.Vector3(-0.1, -0.12, 0.2)];
    const wid = this.weaponId;
    let mountPos = new THREE.Vector3(0.0, -0.04, 0.28);
    let mountRot = 0;
    if (wid === 'fists') {
      // boxing guard
      armT[0].set(0.1, 0.06 + breathe, 0.24);
      armT[1].set(-0.1, 0.03 - breathe, 0.2);
    } else if (wid === 'pistol') {
      mountPos.set(0.03, 0.0, 0.36);
      armT[0].copy(mountPos).add(new THREE.Vector3(0.0, -0.02, 0));
      armT[1].copy(mountPos).add(new THREE.Vector3(-0.04, -0.04, -0.02));
    } else if (wid === 'smg' || wid === 'shotgun') {
      mountPos.set(0.06, -0.02, 0.24);
      armT[0].copy(mountPos).add(new THREE.Vector3(0, -0.03, 0));
      armT[1].copy(mountPos).add(new THREE.Vector3(-0.03, -0.03, wid === 'shotgun' ? 0.3 : 0.24));
    } else if (wid === 'rpg') {
      mountPos.set(0.15, 0.1, 0.0);
      armT[0].copy(mountPos).add(new THREE.Vector3(0, -0.05, 0));
      armT[1].copy(mountPos).add(new THREE.Vector3(-0.04, -0.05, 0.3));
    } else if (wid === 'grenade') {
      mountPos.set(0.16, 0.0, 0.2);
      armT[0].copy(mountPos).add(new THREE.Vector3(0, -0.05, -0.02));
      armT[1].set(-0.12, -0.08, 0.18);
    }

    // actions --------------------------------------------------------------
    let twist = 0;
    const a = s.action, at = s.actionT;
    if (a === 'kick') {
      // lean back on the tail and double kick with both feet
      const wind = at < 0.25 ? at / 0.25 : at < 0.6 ? 1 : 1 - (at - 0.6) / 0.4;
      const strike = at < 0.25 ? 0 : at < 0.45 ? (at - 0.25) / 0.2 : at < 0.65 ? 1 : 1 - (at - 0.65) / 0.35;
      lean = lerp(lean, -0.55, wind);
      chestAbs = lerp(chestAbs, 0.15, wind * 0.6);
      tailBase = lerp(tailBase, -1.05, wind);
      hipDrop += wind * 0.06;
      fz = lerp(fz, 0.62, strike);
      fy = lerp(fy, HIP_Y - 0.02, strike);
      footPitch = lerp(footPitch, -1.3, strike);
      armT[0].lerp(new THREE.Vector3(0.18, -0.02, 0.05), wind);
      armT[1].lerp(new THREE.Vector3(-0.18, -0.02, 0.05), wind);
    } else if (a === 'punch') {
      const k = at < 0.35 ? at / 0.35 : 1 - (at - 0.35) / 0.65;
      const side = s.punchSide > 0 ? 0 : 1;
      armT[side].lerp(new THREE.Vector3(side === 0 ? 0.04 : -0.04, 0.06, 0.48), k);
      twist = (side === 0 ? -0.3 : 0.3) * k;
    } else if (a === 'throw') {
      const k = at < 0.4 ? at / 0.4 : 1 - (at - 0.4) / 0.6;
      armT[0].set(0.16, 0.2 * (1 - k) + 0.25 * k, lerp(-0.15, 0.4, at < 0.4 ? 0 : (at - 0.4) / 0.3));
      twist = -0.25 * k;
    } else if (a === 'reload') {
      const k = Math.sin(Math.min(1, at) * Math.PI);
      mountRot = k * 0.6;
      armT[1].lerp(new THREE.Vector3(-0.02, -0.18, 0.12), k);
    } else if (a === 'switch') {
      // reach into the pouch!
      const k = Math.sin(Math.min(1, at) * Math.PI);
      armT[0].lerp(new THREE.Vector3(0.02, -0.38, 0.12), k);
      armT[1].lerp(new THREE.Vector3(-0.02, -0.38, 0.12), k * 0.7);
      chestAbs = lerp(chestAbs, 0.4, k * 0.5);
    }
    if (s.climbing) {
      const c = Math.sin(t * 6) * 0.08;
      lean = 0.05;
      chestAbs = 0;
      armT[0].set(0.12, 0.3 + c, 0.18);
      armT[1].set(-0.12, 0.3 - c, 0.18);
      tailBase = -1.2;
    }
    if (s.pain > 0) {
      lean += Math.sin(s.pain * 30) * 0.08 * s.pain;
    }

    // apply posture
    this.lean = damp(this.lean, lean, 12, dt);
    this.hips.position.y = HIP_Y + hipDrop + shiver;
    this.torso.rotation.x = this.lean * 0.6;
    this.torso.rotation.y = damp(this.torso.rotation.y, twist, 18, dt);
    this.chest.rotation.x = chestAbs - this.lean * 0.6;
    this.chest.scale.set(1 + breathe, 1 + breathe, 1 + breathe);
    this.head.rotation.x = -s.pitch * 0.25 + Math.sin(t * 1.1) * 0.03;
    this.head.rotation.y = Math.sin(t * 0.37) * 0.08 * (1 - this.moveBlend);

    // ears twitch & flop
    this.nextTwitch -= dt;
    if (this.nextTwitch < 0) {
      this.earTwitch = 1;
      this.nextTwitch = 1.5 + Math.random() * 4;
    }
    this.earTwitch = damp(this.earTwitch, 0, 8, dt);
    const earFlop = this.airBlend * 0.5 + this.moveBlend * Math.sin(ph * Math.PI * 2) * 0.2;
    this.ears[0].rotation.set(-0.25 - earFlop - this.earTwitch * 0.3, 0, -0.22);
    this.ears[1].rotation.set(-0.25 - earFlop, 0, 0.22);

    // tail chain
    const tailCurl = [tailBase, 0.16 + this.crouchBlend * 0.15, 0.14 + this.crouchBlend * 0.08, 0.1 + this.crouchBlend * 0.08];
    for (let i = 0; i < 4; i++) {
      const wag = Math.sin(t * 1.5 - i * 0.6) * 0.04 * (1 - this.moveBlend);
      this.tail[i].rotation.x = tailCurl[i] + (i > 0 ? Math.sin(ph * Math.PI * 2 - i) * 0.06 * this.moveBlend : 0);
      this.tail[i].rotation.y = wag;
    }

    // weapon mount follows aim, with recoil
    this.weaponMount.position.copy(mountPos);
    this.weaponMount.position.z -= this.recoil * 0.07;
    this.weaponMount.rotation.set(-this.recoil * 0.35, 0, mountRot);

    // legs IK
    this.root.updateMatrixWorld(true);
    // how far the floor we stand on (or just jumped from) is below the root
    let clearance = 0;
    if (airborne) {
      const lift = this.root.position.y - (this.takeoffY ?? this.root.position.y);
      clearance = lift < -0.05 ? 9 : Math.max(0, lift);
    }
    const tmp = this._tmp;
    for (const L of this.legs) {
      const hip = _hipTmp.copy(L.hip);
      hip.x += fwide * L.s;
      hip.y = this.hips.position.y + (L.hip.y - HIP_Y) - 0.02;
      // undo the body bob for planted feet: feet targets are in ground space
      const ankle = tmp.tgt.set(0.12 * L.s + fwide * L.s, fy - this.body.position.y * (moving && ph < contact ? 1 : 0), fz);
      if (a === 'kick') ankle.y = fy;
      // keep the long hind feet out of the floor: near the ground the ankle
      // can't sit below it and the toes can only point down as far as the
      // ankle's height allows (push-off: the toe is the last thing to leave)
      const aboveFloor = this.body.position.y + ankle.y * this.body.scale.y + clearance;
      if (aboveFloor < 0.05) ankle.y += (0.05 - aboveFloor) / this.body.scale.y;
      solve2(hip, ankle, L_THIGH, L_SHIN, FWD, tmp.knee, tmp.ank);
      aim(L.thigh, hip, tmp.knee);
      aim(L.shin, tmp.knee, tmp.ank);
      L.foot.position.copy(tmp.ank);
      const ankH = this.body.position.y + tmp.ank.y * this.body.scale.y + clearance;
      const maxPitch = Math.asin(clamp((ankH - 0.05) / FOOT_LEN, 0, 1));
      L.foot.rotation.set(Math.min(footPitch, maxPitch), 0, 0);
    }
    // arms IK (chest space)
    for (let i = 0; i < 2; i++) {
      const A = this.arms[i];
      const pole = _poleTmp.set(A.s * 0.8, -1, -0.3);
      solve2(A.shoulder, armT[i], L_UPPER, L_FORE, pole, tmp.elbow, tmp.paw);
      aim(A.upper, A.shoulder, tmp.elbow);
      aim(A.fore, tmp.elbow, tmp.paw);
      A.paw.position.copy(tmp.paw);
      A.paw.quaternion.copy(A.fore.quaternion);
    }
  }

  land(strength) {
    this.landSquash = Math.min(1, Math.max(this.landSquash, strength));
  }
  fireRecoil(k = 1) {
    this.recoil = Math.min(1.5, this.recoil + k);
  }

  _dead(dt, s) {
    this.deadT += dt;
    const k = Math.min(1, this.deadT / 0.7);
    const e = 1 - (1 - k) * (1 - k);
    this.root.rotation.z = e * 1.45;
    // lift in world space (root is re-placed at the feet every frame)
    this.root.position.y += e * 0.18;
    this.body.position.y = 0;
    this.body.scale.set(1, 1, 1);
    this.torso.rotation.x = 0.2;
    this.chest.rotation.x = 0.1;
    this.head.rotation.x = 0.4 * e;
  }
}

const _hipTmp = new THREE.Vector3();
const _poleTmp = new THREE.Vector3();

function finishTail(g, i) {
  if (g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const y = g.attributes.position.getY(k);
    const c = y < -0.02 && i < 2 ? BELLY : i === 3 ? FUR_D : FUR;
    col[k * 3] = c[0];
    col[k * 3 + 1] = c[1];
    col[k * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
