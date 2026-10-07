import * as THREE from 'three';
import { Renderer } from '../engine/renderer.js';
import { generateTextures } from '../engine/textures.js';
import { World } from '../engine/world.js';
import { createSharedUniforms } from '../engine/materials.js';
import { createSky } from '../engine/sky.js';
import { MapBuilder } from '../maps/builder.js';

export async function lightTest() {
  const r = new Renderer(document.getElementById('game'));
  const tex = generateTextures();
  const b = new MapBuilder('test');
  // outdoor yard
  b.air(-30, 0, -30, 30, 12, 30, { floor: 'dirt', wall: 'rock', noCeil: true, outer: true });
  // building with door
  b.air(-8, 0, -20, 8, 3.5, -8, { floor: 'tile_floor', wall: 'office_wall', ceil: 'ceiling', ext: 'bunker', roof: 'concrete_dark' });
  b.air(-1, 0, -8.01, 1, 2.6, -7.0, { floor: 'tile_floor', wall: 'office_wall' }); // doorway into yard
  b.solid(10, 0, 0, 10.05, 4, 20, 'fence');
  b.crate(4, 0, 4, 1.2);
  b.solid(-6, 0, 2, -3, 1.2, 4, 'sandbag');
  b.solid(-10, 0, 10, -8, 5, 12, 'bunker');
  b.light(0, 3.3, -14, { radius: 10, intensity: 1.6 });
  b.light(-5, 3.3, -14, { radius: 8, intensity: 1.2, color: [1, 0.8, 0.6] });
  b.lighting.ambient = [0.1, 0.09, 0.12];
  b.lighting.sun = { dir: [0.6, 0.35, -0.5], color: [1.0, 0.62, 0.38] };
  b.lighting.sky = [0.3, 0.26, 0.36];
  const map = b.compile();
  const world = new World();
  for (const br of map.brushes) world.add(br);
  const shared = createSharedUniforms();
  const t0 = performance.now();
  await world.build(tex, map.lighting, shared, (p) => {});
  console.log('bake ms', performance.now() - t0, 'brushes', map.brushes.length, 'lm', world.lightmap.width, world.lightmap.height);
  const scene = new THREE.Scene();
  scene.add(world.group);
  const sky = createSky({ sunDir: [0.6, 0.35, -0.5], top: [0.15, 0.2, 0.42], horizon: [0.95, 0.55, 0.3], clouds: 0.6 });
  scene.add(sky);
  const views = {
    yard: [[0, 1.7, 20], [0, 1.5, -10]],
    room: [[5, 1.7, -10], [-5, 1, -18]],
    sky: [[0, 1.7, 0], [10, 4, -10]],
  };
  const v = views[location.hash.split('=')[1] || 'yard'] || views.yard;
  r.camera.position.set(...v[0]);
  r.camera.lookAt(...v[1]);
  r.render(scene);
  window.__done = true;
}
