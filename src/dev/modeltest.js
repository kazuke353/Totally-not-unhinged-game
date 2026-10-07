import * as THREE from 'three';
import { Renderer } from '../engine/renderer.js';
import { createSharedUniforms } from '../engine/materials.js';
import { KangarooModel } from '../game/kangaroo.js';

export async function modelTest() {
  const r = new Renderer(document.getElementById('game'));
  r.setScale(1);
  const shared = createSharedUniforms();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.35, 0.3, 0.3);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x6a3a22 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const poses = [
    { name: 'idle', s: { speed: 0, onGround: true, vy: 0, weapon: 'fists' }, time: 1 },
    { name: 'hop', s: { speed: 6, onGround: true, vy: 0, weapon: 'smg' }, time: 0.55 },
    { name: 'air', s: { speed: 6, onGround: false, vy: 5, weapon: 'pistol' }, time: 1 },
    { name: 'kick', s: { speed: 0, onGround: true, vy: 0, weapon: 'fists', action: 'kick', actionT: 0.5 }, time: 1 },
    { name: 'crouch', s: { speed: 0, onGround: true, vy: 0, crouch: true, weapon: 'shotgun' }, time: 1 },
    { name: 'rpg', s: { speed: 0, onGround: true, vy: 0, weapon: 'rpg' }, time: 1 },
  ];
  const args = (location.hash.split('=')[1] || '0.9').split(',');
  const yawView = parseFloat(args[0]);
  const only = args[1] !== undefined ? parseInt(args[1]) : -1;
  poses.forEach((p, i) => {
    if (only >= 0 && i !== only) return;
    const k = new KangarooModel(shared);
    k.setWeapon(p.s.weapon);
    k.setLight([0.55, 0.5, 0.48], [0.6, 0.55, 0.5]);
    k.root.position.set(only >= 0 ? 0 : (i - 2.5) * 1.3, 0, 0);
    scene.add(k.root);
    const st = { yaw: yawView, pitch: 0, speed: 0, onGround: true, vy: 0, crouch: false, charge: 0, action: null, actionT: 0, punchSide: 1, climbing: false, dead: false, pain: 0, ...p.s };
    for (let t = 0; t < p.time; t += 1 / 60) k.update(1 / 60, st);
  });
  if (only >= 0) { r.camera.position.set(0, 1.1, 2.4); r.camera.lookAt(0, 0.75, 0); }
  else { r.camera.position.set(0, 1.6, 6.5); r.camera.lookAt(0, 0.7, 0); }
  r.render(scene);
  window.__done = true;
}
