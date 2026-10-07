// CHAPTER 2: SECURITY COMPLEX
// Inside the mesa. A loop of corridors around offices, an armoury reachable
// through the vents, a two-level generator hall and a pitch black server room.
//
//            [ GENERATOR (2 lvl) ] [ELEV LOBBY] [ SERVER ROOM (dark) ]
//   W corr   ================ NORTH CORRIDOR ================   E corr
//     |      [ SECURITY ] [ ARMOURY ]   [ LAB: PROJECT EMU  ]      |
//     |      ================ MAIN CORRIDOR =================      |
//            [ BARRACKS ]  [ LOBBY / CHECKPOINT ]  [ MESS HALL ]
//                               [ decon ]
//                               [arrival lift]
import { MapBuilder } from './builder.js';
import * as P from './props.js';

export function buildComplex() {
  const b = new MapBuilder('complex');
  b.title = 'SECURITY COMPLEX';
  b.spawn = { pos: [0, 0, 3.4], yaw: 0 };
  b.lighting = { ambient: [0.09, 0.09, 0.1], luxel: 0.45, aoStrength: 0.7 };
  b.ambientSound = 'hum_loop';
  b.ambientVolume = 0.25;
  const L = (x, y, z, o = {}) => b.light(x, y, z, { intensity: 1.5, radius: 9, color: [0.92, 0.96, 1.0], ...o });

  // ------------------------------------------------------------------ arrival
  b.air(-2.5, 0, 0.4, 2.5, 3.2, 5.4, { floor: 'metal_floor', wall: 'metal_blue', ceil: 'metal_panel' });
  L(0, 3.05, 3, { intensity: 1.2, radius: 6 });
  b.carve(-1.5, 0, -0.1, 1.5, 2.6, 0.5);
  b.ent('door', { targetname: 'arrive_door', min: [-1.5, 0, 0.15], max: [1.5, 2.6, 0.25], tex: 'door_elevator', move: [0, 2.55, 0], speed: 1.2, wait: -1, triggerOnly: true, faces: { side: 'metal_panel', nz: 'door_elevator', pz: 'door_elevator' } });
  // decontamination corridor
  b.air(-2, 0, -8, 2, 3.2, 0, { floor: 'metal_floor', wall: 'tile_white', ceil: 'metal_panel' });
  for (const z of [-2, -6]) L(0, 3.05, z, { color: [1, 0.85, 0.4], intensity: 1.3, radius: 6, fixture: 'lamp_warm' });
  b.detail(-1.98, 0.1, -7.6, -1.95, 3.0, -0.4, 'hazard');
  b.detail(1.95, 0.1, -7.6, 1.98, 3.0, -0.4, 'hazard');
  b.carve(-1.5, 0, -8.5, 1.5, 2.8, -7.9);
  b.ent('door', { min: [-1.5, 0, -8.25], max: [1.5, 2.8, -8.15], tex: 'door_red', move: [0, 2.75, 0], speed: 2.5, wait: 3, faces: { side: 'metal_panel', nz: 'door', pz: 'door' } });

  // ------------------------------------------------------------------ lobby / checkpoint
  b.air(-12, 0, -21.6, 12, 5, -8.4, { floor: 'tile_floor', wall: 'office_wall', ceil: 'ceiling' });
  for (const [x, z] of [[-6, -12], [6, -12], [-6, -18], [6, -18], [0, -15]]) L(x, 4.85, z, { intensity: 1.4, radius: 10 });
  // reception desk + flags + posters
  b.solid(-6, 0, -17, 0.5, 1.1, -16.2, { side: 'wood', top: 'table_top' });
  b.solid(-6, 0, -17, -5.2, 1.1, -14, { side: 'wood', top: 'table_top' });
  P.computer(b, -3, 1.1, -16.6, 'pz', 'screen_green');
  b.detail(-11.97, 1.0, -14, -11.95, 2.5, -12.6, 'poster_wanted');
  b.detail(-11.97, 1.0, -18, -11.95, 2.5, -16.6, 'poster_safety');
  b.detail(-3, 3.2, -21.58, 3, 4.6, -21.55, 'flag');
  b.detail(-6.8, 3.0, -8.45, -2.2, 4.0, -8.42, 'sign_restricted');
  // security booth with glass + turret
  b.solid(6, 0, -14.2, 12, 1.0, -14, 'metal_panel');
  b.solid(6, 0, -14.2, 6.2, 3.0, -9, 'metal_panel');
  b.solid(6, 1.0, -14.2, 12, 1.05, -14, 'metal_panel');
  b.ent('breakable', { min: [6.2, 1.05, -14.15], max: [12, 3.0, -14.05], tex: 'glass', material: 'glass', health: 8 });
  b.ent('breakable', { min: [6.05, 1.0, -14], max: [6.15, 3.0, -9.2], tex: 'glass', material: 'glass', health: 8 });
  b.solid(6, 3.0, -14.2, 12, 3.1, -8.4, 'metal_panel');
  b.carve(10.5, 0, -14.3, 11.8, 1.0, -13.9);
  P.consoleDesk(b, 8, -10, 11.8, -9, 0, 'nz', 'console');
  b.ent('pickup', { item: 'ammo_9mm', pos: [9, 0, -12] });
  b.ent('soldier', { pos: [9, 0, -11.5], yaw: Math.PI, ambush: true, drop: 'ammo_9mm' });
  b.ent('turret', { pos: [0, 5, -11], ceiling: true, yaw: Math.PI, active: false, targetname: 'lobby_turret' });
  // turnstiles (hop over them)
  for (const x of [-3, -1, 1, 3]) b.solid(x - 0.1, 0, -19.6, x + 0.1, 1.0, -18.6, 'metal_panel');
  for (const x of [-2, 0, 2]) b.solid(x - 0.5, 0.9, -19.15, x + 0.5, 0.95, -19.05, 'pipe');
  b.ent('soldier', { pos: [-4, 0, -19.5], yaw: Math.PI, drop: 'medkit' });
  b.ent('searchlight', { pos: [-11.2, 4.4, -20.6], yaw: 0.8, sweep: 0.7, pitch: -0.5, speed: 0.5, range: 18, cone: 14, target: 'alarm', camera: true });
  b.ent('pickup', { item: 'battery', pos: [-5.6, 1.1, -15] });

  // ------------------------------------------------------------------ corridors (loop)
  b.air(-40, 0, -28, 40, 3.4, -22, { floor: 'concrete', wall: 'concrete_wall', ceil: 'ceiling' });
  b.carve(-3, 0, -22.1, 3, 3.0, -21.5); // lobby arch
  b.air(-46, 0, -62, -40.4, 3.4, -22, { floor: 'concrete', wall: 'concrete_wall', ceil: 'ceiling' });
  b.carve(-40.5, 0, -28, -39.9, 3.0, -22.2);
  b.air(40.4, 0, -62, 46, 3.4, -22, { floor: 'concrete', wall: 'concrete_wall', ceil: 'ceiling' });
  b.carve(39.9, 0, -28, 40.5, 3.0, -22.2);
  b.air(-46, 0, -68, 46, 3.4, -62.4, { floor: 'concrete', wall: 'concrete_wall', ceil: 'ceiling' });
  b.carve(-46, 0, -62.5, -40.4, 3.0, -61.9);
  b.carve(40.4, 0, -62.5, 46, 3.0, -61.9);
  for (let x = -36; x <= 36; x += 8) L(x, 3.25, -25, { intensity: 1.3, radius: 8 });
  for (let z = -30; z >= -58; z -= 8) {
    L(-43.2, 3.25, z, { intensity: 1.2, radius: 8 });
    L(43.2, 3.25, z, { intensity: 1.2, radius: 8 });
  }
  for (let x = -40; x <= 40; x += 8) L(x, 3.25, -65.2, { intensity: 1.2, radius: 8 });
  // signage
  b.detail(-29.5, 2.5, -27.98, -27.5, 3.0, -27.95, 'sign_security');
  b.detail(-11, 2.5, -27.98, -9, 3.0, -27.95, 'sign_armory');
  b.detail(8.5, 2.5, -27.98, 11.5, 3.0, -27.95, 'sign_lab');
  b.detail(-27.3, 2.5, -22.05, -25.3, 3.0, -22.02, 'sign_barracks');
  b.detail(25.3, 2.5, -22.05, 27.3, 3.0, -22.02, 'sign_mess');
  b.detail(-26, 2.5, -62.45, -23.5, 3.0, -62.42, 'sign_generator');
  b.detail(-1.5, 2.6, -68.0, 1.5, 3.1, -67.97, 'sign_elevator');
  b.detail(19.5, 2.5, -68.0, 22, 3.0, -67.97, 'sign_server');
  b.detail(45.98, 1.0, -44, 46.0, 2.4, -42, 'poster_emu');
  b.detail(-46.0, 1.0, -40, -45.98, 2.4, -38, 'poster_wanted');
  b.detail(-39.98, 1.0, -26, -39.95, 2.0, -24, 'map_board');
  // cover and clutter
  P.crateStack(b, 30, -26.6, [[0, 0, 0, true, 'ammo_9mm'], [1, 0, 0]], 1.0, 0, { tex: 'crate_metal' });
  P.crateStack(b, -33, -23.4, [[0, 0, 0], [0, 0, 1, true]], 1.0, 0, { tex: 'crate' });
  P.crateStack(b, 44.5, -46, [[0, 0, 0], [0, -1, 0, true, 'ammo_shells']], 1.0);
  b.ent('barrel', { pos: [-44.5, 0, -50] });
  b.ent('barrel', { pos: [-44.6, 0, -51.2] });
  P.pipeRunX(b, -46, 46, 3.0, -67.4, 0.15, 'pipe_red');
  P.pipeRunZ(b, -62, -22, 3.0, 45.5, 0.15, 'pipe');
  // corridor patrols / guards
  b.ent('soldier', { pos: [20, 0, -25], yaw: Math.PI / 2, patrol: [[-20, 0, -25], [20, 0, -25]] });
  b.ent('dingo', { pos: [43, 0, -40], yaw: 0 });
  b.ent('dingo', { pos: [-43, 0, -45], yaw: Math.PI });
  b.ent('charger', { pos: [-40.42, 1.2, -33], facing: [1, 0, 0], kind: 'health' });
  b.ent('charger', { pos: [40.42, 1.2, -55], facing: [-1, 0, 0], kind: 'suit' });

  // ------------------------------------------------------------------ barracks (vent entrance)
  b.air(-38, 0, -21.6, -15.6, 6, -8.4, { floor: 'carpet', wall: 'office_wall', ceil: 'ceiling' });
  b.carve(-27, 0, -22.1, -25.6, 2.4, -21.5);
  b.ent('door', { min: [-27, 0, -21.85], max: [-25.6, 2.4, -21.75], tex: 'door', move: [0, 2.35, 0] });
  for (const [x, z] of [[-34, -12], [-34, -16], [-28, -12], [-28, -16]]) P.bunk(b, x, z, 0, 'x');
  P.lockers(b, -37.5, -20.5, -32, 0, 'pz');
  P.lockers(b, -23, -20.5, -20, 0, 'pz');
  b.solid(-24, 0, -11.5, -20, 0.78, -9.5, { top: 'table_top', side: 'wood' });
  b.ent('pickup', { item: 'medkit', pos: [-23, 0.8, -10.5] });
  b.ent('pickup', { item: 'ammo_9mm', pos: [-21, 0.8, -10.3] });
  for (const [x, z] of [[-30, -10], [-24, -15], [-18, -12]]) L(x, 5.85, z, { intensity: 1.5, radius: 10, color: [1, 0.92, 0.8] });
  b.ent('soldier', { pos: [-31, 0, -14], yaw: 0, ambush: true, idleChat: true, idleLine: "Mate, I swear I saw a kangaroo in an orange vest earlier." });
  b.ent('soldier', { pos: [-20, 0, -17], yaw: -2.5, ambush: true });
  // vent: crates under the grate, duct over the corridor into the armoury
  // crate staircase up to the duct (each step is an easy hop)
  P.crateStack(b, -17.45, -21.12, [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 0, 3]], 0.95, 0, { tex: 'crate_metal' });
  P.crateStack(b, -18.4, -21.12, [[0, 0, 0], [0, 0, 1], [0, 0, 2]], 0.95, 0, { tex: 'crate_metal' });
  P.crateStack(b, -19.35, -21.12, [[0, 0, 0], [0, 0, 1]], 0.95, 0, { tex: 'crate_metal' });
  P.crateStack(b, -20.3, -21.12, [[0, 0, 0]], 0.95, 0, { tex: 'crate_metal' });
  b.air(-18, 3.8, -33, -16.9, 4.9, -21.6, { floor: 'vent', wall: 'vent', ceil: 'vent', noWalls: 's', t: 0.15 });
  b.ent('breakable', { min: [-18, 3.8, -21.75], max: [-16.9, 4.9, -21.65], tex: 'vent_grate', material: 'metal', health: 10 });
  b.carve(-18, 3.3, -33, -16.9, 3.9, -32);
  b.ent('breakable', { min: [-18, 3.42, -33], max: [-16.9, 3.52, -32], tex: 'vent_grate', material: 'metal', health: 10 });
  b.ent('trigger', { min: [-21, 0, -21.6], max: [-15.6, 4, -18.5], msg: 'A vent! Hop up the crates, kick the grate, then hold C to crawl in.', msgDur: 5 });
  b.ent('secret', { min: [-18, 3.8, -30], max: [-16.9, 4.9, -24] });
  b.light(-17.45, 4.7, -24, { intensity: 0.7, radius: 4, color: [0.7, 0.85, 1], fixture: null });
  b.light(-17.45, 4.7, -31, { intensity: 0.7, radius: 4, color: [0.7, 0.85, 1], fixture: null });
  b.ent('pickup', { item: 'battery', pos: [-17.45, 3.8, -27] });

  // ------------------------------------------------------------------ mess hall
  b.air(15.6, 0, -21.6, 38, 4, -8.4, { floor: 'tile_white', wall: 'lab_wall', ceil: 'ceiling' });
  b.carve(25.6, 0, -22.1, 27, 2.4, -21.5);
  b.ent('door', { min: [25.6, 0, -21.85], max: [27, 2.4, -21.75], tex: 'door', move: [0, 2.35, 0] });
  for (const [x, z] of [[20, -18], [27, -18], [20, -13], [27, -13]]) {
    b.solid(x - 2, 0.74, z - 0.6, x + 2, 0.8, z + 0.6, { top: 'table_top', side: 'metal_panel' });
    b.solid(x - 1.9, 0, z - 0.1, x + 1.9, 0.74, z + 0.1, 'metal_panel');
    b.solid(x - 2, 0.42, z - 1.2, x + 2, 0.48, z - 0.9, 'metal_panel');
    b.solid(x - 2, 0.42, z + 0.9, x + 2, 0.48, z + 1.2, 'metal_panel');
  }
  // kitchen counter + vending machines
  b.solid(33, 0, -21.4, 37.8, 1.0, -9, { top: 'metal_floor', side: 'metal_panel' });
  b.solid(31, 0, -9.8, 32.2, 2.2, -8.6, { side: 'metal_panel', nz: 'vending' });
  b.solid(29.6, 0, -9.8, 30.8, 2.2, -8.6, { side: 'metal_panel', nz: 'vending' });
  b.ent('pickup', { item: 'medkit', pos: [35, 1.0, -15] });
  b.ent('pickup', { item: 'ammo_9mm', pos: [35, 1.0, -12] });
  b.ent('pickup', { item: 'ammo_grenades', pos: [27, 0.8, -13] });
  for (const [x, z] of [[20, -15.5], [27, -15.5], [34, -15.5]]) L(x, 3.85, z, { intensity: 1.4, radius: 9 });
  b.ent('soldier', { pos: [20, 0, -16.5], yaw: Math.PI, ambush: true, idleChat: true, idleLine: 'Reckon the roos know about the missile?' });
  b.ent('soldier', { pos: [27, 0, -11.5], yaw: Math.PI, ambush: true });
  b.ent('soldier', { pos: [23, 0, -10], yaw: -2.6, ambush: true, variant: 'shotgun', drop: 'ammo_shells' });
  b.ent('soldier', { pos: [35, 0, -19], yaw: -1.6, ambush: true, drop: 'ammo_9mm' });
  b.ent('barrel', { pos: [16.4, 0, -20.8] });

  // ------------------------------------------------------------------ security office (red keycard)
  b.air(-38, 0, -42, -20, 3.4, -28.4, { floor: 'carpet', wall: 'office_wall', ceil: 'ceiling' });
  b.carve(-30, 0, -28.5, -28.6, 2.4, -27.9);
  b.ent('door', { min: [-30, 0, -28.25], max: [-28.6, 2.4, -28.15], tex: 'door', move: [0, 2.35, 0] });
  // CCTV wall
  b.solid(-37.9, 0, -41.8, -36.9, 1.0, -30, { side: 'metal_panel', px: 'console' });
  for (let z = -41; z < -30; z += 1.4) b.solid(-37.95, 1.5, z, -37.7, 2.4, z + 1.2, { side: 'metal_panel', px: z % 2.8 < 1.4 ? 'screen_cctv' : 'screen_radar' });
  P.desk(b, -29, -37, 0);
  P.computer(b, -29.4, 0.78, -37.2, 'pz', 'screen_green');
  b.ent('pickup', { item: 'keycard_red', pos: [-28.4, 0.8, -36.8], target: 'got_keycard' });
  P.desk(b, -24, -33, 0, 'z');
  P.shelf(b, -21.6, -41.8, -20.2, -38, 0, 2.2);
  b.detail(-20.05, 1.2, -36, -20.02, 2.4, -33, 'whiteboard');
  b.ent('button', { min: [-20.3, 1.2, -30.6], max: [-20.05, 1.6, -30.2], tex: 'button', target: 'armory_door', label: 'ARMOURY RELEASE', msg: 'ARMOURY DOOR UNLOCKED', once: true });
  b.detail(-20.05, 1.7, -31, -20.02, 2.1, -29.8, 'sign_armory');
  for (const [x, z] of [[-33, -32], [-25, -32], [-33, -39], [-25, -39]]) L(x, 3.25, z, { intensity: 1.3, radius: 8 });
  b.ent('soldier', { pos: [-29, 0, -39.5], yaw: 0, variant: 'commander', ambush: true, drop: 'ammo_9mmbox', idleChat: true, idleLine: 'Report! What do you mean a kangaroo took the gate?' });
  b.ent('soldier', { pos: [-35, 0, -33], yaw: 1.2, ambush: true });
  b.ent('turret', { pos: [-23, 3.4, -40], ceiling: true, yaw: 0.6 });

  // ------------------------------------------------------------------ armoury (locked; vent or button)
  b.air(-19, 0, -40, -4, 3.4, -28.4, { floor: 'metal_floor', wall: 'metal_panel', ceil: 'metal_panel' });
  b.carve(-10.7, 0, -28.5, -9.3, 2.4, -27.9);
  b.ent('door', { targetname: 'armory_door', min: [-10.7, 0, -28.25], max: [-9.3, 2.4, -28.15], tex: 'door_red', locked: true, lockedMsg: 'ARMOURY LOCKED. Release is in the Security Office... or find another way in.', move: [0, 2.35, 0], wait: -1 });
  P.shelf(b, -18.8, -39.8, -14, -39, 0, 2.4);
  P.shelf(b, -9, -39.8, -4.2, -39, 0, 2.4);
  b.solid(-13, 0, -36, -9, 0.9, -34, { top: 'table_top', side: 'metal_panel' });
  b.ent('pickup', { item: 'weapon_shotgun', pos: [-11, 0.9, -35] });
  b.ent('pickup', { item: 'ammo_shells', pos: [-16, 0, -38] });
  b.ent('pickup', { item: 'ammo_shells', pos: [-15, 0, -38] });
  b.ent('pickup', { item: 'ammo_9mmbox', pos: [-6, 0, -38] });
  b.ent('pickup', { item: 'ammo_argrenades', pos: [-7, 0, -38] });
  b.ent('pickup', { item: 'battery', pos: [-5, 0, -30] });
  b.ent('pickup', { item: 'ammo_grenades', pos: [-18, 0, -30] });
  P.crateStack(b, -6, -33, [[0, 0, 0], [0, 0, 1]], 1.0, 0, { tex: 'crate_ammo' });
  L(-11.5, 3.25, -34, { intensity: 1.4, radius: 10, color: [1, 0.85, 0.7] });
  b.ent('turret', { pos: [-11, 0, -31.5], yaw: 0, active: true });

  // ------------------------------------------------------------------ lab: Project EMU
  b.air(4, 0, -46, 38, 6, -28.4, { floor: 'tile_white', wall: 'lab_wall', ceil: 'metal_panel' });
  b.carve(9, 0, -28.5, 11, 2.6, -27.9);
  b.ent('door', { min: [9, 0, -28.25], max: [11, 2.6, -28.15], tex: 'door', move: [2, 0, 0], faces: { side: 'metal_panel', pz: 'door', nz: 'door' } });
  // containment pods
  for (const [x, z] of [[12, -40], [19, -40], [26, -40], [33, -40]]) {
    b.solid(x - 1.4, 0, z - 1.4, x + 1.4, 0.4, z + 1.4, 'metal_panel');
    b.solid(x - 1.4, 3.4, z - 1.4, x + 1.4, 3.9, z + 1.4, 'metal_panel');
    b.ent('breakable', { min: [x - 1.3, 0.4, z + 1.25], max: [x + 1.3, 3.4, z + 1.35], tex: 'glass', material: 'glass', health: 10 });
    b.solid(x - 1.35, 0.4, z - 1.35, x - 1.25, 3.4, z + 1.25, 'glass', { castShadow: false });
    b.solid(x + 1.25, 0.4, z - 1.35, x + 1.35, 3.4, z + 1.25, 'glass', { castShadow: false });
    b.solid(x - 1.35, 0.4, z - 1.35, x + 1.35, 3.4, z - 1.25, 'glass', { castShadow: false });
    b.light(x, 3.3, z, { color: [0.5, 1.0, 0.6], intensity: 1.2, radius: 5, fixture: 'light_blue' });
  }
  b.ent('prop', { model: 'emu', pos: [12, 0.4, -40], yaw: 0.4 });
  b.ent('prop', { model: 'emu', pos: [26, 0.4, -40], yaw: -0.3 });
  b.ent('prop', { model: 'emu', pos: [33, 0.4, -40], yaw: 0.1, scale: 0.8 });
  b.detail(14, 3.2, -45.98, 24, 4.7, -45.95, 'sign_lab');
  b.detail(30, 1.2, -45.98, 34, 3.2, -45.95, 'whiteboard');
  P.consoleDesk(b, 5, -32, 6, -29, 0, 'px', 'console');
  P.consoleDesk(b, 5, -36, 6, -33, 0, 'px', 'console');
  b.solid(14, 0, -33, 22, 0.95, -31, { top: 'metal_floor', side: 'metal_panel' });
  b.solid(26, 0, -33, 34, 0.95, -31, { top: 'metal_floor', side: 'metal_panel' });
  // radioactive spill
  b.detail(28, 0.01, -37, 31, 0.03, -35, 'light_blue');
  b.ent('hurt', { min: [28, 0, -37], max: [31, 1, -35], dps: 10, kind: 'radiation' });
  b.ent('glow', { pos: [29.5, 0.3, -36], size: 3, color: [0.3, 1, 0.4], alpha: 0.4 });
  b.ent('pickup', { item: 'ammo_shells', pos: [16, 0.95, -32] });
  b.ent('pickup', { item: 'battery', pos: [30, 0.95, -32] });
  b.ent('pickup', { item: 'medkit', pos: [36.5, 0, -30] });
  b.ent('charger', { pos: [37.98, 1.2, -36], facing: [-1, 0, 0], kind: 'health' });
  for (const [x, z] of [[9, -35], [18, -35], [27, -35], [35, -35]]) L(x, 5.85, z, { intensity: 1.4, radius: 11, color: [0.85, 1.0, 0.9] });
  b.ent('turret', { pos: [34, 0, -30], yaw: -1.9 });
  b.ent('turret', { pos: [8, 0, -44.5], yaw: 0.7, active: false, targetname: 'lab_turrets' });
  b.ent('soldier', { pos: [18, 0, -36], yaw: 0.2, ambush: true });
  b.ent('soldier', { pos: [30, 0, -44], yaw: -0.6, ambush: true, variant: 'shotgun', drop: 'ammo_shells' });
  b.ent('soldier', { pos: [12, 0, -30], yaw: 3, ambush: true, drop: 'ammo_9mm' });

  // ------------------------------------------------------------------ generator hall (2 levels)
  b.air(-40, -5, -92, -8, 6, -68.4, { floor: 'concrete_dark', wall: 'silo_wall', ceil: 'metal_panel' });
  b.carve(-26, 0, -68.5, -24, 2.6, -67.9);
  b.ent('door', { min: [-26, 0, -68.25], max: [-24, 2.6, -68.15], tex: 'door', move: [0, 2.55, 0] });
  // upper catwalk ring + stairs down
  P.catwalk(b, -40, -70.6, -8, -68.4, 0);
  P.catwalk(b, -10.2, -92, -8, -70.6, 0);
  P.railingX(b, -37.8, -10.2, -70.55, 0);
  P.railingZ(b, -92, -70.6, -10.25, 0);
  b.stairs(-40, -78.6, -37.8, -70.6, -5, 0, '+z', 'metal_floor', { side: 'metal_panel' });
  b.solid(-40, -5, -82, -37.8, -4.9, -78.6, 'metal_floor');
  // generators
  for (const [i, x] of [[1, -32], [2, -24], [3, -16]]) {
    b.solid(x - 2.2, -5, -86, x + 2.2, -1.6, -78, { side: 'generator', top: 'metal_panel' });
    b.solid(x - 1.2, -1.6, -84, x + 1.2, -0.2, -80, 'metal_blue');
    b.solid(x - 0.4, -0.2, -83, x + 0.4, 6, -82.2, 'pipe');
    b.ent('button', { targetname: 'breaker' + i, min: [x - 0.35, -3.9, -77.95], max: [x + 0.35, -3.3, -77.75], tex: 'keypad_red', texOn: 'button_on', target: ['power_count', 'breaker_fx' + i], label: 'THROW BREAKER ' + i, sound: 'button' });
    b.ent('hurt', { min: [x - 2.6, -5, -87.5], max: [x + 2.6, -2, -86], dps: 30, kind: 'shock', fx: 'spark', targetname: 'zap' + i });
    b.ent('relay', { targetname: 'breaker_fx' + i, target: 'zap' + i });
    b.light(x, -1.0, -76, { color: [1, 0.25, 0.15], intensity: 1.2, radius: 7, fixture: null });
    b.ent('glow', { pos: [x, -3.6, -77.7], size: 0.6, color: [1, 0.2, 0.1], alpha: 0.6 });
  }
  b.ent('sound', { pos: [-24, -3, -82], sound: 'hum_loop', volume: 0.6, ref: 6 });
  for (const [x, z] of [[-34, -74], [-14, -74], [-24, -90]]) L(x, 5.85, z, { intensity: 1.1, radius: 12, color: [1, 0.4, 0.3] });
  L(-24, 2.6, -69.4, { intensity: 1.0, radius: 7, fixture: null, color: [1, 0.9, 0.8] });
  P.pipeRunX(b, -40, -8, 4.5, -91.5, 0.3, 'pipe_red');
  P.pipeRunX(b, -40, -8, 3.6, -91.5, 0.2, 'pipe');
  P.crateStack(b, -37, -90, [[0, 0, 0], [1, 0, 0, true, 'medkit'], [0, 0, 1]], 1.2, -5);
  P.crateStack(b, -12, -90, [[0, 0, 0, true, 'ammo_9mm'], [-1, 0, 0]], 1.2, -5, { tex: 'crate_ammo' });
  b.ent('barrel', { pos: [-20, -5, -76.5] });
  b.ent('barrel', { pos: [-28, -5, -76.8] });
  b.ent('soldier', { pos: [-30, -5, -75], yaw: 0.5, ambush: true });
  b.ent('soldier', { pos: [-18, -5, -89], yaw: 0, ambush: true, grenades: 3 });
  b.ent('soldier', { pos: [-9.1, 0, -85], yaw: -1.2, ambush: true, drop: 'ammo_9mm' });
  b.ent('counter', { targetname: 'power_count', count: 3, target: 'power_on', progressMsg: 'BREAKERS: %n / %t' });
  b.ent('relay', { targetname: 'power_on', target: ['power_msg', 'silo_elev_door', 'obj_power_done', 'power_ambush', 'alarm', 'power_music'] });
  b.ent('message', { targetname: 'power_msg', speaker: 'PA SYSTEM', text: 'Main power restored. Silo elevator online. Also, the kangaroo is in the generator hall. Get it.', voice: 'tech' });
  b.ent('music', { targetname: 'power_music', track: 'action' });
  b.ent('spawner', {
    targetname: 'power_ambush',
    interval: 1.5,
    spawns: [
      { type: 'soldier', pos: [-30, 0, -65], yaw: Math.PI, hunt: true, drop: 'ammo_9mm' },
      { type: 'soldier', pos: [-20, 0, -65], yaw: Math.PI, hunt: true, variant: 'shotgun', drop: 'ammo_shells' },
      { type: 'dingo', pos: [-40, 0, -65], yaw: 0, hunt: true },
      { type: 'soldier', pos: [-10, 0, -65], yaw: Math.PI, hunt: true, grenades: 3 },
    ],
  });

  // ------------------------------------------------------------------ server room (dark)
  b.air(8, 0, -90, 40, 4, -68.4, { floor: 'metal_floor', wall: 'metal_blue', ceil: 'metal_panel' });
  b.carve(20, 0, -68.5, 21.4, 2.4, -67.9);
  b.ent('door', { min: [20, 0, -68.25], max: [21.4, 2.4, -68.15], tex: 'door', move: [0, 2.35, 0] });
  for (let x = 12; x <= 36; x += 6) {
    b.solid(x - 0.5, 0, -86, x + 0.5, 2.6, -74, 'server');
  }
  b.light(24, 3.85, -88, { color: [0.3, 0.45, 1.0], intensity: 0.8, radius: 8, fixture: 'light_blue' });
  b.light(10, 3.85, -71, { color: [0.3, 0.45, 1.0], intensity: 0.6, radius: 6, fixture: 'light_blue' });
  b.ent('trigger', { min: [8, 0, -73], max: [40, 3, -68.4], msg: "It's dark in here. Press F for your flashlight." });
  b.ent('dingo', { pos: [15, 0, -80], yaw: 0, ambush: true });
  b.ent('dingo', { pos: [27, 0, -84], yaw: 1, ambush: true });
  b.ent('dingo', { pos: [33, 0, -76], yaw: 2, ambush: true });
  b.ent('pickup', { item: 'battery', pos: [38.5, 0, -88.5] });
  b.ent('pickup', { item: 'battery', pos: [37.5, 0, -88.5] });
  b.ent('pickup', { item: 'medkit', pos: [9.5, 0, -88.5] });
  b.ent('pickup', { item: 'ammo_9mmbox', pos: [24, 0, -70] });
  b.ent('secret', { min: [36, 0, -90], max: [40, 3, -87] });
  b.ent('sound', { pos: [24, 1.5, -80], sound: 'hum_loop', volume: 0.4, ref: 5 });

  // ------------------------------------------------------------------ elevator lobby (red key) + silo lift
  b.air(-4.6, 0, -82, 4.6, 4, -68.4, { floor: 'tile_floor', wall: 'metal_blue', ceil: 'ceiling' });
  b.carve(-1, 0, -68.5, 1, 2.6, -67.9);
  b.ent('door', { targetname: 'redkey_door', min: [-1, 0, -68.25], max: [1, 2.6, -68.15], tex: 'door_red', locked: 'red', move: [0, 2.55, 0], wait: 5 });
  b.ent('glow', { pos: [1.4, 1.5, -67.9], size: 0.5, color: [1, 0.2, 0.1], alpha: 0.7 });
  b.detail(1.2, 1.2, -67.98, 1.6, 1.8, -67.95, 'keypad_red');
  L(0, 3.85, -72, { intensity: 1.3, radius: 8 });
  L(0, 3.85, -78, { intensity: 1.3, radius: 8, color: [1, 0.5, 0.4] });
  b.ent('soldier', { pos: [-2.5, 0, -79], yaw: 0, ambush: true, drop: 'medkit' });
  b.ent('soldier', { pos: [2.5, 0, -77], yaw: 0.3, ambush: true, drop: 'ammo_9mm' });
  b.detail(-2, 3.0, -81.98, 2, 3.6, -81.95, 'sign_elevator');
  b.air(-2, 0, -88, 2, 3.2, -82.4, { floor: 'metal_floor', wall: 'metal_blue', ceil: 'metal_panel' });
  b.carve(-1.5, 0, -82.5, 1.5, 2.6, -81.9);
  b.ent('door', { targetname: 'silo_elev_door', min: [-1.5, 0, -82.25], max: [1.5, 2.6, -82.15], tex: 'door_elevator', move: [0, 2.55, 0], wait: -1, triggerOnly: true, lockedMsg: 'NO POWER', faces: { side: 'metal_panel', pz: 'door_elevator', nz: 'door_elevator' } });
  b.ent('trigger', { min: [-2, 0, -82.2], max: [2, 3, -80], msg: 'ELEVATOR OFFLINE: NO POWER. Restore power in the Generator Hall.', msgDur: 4, requireFlag: '!power', once: false });
  L(0, 3.05, -85, { intensity: 1.0, radius: 5 });
  b.ent('changelevel', { min: [-1.8, 0, -87.6], max: [1.8, 3, -85] , map: 'silo' });

  // ------------------------------------------------------------------ scripting
  b.ent('relay', { targetname: 'mapstart', target: ['ch2', 'obj_elev', 'arrive_door', 'pa_arrive'], delay: 0 });
  b.ent('chapter', { targetname: 'ch2', title: 'SECURITY COMPLEX', sub: 'CHAPTER  TWO', music: 'explore' });
  b.ent('message', { targetname: 'pa_arrive', speaker: 'PA SYSTEM', text: 'Attention security personnel. A kangaroo has entered Level One. Do not let it kick you. Repeat. Do NOT let it kick you.', voice: 'tech', delay: 2 });
  b.ent('objective', { targetname: 'obj_elev', id: 'elev', text: 'Find the elevator down to Silo 7.' });
  b.ent('trigger', { min: [-6, 0, -68], max: [6, 3, -62.4], target: ['obj_key', 'obj_power'], msg: 'The silo elevator needs a RED KEYCARD and POWER.' });
  b.ent('objective', { targetname: 'obj_key', id: 'key', text: 'Find the RED KEYCARD (Security Office).' });
  b.ent('objective', { targetname: 'obj_power', id: 'power', text: 'Throw the 3 breakers in the Generator Hall.' });
  b.ent('objective', { targetname: 'got_keycard', complete: 'key' });
  b.ent('objective', { targetname: 'obj_power_done', complete: 'power' });
  b.ent('script', { targetname: 'obj_power_done', run: (g) => { g.flags.power = true; } });
  b.ent('alarm', { targetname: 'alarm' });
  b.ent('message', { targetname: 'alarm_on', speaker: 'PA SYSTEM', text: 'Security breach. All turrets online.', voice: 'tech', once: true });
  b.ent('trigger', { min: [-2, 0, -88], max: [2, 3, -82.4], target: 'obj_elev_done' });
  b.ent('objective', { targetname: 'obj_elev_done', complete: 'elev' });
  b.ent('autosave', { targetname: 'save_key' });
  b.ent('trigger', { min: [-46, 0, -68], max: [46, 3, -62.4], target: 'save_north' });
  b.ent('autosave', { targetname: 'save_north' });
  return b.compile();
}
