// Game session: owns the world, entities, player and the per-frame loop.
import * as THREE from 'three';
import { World, rayBox } from '../engine/world.js';
import { createSharedUniforms } from '../engine/materials.js';
import { createSky } from '../engine/sky.js';
import { sampleLightmapAt } from '../engine/lightmap.js';
import { audio } from '../engine/audio.js';
import { FX } from './fx.js';
import { Player } from './player.js';
import { createEntity } from './entities/index.js';
import { NavGrid } from './nav.js';
import { MAPS } from '../maps/index.js';
import { clamp, rand } from '../engine/util.js';

export const DIFFICULTY = [
  { name: 'JOEY', dmgTaken: 0.5, enemyHp: 0.8, accuracy: 0.7, aggression: 0.7 },
  { name: 'BOOMER', dmgTaken: 1.0, enemyHp: 1.0, accuracy: 1.0, aggression: 1.0 },
  { name: 'BIG RED', dmgTaken: 1.5, enemyHp: 1.25, accuracy: 1.3, aggression: 1.3 },
];

let DYN_ID = 0;

export class Game {
  constructor(app) {
    this.app = app;
    this.input = app.input;
    this.scene = new THREE.Scene();
    this.vmScene = new THREE.Scene();
    this.shared = createSharedUniforms();
    this.entities = [];
    this.byName = new Map();
    this.timers = [];
    this.fx = new FX(this, app.atlas, this.shared);
    this.scene.add(this.fx.group);
    this.entGroup = new THREE.Group();
    this.scene.add(this.entGroup);
    this.world = null;
    this.player = null;
    this.nav = null;
    this.sky = null;
    this.paused = false;
    this.time = 0;
    this.difficulty = 1;
    this.stats = { kills: 0, shots: 0, hits: 0, secrets: 0, secretsTotal: 0, time: 0, deaths: 0 };
    this.flags = {};
    this.objectives = [];
    this.mapId = null;
    this.loading = false;
    this.ambient = [];
    this.shake = 0;
    this.lastSave = null;
    this.ended = false;
    this.cutscene = null;
    this.godMode = false;
    this.noclip = false;
    this.alarm = false;
  }

  get diff() {
    return DIFFICULTY[this.difficulty];
  }

  // ------------------------------------------------------------------ loading
  async loadMap(mapId, opts = {}) {
    this.loading = true;
    const ui = this.app.ui;
    ui.showLoading(true, 0);
    await new Promise((r) => setTimeout(r, 30));
    this.unload();
    const def = MAPS[mapId];
    if (!def) throw new Error('No map ' + mapId);
    this.mapId = mapId;
    const map = def.build();
    this.map = map;
    const world = new World();
    for (const b of map.brushes) world.add(b);
    for (const l of map.ladders) world.ladders = (world.ladders || []).concat([l]);
    world.ladders = map.ladders;
    this.world = world;
    world.entitySolids = (min, max, ignore, out) => this._entitySolids(min, max, ignore, out);

    // entities create their brushes before the bake so they get lightmaps
    this.entities = [];
    this.byName.clear();
    const defs = map.ents;
    defs.forEach((d, i) => {
      const e = createEntity(this, d);
      if (!e) return;
      e.id = 'm' + i;
      this._register(e);
    });
    for (const e of this.entities) if (e.preBuild) e.preBuild(world);

    await world.build(this.app.textures, map.lighting, this.shared, (p) => ui.showLoading(true, p));
    this.scene.add(world.group);

    // sky + fog
    if (map.sky) {
      this.sky = createSky(map.sky);
      this.scene.add(this.sky);
    }
    if (map.fog) {
      this.shared.fogColor.value.setRGB(...map.fog.color);
      this.shared.fogNear.value = map.fog.near;
      this.shared.fogFar.value = map.fog.far;
    } else {
      this.shared.fogNear.value = 1000;
      this.shared.fogFar.value = 2000;
    }
    this.shared.uBright.value = this.app.settings.brightness;

    this.nav = new NavGrid(world);
    this.nav.build();

    for (const e of this.entities) if (e.spawn) e.spawn();

    // player
    this.player = new Player(this);
    this.scene.add(this.player.model.root);
    this.player.spawnAt(map.spawn.pos, map.spawn.yaw);
    if (opts.carry) this.player.applyCarry(opts.carry);
    else this.player.giveStart();

    this.stats.secretsTotal = (this.stats.secretsTotalBase || 0) + this.entities.filter((e) => e.type === 'secret').length;

    // ambience
    if (map.ambientSound) this.ambient.push(audio.play(map.ambientSound, { loop: true, volume: map.ambientVolume ?? 0.35 }));

    if (opts.state) this.applyState(opts.state);
    else {
      this.objectives = (this.objectives || []).filter((o) => o.persist);
      // fire the map's start relay
      this.fire('mapstart', this.player);
    }
    this.loading = false;
    ui.showLoading(false);
    this.time = opts.state ? opts.state.time : 0;
    this.app.hud.reset();
    if (!opts.state) setTimeout(() => this.autosave(), 100);
  }

  unload() {
    audio.stopAllLoops();
    audio.stopMusic(0.5);
    this.ambient = [];
    for (const e of this.entities) if (e.destroy) e.destroy();
    this.entities = [];
    this.byName.clear();
    this.timers = [];
    this.entGroup.clear();
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
      this.world = null;
    }
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky = null;
    }
    if (this.player) {
      this.scene.remove(this.player.model.root);
      this.player.destroy();
      this.player = null;
    }
    this.fx.clear();
    this.vmScene.clear();
    this.alarm = false;
    this.cutscene = null;
  }

  // ------------------------------------------------------------------ entities
  _register(e) {
    this.entities.push(e);
    if (e.targetname) {
      let arr = this.byName.get(e.targetname);
      if (!arr) this.byName.set(e.targetname, (arr = []));
      arr.push(e);
    }
  }
  spawnEntity(def, spawnNow = true) {
    const e = createEntity(this, def);
    if (!e) return null;
    e.id = 'd' + DYN_ID++;
    e.dynamicDef = def;
    this._register(e);
    if (spawnNow && e.spawn) e.spawn();
    return e;
  }
  removeEntity(e) {
    e.removed = true;
    if (e.destroy) e.destroy();
  }
  find(name) {
    return this.byName.get(name) || [];
  }
  first(name) {
    return (this.byName.get(name) || [])[0];
  }

  // HL style I/O: trigger every entity named `target`.
  fire(target, activator = null, delay = 0) {
    if (!target) return;
    if (Array.isArray(target)) {
      for (const t of target) this.fire(t, activator, delay);
      return;
    }
    if (delay > 0) {
      this.timers.push({ t: this.time + delay, fn: () => this.fire(target, activator, 0) });
      return;
    }
    for (const e of this.find(target)) if (!e.removed && e.trigger) e.trigger(activator);
  }
  after(sec, fn) {
    this.timers.push({ t: this.time + sec, fn });
  }

  _entitySolids(min, max, ignore, out) {
    for (const e of this.entities) {
      if (!e.solid || e.removed || e === ignore) continue;
      const b = e.getBox();
      if (!b) continue;
      if (b.max[0] < min[0] || b.min[0] > max[0] || b.max[1] < min[1] || b.min[1] > max[1] || b.max[2] < min[2] || b.min[2] > max[2]) continue;
      out.push({ min: b.min, max: b.max, owner: e });
    }
    const p = this.player;
    if (p && p !== ignore && p.alive && !this.noclip) {
      const b = p.getBox();
      if (!(b.max[0] < min[0] || b.min[0] > max[0] || b.max[1] < min[1] || b.min[1] > max[1] || b.max[2] < min[2] || b.min[2] > max[2]))
        out.push({ min: b.min, max: b.max, owner: p });
    }
  }

  // ------------------------------------------------------------------ combat helpers
  // Trace a bullet/ray against world + shootable entities.
  trace(o, d, maxDist, opts = {}) {
    const wh = this.world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], maxDist, { bullet: opts.bullet !== false, sight: opts.sight });
    let best = wh ? wh.t : maxDist;
    let hit = wh ? { t: wh.t, point: wh.point, normal: wh.normal, brush: wh.brush, entity: wh.brush.owner || null } : null;
    const cands = this.entities.slice();
    if (this.player && opts.ignore !== this.player && this.player.alive) cands.push(this.player);
    for (const e of cands) {
      if (e === opts.ignore || e.removed || !e.getHitboxes) continue;
      const hbs = e.getHitboxes();
      if (!hbs) continue;
      for (const hb of hbs) {
        const r = rayBox(o[0], o[1], o[2], d[0], d[1], d[2], hb.min, hb.max, best);
        if (r && r.t < best && r.t > 0) {
          best = r.t;
          hit = { t: r.t, point: [o[0] + d[0] * r.t, o[1] + d[1] * r.t, o[2] + d[2] * r.t], normal: r.normal, entity: e, group: hb.group, brush: null };
        }
      }
    }
    return hit;
  }

  // Apply a hitscan bullet with impact effects. Returns the hit.
  bullet(o, d, maxDist, damage, attacker, opts = {}) {
    const hit = this.trace(o, d, maxDist, { ignore: attacker });
    const end = hit ? hit.point : [o[0] + d[0] * maxDist, o[1] + d[1] * maxDist, o[2] + d[2] * maxDist];
    if (opts.tracer) this.fx.tracer(opts.tracerFrom || o, end, opts.tracerColor);
    if (!hit) return null;
    if (hit.entity && hit.entity.damage) {
      hit.entity.damage(damage, d, attacker, hit.group || 'body', opts.type || 'bullet', hit.point);
      if (hit.entity.fleshy) {
        this.fx.blood(hit.point, [-d[0], -d[1], -d[2]], 0.6, hit.entity.bloodColor);
        audio.play('hit_flesh', { pos: hit.point, volume: 0.6 });
        // blood splatter on the wall behind
        if (Math.random() < 0.5) {
          const wh = this.world.raycast(hit.point[0], hit.point[1], hit.point[2], d[0], d[1] - 0.2, d[2], 2.5, { bullet: true });
          if (wh && !wh.brush.dynamic) this.fx.decal(wh.point, wh.normal, 'blood', rand(0.2, 0.45));
        }
      } else this.impactFX(hit, d);
      if (attacker === this.player) this.stats.hits++;
    } else {
      this.impactFX(hit, d);
    }
    return hit;
  }

  impactFX(hit, d) {
    const surf = this.surfaceOf(hit.brush, hit.entity);
    const n = hit.normal;
    if (surf === 'metal') {
      this.fx.sparks(hit.point, n, 6);
      audio.play(Math.random() < 0.3 ? 'ric' : 'hit_metal', { pos: hit.point, volume: 0.5 });
    } else if (surf === 'wood') {
      this.fx.chips(hit.point, n, [0.5, 0.35, 0.2], 4);
      this.fx.puff(hit.point, n, [0.55, 0.45, 0.35], 2, 0.2);
      audio.play('hit_wood', { pos: hit.point, volume: 0.6 });
    } else if (surf === 'dirt') {
      this.fx.puff(hit.point, n, [0.6, 0.35, 0.22], 3, 0.35);
      this.fx.chips(hit.point, n, [0.45, 0.25, 0.15], 3);
      audio.play('hit_concrete', { pos: hit.point, volume: 0.4, rate: 0.7 });
    } else if (surf === 'glass') {
      audio.play('hit_metal', { pos: hit.point, volume: 0.3, rate: 2 });
    } else {
      this.fx.puff(hit.point, n, [0.6, 0.6, 0.58], 2, 0.25);
      this.fx.chips(hit.point, n, [0.5, 0.5, 0.5], 3);
      if (Math.random() < 0.25) this.fx.sparks(hit.point, n, 2);
      audio.play(Math.random() < 0.15 ? 'ric' : 'hit_concrete', { pos: hit.point, volume: 0.5 });
    }
    if (hit.brush && !hit.brush.dynamic && surf !== 'glass') this.fx.decal(hit.point, n, 'hole', 0.07);
  }

  surfaceOf(brush, ent) {
    if (ent && ent.surface) return ent.surface;
    if (!brush) return 'concrete';
    if (brush.surface) return brush.surface;
    const t = brush.tex || '';
    if (/metal|rust|corrug|vent|grate|door|crate_metal|elevator|silo|pipe|server|locker|generator|console|water|missile|olive/.test(t)) return 'metal';
    if (/wood|crate|table|bunk/.test(t)) return 'wood';
    if (/dirt|sand|rock|tent/.test(t)) return 'dirt';
    if (/glass/.test(t)) return 'glass';
    return 'concrete';
  }

  radiusDamage(pos, radius, damage, attacker, opts = {}) {
    const cands = this.entities.slice();
    if (this.player && this.player.alive) cands.push(this.player);
    for (const e of cands) {
      if (e.removed || !e.damage || e === opts.ignore) continue;
      const c = e.center ? e.center() : null;
      if (!c) continue;
      const dx = c[0] - pos[0], dy = c[1] - pos[1], dz = c[2] - pos[2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist > radius) continue;
      if (!this.canHit(pos, e, c)) {
        // partial cover: check from slightly above
        if (!this.canHit([pos[0], pos[1] + 0.8, pos[2]], e, c)) continue;
      }
      const k = 1 - dist / radius;
      const dir = dist > 0.01 ? [dx / dist, dy / dist + 0.4, dz / dist] : [0, 1, 0];
      let dmg = damage * (0.25 + 0.75 * k);
      if (e === this.player && attacker === this.player) dmg *= 0.5; // rocket hops hurt less
      e.damage(dmg, dir, attacker, 'body', 'explosion', c);
      if (e.knockback) e.knockback(dir, k * (opts.force ?? 12));
    }
    this.noise(pos, radius * 4, attacker);
    this.shakeAt(pos, 1.2 * (damage / 100), radius * 3);
  }

  // Line of fire to an entity, ignoring the entity's own brush.
  canHit(from, ent, to = null) {
    const c = to || ent.center();
    const dx = c[0] - from[0], dy = c[1] - from[1], dz = c[2] - from[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return true;
    const hit = this.world.raycast(from[0], from[1], from[2], dx / d, dy / d, dz / d, d, { bullet: true });
    return !hit || hit.t >= d - 0.15 || (hit.brush && hit.brush.owner === ent);
  }

  explode(pos, radius = 5, damage = 120, attacker = null, scale = 1) {
    this.fx.explosion(pos, scale);
    audio.play('explosion', { pos, volume: 1.2, ref: 8, range: 200 });
    this.radiusDamage(pos, radius, damage, attacker);
    // scorch
    const wh = this.world.raycast(pos[0], pos[1] + 0.3, pos[2], 0, -1, 0, 2.5, {});
    if (wh && !wh.brush.dynamic) this.fx.decal(wh.point, wh.normal, 'scorch', radius * 0.35);
  }

  shakeAt(pos, amount, range) {
    if (!this.player) return;
    const c = this.player.body.pos;
    const d = Math.hypot(c.x - pos[0], c.y - pos[1], c.z - pos[2]);
    if (d < range) this.shake = Math.min(2, this.shake + amount * (1 - d / range));
  }

  // AI hearing: any creature within radius gets alerted to pos.
  noise(pos, radius, source) {
    for (const e of this.entities) if (e.hear) e.hear(pos, radius, source);
  }

  // HL1 style model lighting: sample the lightmap on the floor below.
  sampleLight(pos, out) {
    const w = this.world;
    const hit = w.raycast(pos[0], pos[1] + 0.3, pos[2], 0, -1, 0, 12, { dynamic: true });
    let c = null;
    if (hit) c = sampleLightmapAt(w, hit.brush, hit.point, hit.normal);
    if (!c) c = w.lighting ? w.lighting.ambient.map((v) => v * 2) : [0.5, 0.5, 0.5];
    out[0] = c[0];
    out[1] = c[1];
    out[2] = c[2];
    return out;
  }

  // ------------------------------------------------------------------ messaging
  message(text, opts) {
    this.app.hud.message(text, opts);
  }
  hint(text, dur = 5) {
    this.app.hud.hint(text, dur);
  }
  say(speaker, text, opts = {}) {
    this.app.hud.subtitle(speaker, text, opts.dur);
    const kind = opts.voice || (speaker === 'H.O.P. SUIT' ? 'hev' : speaker === 'K-MAN' ? 'koala' : speaker.startsWith('ODF') ? 'soldier' : 'tech');
    if (kind === 'soldier') audio.play('radio', { volume: 0.4 });
    if (kind === 'hev') audio.play('hev_beep', { volume: 0.5 });
    audio.say(text, kind, opts.force);
  }
  setObjective(id, text) {
    const o = this.objectives.find((x) => x.id === id);
    if (o) o.text = text;
    else this.objectives.push({ id, text, done: false });
    this.app.hud.objective(text);
  }
  completeObjective(id) {
    const o = this.objectives.find((x) => x.id === id);
    if (o && !o.done) {
      o.done = true;
      this.app.hud.objectiveDone(o.text);
    }
  }

  // ------------------------------------------------------------------ level flow
  async changeLevel(mapId) {
    if (this.loading) return;
    const carry = this.player.getCarry();
    this.stats.secretsTotalBase = this.stats.secretsTotal;
    await this.loadMap(mapId, { carry });
  }

  // ------------------------------------------------------------------ save / load
  captureState() {
    const ents = [];
    for (const e of this.entities) {
      if (!e.save) continue;
      const s = e.save();
      if (s === undefined) continue;
      ents.push({ id: e.id, s, dyn: e.dynamicDef && !e.removed ? e.dynamicDef : null, removed: e.removed });
    }
    return {
      savedAt: Date.now(),
      map: this.mapId,
      time: this.time,
      difficulty: this.difficulty,
      player: this.player.save(),
      ents,
      stats: { ...this.stats },
      flags: { ...this.flags },
      objectives: this.objectives.map((o) => ({ ...o })),
      alarm: this.alarm,
    };
  }
  applyState(st) {
    this.difficulty = st.difficulty;
    this.stats = { ...st.stats };
    this.flags = { ...st.flags };
    this.objectives = st.objectives.map((o) => ({ ...o }));
    const byId = new Map(this.entities.map((e) => [e.id, e]));
    for (const rec of st.ents) {
      let e = byId.get(rec.id);
      if (!e && rec.dyn && !rec.removed) {
        e = this.spawnEntity(rec.dyn);
        if (e) e.id = rec.id;
      }
      if (!e) continue;
      if (rec.removed) {
        if (!e.removed) this.removeEntity(e);
        continue;
      }
      if (e.load) e.load(rec.s);
    }
    this.player.load(st.player);
    if (st.alarm) this.setAlarm(true, true);
  }
  autosave() {
    if (!this.player || !this.player.alive) return;
    this.lastSave = this.captureState();
    try {
      localStorage.setItem('halfhop_autosave', JSON.stringify(this.lastSave));
    } catch (e) {}
  }
  quicksave() {
    if (!this.player || !this.player.alive || this.cutscene) return;
    const st = this.captureState();
    this.lastSave = st;
    try {
      localStorage.setItem('halfhop_quicksave', JSON.stringify(st));
    } catch (e) {}
    this.app.hud.hint('GAME SAVED', 1.5);
  }
  async loadSave(st) {
    if (!st) return;
    this.difficulty = st.difficulty;
    await this.loadMap(st.map, { state: st });
    this.lastSave = st;
  }
  async restartFromLast() {
    const st = this.lastSave;
    if (st) await this.loadSave(st);
    else await this.loadMap(this.mapId);
  }

  setAlarm(on, silent = false) {
    if (on === this.alarm) return;
    this.alarm = on;
    for (const e of this.entities) if (e.onAlarm) e.onAlarm(on);
    if (on && !silent) this.fire('alarm_on', this.player);
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    if (this.loading || !this.world) return;
    this.time += dt;
    this.stats.time += dt;
    this.shared.uTime.value = this.time;
    if (this.sky) this.sky.material.uniforms.time.value = this.time;
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.t <= this.time);
      this.timers = this.timers.filter((t) => t.t > this.time);
      for (const t of due) t.fn();
    }
    if (this.cutscene) this.cutscene.update(dt);
    this.player.update(dt);
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (!e.removed && e.update) e.update(dt);
    }
    if (this.entities.some((e) => e.removed && e.purge)) this.entities = this.entities.filter((e) => !(e.removed && e.purge));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.player.updateCamera(dt);
    this.fx.update(dt, this.app.renderer.camera);
    if (this.sky) this.sky.position.copy(this.app.renderer.camera.position);
  }
}
