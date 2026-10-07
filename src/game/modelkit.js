// Tiny procedural modelling kit: low-poly primitives with baked vertex
// colours, merged per bone so each animated part is a single draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createModelMaterial } from '../engine/materials.js';

export const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

function finish(g, color) {
  if (g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const pos = g.attributes.position;
  for (let i = 0; i < n; i++) {
    let c = color;
    if (typeof color === 'function') c = color(pos.getX(i), pos.getY(i), pos.getZ(i));
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

// Each primitive accepts a transform {p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz]}.
function xf(g, t = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(t.r || [0, 0, 0]), 'YXZ'));
  m.compose(new THREE.Vector3(...(t.p || [0, 0, 0])), q, new THREE.Vector3(...(t.s || [1, 1, 1])));
  g.applyMatrix4(m);
  return g;
}

export const kit = {
  box(w, h, d, color, t) {
    return finish(xf(new THREE.BoxGeometry(w, h, d), t), color);
  },
  ball(rx, ry, rz, color, t, ws = 8, hs = 6) {
    const g = new THREE.SphereGeometry(1, ws, hs);
    g.scale(rx, ry, rz);
    return finish(xf(g, t), color);
  },
  cyl(rt, rb, h, color, t, seg = 7, open = false) {
    return finish(xf(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), t), color);
  },
  cone(r, h, color, t, seg = 6) {
    return finish(xf(new THREE.ConeGeometry(r, h, seg), t), color);
  },
  // Tapered limb from origin down along -Y of length len.
  limb(r0, r1, len, color, t = {}, seg = 6) {
    const g = new THREE.CylinderGeometry(r0, r1, len, seg, 1);
    g.translate(0, -len / 2, 0);
    return finish(xf(g, t), color);
  },
  merge(list) {
    return mergeGeometries(list.filter(Boolean), false);
  },
};

// Build a mesh from geometry list with an entity's material.
export function meshOf(list, mat) {
  const g = kit.merge(list);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}

export function bone(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// Per-entity lit material.
export function entityMaterial(shared, opts) {
  return createModelMaterial(shared, opts);
}

// Gradient helper: blend two colours by local y.
export function vgrad(c0, c1, y0, y1) {
  return (x, y) => {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
  };
}
// Front/back split (belly colouring): z > split => front colour.
export function zsplit(back, front, split = 0) {
  return (x, y, z) => (z > split ? front : back);
}
