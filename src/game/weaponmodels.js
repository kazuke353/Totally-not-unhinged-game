// Low-poly weapon meshes. Origin is the grip, barrel points along +Z.
import * as THREE from 'three';
import { kit, C, meshOf } from './modelkit.js';

const GUN = C('#2b2d30');
const GUN2 = C('#3d4044');
const STEEL = C('#6a6e72');
const WOOD = C('#6b4426');
const OLIVE = C('#4a5530');
const RED = C('#c0281c');

export function buildWeaponModel(id, mat) {
  const g = new THREE.Group();
  let muzzle = new THREE.Vector3(0, 0.05, 0.2);
  let parts;
  switch (id) {
    case 'fists':
      return g; // gloves are handled by the kangaroo model
    case 'pistol':
      parts = [
        kit.box(0.035, 0.1, 0.05, GUN, { p: [0, -0.04, -0.01], r: [-0.25, 0, 0] }),
        kit.box(0.04, 0.045, 0.2, GUN2, { p: [0, 0.035, 0.06] }),
        kit.box(0.03, 0.02, 0.17, GUN, { p: [0, 0.005, 0.07] }),
        kit.box(0.012, 0.012, 0.02, STEEL, { p: [0, 0.064, 0.15] }),
        kit.cyl(0.008, 0.008, 0.02, C('#111'), { p: [0, 0.035, 0.165], r: [Math.PI / 2, 0, 0] }, 6),
      ];
      muzzle.set(0, 0.035, 0.18);
      break;
    case 'smg':
      parts = [
        kit.box(0.035, 0.1, 0.045, GUN, { p: [0, -0.045, 0], r: [-0.2, 0, 0] }),
        kit.box(0.05, 0.07, 0.34, GUN2, { p: [0, 0.03, 0.08] }),
        kit.box(0.03, 0.14, 0.04, GUN, { p: [0, -0.06, 0.1], r: [0.25, 0, 0] }),
        kit.cyl(0.022, 0.022, 0.16, GUN, { p: [0, 0.035, 0.3], r: [Math.PI / 2, 0, 0] }, 7),
        kit.cyl(0.01, 0.01, 0.06, C('#111'), { p: [0, 0.035, 0.4], r: [Math.PI / 2, 0, 0] }, 6),
        kit.box(0.03, 0.03, 0.18, GUN, { p: [0, 0.03, -0.17] }),
        kit.box(0.035, 0.07, 0.03, GUN, { p: [0, 0.0, -0.26] }),
        kit.box(0.02, 0.03, 0.05, STEEL, { p: [0, 0.08, 0.06] }),
        // under-barrel grenade launcher
        kit.cyl(0.025, 0.025, 0.14, C('#202224'), { p: [0, -0.02, 0.26], r: [Math.PI / 2, 0, 0] }, 7),
      ];
      muzzle.set(0, 0.035, 0.44);
      break;
    case 'shotgun':
      parts = [
        kit.box(0.04, 0.11, 0.045, WOOD, { p: [0, -0.05, -0.01], r: [-0.25, 0, 0] }),
        kit.box(0.05, 0.075, 0.2, GUN2, { p: [0, 0.03, 0.06] }),
        kit.cyl(0.018, 0.018, 0.5, GUN, { p: [0, 0.05, 0.4], r: [Math.PI / 2, 0, 0] }, 7),
        kit.cyl(0.016, 0.016, 0.42, GUN, { p: [0, 0.015, 0.36], r: [Math.PI / 2, 0, 0] }, 7),
        kit.box(0.05, 0.05, 0.14, WOOD, { p: [0, 0.015, 0.3] }),
        kit.box(0.04, 0.07, 0.24, WOOD, { p: [0, 0.0, -0.18], r: [0.12, 0, 0] }),
      ];
      muzzle.set(0, 0.05, 0.66);
      break;
    case 'rpg':
      parts = [
        kit.cyl(0.06, 0.06, 1.0, OLIVE, { p: [0, 0.08, 0.15], r: [Math.PI / 2, 0, 0] }, 9),
        kit.cyl(0.07, 0.07, 0.06, C('#2a301c'), { p: [0, 0.08, 0.64], r: [Math.PI / 2, 0, 0] }, 9),
        kit.cyl(0.075, 0.06, 0.1, C('#2a301c'), { p: [0, 0.08, -0.36], r: [Math.PI / 2, 0, 0] }, 9),
        kit.box(0.035, 0.1, 0.045, GUN, { p: [0, -0.02, 0], r: [-0.2, 0, 0] }),
        kit.box(0.035, 0.1, 0.045, GUN, { p: [0, -0.02, 0.3], r: [-0.2, 0, 0] }),
        kit.box(0.04, 0.06, 0.1, GUN2, { p: [0.08, 0.14, 0.15] }),
        kit.cyl(0.012, 0.012, 0.02, RED, { p: [0.08, 0.14, 0.21], r: [Math.PI / 2, 0, 0] }, 6),
      ];
      muzzle.set(0, 0.08, 0.7);
      break;
    case 'grenade':
      parts = [
        kit.ball(0.045, 0.055, 0.045, C('#3c4a28'), { p: [0, 0.03, 0.03] }, 7, 5),
        kit.box(0.02, 0.03, 0.02, STEEL, { p: [0, 0.09, 0.03] }),
        kit.box(0.012, 0.06, 0.012, STEEL, { p: [0.03, 0.06, 0.03], r: [0, 0, -0.3] }),
      ];
      muzzle.set(0, 0.05, 0.05);
      break;
    default:
      parts = [kit.box(0.05, 0.05, 0.2, GUN)];
  }
  const mesh = meshOf(parts, mat);
  g.add(mesh);
  const mz = new THREE.Object3D();
  mz.position.copy(muzzle);
  g.add(mz);
  g.userData.muzzle = mz;
  g.userData.mesh = mesh;
  return g;
}

// Stand-alone world pickup models share the same meshes.
export function buildPickupModel(kind, mat) {
  const g = new THREE.Group();
  let parts;
  switch (kind) {
    case 'medkit':
      parts = [
        kit.box(0.42, 0.22, 0.3, C('#e8e8e0')),
        kit.box(0.1, 0.03, 0.26, RED, { p: [0, 0.115, 0] }),
        kit.box(0.26, 0.03, 0.1, RED, { p: [0, 0.115, 0] }),
        kit.box(0.12, 0.04, 0.04, C('#555'), { p: [0, 0.13, 0.17] }),
      ];
      break;
    case 'battery':
      parts = [
        kit.cyl(0.11, 0.11, 0.3, C('#2a5aa0'), {}, 8),
        kit.cyl(0.115, 0.115, 0.05, C('#e07818'), { p: [0, 0.12, 0] }, 8),
        kit.cyl(0.05, 0.05, 0.06, C('#bbb'), { p: [0, 0.17, 0] }, 6),
        kit.box(0.1, 0.1, 0.01, C('#f0f0f0'), { p: [0, 0, 0.11] }),
      ];
      break;
    case 'ammo_9mm':
      parts = [kit.box(0.3, 0.16, 0.2, C('#6a5a2a')), kit.box(0.31, 0.04, 0.21, C('#c8a040'), { p: [0, 0.05, 0] })];
      break;
    case 'ammo_shells':
      parts = [kit.box(0.28, 0.16, 0.18, C('#8a2018')), kit.box(0.29, 0.03, 0.19, C('#d8c050'), { p: [0, -0.06, 0] })];
      break;
    case 'ammo_rockets':
      parts = [
        kit.cyl(0.06, 0.06, 0.5, OLIVE, { r: [0, 0, Math.PI / 2] }, 8),
        kit.cone(0.06, 0.16, C('#5a5a5a'), { p: [0.33, 0, 0], r: [0, 0, -Math.PI / 2] }, 8),
      ];
      break;
    case 'ammo_grenades':
      parts = [
        kit.ball(0.06, 0.07, 0.06, C('#3c4a28'), { p: [-0.07, 0.07, 0] }),
        kit.ball(0.06, 0.07, 0.06, C('#3c4a28'), { p: [0.07, 0.07, 0] }),
        kit.box(0.02, 0.04, 0.02, STEEL, { p: [-0.07, 0.15, 0] }),
        kit.box(0.02, 0.04, 0.02, STEEL, { p: [0.07, 0.15, 0] }),
      ];
      break;
    case 'ammo_argrenades':
      parts = [
        kit.cyl(0.03, 0.03, 0.1, C('#c8a040'), { p: [-0.05, 0.05, 0] }, 6),
        kit.cyl(0.03, 0.03, 0.1, C('#c8a040'), { p: [0.05, 0.05, 0] }, 6),
        kit.ball(0.03, 0.03, 0.03, C('#3a3a3a'), { p: [-0.05, 0.11, 0] }),
        kit.ball(0.03, 0.03, 0.03, C('#3a3a3a'), { p: [0.05, 0.11, 0] }),
      ];
      break;
    case 'keycard_red':
    case 'keycard_blue':
      parts = [
        kit.box(0.2, 0.01, 0.13, C(kind === 'keycard_red' ? '#c02020' : '#2050c0')),
        kit.box(0.06, 0.012, 0.06, C('#e8e8e8'), { p: [-0.05, 0.002, 0] }),
        kit.box(0.16, 0.012, 0.015, C('#111'), { p: [0, 0.002, 0.045] }),
      ];
      break;
    case 'launchkey':
      parts = [
        kit.box(0.04, 0.015, 0.16, C('#d8b030'), { p: [0, 0, 0.04] }),
        kit.cyl(0.06, 0.06, 0.02, C('#d8b030'), { p: [0, 0, -0.08] }, 10),
        kit.box(0.02, 0.016, 0.03, C('#d8b030'), { p: [0.03, 0, 0.1] }),
        kit.box(0.02, 0.016, 0.03, C('#d8b030'), { p: [0.03, 0, 0.06] }),
      ];
      break;
    default:
      return null;
  }
  g.add(meshOf(parts, mat));
  return g;
}
