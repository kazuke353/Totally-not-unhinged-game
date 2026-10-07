// CHAPTER 3: SILO 7
// A 40 metre deep missile silo. Get the launch key from the Base Commander,
// fuel the missile, open the silo doors, deal with the gunship and turn the key.
//
//  Level 3 (y=24): Launch Control (north, windows over the missile), rocket cache (east)
//  Level 2 (y=12): Armoury (west, RPG), Maintenance (east)
//  Level 1 (y=0) : Commander's office (west), Fuel room (east), lift corridor (south)
//  Top (y=40)    : silo doors -> mesa top under a night sky
import { MapBuilder } from './builder.js';
import * as P from './props.js';

export function buildSilo() {
  const b = new MapBuilder('silo');
  b.title = 'SILO 7';
  b.spawn = { pos: [0, 0, 27], yaw: 0 };
  const moonDir = [-0.35, 0.6, -0.72];
  b.lighting = {
    ambient: [0.07, 0.07, 0.09],
    sky: [0.07, 0.09, 0.16],
    sun: { dir: moonDir, color: [0.26, 0.32, 0.5] },
    luxel: 0.55,
    aoStrength: 0.7,
  };
  b.sky = {
    sunDir: [0.2, -0.3, 0.9],
    moonDir,
    moon: 1,
    top: [0.02, 0.03, 0.09],
    horizon: [0.12, 0.12, 0.22],
    bottom: [0.03, 0.02, 0.03],
    sunColor: [0, 0, 0],
    stars: 1.0,
    clouds: 0.25,
    cloudColor: [0.12, 0.13, 0.2],
    mountColor: [0.03, 0.03, 0.05],
    mountColor2: [0.07, 0.07, 0.12],
  };
  b.fog = { color: [0.04, 0.05, 0.09], near: 60, far: 220 };
  b.ambientSound = 'hum_loop';
  b.ambientVolume = 0.2;
  b.ending = { cam1: [-4.2, 26.4, -10.95], cam2: [38, 50, 46] };
  const SOD = [1.0, 0.62, 0.32];
  const L = (x, y, z, o = {}) => b.light(x, y, z, { intensity: 1.5, radius: 10, color: [0.92, 0.96, 1.0], ...o });

  // ------------------------------------------------------------------ the shaft
  b.air(-10, 0, -10, 10, 40, 10, { floor: 'metal_floor', wall: 'silo_wall', noCeil: true, t: 0.6 });
  b.solid(-3.2, 0, -3.2, 3.2, 0.5, 3.2, { top: 'hazard', side: 'metal_panel' });
  b.ent('missile', { pos: [0, 0.5, 0], targetname: 'missile' });
  // spotlights on the missile
  for (const [x, z] of [[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5]]) {
    b.solid(x - 0.4, 0, z - 0.4, x + 0.4, 0.6, z + 0.4, 'metal_panel');
    b.light(x * 0.92, 0.9, z * 0.92, { color: [1, 0.95, 0.85], intensity: 2.2, radius: 30, fixture: null, spot: [-x, 30, -z], cone: 30 });
    b.ent('glow', { pos: [x, 0.8, z], size: 1.4, color: [1, 0.95, 0.8], alpha: 0.6 });
  }
  // wall lamps per level
  for (const y of [3, 15, 27, 37]) {
    for (const [x, z, nx, nz] of [[-9.95, 4, 1, 0], [9.95, -4, -1, 0], [4, -9.95, 0, 1], [-4, 9.95, 0, -1]]) {
      P.wallLamp(b, x, y, z, nx, nz, { color: SOD, radius: 11, intensity: 1.5 });
    }
  }
  b.ent('alarmlight', { pos: [-9.6, 10, 9.6], siren: true });
  b.ent('alarmlight', { pos: [9.6, 22, -9.6], siren: true });
  b.ent('alarmlight', { pos: [9.6, 34, 9.6] });

  // level 2 (y=12): north strip + umbilical arm, stairs up east side from level 1
  P.catwalk(b, -10, -10, 4, -7, 12);
  P.catwalk(b, 5, -10, 10, -7, 12);
  P.catwalk(b, 4, -9.0, 5, -7, 12);
  P.railingX(b, -7, 7, -7.05, 12);
  P.catwalk(b, -0.9, -7, 0.9, -1.45, 12);
  P.railingZ(b, -7, -1.6, -0.95, 12);
  P.railingZ(b, -7, -1.6, 0.95, 12);
  b.stairs(7, -7, 10, 7, 0, 12, '-z', 'metal_floor', { side: 'metal_panel' });
  // level 3 (y=24): stairs up the west side, ring south/east/north
  b.stairs(-10, -7, -7, 7, 12, 24, '+z', 'metal_floor', { side: 'metal_panel' });
  P.catwalk(b, -10, 7, -1, 10, 24);
  P.catwalk(b, 0, 7, 10, 10, 24);
  P.catwalk(b, -1, 7, 0, 9.0, 24);
  P.catwalk(b, 7, -10, 10, 7, 24);
  P.catwalk(b, -10, -10, 7, -7, 24);
  P.railingX(b, -7, 7, 6.95, 24);
  P.railingZ(b, -7, 7, 6.95, 24);
  P.railingX(b, -7, 7, -6.95, 24);
  // ladders: north wall 0->12, south wall 0->24
  b.ladder(4, 0, -10, 5, 12.4, -9.6);
  b.ladder(-1, 0, 9.6, 0, 24.4, 10);
  // pipes & clutter
  P.pipeRunZ(b, -10, 10, 7, 9.4, 0.25, 'pipe_red');
  P.pipeRunZ(b, -10, 10, 19, -9.4, 0.25, 'pipe');
  P.pipeRunX(b, -10, 10, 32, 9.4, 0.3, 'pipe');
  P.crateStack(b, -7, 7.5, [[0, 0, 0], [1, 0, 0, true, 'ammo_9mm'], [0, 0, 1]], 1.2, 0, { tex: 'crate_metal' });
  P.crateStack(b, 6.5, -2, [[0, 0, 0, true, 'ammo_shells']], 1.0);
  b.ent('barrel', { pos: [-8.5, 0, -4] });
  b.ent('barrel', { pos: [-8.6, 0, -2.8] });
  b.detail(-3, 2.5, 9.97, 3, 4.5, 10.0, 'sign_silo');
  b.detail(-9.98, 13, -6.5, -9.95, 13.5, -4.5, 'sign_level2');
  b.detail(-9.98, 1.5, 3, -9.95, 2.0, 5, 'sign_level1');
  b.detail(9.95, 25, -2, 9.98, 25.5, 0, 'sign_level3');

  // ------------------------------------------------------------------ level 1 rooms
  // lift corridor (south)
  b.air(-2.2, 0, 24.4, 2.2, 3.2, 29, { floor: 'metal_floor', wall: 'metal_blue', ceil: 'metal_panel' });
  b.air(-2, 0, 10.6, 2, 3.2, 24, { floor: 'concrete_dark', wall: 'concrete_wall', ceil: 'metal_panel' });
  b.carve(-1.5, 0, 23.9, 1.5, 2.6, 24.5);
  b.carve(-2, 0, 9.3, 2, 3.0, 10.7);
  L(0, 3.05, 27, { intensity: 1.1, radius: 6 });
  for (const z of [13, 18, 22]) L(0, 3.05, z, { intensity: 1.2, radius: 7, color: [1, 0.8, 0.6] });
  b.ent('charger', { pos: [-1.98, 1.2, 17], facing: [1, 0, 0], kind: 'health' });
  b.ent('charger', { pos: [1.98, 1.2, 17], facing: [-1, 0, 0], kind: 'suit' });
  b.ent('pickup', { item: 'ammo_9mm', pos: [1.4, 0, 21] });
  // commander's office (west)
  b.air(-26, 0, -6, -10.6, 4, 6, { floor: 'carpet', wall: 'office_wall', ceil: 'ceiling' });
  b.carve(-10.9, 0, -1.2, -9.3, 2.6, 1.2);
  b.ent('door', { min: [-10.4, 0, -1.2], max: [-10.2, 2.6, 1.2], tex: 'door_red', move: [0, 2.55, 0], faces: { side: 'metal_panel', px: 'door_red', nx: 'door_red' } });
  b.detail(-9.85, 2.8, -1.2, -9.8, 3.3, 1.2, 'sign_commander');
  P.desk(b, -22, 0, 0, 'z');
  P.computer(b, -22.2, 0.78, -0.4, 'px', 'screen_missile');
  b.detail(-25.98, 1.0, -3, -25.95, 3.0, 3, 'flag');
  b.detail(-18, 1.2, 5.97, -14, 2.8, 5.99, 'map_board');
  b.detail(-18, 1.2, -5.99, -15, 2.6, -5.97, 'poster_emu');
  P.shelf(b, -25.8, -5.8, -24.2, -3, 0, 2.4);
  b.light(-20, 3.85, 0, { intensity: 1.3, radius: 9, color: [1, 0.85, 0.65] });
  b.light(-14, 3.85, 0, { intensity: 1.1, radius: 8, color: [1, 0.85, 0.65] });
  b.ent('soldier', { pos: [-23.5, 0, 0.5], yaw: Math.PI / 2, variant: 'commander', ambush: true, drop: ['launchkey', 'medkit'], dropTarget: 'obj_key_done', health: 260, idleChat: true, idleLine: 'So. The kangaroo comes for my missile. Over my dead body, Skippy.', grenades: 4 });
  b.ent('soldier', { pos: [-14, 0, -4], yaw: 1.2, ambush: true, variant: 'shotgun', drop: 'ammo_shells' });
  b.ent('soldier', { pos: [-14, 0, 4], yaw: 2.0, ambush: true });
  b.ent('pickup', { item: 'battery', pos: [-25, 0, 5] });
  // secret stash behind a cracked wall panel
  b.carve(-26.5, 0, 2, -25.9, 2.2, 3.4);
  b.ent('breakable', { min: [-26.1, 0, 2], max: [-25.95, 2.2, 3.4], tex: 'concrete_wall', material: 'metal', health: 30 });
  b.air(-29, 0, 1.6, -26.4, 2.4, 3.8, { floor: 'concrete', wall: 'brick', ceil: 'concrete' });
  b.ent('pickup', { item: 'ammo_rockets', pos: [-28, 0, 2.4] });
  b.ent('pickup', { item: 'battery', pos: [-28, 0, 3.2] });
  b.ent('pickup', { item: 'ammo_9mmbox', pos: [-27.2, 0, 2.8] });
  b.ent('secret', { min: [-29, 0, 1.6], max: [-26.4, 2.4, 3.8] });
  b.light(-27.7, 2.2, 2.7, { intensity: 0.9, radius: 4, color: [1, 0.7, 0.4], fixture: null });

  // fuel room (east)
  b.air(10.6, 0, -2, 28, 8, 12, { floor: 'concrete_dark', wall: 'metal_panel', ceil: 'metal_panel' });
  b.carve(9.3, 0, 7.6, 10.9, 2.6, 9.4);
  b.detail(9.8, 2.8, 7.6, 9.85, 3.3, 9.4, 'sign_fuel');
  for (const [z0, z1] of [[-1.5, 3.5], [5.5, 10.5]]) {
    b.solid(19, 0, z0, 27.5, 5.5, z1, { side: 'water_tank', top: 'rust' });
    P.pipeRunX(b, 10.6, 19, 4.2, (z0 + z1) / 2, 0.3, 'pipe_red');
  }
  b.solid(13, 0, -1.8, 17, 1.2, 0.2, { side: 'metal_panel', top: 'metal_floor' });
  b.ent('valve', { pos: [16.5, 1.5, 11.95], facing: [0, 0, -1], time: 8, target: 'fuel_done', onStart: 'fuel_ambush' });
  b.detail(15, 2.3, 11.97, 18, 3.0, 11.95, 'sign_nuclear');
  b.light(15, 7.85, 2, { intensity: 1.5, radius: 12, color: [1, 0.9, 0.6] });
  b.light(15, 7.85, 9, { intensity: 1.5, radius: 12, color: [1, 0.9, 0.6] });
  b.ent('pickup', { item: 'ammo_shells', pos: [14, 1.2, -1] });
  b.ent('pickup', { item: 'medkit', pos: [16, 1.2, -1] });
  b.ent('soldier', { pos: [14, 0, 5], yaw: -Math.PI / 2, ambush: true });
  b.ent('soldier', { pos: [17.5, 0, 9], yaw: -2.0, ambush: true, drop: 'ammo_argrenades' });
  b.ent('barrel', { pos: [27, 0, 4.5] });
  b.ent('spawner', {
    targetname: 'fuel_ambush',
    interval: 1.4,
    spawns: [
      { type: 'soldier', pos: [0, 0, 20], yaw: Math.PI, hunt: true, drop: 'ammo_9mm' },
      { type: 'dingo', pos: [0, 0, 16], yaw: Math.PI, hunt: true },
      { type: 'soldier', pos: [0, 0, 22], yaw: Math.PI, hunt: true, variant: 'shotgun', drop: 'ammo_shells' },
      { type: 'soldier', pos: [-6, 12, -8.5], yaw: 0, hunt: true, grenades: 3 },
    ],
  });

  // level 1 guards
  b.ent('soldier', { pos: [-5, 0, 5], yaw: Math.PI, ambush: false, drop: 'ammo_9mm' });
  b.ent('soldier', { pos: [5, 0, -5], yaw: Math.PI, variant: 'shotgun', drop: 'ammo_shells' });
  b.ent('dingo', { pos: [-5, 0, -6], yaw: 0.5 });
  b.ent('dingo', { pos: [4, 0, 6], yaw: 2.5 });

  // ------------------------------------------------------------------ level 2 rooms
  b.air(-24, 12, -10, -10.6, 15.2, -4, { floor: 'metal_floor', wall: 'metal_panel', ceil: 'metal_panel' });
  b.carve(-10.9, 12, -9.6, -9.3, 14.4, -8);
  b.ent('door', { min: [-10.4, 12, -9.6], max: [-10.2, 14.4, -8], tex: 'door_red', move: [0, 2.35, 0], faces: { side: 'metal_panel', px: 'door_red', nx: 'door_red' } });
  b.detail(-9.85, 14.5, -9.8, -9.8, 15.0, -7.8, 'sign_armory');
  b.solid(-20, 12, -6, -15, 12.9, -4.6, { top: 'table_top', side: 'metal_panel' });
  b.ent('pickup', { item: 'weapon_rpg', pos: [-17.5, 12.9, -5.3], target: 'got_rpg' });
  b.ent('pickup', { item: 'ammo_rockets', pos: [-22, 12, -9] });
  b.ent('pickup', { item: 'ammo_rockets', pos: [-21, 12, -9] });
  b.ent('pickup', { item: 'ammo_grenades', pos: [-13, 12, -9.2] });
  b.ent('pickup', { item: 'ammo_argrenades', pos: [-12.2, 12, -9.2] });
  P.shelf(b, -23.8, -9.8, -22.2, -6, 12, 2.4);
  b.light(-17, 15.05, -7, { intensity: 1.4, radius: 9, color: [1, 0.85, 0.7] });
  b.ent('turret', { pos: [-22, 12, -6.5], yaw: Math.PI / 2 });
  // maintenance (east)
  b.air(10.6, 12, -10, 22, 15.2, -2, { floor: 'metal_floor', wall: 'metal_blue', ceil: 'metal_panel' });
  b.carve(9.3, 12, -9.6, 10.9, 14.4, -8);
  b.ent('door', { min: [10.2, 12, -9.6], max: [10.4, 14.4, -8], tex: 'door', move: [0, 2.35, 0], faces: { side: 'metal_panel', px: 'door', nx: 'door' } });
  P.lockers(b, 12, -2.5, 16, 12, 'nz');
  b.ent('charger', { pos: [21.98, 13.2, -6], facing: [-1, 0, 0], kind: 'health' });
  b.ent('pickup', { item: 'medkit', pos: [18, 12, -9] });
  b.ent('pickup', { item: 'battery', pos: [19, 12, -9] });
  b.ent('pickup', { item: 'battery', pos: [20, 12, -9] });
  b.light(16, 15.05, -6, { intensity: 1.3, radius: 9 });
  b.ent('soldier', { pos: [17, 12, -4], yaw: -Math.PI / 2, ambush: true, drop: 'ammo_9mm' });
  b.ent('soldier', { pos: [3, 12, -8.5], yaw: Math.PI, ambush: false, drop: 'medkit' });
  b.ent('soldier', { pos: [-5, 12, -8.5], yaw: Math.PI, grenades: 3 });

  // ------------------------------------------------------------------ level 3: launch control + rocket cache
  b.air(-8, 24, -24, 8, 28, -10.6, { floor: 'tile_floor', wall: 'lab_wall', ceil: 'ceiling' });
  b.carve(-1.2, 24, -10.9, 1.2, 26.6, -9.3);
  b.ent('door', { min: [-1.2, 24, -10.4], max: [1.2, 26.6, -10.2], tex: 'door', move: [0, 2.55, 0], faces: { side: 'metal_panel', pz: 'door', nz: 'door' } });
  b.carve(-7, 25.2, -10.9, -1.8, 27.4, -9.3);
  b.carve(1.8, 25.2, -10.9, 7, 27.4, -9.3);
  b.solid(-7, 25.2, -10.35, -1.8, 27.4, -10.25, 'glass', { castShadow: false });
  b.solid(1.8, 25.2, -10.35, 7, 27.4, -10.25, 'glass', { castShadow: false });
  P.consoleDesk(b, -7, -13, -2, -11.2, 24, 'pz', 'console');
  P.consoleDesk(b, 2, -13, 7, -11.2, 24, 'pz', 'console');
  P.computer(b, -5.5, 25, -12.4, 'pz', 'screen_radar');
  P.computer(b, 5.5, 25, -12.4, 'pz', 'screen_missile');
  b.solid(-1.2, 24, -15.5, 1.2, 25.0, -14.3, { side: 'metal_panel', pz: 'console', top: 'metal_panel' });
  b.ent('launch', { pos: [0, 25.2, -14.6], targetname: 'launchconsole', target: 'launch_go' });
  b.ent('glow', { pos: [0, 25.3, -14.2], size: 0.5, color: [1, 0.8, 0.2], alpha: 0.8 });
  b.ent('button', { targetname: 'silo_door_btn', min: [-7.85, 25, -16.5], max: [-7.6, 25.6, -15.9], tex: 'keypad_red', texOn: 'button_on', locked: true, lockedMsg: 'SILO DOORS LOCKED: insert the launch key and fuel the missile first.', label: 'OPEN SILO DOORS', target: ['silo_door_w', 'silo_door_e', 'doors_msg'], once: true });
  b.detail(-7.98, 25.8, -17, -7.95, 26.3, -15.4, 'sign_silo');
  b.detail(-4, 26, -23.98, 4, 27.5, -23.95, 'sign_launch');
  b.detail(7.95, 25.2, -20, 7.98, 26.8, -17, 'whiteboard');
  for (const [x, z] of [[-4, -15], [4, -15], [-4, -21], [4, -21]]) L(x, 27.85, z, { intensity: 1.3, radius: 8 });
  b.ent('soldier', { pos: [-4, 24, -19], yaw: 0, ambush: true, drop: 'ammo_9mm' });
  b.ent('soldier', { pos: [4, 24, -21], yaw: 0, ambush: true, variant: 'shotgun', drop: 'medkit' });
  b.ent('turret', { pos: [0, 28, -19], ceiling: true, yaw: 0 });
  // rocket cache alcove (east, level 3)
  b.air(10.6, 24, -3, 16, 27, 3, { floor: 'metal_floor', wall: 'metal_panel', ceil: 'metal_panel' });
  b.carve(9.3, 24, -2, 10.9, 26.4, 2);
  b.ent('pickup', { item: 'ammo_rockets', pos: [14.5, 24, -2] });
  b.ent('pickup', { item: 'ammo_rockets', pos: [14.5, 24, 2] });
  b.ent('pickup', { item: 'medkit', pos: [12, 24, 2.4] });
  b.ent('pickup', { item: 'battery', pos: [12, 24, -2.4] });
  b.ent('dispenser', { targetname: 'rocket_disp', pos: [15, 24, 0], interval: 10, item: 'ammo_rockets' });
  b.light(13.5, 26.85, 0, { intensity: 1.3, radius: 7, color: [1, 0.8, 0.5] });
  b.detail(15.97, 25, -1, 15.99, 26.5, 1, 'sign_nuclear');
  b.ent('soldier', { pos: [-3, 24, 8.5], yaw: 0.5 });
  b.ent('soldier', { pos: [8.5, 24, -3], yaw: -1.6, drop: 'ammo_9mm' });

  // ------------------------------------------------------------------ silo doors + mesa top
  b.ent('door', { targetname: 'silo_door_w', min: [-10.6, 40, -10.6], max: [0, 40.8, 10.6], tex: 'door_blast', move: [-11, 0, 0], speed: 1.1, wait: -1, triggerOnly: true, sound: 'blastdoor', faces: { side: 'hazard', top: 'metal_panel', bottom: 'metal_panel' }, target: 'doors_open' });
  b.ent('door', { targetname: 'silo_door_e', min: [0, 40, -10.6], max: [10.6, 40.8, 10.6], tex: 'door_blast', move: [11, 0, 0], speed: 1.1, wait: -1, triggerOnly: true, sound: 'blastdoor', faces: { side: 'hazard', top: 'metal_panel', bottom: 'metal_panel' } });
  b.air(-90, 40, -90, 90, 47, 90, { wall: 'rock', noCeil: true, noFloor: true, outer: true, t: 2 });
  b.solid(-90, 38, -90, -10.6, 40, 90, 'rock_dark');
  b.solid(10.6, 38, -90, 90, 40, 90, 'rock_dark');
  b.solid(-10.6, 38, -90, 10.6, 40, -10.6, 'rock_dark');
  b.solid(-10.6, 38, 10.6, 10.6, 40, 90, 'rock_dark');
  b.solid(-14, 40, -14, -10.6, 40.2, 14, 'concrete_dark');
  b.solid(10.6, 40, -14, 14, 40.2, 14, 'concrete_dark');
  b.solid(-10.6, 40, -14, 10.6, 40.2, -10.6, 'concrete_dark');
  b.solid(-10.6, 40, 10.6, 10.6, 40.2, 14, 'concrete_dark');
  for (const [x, z] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) P.lightPole(b, x, z, 7, [-x * 0.03, -1, -z * 0.03], [0.85, 0.9, 1.0], 40, 1.8, 20);
  P.fence(b, -30, 30, -30, 3, 'x', 40);
  P.fence(b, -30, 30, 30, 3, 'x', 40);
  P.fence(b, -30, 30, -30, 3, 'z', 40);
  P.fence(b, -30, 30, 30, 3, 'z', 40);
  b.ent('prop', { model: 'radar', pos: [40, 40, -25], yaw: 0.5 });
  b.ent('prop', { model: 'radar', pos: [-45, 40, 20], yaw: 2 });
  for (const [x, z] of [[-50, -40], [55, 40], [-30, 60], [60, -55], [20, -70]]) P.boulder(b, x, z, 1.5, 40, 'rock_dark');
  P.truck(b, 40, 15, 'z', 40);
  P.jeep(b, -40, -10, 'x', 40);
  // the gunship lurks out of sight until the doors open
  b.ent('gunship', { targetname: 'gunship', pos: [0, 48, -3], target: 'gunship_dead' });

  // ------------------------------------------------------------------ scripting
  b.ent('relay', { targetname: 'mapstart', target: ['ch3', 'obj_launch', 'obj_key', 'obj_fuel', 'pa_silo'] });
  b.ent('chapter', { targetname: 'ch3', title: 'SILO 7', sub: 'CHAPTER  THREE', music: 'explore' });
  b.ent('message', { targetname: 'pa_silo', speaker: 'H.O.P. SUIT', text: 'Nuclear device detected. Recommend: do not lick it.', delay: 6 });
  b.ent('objective', { targetname: 'obj_launch', id: 'launch', text: 'Launch the missile from Launch Control (Level 3).' });
  b.ent('objective', { targetname: 'obj_key', id: 'key', text: "Take the LAUNCH KEY from the Base Commander (Level 1, west)." });
  b.ent('objective', { targetname: 'obj_fuel', id: 'fuel', text: 'Fuel the missile: hold E on the valve (Level 1, east).' });
  b.ent('pickup', { item: 'medkit', pos: [-1.2, 0, 12] });
  b.ent('trigger', { min: [-10, 0, -10], max: [10, 6, 10], target: 'silo_awe', msg: 'Silo 7. One very large missile.', msgDur: 3 });
  b.ent('music', { targetname: 'silo_awe', track: 'menu' });
  b.ent('relay', { targetname: 'fuel_done', target: ['fuel_flag', 'fuel_msg', 'obj_fuel_done'] });
  b.ent('script', { targetname: 'fuel_flag', run: (g) => { g.flags.fuel = true; } });
  b.ent('message', { targetname: 'fuel_msg', speaker: 'PA SYSTEM', text: 'Warning. Missile fuelled. Whoever is doing that, please stop.', voice: 'tech' });
  b.ent('objective', { targetname: 'obj_fuel_done', complete: 'fuel' });
  b.ent('trigger', { min: [-30, 0, -10], max: [-10.6, 4, 10], target: 'commander_seen' });
  b.ent('relay', { targetname: 'commander_seen', target: 'save1' });
  b.ent('autosave', { targetname: 'save1' });
  b.ent('objective', { targetname: 'obj_key_done', complete: 'key' });
  b.ent('relay', { targetname: 'got_rpg', target: 'save2' });
  b.ent('autosave', { targetname: 'save2' });
  b.ent('relay', { targetname: 'key_inserted', target: [] });
  b.ent('relay', { targetname: 'doors_unlock', target: ['silo_door_btn', 'obj_doors'] });
  b.ent('objective', { targetname: 'obj_doors', id: 'doors', text: 'Open the silo doors (Launch Control).' });
  b.ent('message', { targetname: 'doors_msg', speaker: 'PA SYSTEM', text: 'Silo doors opening. Air support, the kangaroo is in the silo. Repeat, the kangaroo is in the silo.', voice: 'tech' });
  b.ent('relay', { targetname: 'doors_open', target: ['doors_flag', 'gunship', 'rocket_disp', 'obj_gunship', 'boss_music', 'gunship_squad', 'save3'], delay: 0 });
  b.ent('script', { targetname: 'doors_flag', run: (g) => { g.flags.doors = true; g.completeObjective('doors'); } });
  b.ent('objective', { targetname: 'obj_gunship', id: 'gunship', text: 'Destroy the gunship. Rockets in the Level 3 cache (east).' });
  b.ent('music', { targetname: 'boss_music', track: 'action', loop: true });
  b.ent('autosave', { targetname: 'save3' });
  b.ent('spawner', {
    targetname: 'gunship_squad',
    interval: 6,
    spawns: [
      { type: 'soldier', pos: [0, 24, 8.5], yaw: 0, hunt: true, drop: 'ammo_rockets' },
      { type: 'soldier', pos: [8.5, 24, 5], yaw: 0, hunt: true, drop: 'medkit' },
      { type: 'soldier', pos: [-6, 24, -8.5], yaw: 0, hunt: true, drop: 'ammo_rockets' },
    ],
  });
  b.ent('relay', { targetname: 'gunship_dead', target: ['gs_flag', 'gs_msg', 'stop_music'] });
  b.ent('script', { targetname: 'gs_flag', run: (g) => { g.flags.gunshipDead = true; g.completeObjective('gunship'); g.setObjective('turn', 'TURN THE KEY in Launch Control.'); g.autosave(); } });
  b.ent('message', { targetname: 'gs_msg', text: 'AIRSPACE CLEAR. Turn the key.', dur: 4 });
  b.ent('music', { targetname: 'stop_music', stop: true });
  b.ent('relay', { targetname: 'launch_go', target: ['alarm', 'launch_music', 'umbilical'] });
  b.ent('alarm', { targetname: 'alarm' });
  b.ent('music', { targetname: 'launch_music', track: 'finale' });
  return b.compile();
}
