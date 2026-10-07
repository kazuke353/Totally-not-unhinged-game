// CHAPTER 1: OUTBACK PERIMETER
// Sunset in the red centre. Hop out of the canyon, get over (or through) the
// perimeter fence, cross the compound and open the bunker blast door.
//
//   N (-z)  [ mesa + bunker blast door + tunnel ]
//           [ compound: tower, kennels, barracks, comms shack, depot ]
//   ======  [ perimeter fence z=0, gate + guard booth, road ]
//           [ outback flats, dry creek ]
//   S (+z)  [ start canyon, rockfall ]
import { MapBuilder } from './builder.js';
import * as P from './props.js';

export function buildOutback() {
  const b = new MapBuilder('outback');
  b.title = 'OUTBACK PERIMETER';
  b.spawn = { pos: [0, 0, 104], yaw: 0 };
  const sunDir = [-0.7, 0.36, -0.42];
  b.lighting = {
    ambient: [0.2, 0.16, 0.2],
    sky: [0.38, 0.28, 0.36],
    sun: { dir: sunDir, color: [1.3, 0.78, 0.46] },
    luxel: 0.6,
    aoStrength: 0.6,
  };
  b.sky = {
    sunDir,
    top: [0.13, 0.12, 0.3],
    horizon: [0.98, 0.5, 0.26],
    bottom: [0.2, 0.08, 0.05],
    sunColor: [1, 0.62, 0.3],
    clouds: 0.55,
    cloudColor: [0.6, 0.32, 0.32],
    stars: 0.25,
    mountColor: [0.24, 0.1, 0.07],
    mountColor2: [0.5, 0.26, 0.24],
  };
  b.fog = { color: [0.55, 0.32, 0.26], near: 70, far: 300 };
  b.ambientSound = 'wind_loop';

  // ------------------------------------------------------------------ terrain
  b.air(-72, 0, -118, 72, 26, 112, { wall: 'rock', noCeil: true, noFloor: true, outer: true, t: 3 });
  b.ground(-72, -63, 72, 40, 0, 'dirt', 16, 2);
  b.ground(-72, 46, 72, 112, 0, 'dirt', 16, 2);
  b.ground(-72, 40, 72, 46, -1.6, 'dirt_dark', 16, 1.2);
  // creek crossing: rock steps and a footbridge
  b.solid(-32, -1.6, 38.6, -28, -0.8, 40, 'rock');
  b.solid(-32, -1.6, 46, -28, -0.8, 47.4, 'rock');
  b.solid(-32, -1.6, 44.4, -28, -0.8, 46, 'rock');
  b.solid(-32, -1.6, 40, -28, -0.8, 41.6, 'rock');
  b.solid(18, -0.12, 39.4, 22, 0.06, 46.6, { top: 'wood', side: 'wood' });
  b.solid(18, -1.6, 42.6, 18.3, 0, 43.4, 'wood');
  b.solid(21.7, -1.6, 42.6, 22, 0, 43.4, 'wood');
  for (const x of [-60, -45, 5, 40, 58]) P.boulder(b, x, 43, 0.6, -1.6, 'rock_dark');

  // start canyon walls (z 60..112) with irregular outcrops
  b.solid(-72, 0, 60, -19, 18, 112, 'rock');
  b.solid(19, 0, 60, 72, 18, 112, 'rock');
  const outcrops = [
    [-19, 64, -15, 70, 9], [-19, 92, -16, 98, 12], [-19, 104, -14, 112, 7], [-19, 76, -17, 84, 5],
    [16, 60, 19, 66, 10], [17, 100, 19, 108, 14], [15, 70, 19, 74, 4],
  ];
  for (const [x0, z0, x1, z1, h] of outcrops) b.solid(x0, 0, z0, x1, h, z1, 'rock');
  // kick tutorial alcove in the east wall
  b.solid(12, 0, 79.4, 19, 6, 80.6, 'rock');
  b.solid(12, 0, 86.4, 19, 6, 87.6, 'rock');
  b.solid(12, 3.2, 80.6, 19, 6, 86.4, 'rock');
  for (const z of [81.2, 82.4, 83.6, 84.8, 85.85]) {
    b.crate(12.0, 0, z, 1.1, { spawn: z === 83.6 ? 'ammo_9mm' : undefined });
    b.crate(12.0, 1.1, z, 1.1);
  }
  b.ent('pickup', { item: 'battery', pos: [16.5, 0, 82.5] });
  b.ent('pickup', { item: 'medkit', pos: [16.5, 0, 85] });
  b.light(15.5, 2.6, 83.5, { color: [1, 0.6, 0.3], intensity: 1.4, radius: 6, fixture: null });
  b.ent('glow', { pos: [17.8, 1.0, 83.5], size: 0.8, color: [1, 0.5, 0.2], alpha: 0.5 });
  // rockfall blocking the canyon (needs a super hop)
  const rf = [[-19, -10, 3.4], [-10, -3, 3.1], [-3, 4, 3.0], [4, 11, 3.6], [11, 19, 4.2]];
  for (const [x0, x1, h] of rf) b.solid(x0, 0, 65, x1, h, 71, 'rock_dark');
  b.solid(-6, 3.0, 66, 2, 3.6, 70, 'rock_dark');
  P.boulder(b, -12, 73, 0.9, 0, 'rock_dark');
  P.boulder(b, 8, 74, 0.7, 0, 'rock_dark');
  // practice ledges near the start
  b.solid(6, 0, 90, 9, 1.0, 93, 'rock');
  b.solid(9, 0, 89, 12, 1.1, 92, 'rock');
  b.solid(-14, 0, 86, -10, 1.0, 90, 'rock');
  // wrecked ute + campfire + sign
  P.ute(b, -9, 101);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.solid(-4 + Math.cos(a) * 0.6 - 0.15, 0, 96 + Math.sin(a) * 0.6 - 0.15, -4 + Math.cos(a) * 0.6 + 0.15, 0.25, 96 + Math.sin(a) * 0.6 + 0.15, 'rock_dark');
  }
  b.ent('hurt', { min: [-4.4, 0, 95.6], max: [-3.6, 0.6, 96.4], dps: 12, kind: 'fire', fx: 'fire' });
  b.light(-4, 0.9, 96, { color: [1, 0.55, 0.25], intensity: 1.9, radius: 9, fixture: null });
  b.ent('glow', { pos: [-4, 0.5, 96], size: 2.0, color: [1, 0.5, 0.2], alpha: 0.7, flicker: true });
  b.ent('sound', { pos: [-4, 0.5, 96], sound: 'fire_loop', volume: 0.35, ref: 2 });
  b.solid(3.8, 0, 98, 4.0, 2.2, 98.2, 'wood');
  b.detail(3.0, 1.6, 98.2, 4.8, 2.6, 98.3, 'sign_silo');
  for (const [x, z, s] of [[-14, 108, 1], [12, 106, 0.8], [-2, 86, 1.1], [6, 78, 0.9], [-15, 79, 1], [14, 96, 1]]) P.bush(b, x, z, s);
  P.deadTree(b, 10, 102, 1.2);

  // ------------------------------------------------------------------ outback flats
  const bushes = [
    [-50, 55], [-40, 30], [-25, 52], [-8, 33], [12, 54], [30, 28], [46, 50], [60, 34], [-62, 22], [-30, 20],
    [26, 8], [50, 14], [-55, 8], [64, 52], [-12, 50], [38, 36], [-44, 12], [8, 26], [54, 24], [-20, 28],
  ];
  for (const [x, z] of bushes) P.bush(b, x, z, 0.8 + ((x * 7 + z) % 5) * 0.1);
  for (const [x, z, h] of [[-36, 54, 2.4], [-52, 36, 1.8], [24, 52, 2.6], [44, 26, 2.0], [62, 46, 1.6], [-18, 36, 2.2]]) P.termiteMound(b, x, z, h);
  for (const [x, z, s] of [[-58, 52, 1.3], [48, 56, 1.1], [-26, 8, 1.0]]) P.deadTree(b, x, z, s);
  for (const [x, z, s] of [[34, 54, 1.2], [-44, 24, 1.0], [56, 6, 0.8], [-62, 50, 1.4]]) P.boulder(b, x, z, s);

  // perimeter road (east -> gate)
  b.solid(4, 0, 10, 72, 0.04, 18, 'road', { uvOffset: [0, 0.25] });
  b.solid(-4, 0, 0.05, 4, 0.04, 18, 'asphalt');
  // gate boom barrier
  b.solid(4.6, 0, 9.4, 5.0, 1.1, 9.8, 'hazard');
  b.detail(-3.8, 0.95, 9.5, 4.6, 1.05, 9.7, 'hazard');
  // cattle grid / closed road gate at the east edge
  P.fence(b, 9.9, 18.1, 71.5, 2.2, 'z');
  b.detail(66, 0, 18.4, 66.1, 2.5, 21, 'wood');
  b.detail(65.5, 1.6, 18.5, 67.5, 2.6, 18.6, 'sign_restricted');

  // ------------------------------------------------------------------ perimeter fence & gate
  P.fence(b, -72, -4, 0, 4, 'x');
  P.fence(b, 4, 72, 0, 4, 'x');
  b.solid(-4.3, 0, -0.3, -3.9, 4.6, 0.3, 'metal_panel');
  b.solid(3.9, 0, -0.3, 4.3, 4.6, 0.3, 'metal_panel');
  b.ent('door', {
    targetname: 'gate', min: [-3.9, 0, -0.06], max: [3.9, 4, 0.06], tex: 'fence', move: [7.8, 0, 0],
    speed: 1.6, wait: -1, triggerOnly: true, sound: 'door_move',
  });
  for (const x of [-60, -40, -20, 20, 40, 60]) b.detail(x - 1, 1.6, 0.04, x + 1, 2.6, 0.08, 'sign_restricted');
  b.detail(-7, 1.4, 0.04, -5.6, 2.8, 0.08, 'sign_noroos');
  P.lightPole(b, -6, 2.5, 7, [0.3, -1, 0.6]);
  P.lightPole(b, -40, -2, 8, [0, -1, 0.5]);
  P.lightPole(b, 40, -2, 8, [0, -1, 0.5]);

  // guard booth (south of the fence, east of the gate)
  b.air(6, 0, 2, 10.5, 2.8, 6.5, { floor: 'wood', wall: 'wood', ext: 'corrugated_green', roof: 'corrugated_green', ceil: 'wood', t: 0.2 });
  b.carve(5.6, 0, 3.6, 6.4, 2.2, 4.8); // doorway (west)
  b.carve(7, 1.1, 1.6, 9.6, 2.1, 2.4); // north window toward the gate
  b.ent('breakable', { min: [7, 1.1, 1.95], max: [9.6, 2.1, 2.05], tex: 'glass', material: 'glass', health: 5 });
  b.carve(10.1, 1.1, 3, 10.9, 2.1, 5.5); // east window
  b.ent('breakable', { min: [10.45, 1.1, 3], max: [10.55, 2.1, 5.5], tex: 'glass', material: 'glass', health: 5 });
  P.desk(b, 8.5, 2.7, 0);
  P.computer(b, 8.0, 0.78, 2.6, 'pz', 'screen_cctv');
  b.ent('pickup', { item: 'weapon_pistol', pos: [9.0, 0.8, 2.7] });
  b.ent('pickup', { item: 'ammo_9mm', pos: [9.6, 0, 5.8] });
  b.ent('pickup', { item: 'ammo_9mm', pos: [9.0, 0, 5.8] });
  b.ent('pickup', { item: 'medkit', pos: [6.8, 0, 6.0] });
  b.light(8.3, 2.6, 4.2, { intensity: 1.4, radius: 7, color: [1, 0.95, 0.8] });
  b.ent('button', { targetname: 'gatebtn', min: [10.2, 1.2, 5.6], max: [10.5, 1.5, 5.95], tex: 'button', target: ['gate', 'gate_alarm'], label: 'OPEN GATE', msg: 'GATE OPENING' });
  b.detail(10.48, 1.6, 5.4, 10.5, 1.9, 6.2, 'sign_restricted');
  b.ent('relay', { targetname: 'gate_alarm', target: 'alarm', delay: 2.5 });
  b.ent('soldier', { pos: [8.6, 0, 4.6], yaw: -Math.PI / 2, idleChat: true, idleLine: "Six more weeks guarding this dirt. Can't wait.", drop: 'ammo_9mm' });

  // ------------------------------------------------------------------ compound
  // dirt roads & concrete pads
  b.solid(-3, 0, -48, 3, 0.03, -0.1, 'dirt_road');
  b.solid(-16, 0, -63, 16, 0.04, -48, 'concrete');
  // helipad
  b.solid(-6, 0, -34, 6, 0.05, -22, 'concrete_dark');
  b.detail(-2.2, 0.05, -31, -1.4, 0.07, -25, 'white_paint');
  b.detail(1.4, 0.05, -31, 2.2, 0.07, -25, 'white_paint');
  b.detail(-1.4, 0.05, -28.4, 1.4, 0.07, -27.6, 'white_paint');
  // watchtower + searchlight + guard
  const tw = P.watchtower(b, -30, -12, 7);
  b.ent('searchlight', { pos: [-30, 9.1, -10.2], yaw: 0, sweep: 1.0, pitch: -0.42, speed: 0.33, range: 42, cone: 9, target: 'alarm' });
  b.ent('soldier', { pos: [-30.5, 7, -13], yaw: 0, ambush: true, drop: 'ammo_9mm' });
  b.ent('pickup', { item: 'battery', pos: [-31.5, 7, -13.5] });
  b.ent('alarmlight', { pos: [-30, 10.15, -12], siren: true });
  // sandbag nests
  P.sandbags(b, -15, -20, -9, -19.2, 1.1);
  P.sandbags(b, -15, -24, -14.2, -19.2, 1.1);
  P.sandbags(b, -9.8, -24, -9, -19.2, 1.1);
  b.ent('soldier', { pos: [-13.2, 0, -21.5], yaw: 0.3, grenades: 2 });
  b.ent('soldier', { pos: [-10.8, 0, -21.8], yaw: -0.2, drop: 'ammo_9mm' });
  P.sandbags(b, 11, -16, 17, -15.2, 1.1);
  P.sandbags(b, 16.2, -20, 17, -15.2, 1.1);
  b.ent('soldier', { pos: [14, 0, -17.5], yaw: 0 });
  b.ent('barrel', { pos: [11.5, 0, -18] });
  b.ent('barrel', { pos: [-16, 0, -18] });
  // patrol
  b.ent('soldier', { pos: [2, 0, -10], yaw: 1.5, patrol: [[20, 0, -8], [20, 0, -40], [-4, 0, -42], [2, 0, -10]] });
  // crate cover
  P.crateStack(b, 6, -22, [[0, 0, 0, true, 'ammo_9mm'], [1, 0, 0], [0.5, 0, 1]], 1.2);
  P.crateStack(b, -21, -6, [[0, 0, 0], [0, 1, 0, true], [1, 0, 0, true, 'medkit']], 1.2);
  P.crateStack(b, 25, -50, [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0.5, 0.5, 1]], 1.2, 0, { tex: 'crate_ammo' });

  // dingo kennel (east) - gate opens when the alarm sounds
  P.fence(b, 30, 44, -12, 2.4, 'x');
  P.fence(b, 30, 44, -2, 2.4, 'x');
  P.fence(b, -12, -2, 44, 2.4, 'z');
  P.fence(b, -12, -9, 30, 2.4, 'z');
  P.fence(b, -5, -2, 30, 2.4, 'z');
  b.ent('door', { targetname: 'kennel_gate', min: [29.95, 0, -9], max: [30.05, 2.4, -5], tex: 'fence', move: [0, 0, 3.8], speed: 2, wait: -1, triggerOnly: true, openOnAlarm: true });
  b.solid(38, 0, -11.6, 43.6, 1.6, -8, { side: 'wood', top: 'corrugated' });
  b.solid(38, 0, -6, 43.6, 1.6, -2.4, { side: 'wood', top: 'corrugated' });
  b.ent('dingo', { pos: [35, 0, -8], yaw: -1.2, sleeping: true });
  b.ent('dingo', { pos: [36.5, 0, -5], yaw: -2.0, sleeping: true });
  b.ent('dingo', { pos: [34, 0, -4], yaw: 2.2, sleeping: true });
  b.light(37, 3.2, -7, { intensity: 1.2, radius: 8, color: [1, 0.85, 0.6], fixture: null });

  // barracks hut (east)
  b.air(18, 0, -36, 32, 3, -24, { floor: 'wood', wall: 'wood', ext: 'corrugated', roof: 'corrugated', ceil: 'wood', t: 0.25 });
  b.carve(17.5, 0, -31.2, 18.5, 2.3, -29.6);
  b.carve(22, 1.2, -24.4, 25, 2.2, -23.5);
  b.ent('breakable', { min: [22, 1.2, -23.9], max: [25, 2.2, -23.8], tex: 'glass', material: 'glass', health: 5 });
  b.carve(27, 1.2, -24.4, 30, 2.2, -23.5);
  b.ent('breakable', { min: [27, 1.2, -23.9], max: [30, 2.2, -23.8], tex: 'glass', material: 'glass', health: 5 });
  for (const x of [21, 24, 27, 30]) P.bunk(b, x, -34.8, 0, 'x');
  P.lockers(b, 19, -24.5, 22, 0, 'nz');
  b.solid(24, 0, -30.5, 28, 0.78, -28.5, { top: 'table_top', side: 'wood' });
  b.ent('pickup', { item: 'medkit', pos: [25, 0.8, -29.5] });
  b.ent('pickup', { item: 'ammo_grenades', pos: [27, 0.8, -29.4] });
  b.ent('pickup', { item: 'battery', pos: [31, 0, -25] });
  b.ent('pickup', { item: 'ammo_9mm', pos: [19.5, 0, -33] });
  b.detail(31.9, 1.0, -30, 31.95, 2.4, -28, 'poster_wanted');
  b.light(22, 2.85, -30, { intensity: 1.3, radius: 8 });
  b.light(29, 2.85, -30, { intensity: 1.3, radius: 8 });
  b.ent('soldier', { pos: [29, 0, -31], yaw: -Math.PI / 2, ambush: true, idleChat: true, idleLine: 'Who trained the dingoes to salute? That is what I want to know.' });

  // comms shack (west) - locked door, roof hatch entry
  b.air(-44, 0, -52, -32, 3.2, -42, { floor: 'concrete', wall: 'concrete_wall', ext: 'bunker', roof: 'concrete_dark', ceil: 'ceiling', t: 0.4 });
  b.carve(-32.5, 0, -48.2, -31.5, 2.4, -46.8);
  b.ent('door', { targetname: 'comms_door', min: [-32.1, 0, -48.2], max: [-31.9, 2.4, -46.8], tex: 'door_red', locked: true, lockedMsg: "LOCKED. That roof hatch looks flimsy, though...", move: [0, 0, 1.4], wait: -1 });
  b.detail(-31.55, 2.5, -48.6, -31.5, 3.0, -46.4, 'sign_comms');
  b.carve(-40.5, 3.1, -48.5, -39.3, 3.7, -47.3); // roof hatch
  b.ent('breakable', { min: [-40.5, 3.38, -48.5], max: [-39.3, 3.52, -47.3], tex: 'vent_grate', material: 'metal', health: 12 });
  // climb aid: crates beside the shack (super hop from the stack)
  P.crateStack(b, -30.6, -44, [[0, 0, 0], [0, -1, 0], [0, -1, 1]], 1.0, 0, { tex: 'crate_metal' });
  b.solid(-31.3, 0, -51.5, -30.3, 1.0, -50.5, 'crate_metal');
  // interior
  P.consoleDesk(b, -43.6, -51.6, -40, -50.6, 0, 'pz', 'console');
  P.computer(b, -42.5, 1.0, -51.2, 'pz', 'screen_radar');
  P.computer(b, -41.2, 1.0, -51.2, 'pz', 'screen_green');
  b.ent('button', { targetname: 'override', min: [-38.5, 1.1, -51.95], max: [-37.9, 1.7, -51.75], tex: 'keypad_red', texOn: 'button_on', label: 'BLAST DOOR OVERRIDE', target: ['blastdoor', 'override_seq', 'comms_door'], msg: 'BLAST DOOR OVERRIDE ENGAGED' });
  b.detail(-39, 1.8, -51.98, -37.4, 2.2, -51.95, 'sign_restricted');
  b.ent('pickup', { item: 'weapon_smg', pos: [-35, 0, -50.5] });
  b.ent('pickup', { item: 'ammo_argrenades', pos: [-34, 0, -51] });
  b.ent('pickup', { item: 'ammo_9mm', pos: [-43, 0, -43] });
  b.ent('pickup', { item: 'medkit', pos: [-42, 0, -43] });
  P.shelf(b, -43.8, -46, -43.2, -43.5, 0, 2);
  b.detail(-32.04, 1.0, -45.5, -32.0, 2.0, -43.5, 'map_board');
  b.light(-38, 3.05, -47, { intensity: 1.5, radius: 9, color: [0.85, 0.95, 1] });
  b.ent('soldier', { pos: [-36, 0, -45], yaw: Math.PI / 2, ambush: true });

  // vehicle depot (west)
  P.truck(b, -16, -40, 'z');
  P.truck(b, -24, -53.5, 'z');
  P.jeep(b, 10, -44, 'x');
  P.fuelTank(b, -54, -24);
  for (const [x, z] of [[-50, -20.5], [-49.2, -21.3], [-57.5, -21], [-22, -46]]) b.ent('barrel', { pos: [x, 0, z] });
  b.ent('pickup', { item: 'medkit', pos: [-52, 0, -27] });
  b.ent('soldier', { pos: [-19, 0, -46], yaw: 0.6, idleChat: true, idleLine: 'Sarge says the nuke is just for emergencies. What emergencies?' });
  P.lightPole(b, -36, -30, 8, [0.4, -1, 0]);
  P.lightPole(b, 20, -44, 8, [-0.3, -1, 0.2]);

  // water tower (north-east) - secret on top
  const wtTop = P.waterTower(b, 46, -46, 10);
  b.ent('pickup', { item: 'battery', pos: [45, wtTop, -46] });
  b.ent('pickup', { item: 'battery', pos: [47, wtTop, -46] });
  b.ent('pickup', { item: 'ammo_9mmbox', pos: [46, wtTop, -45] });
  b.ent('secret', { min: [43, wtTop, -49], max: [49, wtTop + 2, -43] });

  // ------------------------------------------------------------------ mesa + bunker
  b.solid(-72, 0, -118, -6, 16, -63, 'rock');
  b.solid(6, 0, -118, 72, 16, -63, 'rock');
  b.solid(-6, 7.2, -118, 6, 16, -63, 'rock');
  const ledges = [[-72, -50, 6, 4], [-50, -32, 3, 2], [30, 52, 5, 3], [52, 72, 9, 5], [-32, -20, 1.5, 1], [20, 30, 2.5, 1.5]];
  for (const [x0, x1, h, d] of ledges) b.solid(x0, 0, -63, x1, h, -63 + d, 'rock');
  // secret ledge, reachable with a super hop from the truck roof
  b.solid(-27, 5.1, -63, -21, 5.6, -60.5, 'rock');
  b.ent('pickup', { item: 'ammo_grenades', pos: [-25, 5.6, -62] });
  b.ent('pickup', { item: 'battery', pos: [-23, 5.6, -62] });
  b.ent('secret', { min: [-27, 5.6, -63], max: [-21, 7.6, -60.5] });
  // bunker facade
  b.solid(-20, 0, -63.2, -4.4, 9, -62, 'bunker');
  b.solid(4.4, 0, -63.2, 20, 9, -62, 'bunker');
  b.solid(-4.4, 6.4, -63.2, 4.4, 9, -62, 'bunker');
  b.solid(-20.5, 9, -63.4, 20.5, 9.5, -61.6, 'concrete_dark');
  b.solid(-4.8, 0, -62.2, -4.4, 6.4, -61.6, 'hazard');
  b.solid(4.4, 0, -62.2, 4.8, 6.4, -61.6, 'hazard');
  b.detail(-1.6, 6.8, -61.98, 1.6, 8.6, -61.95, 'sign_silo');
  b.detail(-12, 3.2, -61.98, -8, 5.2, -61.95, 'sign_restricted');
  b.detail(8, 3.2, -61.98, 12, 5.2, -61.95, 'sign_nuclear');
  // personnel door (permanently sealed)
  b.solid(12.5, 0, -62.1, 13.9, 2.4, -61.9, { side: 'metal_panel', pz: 'door_red' });
  b.detail(12.3, 2.5, -61.9, 14.1, 2.9, -61.85, 'sign_security');
  b.ent('alarmlight', { pos: [-6, 7.6, -61.6], siren: true });
  b.ent('alarmlight', { pos: [6, 7.6, -61.6] });
  P.wallLamp(b, -9, 6.0, -61.8, 0, 1, { radius: 12, intensity: 2.0 });
  P.wallLamp(b, 9, 6.0, -61.8, 0, 1, { radius: 12, intensity: 2.0 });
  P.lightPole(b, -14, -54, 7, [0.5, -1, -0.4], [0.8, 0.9, 1.0]);
  P.lightPole(b, 14, -54, 7, [-0.5, -1, -0.4], [0.8, 0.9, 1.0]);
  b.ent('soldier', { pos: [-6, 0, -58], yaw: 0.2 });
  b.ent('soldier', { pos: [8, 0, -57], yaw: -0.3, variant: 'rifle', drop: 'ammo_9mm' });

  // blast door + tunnel
  b.carve(-4.4, 0, -63.6, 4.4, 6.4, -61.4);
  b.ent('door', {
    targetname: 'blastdoor', min: [-4.4, 0, -62.9], max: [4.4, 6.4, -62.3], tex: 'door_blast', move: [0, 6.3, 0],
    speed: 0.9, wait: -1, triggerOnly: true, sound: 'blastdoor', target: 'blast_open',
    faces: { side: 'metal_panel', pz: 'door_blast', nz: 'door_blast' },
  });
  b.air(-5, 0, -103, 5, 6.6, -63.4, { floor: 'concrete_dark', wall: 'concrete_wall', ceil: 'metal_panel', t: 0.4, ext: 'rock' });
  for (const z of [-68, -76, -84, -92]) b.light(0, 6.45, z, { intensity: 1.6, radius: 10, color: [1, 0.95, 0.85] });
  b.solid(-5, 0, -96.6, 5, 0.05, -95.4, 'hazard');
  b.ent('charger', { pos: [-4.98, 1.2, -80], facing: [1, 0, 0], kind: 'health' });
  b.ent('charger', { pos: [4.98, 1.2, -80], facing: [-1, 0, 0], kind: 'suit' });
  P.crateStack(b, -3.6, -72, [[0, 0, 0], [0, 1, 0, true, 'ammo_9mm'], [0, 0, 1]], 1.0, 0, { tex: 'crate_ammo' });
  P.crateStack(b, 3.4, -88, [[0, 0, 0, true, 'ammo_argrenades'], [0, -1, 0]], 1.0, 0);
  b.detail(-4.98, 1.0, -70, -4.95, 2.4, -68, 'poster_safety');
  b.detail(4.95, 1.0, -74, 4.98, 2.4, -72, 'poster_emu');
  b.ent('door', { targetname: 'tunnel_door', min: [-3, 0, -99.1], max: [3, 4, -98.9], tex: 'door_elevator', move: [-6, 0, 0], speed: 2, wait: -1, faces: { side: 'metal_panel', pz: 'door_elevator' }, triggerOnly: true });
  // elevator car beyond the door
  b.solid(-5, 0, -103, 5, 0.1, -99.2, 'metal_floor');
  b.solid(-5, 0, -103, -4.8, 4, -99.2, 'metal_blue');
  b.solid(4.8, 0, -103, 5, 4, -99.2, 'metal_blue');
  b.solid(-5, 0, -103, 5, 4, -102.8, 'metal_blue');
  b.solid(-5, 4, -103, 5, 4.2, -99.2, 'metal_panel');
  b.light(0, 3.9, -101, { intensity: 1.3, radius: 6, color: [0.85, 0.9, 1] });
  b.solid(-5, 4, -99.2, 5, 6.6, -98.8, 'metal_panel');
  b.solid(-5, 0, -99.2, -3, 4, -98.8, 'metal_panel');
  b.solid(3, 0, -99.2, 5, 4, -98.8, 'metal_panel');
  b.detail(-1.5, 4.2, -98.78, 1.5, 4.95, -98.75, 'sign_elevator');
  b.ent('changelevel', { min: [-3, 0, -102.6], max: [3, 3, -100.6], map: 'complex' });
  b.ent('autosave', { targetname: 'tunnel_save' });
  b.ent('trigger', { min: [-5, 0, -66], max: [5, 6, -64], target: ['tunnel_save', 'obj_tunnel'] });

  // ------------------------------------------------------------------ lights (outdoor)
  b.light(8, 6, 14, { intensity: 1.2, radius: 14, color: [1, 0.85, 0.6], fixture: null });

  // ------------------------------------------------------------------ scripting
  b.ent('relay', { targetname: 'mapstart', target: ['ch1', 'obj_fence', 'hint_start'] });
  b.ent('chapter', { targetname: 'ch1', title: 'OUTBACK PERIMETER', sub: 'CHAPTER  ONE', music: 'explore' });
  b.ent('message', { targetname: 'hint_start', text: 'WASD to hop around. Hold SPACE to keep bouncing.', delay: 0 });
  b.ent('objective', { targetname: 'obj_fence', id: 'fence', text: 'Get past the perimeter fence of Silo 7.' });
  b.ent('trigger', { min: [-19, 0, 82], max: [12, 6, 92], msg: 'KICK with MOUSE1 or Q. Kangaroo kicks break wooden crates.' });
  b.ent('trigger', { min: [-19, 0, 71], max: [19, 6, 79], msg: 'Too high to hop. Hold C to coil your legs... then press SPACE for a SUPER HOP!', msgDur: 6 });
  b.ent('trigger', { min: [-72, 0, 4], max: [72, 8, 30], msg: 'The fence is 4m tall. A SUPER HOP clears it. Mind the searchlight... or shoot it out.', msgDur: 6 });
  b.ent('trigger', { min: [-72, 0, -60], max: [72, 20, -1.5], target: ['obj_bunker', 'save_inside'] });
  b.ent('objective', { targetname: 'obj_bunker', id: 'bunker', complete: 'fence', text: 'Find a way into the bunker in the mesa.' });
  b.ent('autosave', { targetname: 'save_inside' });
  b.ent('trigger', { min: [-16, 0, -62], max: [16, 8, -55], target: 'obj_comms', msg: 'BLAST DOOR SEALED. Override controls are in the COMMS shack to the west.', msgDur: 5 });
  b.ent('objective', { targetname: 'obj_comms', id: 'comms', complete: 'bunker', text: 'Open the blast door from the COMMS shack (west).' });
  b.ent('trigger', { min: [-44, 3.5, -52], max: [-32, 6, -42], msg: 'Kick or shoot the roof hatch.', msgDur: 3 });
  b.ent('relay', { targetname: 'override_seq', target: ['alarm', 'obj_enter', 'bunker_squad', 'pa_override', 'action_music'] });
  b.ent('objective', { targetname: 'obj_enter', id: 'enter', complete: 'comms', text: 'Get into the bunker before the ODF regroups.' });
  b.ent('objective', { targetname: 'obj_tunnel', id: 'tunnel', complete: 'enter', text: 'Take the tunnel down into the Security Complex.' });
  b.ent('music', { targetname: 'action_music', track: 'action' });
  b.ent('music', { targetname: 'music1', track: 'explore' });
  b.ent('message', { targetname: 'pa_override', speaker: 'PA SYSTEM', text: 'Attention. Blast door override detected. All units to the bunker entrance. Shoot the kangaroo.', voice: 'tech' });
  b.ent('alarm', { targetname: 'alarm' });
  b.ent('message', { targetname: 'alarm_on', speaker: 'PA SYSTEM', text: 'Intruder alert. There is a kangaroo in the compound. This is not a drill.', voice: 'tech', once: true });
  b.ent('spawner', {
    targetname: 'bunker_squad',
    interval: 1.2,
    spawns: [
      { type: 'soldier', pos: [-2, 0, -78], yaw: Math.PI, hunt: true, drop: 'ammo_9mm' },
      { type: 'soldier', pos: [2, 0, -82], yaw: Math.PI, hunt: true, grenades: 3 },
      { type: 'soldier', pos: [0, 0, -86], yaw: Math.PI, hunt: true, drop: 'medkit' },
      { type: 'soldier', pos: [-2, 0, -90], yaw: Math.PI, hunt: true, drop: 'ammo_argrenades' },
    ],
  });
  b.ent('relay', { targetname: 'blast_open', target: 'blast_msg' });
  b.ent('message', { targetname: 'blast_msg', text: 'THE BLAST DOOR IS OPEN', dur: 3 });
  b.ent('trigger', { min: [-5, 0, -98], max: [5, 6, -93], target: 'tunnel_door' });
  return b.compile();
}
