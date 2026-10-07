// Brush & logic entities: doors, buttons, triggers, relays, breakables, ...
import * as THREE from 'three';
import { Entity, boxOverlap } from './base.js';
import { Brush } from '../../engine/world.js';
import { audio } from '../../engine/audio.js';
import { rand, clamp, damp } from '../../engine/util.js';

const KEY_NAMES = { red: 'RED KEYCARD', blue: 'BLUE KEYCARD', launch: 'LAUNCH KEY' };

// ------------------------------------------------------------------ door
export class Door extends Entity {
  constructor(game, d) {
    super(game, d);
    this.move = d.move || [0, (d.max[1] - d.min[1]) - 0.1, 0];
    this.speed = d.speed ?? 2.5;
    this.wait = d.wait ?? 4;
    this.locked = d.locked || false; // 'red' | 'blue' | 'launch' | true
    this.pos = d.startOpen ? 1 : 0;
    this.dir = 0;
    this.timer = 0;
    this.touchOpen = d.touch !== false && !d.triggerOnly;
    this.useOpen = d.use !== false && !d.triggerOnly;
    this.npcOpen = d.npc !== false && !d.triggerOnly && !this.locked;
    this.sound = d.sound || 'door_move';
    this.loop = null;
    this.blockedT = 0;
  }
  preBuild(world) {
    const d = this.def;
    this.brush = new Brush(d.min, d.max, { tex: d.tex || 'door', faces: d.faces, surface: 'metal' });
    this.brush.dynamic = true;
    this.brush.owner = this;
    this.brush.moveDelta = [0, 0, 0];
    world.add(this.brush);
  }
  spawn() {
    this._apply(0);
  }
  getBox() {
    return null;
  }
  useBox() {
    if (!this.useOpen && !this.locked) return null;
    if (this.pos > 0.05) return null;
    return { min: this.brush.wmin, max: this.brush.wmax };
  }
  navBlocked() {
    if (this.pos > 0.8) return false;
    return !this.npcOpen;
  }
  lockedMessage() {
    if (this.def.lockedMsg) return this.def.lockedMsg;
    if (this.locked && KEY_NAMES[this.locked]) return `LOCKED: REQUIRES ${KEY_NAMES[this.locked]}`;
    return 'LOCKED';
  }
  tryOpen(activator) {
    if (this.locked) {
      if (activator && activator.hasKey && KEY_NAMES[this.locked] && activator.hasKey(this.locked)) {
        this.locked = false;
        this.npcOpen = this.def.npc !== false;
        this.game.hint(`${KEY_NAMES[this.def.locked]} ACCEPTED`, 2);
        audio.play('button', { pos: this.center() });
      } else {
        if (activator === this.game.player && (!this._lastMsg || this.game.time - this._lastMsg > 1.5)) {
          this._lastMsg = this.game.time;
          this.game.hint(this.lockedMessage(), 2.5);
          audio.play('denied', { pos: this.center(), volume: 0.7 });
        }
        return false;
      }
    }
    this.open();
    return true;
  }
  use(player) {
    if (this.locked) return this.tryOpen(player) || undefined;
    if (this.pos < 0.5) this.tryOpen(player);
    return true;
  }
  open() {
    if (this.dir === 1 || (this.pos >= 1 && this.dir === 0)) {
      this.timer = this.wait;
      return;
    }
    this.dir = 1;
    this._startSound();
  }
  close() {
    if (this.pos <= 0 && this.dir === 0) return;
    this.dir = -1;
    this._startSound();
  }
  trigger(activator) {
    if (this.def.toggle) {
      if (this.pos > 0.5 || this.dir === 1) this.close();
      else {
        this.locked = false;
        this.open();
      }
      return;
    }
    if (this.locked === true) this.locked = false;
    if (this.def.unlockOnly) {
      this.npcOpen = this.def.npc !== false;
      return;
    }
    this.open();
  }
  onAlarm(on) {
    if (on && this.def.openOnAlarm) {
      this.locked = false;
      this.open();
    }
  }
  useLabel() {
    return this.locked ? 'LOCKED' : 'OPEN';
  }
  _startSound() {
    if (this.loop) this.loop.stop();
    this.loop = audio.play(this.sound, { pos: this.center(), volume: this.sound === 'blastdoor' ? 1.2 : 0.7, ref: this.sound === 'blastdoor' ? 10 : 3 });
  }
  center() {
    const a = this.brush.wmin, b = this.brush.wmax;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  }
  _apply(dt) {
    const off = [this.move[0] * this.pos, this.move[1] * this.pos, this.move[2] * this.pos];
    const old = this.brush.offset;
    this.brush.moveDelta = [off[0] - old[0], off[1] - old[1], off[2] - old[2]];
    this.game.world.setMoverOffset(this.brush, off[0], off[1], off[2]);
  }
  update(dt) {
    const g = this.game;
    // proximity open
    if (this.touchOpen && this.dir !== 1 && this.pos < 1) {
      const a = this.brush.wmin, b = this.brush.wmax;
      const zone = { min: [a[0] - 1.3, a[1], a[2] - 1.3], max: [b[0] + 1.3, b[1], b[2] + 1.3] };
      const p = g.player;
      if (p && p.alive && boxOverlap(p.getBox(), zone)) {
        if (!this.locked) this.open();
        else if (this.pos === 0 && this.def.lockTouchMsg !== false) this.tryOpen(p);
      } else if (this.npcOpen) {
        for (const e of g.entities) {
          if (!e.isNPC || !e.alive || !e.getBox) continue;
          if (boxOverlap(e.getBox(), zone)) {
            this.open();
            break;
          }
        }
      }
    }
    if (this.dir !== 0) {
      const len = Math.hypot(...this.move) || 1;
      const prev = this.pos;
      this.pos = clamp(this.pos + (this.dir * this.speed * dt) / len, 0, 1);
      this._apply(dt);
      // blocked while closing? reopen (HL behaviour)
      if (this.dir === -1) {
        const box = { min: this.brush.wmin, max: this.brush.wmax };
        const p = g.player;
        let blocked = p && p.alive && boxOverlap(p.getBox(), box);
        if (!blocked) for (const e of g.entities) if (e.isNPC && e.alive && boxOverlap(e.getBox(), box)) blocked = true;
        if (blocked) {
          this.pos = prev;
          this._apply(dt);
          this.dir = 1;
        }
      }
      if (this.pos >= 1 && this.dir === 1) {
        this.dir = 0;
        this.timer = this.wait;
        if (this.loop) this.loop.stop();
        audio.play('door_stop', { pos: this.center(), volume: 0.6 });
        if (!this.openedOnce) {
          this.openedOnce = true;
          this.fireTargets(g.player);
        }
      } else if (this.pos <= 0 && this.dir === -1) {
        this.dir = 0;
        if (this.loop) this.loop.stop();
        audio.play('door_stop', { pos: this.center(), volume: 0.6 });
      }
    } else {
      this.brush.moveDelta = [0, 0, 0];
      if (this.pos >= 1 && this.wait >= 0) {
        this.timer -= dt;
        if (this.timer <= 0) this.close();
      }
    }
  }
  save() {
    return { pos: this.pos, dir: this.dir, locked: this.locked, npcOpen: this.npcOpen, opened: this.openedOnce, timer: this.timer };
  }
  load(s) {
    this.pos = s.pos;
    this.dir = s.dir;
    this.locked = s.locked;
    this.npcOpen = s.npcOpen;
    this.openedOnce = s.opened;
    this.timer = s.timer;
    this._apply(0);
  }
}

// ------------------------------------------------------------------ button
export class Button extends Entity {
  constructor(game, d) {
    super(game, d);
    this.pressed = false;
    this.locked = d.locked || false;
    this.once = d.once !== false;
  }
  preBuild(world) {
    const d = this.def;
    this.brush = new Brush(d.min, d.max, { tex: d.tex || 'button', faces: d.faces, surface: 'metal' });
    this.brush.dynamic = true;
    this.brush.owner = this;
    world.add(this.brush);
  }
  useBox() {
    if (this.pressed && this.once) return null;
    const a = this.brush.wmin, b = this.brush.wmax;
    return { min: [a[0] - 0.15, a[1] - 0.15, a[2] - 0.15], max: [b[0] + 0.15, b[1] + 0.15, b[2] + 0.15] };
  }
  center() {
    const a = this.brush.min, b = this.brush.max;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  }
  useLabel() {
    return this.def.label || 'PRESS';
  }
  use(player) {
    if (this.pressed && this.once) return false;
    if (this.locked) {
      if (typeof this.locked === 'string' && KEY_NAMES[this.locked] && player.hasKey(this.locked)) {
        this.locked = false;
      } else {
        this.game.hint(this.def.lockedMsg || 'NO POWER', 2.5);
        return false;
      }
    }
    this.press(player);
    return true;
  }
  press(activator) {
    this.pressed = true;
    audio.play(this.def.sound || 'button', { pos: this.center(), volume: 0.8 });
    if (this.def.msg) this.game.hint(this.def.msg, 3);
    this._setLit(true);
    this.fireTargets(activator);
    if (!this.once) this.game.after(1, () => { this.pressed = false; this._setLit(false); });
  }
  _setLit(on) {
    const w = this.game.world;
    const info = this.game.app.textures[on ? this.def.texOn || 'button_on' : this.def.tex || 'button'];
    if (!info || !this.brush.meshes) return;
    const mat = w._material(info, w.lightmap.texture, this.game.shared);
    for (const m of this.brush.meshes) m.material = mat;
  }
  trigger() {
    // triggering a button unlocks it (e.g. power restored)
    this.locked = false;
    if (this.def.lightOnUnlock) this._setLit(true);
  }
  save() {
    return { pressed: this.pressed, locked: this.locked };
  }
  load(s) {
    this.pressed = s.pressed;
    this.locked = s.locked;
    if (this.pressed) this._setLit(true);
  }
}

// ------------------------------------------------------------------ trigger volume
export class Trigger extends Entity {
  constructor(game, d) {
    super(game, d);
    this.enabled = d.enabled !== false;
    this.fired = false;
    this.once = d.once !== false;
    this.inside = false;
  }
  update() {
    if (!this.enabled || (this.fired && this.once)) return;
    const d = this.def;
    const inside = this.playerInside(d.min, d.max);
    if (inside && !this.inside) {
      if (d.require && !this.game.player.hasKey(d.require)) {
        this.inside = inside;
        return;
      }
      const rf = d.requireFlag;
      if (rf && (rf[0] === '!' ? this.game.flags[rf.slice(1)] : !this.game.flags[rf])) {
        this.inside = inside;
        return;
      }
      this.fired = true;
      if (d.msg) this.game.hint(d.msg, d.msgDur || 4);
      if (d.speaker) this.game.say(d.speaker, d.line, { voice: d.voice });
      this.fireTargets(this.game.player);
      if (d.run) d.run(this.game, this);
    }
    this.inside = inside;
  }
  trigger() {
    this.enabled = true;
  }
  save() {
    return { enabled: this.enabled, fired: this.fired };
  }
  load(s) {
    this.enabled = s.enabled;
    this.fired = s.fired;
  }
}

export class ChangeLevel extends Entity {
  update() {
    const d = this.def;
    if (this.game.loading) return;
    if (this.enabled === false) return;
    if (this.playerInside(d.min, d.max)) this.game.changeLevel(d.map);
  }
  trigger() {
    this.enabled = true;
  }
}

// Relay with optional delay, fires its targets when triggered.
export class Relay extends Entity {
  constructor(game, d) {
    super(game, d);
    this.done = false;
  }
  trigger(activator) {
    if (this.def.once && this.done) return;
    this.done = true;
    this.fireTargets(activator);
    if (this.def.run) this.def.run(this.game, activator);
  }
  save() {
    return { done: this.done };
  }
  load(s) {
    this.done = s.done;
  }
}

export class Counter extends Entity {
  constructor(game, d) {
    super(game, d);
    this.count = 0;
  }
  trigger(activator) {
    this.count++;
    if (this.def.progressMsg) this.game.hint(this.def.progressMsg.replace('%n', this.count).replace('%t', this.def.count), 3);
    if (this.count === this.def.count) this.fireTargets(activator);
  }
  save() {
    return { count: this.count };
  }
  load(s) {
    this.count = s.count;
  }
}

// Displays text: hint (center), subtitle (speaker line), message (big HL title text)
export class Message extends Entity {
  trigger() {
    const d = this.def;
    if (d.once && this.done) return;
    this.done = true;
    const g = this.game;
    if (d.kind === 'subtitle' || d.speaker) g.say(d.speaker || '', d.text, { voice: d.voice, dur: d.dur });
    else if (d.kind === 'title') g.message(d.text, { dur: d.dur, sub: d.sub });
    else g.hint(d.text, d.dur || 4);
  }
  save() {
    return { done: this.done };
  }
  load(s) {
    this.done = s.done;
  }
}

export class Chapter extends Entity {
  trigger() {
    if (this.done) return;
    this.done = true;
    this.game.app.hud.chapter(this.def.title, this.def.sub);
    if (this.def.music) audio.playMusic(this.def.music);
  }
  save() {
    return { done: this.done };
  }
  load(s) {
    this.done = s.done;
  }
}

export class Objective extends Entity {
  trigger() {
    const d = this.def;
    if (d.complete) this.game.completeObjective(d.complete);
    if (d.text) this.game.setObjective(d.id, d.text);
  }
}

export class Autosave extends Entity {
  trigger() {
    this.game.after(0.1, () => this.game.autosave());
  }
}

export class Music extends Entity {
  trigger() {
    if (this.def.stop) audio.stopMusic(this.def.fade ?? 2);
    else audio.playMusic(this.def.track, !!this.def.loop);
  }
}

export class Script extends Entity {
  trigger(activator) {
    if (this.def.once !== false && this.done) return;
    this.done = true;
    this.def.run(this.game, activator, this);
  }
  save() {
    return { done: this.done };
  }
  load(s) {
    this.done = s.done;
    if (this.done && this.def.onLoad) this.def.onLoad(this.game, this);
  }
}

// ------------------------------------------------------------------ breakables
export class Breakable extends Entity {
  constructor(game, d) {
    super(game, d);
    this.health = d.health ?? 20;
    this.broken = false;
    this.material = d.material || 'wood';
    this.surface = this.material === 'glass' ? 'glass' : this.material;
  }
  preBuild(world) {
    const d = this.def;
    const info = this.game.app.textures[d.tex];
    this.brush = new Brush(d.min, d.max, { tex: d.tex || 'crate', faces: d.faces, castShadow: false, surface: this.surface });
    this.brush.dynamic = true;
    this.brush.owner = this;
    if (info && (info.mode === 'glass' || info.mode === 'alpha')) {
      this.brush.seeThrough = true;
      this.brush.transparent = true;
    }
    world.add(this.brush);
  }
  center() {
    const a = this.brush.min, b = this.brush.max;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  }
  radius() {
    return Math.max(this.brush.max[0] - this.brush.min[0], this.brush.max[2] - this.brush.min[2]) / 2;
  }
  damage(amount, dir, attacker, group, type) {
    if (this.broken) return;
    if (this.def.explosiveOnly && type !== 'explosion') return;
    if (this.def.meleeOnly && type !== 'kick' && type !== 'punch' && type !== 'explosion') {
      audio.play('hit_metal', { pos: this.center(), volume: 0.4 });
      return;
    }
    this.health -= amount * (type === 'kick' ? 1.5 : 1);
    if (this.health <= 0) this.break(attacker);
  }
  break(attacker) {
    if (this.broken) return;
    this.broken = true;
    const g = this.game;
    g.world.hideBrush(this.brush);
    const a = this.brush.min, b = this.brush.max;
    const c = this.center();
    if (this.material === 'glass') {
      g.fx.glassShards(c, 30);
      audio.play('break_glass', { pos: c });
    } else if (this.material === 'metal') {
      g.fx.metalChunks(a, b, 8);
      g.fx.sparks(c, [0, 1, 0], 10);
      audio.play('break_metal', { pos: c });
    } else {
      g.fx.woodChunks(a, b, 12);
      g.fx.puff(c, [0, 1, 0], [0.55, 0.45, 0.32], 5, 0.5);
      audio.play('break_wood', { pos: c });
    }
    const sp = this.def.spawn;
    if (sp) {
      const items = Array.isArray(sp) ? sp : [sp];
      items.forEach((it, i) => g.spawnEntity({ type: 'pickup', item: it, pos: [c[0] + (i - (items.length - 1) / 2) * 0.35, a[1] + 0.05, c[2]], drop: true }));
    }
    this.fireTargets(attacker);
    g.noise(c, 10, attacker);
  }
  getHitboxes() {
    if (this.broken) return null;
    return [{ min: this.brush.wmin, max: this.brush.wmax, group: 'body' }];
  }
  save() {
    return { broken: this.broken, health: this.health };
  }
  load(s) {
    this.health = s.health;
    if (s.broken && !this.broken) {
      this.broken = true;
      this.game.world.hideBrush(this.brush);
    }
  }
}

// ------------------------------------------------------------------ hurt volume
export class Hurt extends Entity {
  constructor(game, d) {
    super(game, d);
    this.enabled = d.enabled !== false;
    this.tick = 0;
  }
  update(dt) {
    if (!this.enabled) return;
    const d = this.def;
    this.tick -= dt;
    if (d.fx === 'spark' && Math.random() < dt * 4) {
      const p = [rand(d.min[0], d.max[0]), rand(d.min[1], d.max[1]), rand(d.min[2], d.max[2])];
      this.game.fx.sparks(p, [0, 1, 0], 6, [0.6, 0.8, 1]);
      this.game.fx.dlight(p, [0.6, 0.8, 1.6], 4, 0.08);
      if (Math.random() < 0.3) audio.play('zap', { pos: p, volume: 0.5 });
    }
    if (d.fx === 'fire' && Math.random() < dt * 20) this.game.fx.fire([rand(d.min[0], d.max[0]), d.min[1] + 0.1, rand(d.min[2], d.max[2])], 0.7);
    if (this.tick > 0) return;
    if (this.playerInside(d.min, d.max)) {
      this.tick = 0.5;
      this.game.player.damage((d.dps ?? 20) * 0.5, [0, 1, 0], null, 'body', d.kind || 'shock');
      if (d.kind === 'shock') audio.play('zap', { volume: 0.6 });
    }
  }
  trigger() {
    this.enabled = this.def.toggle ? !this.enabled : false;
  }
  save() {
    return { enabled: this.enabled };
  }
  load(s) {
    this.enabled = s.enabled;
  }
}

export class Secret extends Entity {
  update() {
    if (this.found) return;
    if (this.playerInside(this.def.min, this.def.max)) {
      this.found = true;
      this.game.stats.secrets++;
      this.game.app.hud.secret();
      audio.play('battery', { volume: 0.6 });
    }
  }
  save() {
    return { found: this.found };
  }
  load(s) {
    this.found = s.found;
  }
}

// ------------------------------------------------------------------ alarm
export class Alarm extends Entity {
  trigger() {
    this.game.setAlarm(true);
  }
}

// Rotating red beacon + siren speaker. Active when the base alarm is on.
export class AlarmLight extends Entity {
  spawn() {
    const g = this.game;
    const d = this.def;
    const geo = new THREE.CylinderGeometry(0.14, 0.16, 0.22, 10);
    this.mat = new THREE.MeshBasicMaterial({ color: 0x551010 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(...d.pos);
    g.entGroup.add(this.mesh);
    this.on = false;
    this.a = rand(0, 6);
    this.snd = null;
  }
  onAlarm(on) {
    this.on = on;
    this.mat.color.set(on ? 0xff2010 : 0x551010);
    if (on && this.def.siren && !this.snd) this.snd = audio.play('alarm', { pos: this.def.pos, loop: true, volume: 0.5, ref: 6 });
    if (!on && this.snd) {
      this.snd.stop();
      this.snd = null;
    }
  }
  update(dt) {
    if (!this.on) return;
    this.a += dt * 6;
    const p = this.def.pos;
    const dir = [Math.cos(this.a), 0, Math.sin(this.a)];
    this.game.fx.dlight([p[0] + dir[0] * 1.5, p[1] - 0.3, p[2] + dir[2] * 1.5], [1.6, 0.15, 0.05], 7, 0.0);
    this.game.fx.glowSprite(p, 0.8, [1, 0.2, 0.1], 0.001);
  }
  destroy() {
    super.destroy();
    if (this.snd) this.snd.stop();
  }
}

// ------------------------------------------------------------------ ambient sound
export class SoundEnt extends Entity {
  spawn() {
    this.on = this.def.startOn !== false;
    if (this.on) this._start();
  }
  _start() {
    this.h = audio.play(this.def.sound, { pos: this.def.pos, loop: true, volume: this.def.volume ?? 0.5, ref: this.def.ref || 4 });
  }
  trigger() {
    this.on = !this.on;
    if (this.on) this._start();
    else if (this.h) this.h.stop();
  }
  destroy() {
    if (this.h) this.h.stop();
  }
  save() {
    return { on: this.on };
  }
  load(s) {
    if (s.on !== this.on) this.trigger();
  }
}

// ------------------------------------------------------------------ glow sprite (lamp halos)
let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
export class Glow extends Entity {
  spawn() {
    const d = this.def;
    const m = new THREE.SpriteMaterial({ map: getGlowTex(), color: new THREE.Color(...(d.color || [1, 0.9, 0.7])), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: d.alpha ?? 0.5 });
    this.mesh = new THREE.Sprite(m);
    this.mesh.position.set(...d.pos);
    this.mesh.scale.setScalar(d.size || 1.2);
    this.mesh.renderOrder = 12;
    this.game.entGroup.add(this.mesh);
    this.on = d.startOn !== false;
    this.mesh.visible = this.on;
  }
  update() {
    if (this.def.flicker && this.on) this.mesh.material.opacity = (this.def.alpha ?? 0.5) * (Math.random() < 0.08 ? 0.2 : 1);
  }
  trigger() {
    this.on = !this.on;
    this.mesh.visible = this.on;
  }
}

// ------------------------------------------------------------------ searchlight
// Sweeping tower spotlight. If it catches the player, it fires its target
// (usually the alarm). Shoot the lamp to kill it.
export class Searchlight extends Entity {
  constructor(game, d) {
    super(game, d);
    this.health = 15;
    this.dead = false;
    this.t = rand(0, 10);
    this.spotted = 0;
    this.fleshy = false;
    this.surface = 'metal';
  }
  spawn() {
    const g = this.game, d = this.def;
    this.group = new THREE.Group();
    this.group.position.set(...d.pos);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
    const cam = !!d.camera;
    const lamp = cam ? new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.45), new THREE.MeshBasicMaterial({ color: 0x8a8e90 })) : new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10).rotateX(Math.PI / 2), lampMat);
    this.lens = new THREE.Mesh(new THREE.CircleGeometry(cam ? 0.07 : 0.25, 12), new THREE.MeshBasicMaterial({ color: cam ? 0xff2010 : 0xfff4d0 }));
    this.lens.position.z = cam ? 0.23 : 0.26;
    this.head = new THREE.Group();
    this.head.add(lamp, this.lens);
    this.group.add(this.head);
    // light cone
    const len = d.range || 30;
    const coneGeo = new THREE.ConeGeometry(Math.tan(((d.cone || 12) * Math.PI) / 180) * len, len, 16, 1, true);
    coneGeo.translate(0, -len / 2, 0);
    coneGeo.rotateX(-Math.PI / 2);
    const cols = [];
    const pos = coneGeo.attributes.position;
    const tint = d.camera ? [0.12, 0.02, 0.02] : [0.35, 0.33, 0.25];
    for (let i = 0; i < pos.count; i++) {
      const k = 1 - pos.getZ(i) / len;
      cols.push(k * tint[0], k * tint[1], k * tint[2]);
    }
    coneGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.cone.renderOrder = 13;
    this.head.add(this.cone);
    g.entGroup.add(this.group);
    this.mesh = this.group;
  }
  center() {
    return this.def.pos.slice();
  }
  getHitboxes() {
    if (this.dead) return null;
    const p = this.def.pos;
    return [{ min: [p[0] - 0.35, p[1] - 0.35, p[2] - 0.35], max: [p[0] + 0.35, p[1] + 0.35, p[2] + 0.35], group: 'body' }];
  }
  damage(n) {
    if (this.dead) return;
    this.health -= n;
    if (this.health <= 0) this.kill();
  }
  kill() {
    this.dead = true;
    this.cone.visible = false;
    this.lens.material.color.set(0x222222);
    this.game.fx.sparks(this.def.pos, [0, -1, 0], 14);
    this.game.fx.glassShards(this.def.pos, 10);
    audio.play('break_glass', { pos: this.def.pos });
  }
  trigger() {
    this.kill();
  }
  update(dt) {
    if (this.dead) return;
    const d = this.def, g = this.game;
    this.t += dt * (d.speed || 0.35);
    const p = g.player;
    let yaw = d.yaw + Math.sin(this.t) * (d.sweep ?? 0.9);
    let pitch = d.pitch ?? -0.35;
    // track the player once spotted
    if (this.spotted > 0 && p.alive) {
      const c = p.center();
      const dx = c[0] - d.pos[0], dy = c[1] - d.pos[1], dz = c[2] - d.pos[2];
      yaw = Math.atan2(dx, dz);
      pitch = Math.atan2(dy, Math.hypot(dx, dz));
      this.spotted -= dt;
    }
    this.curYaw = this.curYaw === undefined ? yaw : this.curYaw + (yaw - this.curYaw) * Math.min(1, dt * 4);
    this.curPitch = this.curPitch === undefined ? pitch : this.curPitch + (pitch - this.curPitch) * Math.min(1, dt * 4);
    this.head.rotation.set(-this.curPitch, this.curYaw, 0, 'YXZ');
    // detection
    if (p && p.alive && !g.notarget && !g.cutscene) {
      const c = p.center();
      const dx = c[0] - d.pos[0], dy = c[1] - d.pos[1], dz = c[2] - d.pos[2];
      const dist = Math.hypot(dx, dy, dz);
      const fx = Math.sin(this.curYaw) * Math.cos(this.curPitch), fy = Math.sin(this.curPitch), fz = Math.cos(this.curYaw) * Math.cos(this.curPitch);
      const cos = (dx * fx + dy * fy + dz * fz) / dist;
      const coneCos = Math.cos((((d.cone || 12) + 3) * Math.PI) / 180);
      if (dist < (d.range || 30) && cos > coneCos && g.world.visible(d.pos, c)) {
        if (this.spotted <= 0) {
          this.spotted = 3;
          audio.play('turret_ping', { pos: d.pos, volume: 0.8, ref: 10, range: 80 });
          if (!this.firedOnce) {
            this.firedOnce = true;
            g.hint('YOU HAVE BEEN SPOTTED!', 2.5);
            this.fireTargets(p);
          }
          g.noise(c, 40, p);
        } else this.spotted = 3;
      }
      // light the player when lit
      if (this.spotted > 0) g.fx.dlight(c, [0.6, 0.55, 0.45], 3, 0);
    }
  }
  save() {
    return { dead: this.dead, fired: this.firedOnce };
  }
  load(s) {
    this.firedOnce = s.fired;
    if (s.dead && !this.dead) this.kill();
  }
}
