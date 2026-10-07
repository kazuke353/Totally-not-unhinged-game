// Procedural skybox dome: gradient, sun, moon, stars, drifting clouds and a
// band of distant outback mesas on the horizon.
import * as THREE from 'three';

const VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const FS = /* glsl */ `
uniform vec3 topCol;
uniform vec3 horCol;
uniform vec3 botCol;
uniform vec3 sunDir;
uniform vec3 sunCol;
uniform vec3 moonDir;
uniform float moon;
uniform float stars;
uniform float clouds;
uniform vec3 cloudCol;
uniform float mountains;
uniform vec3 mountCol;
uniform vec3 mountCol2;
uniform float time;
uniform float flash;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1, 0), 1.0));
  float c = hash(vec3(i + vec2(0, 1), 1.0)), d = hash(vec3(i + vec2(1, 1), 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.07; a *= 0.5; }
  return s;
}
float ridge(float az, float seed) {
  float m = 0.0;
  m += sin(az * 2.0 + seed) * 0.018;
  m += sin(az * 5.0 + seed * 2.3) * 0.012;
  m += sin(az * 11.0 + seed * 1.7) * 0.007;
  m += sin(az * 23.0 + seed * 0.4) * 0.004;
  return m;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horCol, topCol, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horCol, botCol, pow(clamp(-h, 0.0, 1.0), 0.35));
  float s = max(dot(d, sunDir), 0.0);
  col += sunCol * (smoothstep(0.99965, 0.9998, s) * 2.0 + pow(s, 120.0) * 0.4 + pow(s, 6.0) * 0.12);
  if (stars > 0.0) {
    vec3 q = floor(d * 260.0);
    float st = step(0.9975, hash(q));
    float tw = 0.6 + 0.4 * sin(time * 3.0 + hash(q + 3.0) * 30.0);
    col += vec3(st * tw) * stars * smoothstep(0.02, 0.35, h);
  }
  if (moon > 0.0) {
    float m = dot(d, moonDir);
    float disc = smoothstep(0.99935, 0.9995, m);
    vec2 mp = (d - moonDir).xy * 900.0;
    float crater = noise(mp * 0.5) * 0.35 + 0.65;
    col = mix(col, vec3(0.92, 0.9, 0.82) * crater, disc * moon);
    col += vec3(0.5, 0.55, 0.7) * pow(max(m, 0.0), 200.0) * 0.25 * moon;
  }
  if (clouds > 0.0 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.3 + vec2(time * 0.004, time * 0.002);
    float c = fbm(uv);
    c = smoothstep(0.52, 0.78, c) * clouds * smoothstep(0.0, 0.18, h);
    vec3 cc = cloudCol + sunCol * 0.35 * pow(s, 3.0);
    col = mix(col, cc, c);
  }
  if (mountains > 0.0) {
    float az = atan(d.z, d.x);
    float far = 0.045 + ridge(az, 1.3);
    float mesa = 0.025 + ridge(az * 1.0, 4.1) * 1.4;
    mesa = mesa > 0.03 ? 0.03 + (mesa - 0.03) * 0.15 : mesa; // flatten into mesas
    if (h < far) col = mix(col, mountCol2, 0.85 * mountains);
    if (h < mesa) col = mountCol * (0.75 + 0.25 * smoothstep(-0.05, mesa, h));
  }
  col += vec3(flash);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(params = {}) {
  const v3 = (a, def) => new THREE.Vector3(...(a || def));
  const sd = params.sunDir || [0.4, 0.15, -0.9];
  const md = params.moonDir || [-0.3, 0.5, -0.8];
  const uniforms = {
    topCol: { value: v3(params.top, [0.1, 0.15, 0.35]) },
    horCol: { value: v3(params.horizon, [0.9, 0.5, 0.25]) },
    botCol: { value: v3(params.bottom, [0.25, 0.12, 0.08]) },
    sunDir: { value: new THREE.Vector3(...sd).normalize() },
    sunCol: { value: v3(params.sunColor, [1, 0.7, 0.4]) },
    moonDir: { value: new THREE.Vector3(...md).normalize() },
    moon: { value: params.moon ?? 0 },
    stars: { value: params.stars ?? 0 },
    clouds: { value: params.clouds ?? 0.5 },
    cloudCol: { value: v3(params.cloudColor, [0.55, 0.35, 0.35]) },
    mountains: { value: params.mountains ?? 1 },
    mountCol: { value: v3(params.mountColor, [0.22, 0.1, 0.08]) },
    mountCol2: { value: v3(params.mountColor2, [0.45, 0.25, 0.22]) },
    time: { value: 0 },
    flash: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VS,
    fragmentShader: FS,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  mesh.userData.uniforms = uniforms;
  return mesh;
}
