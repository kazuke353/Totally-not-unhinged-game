// WebGL renderer wrapper with retro resolution scaling.
import * as THREE from 'three';

export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'gl';
    container.appendChild(this.canvas);
    this.scale = 0.5;
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 1200);
    this.vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setScale(s) {
    this.scale = s;
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.scale * Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h;
    this.vmCamera.updateProjectionMatrix();
    this.canvas.style.imageRendering = this.scale < 0.99 ? 'pixelated' : 'auto';
  }
  setFov(vfov) {
    this.camera.fov = vfov;
    this.camera.updateProjectionMatrix();
  }
  render(scene, vmScene) {
    const r = this.renderer;
    r.clear(true, true, true);
    r.render(scene, this.camera);
    if (vmScene) {
      r.clearDepth();
      r.render(vmScene, this.vmCamera);
    }
  }
}
