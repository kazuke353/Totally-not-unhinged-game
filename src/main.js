import './style.css';
import * as THREE from 'three';
import { Renderer } from './engine/renderer.js';
import { generateTextures, generateFxAtlas, applyFilter } from './engine/textures.js';
import { Input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { Hud } from './ui/hud.js';
import { UI } from './ui/ui.js';
import { Game } from './game/game.js';
import { createSharedUniforms } from './engine/materials.js';
import { KangarooModel } from './game/kangaroo.js';
import { createSky } from './engine/sky.js';
import { ITEMS } from './game/entities/items.js';
import { MAPS } from './maps/index.js';

const DEFAULTS = {
  sensitivity: 1,
  invertY: false,
  fov: 74,
  renderScale: 0.5,
  smoothTextures: false,
  brightness: 1,
  volume: 0.8,
  music: 0.5,
  voices: true,
  firstPerson: false,
  autoHop: true,
  showFps: false,
};

class App {
  constructor() {
    this.settings = { ...DEFAULTS };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem('halfhop_settings') || '{}'));
    } catch (e) {}
    const container = document.getElementById('game');
    this.renderer = new Renderer(container);
    this.input = new Input(this.renderer.canvas);
    this.textures = generateTextures(this.settings);
    this.atlas = generateFxAtlas();
    const uiRoot = document.getElementById('ui');
    this.hud = new Hud(uiRoot);
    this.ui = new UI(uiRoot, this);
    this.game = null;
    this.state = 'menu';
    this.timeScale = 1;
    this.last = performance.now();
    this.input.onLockChange = (locked, failed) => {
      if (!locked && !failed && this.state === 'playing' && !this.ui.consoleOpen && !this.game?.ended && !this.game?.cutscene) this.pause();
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        e.preventDefault();
        if (!this.ui.consoleOpen) this.ui.toggleConsole(true);
      }
      if (e.code === 'Escape' && this.state === 'paused' && !this.ui.consoleOpen && this.ui.screen === 'pause') {
        // allow ESC to resume
        setTimeout(() => this.resume(), 0);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.applySettings();
    this._buildMenuScene();
    window.__app = this;
    const m = location.hash.match(/^#play=(\w+)/);
    if (m) this.startMap(m[1]);
    else this.ui.mainMenu();
    requestAnimationFrame((t) => this.frame(t));
  }

  saveSettings() {
    try {
      localStorage.setItem('halfhop_settings', JSON.stringify(this.settings));
    } catch (e) {}
  }
  applySettings() {
    const s = this.settings;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    this.renderer.setScale(s.renderScale);
    this.renderer.setFov(s.fov);
    audio.setVolume(s.volume);
    audio.setMusicVolume(s.music);
    audio.voices = s.voices;
    if (this._smooth !== s.smoothTextures) {
      this._smooth = s.smoothTextures;
      for (const t of Object.values(this.textures)) applyFilter(t.tex, t.mode, s.smoothTextures);
    }
    if (this.game) {
      this.game.shared.uBright.value = s.brightness;
      if (this.game.player) this.game.player.view = s.firstPerson ? 'first' : 'third';
    }
    this.saveSettings();
  }

  getSave() {
    try {
      const q = localStorage.getItem('halfhop_quicksave');
      const a = localStorage.getItem('halfhop_autosave');
      const qs = q ? JSON.parse(q) : null, as = a ? JSON.parse(a) : null;
      if (qs && as) return (qs.savedAt || 0) > (as.savedAt || 0) ? qs : as;
      return qs || as;
    } catch (e) {
      return null;
    }
  }

  // --------------------------------------------------------------- menu scene
  _buildMenuScene() {
    const shared = createSharedUniforms();
    this.menuShared = shared;
    const scene = new THREE.Scene();
    const sky = createSky({ sunDir: [-0.5, 0.06, -0.8], top: [0.08, 0.06, 0.18], horizon: [0.95, 0.42, 0.18], bottom: [0.12, 0.05, 0.03], sunColor: [1, 0.55, 0.25], stars: 0.6, clouds: 0.5, cloudColor: [0.45, 0.22, 0.25] });
    scene.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: 0x3a1a0e }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const roo = new KangarooModel(shared);
    roo.setWeapon('smg');
    roo.setLight([0.45, 0.32, 0.3], [0.9, 0.55, 0.35]);
    roo.mat.uniforms.uDir.value.set(-0.6, 0.3, -0.7).normalize();
    scene.add(roo.root);
    this.menu = { scene, roo, sky, t: 0 };
  }
  _renderMenu(dt) {
    const m = this.menu;
    m.t += dt;
    m.sky.material.uniforms.time.value = m.t;
    const cam = this.renderer.camera;
    const a = 0.6 + Math.sin(m.t * 0.1) * 0.25;
    const wide = window.innerWidth > 700;
    cam.position.set(Math.sin(a) * 3.2 - (wide ? 0.9 : 0), 1.15, Math.cos(a) * 3.2);
    cam.lookAt(wide ? -1.1 : 0, 0.95, 0);
    m.roo.root.position.set(0, 0, 0);
    m.roo.update(dt, { yaw: -0.4 + Math.sin(m.t * 0.3) * 0.3, pitch: Math.sin(m.t * 0.5) * 0.1, speed: 0, onGround: true, vy: 0, crouch: false, charge: 0, action: null, actionT: 0, punchSide: 1, climbing: false, dead: false, pain: 0 });
    m.sky.position.copy(cam.position);
    this.renderer.render(m.scene);
  }

  // --------------------------------------------------------------- flow
  async newGame(difficulty) {
    audio.init();
    this.ui.intro(async () => {
      this.ui.clear();
      await this._startGame(async (g) => {
        g.difficulty = difficulty;
        g.stats = { kills: 0, shots: 0, hits: 0, secrets: 0, secretsTotal: 0, time: 0, deaths: 0 };
        await g.loadMap('outback');
      });
    });
  }
  async continueGame() {
    audio.init();
    const s = this.getSave();
    if (!s) return;
    this.ui.clear();
    await this._startGame(async (g) => g.loadSave(s));
  }
  async startMap(id) {
    audio.init();
    this.ui.clear();
    await this._startGame(async (g) => g.loadMap(id));
  }
  async _startGame(loader) {
    if (this.game) this.game.unload();
    this.game = new Game(this);
    this.hud.game = this.game;
    this.state = 'loading';
    this.hud.show(false);
    await loader(this.game);
    this.applySettings();
    this.hud.show(true);
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    this.input.requestLock();
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.clear();
    this.input.exitLock();
    audio.stopSpeech();
    if (audio.ctx) audio.ctx.suspend();
    this.ui.pauseMenu();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.ui.clear();
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clear();
    if (audio.ctx) audio.ctx.resume();
    this.input.requestLock();
    this.last = performance.now();
  }
  async loadQuick() {
    const s = this.getSave();
    if (!s) return this.ui.toast('No saved game.');
    if (audio.ctx) audio.ctx.resume();
    this.ui.clear();
    await this._startGame(async (g) => g.loadSave(s));
  }
  quitToMenu() {
    if (this.game) this.game.unload();
    this.game = null;
    this.state = 'menu';
    this.hud.show(false);
    this.input.enabled = false;
    this.input.exitLock();
    if (audio.ctx) audio.ctx.resume();
    audio.stopMusic();
    this.ui.mainMenu();
  }
  showEnding() {
    this.state = 'ending';
    this.input.enabled = false;
    this.input.exitLock();
    this.input.clear();
    this.hud.show(false);
    audio.playMusic('ending');
    try {
      localStorage.removeItem('halfhop_autosave');
    } catch (e) {}
    this.ui.ending(this.game.stats, () => this.quitToMenu());
  }

  // --------------------------------------------------------------- console
  command(line) {
    const [cmd, ...args] = line.split(/\s+/);
    const g = this.game;
    const p = g && g.player;
    const log = (t) => this.ui.log(t);
    switch (cmd.toLowerCase()) {
      case 'help':
        log('god, noclip, impulse 101, give <item>, map <outback|complex|silo>, kill, notarget, fps, hurt <n>, firstperson, maps');
        break;
      case 'god':
        if (g) log('godmode ' + ((g.godMode = !g.godMode) ? 'ON' : 'OFF'));
        break;
      case 'noclip':
        if (g) log('noclip ' + ((g.noclip = !g.noclip) ? 'ON' : 'OFF'));
        break;
      case 'notarget':
        if (g) {
          g.notarget = !g.notarget;
          log('notarget ' + (g.notarget ? 'ON' : 'OFF'));
        }
        break;
      case 'impulse':
        if (p && args[0] === '101') {
          for (const w of ['pistol', 'smg', 'shotgun', 'rpg', 'grenade']) p.weapons.give(w, true);
          for (const k of Object.keys(p.weapons.ammo)) p.weapons.ammo[k] = 999;
          for (const k of Object.keys(p.weapons.ammo)) p.weapons.addAmmo(k, 0);
          p.weapons.ammo = { '9mm': 250, shells: 64, rockets: 5, grenades: 10, argrenades: 10 };
          p.armor = 100;
          log('All weapons given. Cheater.');
        }
        break;
      case 'give':
        if (p && ITEMS[args[0]]) {
          g.spawnEntity({ type: 'pickup', item: args[0], pos: [p.body.pos.x, p.body.pos.y + 0.5, p.body.pos.z] });
          log('gave ' + args[0]);
        } else log('unknown item. Items: ' + Object.keys(ITEMS).join(', '));
        break;
      case 'map':
        if (MAPS[args[0]]) {
          this.ui.toggleConsole(false);
          if (g) g.loadMap(args[0], { carry: p ? p.getCarry() : undefined });
          else this.startMap(args[0]);
        } else log('maps: ' + Object.keys(MAPS).join(', '));
        break;
      case 'maps':
        log(Object.keys(MAPS).join(', '));
        break;
      case 'kill':
        if (p) p.damage(999, [0, 1, 0], null, 'body', 'fall');
        break;
      case 'hurt':
        if (p) p.damage(parseFloat(args[0]) || 10, [0, 0, 1], null, 'body', 'bullet');
        break;
      case 'fps':
        this.settings.showFps = !this.settings.showFps;
        this.applySettings();
        break;
      case 'firstperson':
        this.settings.firstPerson = !this.settings.firstPerson;
        this.applySettings();
        break;
      case 'tp':
        if (p) {
          p.body.pos.set(+args[0], +args[1], +args[2]);
          p.body.vel.set(0, 0, 0);
        }
        break;
      case 'pos':
        if (p) log(p.body.pos.toArray().map((v) => v.toFixed(2)).join(' ') + ' yaw ' + p.yaw.toFixed(2));
        break;
      case 'fire':
        if (g) g.fire(args[0], p);
        break;
      default:
        log('Unknown command: ' + cmd);
    }
  }

  // --------------------------------------------------------------- loop
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 1 / 30) * this.timeScale;
    try {
      if (this.state === 'menu') {
        this._renderMenu(dt);
      } else if (this.game && this.game.world && !this.game.loading) {
        if (this.state === 'playing') {
          if (this.ui.consoleOpen) this.input.clear();
          if (this.input.hit('pause') && this.input.lockFailed) this.pause();
          if (this.input.hit('quicksave')) this.game.quicksave();
          if (this.input.hit('quickload')) this.loadQuick();
          this.game.update(dt);
          this.hud.update(this.game, dt, this.settings);
        }
        this.renderer.render(this.game.scene, this.game.player && this.game.player.view === 'first' && this.game.player.alive && !this.game.cutscene ? this.game.vmScene : null);
      } else if (this.state === 'ending' && this.game && this.game.world) {
        this.game.update(dt);
        this.renderer.render(this.game.scene);
      }
    } catch (e) {
      console.error(e);
      this.ui.log('ERROR: ' + e.message);
    }
    this.input.endFrame();
  }
}

if (location.hash.startsWith('#lighttest')) {
  import('./dev/lighttest.js').then((m) => m.lightTest());
} else if (location.hash.startsWith('#modeltest')) {
  import('./dev/modeltest.js').then((m) => m.modelTest());
} else {
  new App();
}
