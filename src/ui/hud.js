// Half-Life style heads-up display, built from DOM elements.
import { WEAPONS, WEAPON_ORDER, AMMO_MAX } from '../game/weapons.js';
import { audio } from '../engine/audio.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
};

const ICON_CROSS = '<svg viewBox="0 0 24 24"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor"/></svg>';
const ICON_SUIT = '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8.5 13.5c0-1.5 1.5-2.5 3.5-2.5s3.5 1 3.5 2.5-1.6 2.5-3.5 2.5-3.5-1-3.5-2.5zM8 9a1.3 1.3 0 1 0 0 .1M16 9a1.3 1.3 0 1 0 0 .1M12 7.5a1.3 1.3 0 1 0 0 .1" fill="currentColor"/></svg>';
const ICON_BULLET = '<svg viewBox="0 0 24 24"><path d="M10 22V9c0-3 1-6 2-7 1 1 2 4 2 7v13z" fill="currentColor"/></svg>';
const ICON_SHELL = '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="14" fill="currentColor"/><rect x="7" y="17" width="10" height="4" fill="currentColor"/></svg>';
const ICON_ROCKET = '<svg viewBox="0 0 24 24"><path d="M12 2c2 2 3 5 3 8v8l3 3H6l3-3v-8c0-3 1-6 3-8z" fill="currentColor"/></svg>';
const ICON_GREN = '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="6" ry="7" fill="currentColor"/><rect x="10" y="3" width="4" height="4" fill="currentColor"/></svg>';
const ICON_LIGHT = '<svg viewBox="0 0 24 24"><path d="M3 9h9l6-5v16l-6-5H3z" fill="currentColor"/></svg>';
const AMMO_ICON = { '9mm': ICON_BULLET, shells: ICON_SHELL, rockets: ICON_ROCKET, grenades: ICON_GREN, argrenades: ICON_GREN };

export class Hud {
  constructor(root) {
    this.root = el('div', 'hud', root);
    this.root.style.display = 'none';
    this.flashEl = el('div', 'hud-flash', this.root);
    this.vignette = el('div', 'hud-vignette', this.root);
    // crosshair
    this.cross = el('div', 'hud-cross', this.root, '<i></i><i></i><i></i><i></i><b></b>');
    this.useHint = el('div', 'hud-use', this.root);
    this.charge = el('div', 'hud-charge', this.root, '<div class="hud-charge-fill"></div><span>SUPER HOP</span>');
    this.chargeFill = this.charge.querySelector('.hud-charge-fill');
    this.dmgInd = [];
    for (let i = 0; i < 4; i++) this.dmgInd.push(el('div', 'hud-dmg hud-dmg' + i, this.root));
    // bottom left: health / armor
    const bl = el('div', 'hud-bl', this.root);
    this.hpBox = el('div', 'hud-num', bl, `<span class="ico">${ICON_CROSS}</span><span class="v">100</span>`);
    el('div', 'hud-sep', bl);
    this.arBox = el('div', 'hud-num', bl, `<span class="ico">${ICON_SUIT}</span><span class="v">0</span>`);
    this.keysEl = el('div', 'hud-keys', bl);
    // bottom right: ammo
    const br = el('div', 'hud-br', this.root);
    this.altAmmo = el('div', 'hud-num small', br, `<span class="v"></span><span class="ico">${ICON_GREN}</span>`);
    this.ammoBox = el('div', 'hud-num', br, `<span class="v clip"></span><span class="bar"></span><span class="v res"></span><span class="ico"></span>`);
    // top right: flashlight
    this.flEl = el('div', 'hud-fl', this.root, `<span class="ico">${ICON_LIGHT}</span><div class="hud-fl-bar"><div></div></div>`);
    this.flBar = this.flEl.querySelector('.hud-fl-bar div');
    // weapon menu
    this.wmenu = el('div', 'hud-wmenu', this.root);
    this.wmenuT = 0;
    // pickups
    this.pickups = el('div', 'hud-pickups', this.root);
    // texts
    this.hintEl = el('div', 'hud-hint', this.root);
    this.titleEl = el('div', 'hud-title', this.root);
    this.chapterEl = el('div', 'hud-chapter', this.root);
    this.subEl = el('div', 'hud-sub', this.root);
    this.objEl = el('div', 'hud-obj', this.root);
    this.objList = el('div', 'hud-objlist', this.root);
    this.secretEl = el('div', 'hud-secret', this.root, 'SECRET AREA FOUND!');
    this.headshotEl = el('div', 'hud-headshot', this.root, 'HEADSHOT');
    this.death = el('div', 'hud-death', this.root, '<div class="t">YOU HAVE DIED</div><div class="s">The outback mourns. Press FIRE to try again.</div>');
    this.fps = el('div', 'hud-fps', this.root);
    this.bossEl = el('div', 'hud-boss', this.root, '<div class="n"></div><div class="b"><div></div></div>');
    this.bossBar = this.bossEl.querySelector('.b div');
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.timers = {};
    this.last = {};
    this.menuT = 0;
  }

  show(v) {
    this.root.style.display = v ? 'block' : 'none';
  }
  reset() {
    this.death.classList.remove('on');
    this.bossEl.classList.remove('on');
    this.root.classList.remove('dead');
    this.subEl.classList.remove('on');
    this.titleEl.classList.remove('on');
    this.hintEl.classList.remove('on');
    this.pickups.innerHTML = '';
    for (const d of this.dmgInd) d.style.opacity = 0;
  }

  // ------------------------------------------------------------------ events
  message(text, opts = {}) {
    this.titleEl.innerHTML = `<div>${text}</div>${opts.sub ? `<div class="s">${opts.sub}</div>` : ''}`;
    this._pulse(this.titleEl, 'title', opts.dur || 4);
  }
  hint(text, dur = 4) {
    this.hintEl.textContent = text;
    this._pulse(this.hintEl, 'hint', dur);
  }
  subtitle(speaker, text, dur) {
    const cls = speaker === 'H.O.P. SUIT' ? 'hev' : speaker === 'K-MAN' ? 'kman' : speaker.startsWith('ODF') ? 'grunt' : 'npc';
    this.subEl.innerHTML = `${speaker ? `<span class="who ${cls}">${speaker}:</span> ` : ''}${text}`;
    this._pulse(this.subEl, 'sub', dur || Math.max(2.5, text.length * 0.065));
  }
  chapter(title, sub) {
    this.chapterEl.innerHTML = `<div class="c-sub">${sub || ''}</div><div class="c-title">${title}</div>`;
    this._pulse(this.chapterEl, 'chapter', 6);
  }
  objective(text) {
    this.objEl.innerHTML = `<span>NEW OBJECTIVE</span>${text}`;
    this._pulse(this.objEl, 'obj', 6);
    audio.play('message', { volume: 0.6 });
  }
  objectiveDone(text) {
    this.objEl.innerHTML = `<span>OBJECTIVE COMPLETE</span><s>${text}</s>`;
    this._pulse(this.objEl, 'obj', 4);
  }
  boss(name, frac) {
    if (!name) {
      this.bossEl.classList.remove('on');
      return;
    }
    this.bossEl.classList.add('on');
    this.bossEl.querySelector('.n').textContent = name;
    this.bossBar.style.width = Math.round(frac * 100) + '%';
  }
  secret() {
    this._pulse(this.secretEl, 'secret', 3);
  }
  headshot() {
    this._pulse(this.headshotEl, 'hs', 0.8);
  }
  _pulse(e, key, dur) {
    e.classList.remove('on');
    void e.offsetWidth;
    e.classList.add('on');
    clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(() => e.classList.remove('on'), dur * 1000);
  }
  pickup(name, kind) {
    const d = el('div', 'hud-pick', this.pickups, name);
    if (kind === 'weapon' || kind === 'key') d.classList.add('big');
    setTimeout(() => d.classList.add('out'), 2500);
    setTimeout(() => d.remove(), 3200);
    while (this.pickups.children.length > 6) this.pickups.firstChild.remove();
  }
  flash(kind) {
    this.flashEl.className = 'hud-flash ' + kind;
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }
  damage(amount, from, type) {
    this.flash(type === 'fall' ? 'fall' : 'dmg');
    if (!from || !this.game) return;
    const p = this.game.player;
    const dx = from[0] - p.body.pos.x, dz = from[2] - p.body.pos.z;
    const ang = Math.atan2(-dx, -dz) - p.yaw; // relative to view
    let a = ((ang % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    // 0 = front, pi/2 = left
    let idx;
    if (Math.abs(a) < Math.PI / 4) idx = 0;
    else if (Math.abs(a) > (3 * Math.PI) / 4) idx = 2;
    else idx = a > 0 ? 3 : 1;
    const d = this.dmgInd[idx];
    d.style.transition = 'none';
    d.style.opacity = Math.min(1, 0.4 + amount / 25);
    void d.offsetWidth;
    d.style.transition = 'opacity 1.2s';
    d.style.opacity = 0;
  }
  death() {
    this.root.classList.add('dead');
    setTimeout(() => this.death.classList.add('on'), 1200);
  }
  showWeaponMenu(slot, id) {
    this.menuT = 1.6;
    this.menuSel = id;
    this._renderMenu();
  }
  menuOpen() {
    return false;
  }
  closeWeaponMenu() {
    this.menuT = 0;
  }
  consumeClick() {
    return false;
  }
  _renderMenu() {
    const p = this.game.player;
    const w = p.weapons;
    let html = '';
    for (let s = 1; s <= 5; s++) {
      const ids = WEAPON_ORDER.filter((id) => WEAPONS[id].slot === s);
      html += `<div class="slot"><div class="num">${s}</div>`;
      for (const id of ids) {
        if (!w.has(id)) continue;
        const sel = id === (w.pending || w.current) ? ' sel' : '';
        const empty = !w.canUse(id) ? ' empty' : '';
        html += `<div class="w${sel}${empty}">${WEAPONS[id].name}</div>`;
      }
      html += '</div>';
    }
    this.wmenu.innerHTML = html;
  }

  // ------------------------------------------------------------------ frame
  update(game, dt, settings) {
    this.game = game;
    const p = game.player;
    if (!p) return;
    this.root.classList.toggle('cutscene', !!game.cutscene);
    const hp = Math.ceil(p.health), ar = Math.floor(p.armor);
    if (this.last.hp !== hp) {
      this.hpBox.querySelector('.v').textContent = hp;
      this.hpBox.classList.toggle('low', hp <= 25);
      if (this.last.hp !== undefined) this._bump(this.hpBox);
      this.last.hp = hp;
    }
    if (this.last.ar !== ar) {
      this.arBox.querySelector('.v').textContent = ar;
      if (this.last.ar !== undefined) this._bump(this.arBox);
      this.last.ar = ar;
    }
    const keys = [...p.keys].join(',');
    if (this.last.keys !== keys) {
      this.keysEl.innerHTML = [...p.keys].map((k) => `<span class="key ${k}">${k === 'launch' ? '⚿' : '▮'}</span>`).join('');
      this.last.keys = keys;
    }
    // ammo
    const ws = p.weapons;
    const d = WEAPONS[ws.current];
    let ammoStr = '';
    if (d.ammo) {
      const clip = d.clip ? ws.clip[ws.current] : null;
      const res = ws.ammo[d.ammo];
      ammoStr = `${clip}|${res}|${d.ammo}`;
      if (this.last.ammo !== ammoStr) {
        this.ammoBox.style.display = '';
        this.ammoBox.querySelector('.clip').textContent = clip !== null ? clip : '';
        this.ammoBox.querySelector('.bar').style.display = clip !== null ? '' : 'none';
        this.ammoBox.querySelector('.res').textContent = res;
        this.ammoBox.querySelector('.ico').innerHTML = AMMO_ICON[d.ammo] || '';
        this.ammoBox.classList.toggle('low', (clip ?? res) === 0);
        this.last.ammo = ammoStr;
      }
    } else if (this.last.ammo !== 'none') {
      this.ammoBox.style.display = 'none';
      this.last.ammo = 'none';
    }
    const showAlt = ws.current === 'smg';
    this.altAmmo.style.display = showAlt ? '' : 'none';
    if (showAlt) this.altAmmo.querySelector('.v').textContent = ws.ammo.argrenades;
    // flashlight
    this.flEl.classList.toggle('on', p.flashlight);
    this.flBar.style.width = p.battery + '%';
    // weapon menu
    if (this.menuT > 0) {
      this.menuT -= dt;
      this.wmenu.style.opacity = Math.min(1, this.menuT * 2);
      this._renderMenu();
    } else this.wmenu.style.opacity = 0;
    // crosshair & use
    const third = p.view === 'third';
    this.cross.classList.toggle('enemy', !!(p.aimEntity && p.aimEntity.isNPC && p.aimEntity.alive));
    this.cross.classList.toggle('melee', ws.current === 'fists');
    if (p.useTarget && p.alive) {
      const t = p.useTarget;
      let label = t.useLabel ? t.useLabel() : 'USE';
      this.useHint.innerHTML = `<kbd>E</kbd> ${label}`;
      this.useHint.classList.add('on');
    } else this.useHint.classList.remove('on');
    // hop charge meter
    if (p.crouched && p.body.onGround && p.charge > 0.02) {
      this.charge.classList.add('on');
      this.chargeFill.style.width = Math.round(p.charge * 100) + '%';
      this.charge.classList.toggle('full', p.charge >= 1);
    } else this.charge.classList.remove('on');
    // low health vignette
    const low = p.alive ? Math.max(0, (35 - p.health) / 35) : 0;
    this.vignette.style.opacity = low * (0.6 + 0.4 * Math.sin(game.time * 5));
    // fps
    if (settings.showFps) {
      this.fpsAcc += dt;
      this.fpsN++;
      if (this.fpsAcc > 0.5) {
        this.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' FPS';
        this.fpsAcc = 0;
        this.fpsN = 0;
      }
      this.fps.style.display = '';
    } else this.fps.style.display = 'none';
    // objectives list (hold TAB)
    if (game.input.is('objectives')) {
      this.objList.innerHTML = '<div class="h">OBJECTIVES</div>' + game.objectives.map((o) => `<div class="${o.done ? 'done' : ''}">${o.done ? '☑' : '☐'} ${o.text}</div>`).join('') + `<div class="st">KILLS ${game.stats.kills} · SECRETS ${game.stats.secrets}/${game.stats.secretsTotal}</div>`;
      this.objList.classList.add('on');
    } else this.objList.classList.remove('on');
  }
  _bump(e) {
    e.classList.remove('bump');
    void e.offsetWidth;
    e.classList.add('bump');
  }
}
