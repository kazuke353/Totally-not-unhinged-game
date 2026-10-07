// Shaders. World surfaces are texture x baked lightmap (2x overbright like
// GoldSrc) plus a handful of dynamic lights (muzzle flashes, explosions)
// and the flashlight. Models use vertex colours lit by a sampled ambient
// value + a directional term, matching how HL1 lit studio models.
import * as THREE from 'three';

export const MAX_DLIGHTS = 8;

export function createSharedUniforms() {
  const dlPos = [], dlCol = [];
  for (let i = 0; i < MAX_DLIGHTS; i++) {
    dlPos.push(new THREE.Vector4(0, -1000, 0, 1));
    dlCol.push(new THREE.Vector3(0, 0, 0));
  }
  return {
    dlPos: { value: dlPos },
    dlCol: { value: dlCol },
    flPos: { value: new THREE.Vector3() },
    flDir: { value: new THREE.Vector3(0, 0, -1) },
    flOn: { value: 0 },
    fogColor: { value: new THREE.Color(0, 0, 0) },
    fogNear: { value: 1000 },
    fogFar: { value: 2000 },
    uTime: { value: 0 },
    uBright: { value: 1 },
  };
}

const COMMON = /* glsl */ `
uniform vec4 dlPos[${MAX_DLIGHTS}];
uniform vec3 dlCol[${MAX_DLIGHTS}];
uniform vec3 flPos;
uniform vec3 flDir;
uniform float flOn;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float uBright;

vec3 dynLight(vec3 wp, vec3 n) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAX_DLIGHTS}; i++) {
    vec3 d = dlPos[i].xyz - wp;
    float dist = length(d);
    float a = max(0.0, 1.0 - dist / dlPos[i].w);
    float ndl = max(0.0, dot(d / max(dist, 0.001), n)) * 0.75 + 0.25;
    acc += dlCol[i] * a * a * ndl;
  }
  if (flOn > 0.5) {
    vec3 d = wp - flPos;
    float dist = length(d);
    vec3 dn = d / max(dist, 0.001);
    float c = dot(dn, flDir);
    float spot = smoothstep(0.88, 0.97, c) * 0.85 + smoothstep(0.7, 0.9, c) * 0.15;
    float att = clamp(1.0 - dist / 22.0, 0.0, 1.0);
    float ndl = max(0.0, -dot(dn, n)) * 0.8 + 0.2;
    acc += vec3(1.0, 0.94, 0.78) * spot * att * ndl * 1.6;
  }
  return acc;
}
vec3 applyFog(vec3 col, float depth) {
  return mix(col, fogColor, smoothstep(fogNear, fogFar, depth));
}
`;

const WORLD_VS = /* glsl */ `
attribute vec2 lmuv;
varying vec2 vUv;
varying vec2 vLm;
varying vec3 vWp;
varying vec3 vN;
varying float vDepth;
void main() {
  vUv = uv;
  vLm = lmuv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const WORLD_FS = /* glsl */ `
uniform sampler2D map;
uniform sampler2D lightmap;
${COMMON}
varying vec2 vUv;
varying vec2 vLm;
varying vec3 vWp;
varying vec3 vN;
varying float vDepth;
void main() {
  vec4 t = texture2D(map, vUv);
  #ifdef ALPHATEST
    vec2 tsz = vec2(textureSize(map, 0));
    vec2 dx = dFdx(vUv * tsz), dy = dFdy(vUv * tsz);
    float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
    if (t.a * (1.0 + lod * 0.6) < 0.5) discard;
  #endif
  vec3 col;
  #ifdef FULLBRIGHT
    col = t.rgb;
  #else
    vec3 light = texture2D(lightmap, vLm).rgb * 2.0 * uBright + dynLight(vWp, normalize(vN));
    col = t.rgb * light;
    #ifdef GLOW
      col = mix(col, t.rgb * 1.15, t.a);
    #endif
  #endif
  col = applyFog(col, vDepth);
  #ifdef GLASS
    gl_FragColor = vec4(col, 0.28);
  #else
    gl_FragColor = vec4(col, 1.0);
  #endif
}
`;

export function createWorldMaterial(info, lightmapTex, shared) {
  const defines = {};
  if (info.mode === 'alpha') defines.ALPHATEST = 1;
  if (info.mode === 'glow') defines.GLOW = 1;
  if (info.mode === 'fullbright') defines.FULLBRIGHT = 1;
  if (info.mode === 'glass') defines.GLASS = 1;
  const m = new THREE.ShaderMaterial({
    uniforms: { ...shared, map: { value: info.tex }, lightmap: { value: lightmapTex } },
    vertexShader: WORLD_VS,
    fragmentShader: WORLD_FS,
    defines,
    side: info.mode === 'alpha' || info.mode === 'glass' ? THREE.DoubleSide : THREE.FrontSide,
    transparent: info.mode === 'glass',
    depthWrite: info.mode !== 'glass',
  });
  m.name = 'world_' + info.name;
  return m;
}

const MODEL_VS = /* glsl */ `
attribute vec3 color;
varying vec3 vColor;
varying vec3 vWp;
varying vec3 vN;
varying float vDepth;
varying vec2 vUv;
void main() {
  vColor = color;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const MODEL_FS = /* glsl */ `
uniform vec3 uAmbient;
uniform vec3 uDirCol;
uniform vec3 uDir;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uEmissive;
uniform sampler2D detail;
uniform sampler2D map;
${COMMON}
varying vec3 vColor;
varying vec3 vWp;
varying vec3 vN;
varying float vDepth;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  float ndl = dot(n, uDir) * 0.5 + 0.5;
  vec3 light = (uAmbient + uDirCol * ndl * ndl) * uBright + dynLight(vWp, n);
  #ifdef USE_MAP
    vec3 base = vColor * texture2D(map, vUv).rgb;
  #else
    float d = texture2D(detail, vUv).r * 0.35 + 0.82;
    vec3 base = vColor * d;
  #endif
  vec3 col = base * light;
  col = mix(col, base * 1.2, uEmissive);
  col += uTint;
  col = applyFog(col, vDepth);
  gl_FragColor = vec4(col, uOpacity);
}
`;

let detailTex = null;
function getDetail() {
  if (detailTex) return detailTex;
  const S = 32;
  const data = new Uint8Array(S * S * 4);
  let s = 12345;
  for (let i = 0; i < S * S; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = 128 + ((s >> 8) % 128) - 64;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  detailTex = new THREE.DataTexture(data, S, S);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.magFilter = THREE.NearestFilter;
  detailTex.minFilter = THREE.NearestMipmapLinearFilter;
  detailTex.generateMipmaps = true;
  detailTex.needsUpdate = true;
  return detailTex;
}

export function createModelMaterial(shared, opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uAmbient: { value: new THREE.Vector3(0.6, 0.6, 0.6) },
      uDirCol: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
      uTint: { value: new THREE.Vector3(0, 0, 0) },
      uOpacity: { value: 1 },
      uEmissive: { value: opts.emissive || 0 },
      detail: { value: getDetail() },
      map: { value: opts.map || getDetail() },
    },
    defines: opts.map ? { USE_MAP: 1 } : {},
    vertexShader: MODEL_VS,
    fragmentShader: MODEL_FS,
    transparent: !!opts.transparent,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  return m;
}

// Point-sprite particle material: per-particle size, colour, alpha, atlas cell, rotation.
const PART_VS = /* glsl */ `
attribute float size;
attribute vec4 pcolor;
attribute vec2 cell;
attribute float rot;
uniform float scale;
varying vec4 vColor;
varying vec2 vCell;
varying float vRot;
varying float vDepth;
void main() {
  vColor = pcolor;
  vCell = cell;
  vRot = rot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_PointSize = min(size * scale / max(-mv.z, 0.05), 1024.0);
  gl_Position = projectionMatrix * mv;
}
`;
const PART_FS = /* glsl */ `
uniform sampler2D atlas;
uniform float cells;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float additive;
varying vec4 vColor;
varying vec2 vCell;
varying float vRot;
varying float vDepth;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
  vec2 uv = (vCell + p) / cells;
  vec4 t = texture2D(atlas, uv);
  vec4 col = t * vColor;
  float f = smoothstep(fogNear, fogFar, vDepth);
  if (additive > 0.5) col.rgb *= (1.0 - f);
  else col.rgb = mix(col.rgb, fogColor, f);
  if (col.a < 0.01) discard;
  gl_FragColor = col;
}
`;

export function createParticleMaterial(atlas, shared, additive) {
  return new THREE.ShaderMaterial({
    uniforms: {
      atlas: { value: atlas.tex },
      cells: { value: atlas.cells },
      scale: { value: 400 },
      fogColor: shared.fogColor,
      fogNear: shared.fogNear,
      fogFar: shared.fogFar,
      additive: { value: additive ? 1 : 0 },
    },
    vertexShader: PART_VS,
    fragmentShader: PART_FS,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
