// Menus, loading screen, intro text, console.
import { audio } from '../engine/audio.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
};

export const PAW_LOGO = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="7"/><ellipse cx="50" cy="62" rx="15" ry="17" fill="currentColor"/><ellipse cx="31" cy="38" rx="7" ry="10" fill="currentColor" transform="rotate(-20 31 38)"/><ellipse cx="50" cy="30" rx="7" ry="11" fill="currentColor"/><ellipse cx="69" cy="38" rx="7" ry="10" fill="currentColor" transform="rotate(20 69 38)"/></svg>';

export const CONTROLS = [
  ['W A S D', 'Hop around'],
  ['MOUSE', 'Look / aim'],
  ['MOUSE 1', 'Fire / KICK (fists)'],
  ['MOUSE 2', 'Alt fire / JAB (fists)'],
  ['Q  or  MOUSE 3', 'Quick kick (any weapon)'],
  ['SPACE', 'Hop (hold to keep bouncing)'],
  ['C', 'Crouch. Hold to coil, then SPACE = SUPER HOP'],
  ['SHIFT', 'Walk quietly'],
  ['E', 'Use doors, buttons, chargers (hold)'],
  ['R', 'Reload'],
  ['G', 'Throw grenade'],
  ['F', 'Flashlight'],
  ['1 - 5 / WHEEL', 'Select weapon'],
  ['V', 'Toggle 3rd / 1st person'],
  ['TAB', 'Objectives'],
  ['F5 / F9', 'Quick save / quick load'],
  ['ESC', 'Pause'],
  ['~', 'Console'],
];

export class UI {
  constructor(root, app) {
    this.app = app;
    this.root = el('div', 'ui', root);
    this.loading = el('div', 'loading', root, '<div class="lt">LOADING...</div><div class="lbar"><div></div></div><div class="ltip"></div>');
    this.loadBar = this.loading.querySelector('.lbar div');
    this.loadTip = this.loading.querySelector('.ltip');
    this.screen = null;
    this.consoleEl = el('div', 'console', root, '<div class="clog"></div><div class="cin"><span>]</span><input spellcheck="false" autocomplete="off"/></div>');
    this.clog = this.consoleEl.querySelector('.clog');
    this.cin = this.consoleEl.querySelector('input');
    this.consoleOpen = false;
    this.cin.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = this.cin.value.trim();
        this.cin.value = '';
        if (v) {
          this.log('] ' + v);
          this.app.command(v);
        }
      } else if (e.key === '`' || e.key === '~' || e.key === 'Escape') {
        e.preventDefault();
        this.toggleConsole(false);
      }
    });
    this.tips = [
      'TIP: Hold C to coil your legs, then press SPACE for a SUPER HOP.',
      'TIP: A kangaroo kick does serious damage. Press Q any time.',
      'TIP: Kick explosive barrels toward soldiers.',
      'TIP: Kick sentry guns to knock them over.',
      'TIP: Holding SPACE keeps you hopping. Strafe in the air to keep momentum.',
      'TIP: Hold E on wall chargers to refill health and suit armour.',
      'TIP: Shoot out searchlights before they spot you.',
      'TIP: The RPG rocket follows your crosshair while the laser is on.',
      'TIP: Crouched kangaroos in dark corners are hard to spot.',
    ];
  }

  log(t) {
    const d = el('div', '', this.clog, t.replace(/</g, '&lt;'));
    while (this.clog.children.length > 60) this.clog.firstChild.remove();
    this.clog.scrollTop = 1e9;
  }
  toggleConsole(v = !this.consoleOpen) {
    this.consoleOpen = v;
    this.consoleEl.classList.toggle('on', v);
    if (v) {
      this.app.input.exitLock();
      setTimeout(() => this.cin.focus(), 10);
    } else this.cin.blur();
  }

  showLoading(v, p = 0) {
    this.loading.classList.toggle('on', v);
    this.loadBar.style.width = Math.round(p * 100) + '%';
    if (v && !this._tipShown) {
      this._tipShown = true;
      this.loadTip.textContent = this.tips[Math.floor(Math.random() * this.tips.length)];
    }
    if (!v) this._tipShown = false;
  }

  clear() {
    this.root.innerHTML = '';
    this.root.className = 'ui';
    this.screen = null;
  }

  _btn(parent, label, fn, cls = '') {
    const b = el('button', 'mbtn ' + cls, parent, label);
    b.addEventListener('mouseenter', () => audio.play('ui_hover', { volume: 0.5 }));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.init();
      audio.play('ui_click', { volume: 0.7 });
      fn();
    });
    return b;
  }

  // ------------------------------------------------------------------ main menu
  mainMenu() {
    this.clear();
    this.screen = 'main';
    this.root.classList.add('menu-bg');
    const wrap = el('div', 'menu', this.root);
    el('div', 'logo', wrap, `<span class="l1">HALF</span><span class="lam">${PAW_LOGO}</span><span class="l2">HOP</span>`);
    el('div', 'tagline', wrap, 'A Totally Not Unhinged Game');
    const list = el('div', 'mlist', wrap);
    const save = this.app.getSave();
    if (save) this._btn(list, 'CONTINUE', () => this.app.continueGame());
    this._btn(list, 'NEW GAME', () => this.difficultyMenu());
    this._btn(list, 'OPTIONS', () => this.optionsMenu(() => this.mainMenu()));
    this._btn(list, 'CONTROLS', () => this.controlsMenu(() => this.mainMenu()));
    this._btn(list, 'CREDITS', () => this.creditsMenu());
    this._btn(list, 'QUIT', () => this.app.ui.toast('You can never leave the outback.'));
    el('div', 'mfoot', wrap, 'v1.0 · Click to capture the mouse · Headphones recommended');
  }

  toast(t) {
    const d = el('div', 'toast', this.root, t);
    setTimeout(() => d.remove(), 2500);
  }

  difficultyMenu() {
    this.clear();
    this.root.classList.add('menu-bg');
    const wrap = el('div', 'menu', this.root);
    el('div', 'mtitle', wrap, 'SELECT DIFFICULTY');
    const list = el('div', 'mlist', wrap);
    const opts = [
      ['JOEY', 'Easy. For baby kangaroos still in the pouch.'],
      ['BOOMER', 'Normal. A big grumpy male roo. Recommended.'],
      ['BIG RED', 'Hard. You are the biggest, angriest roo in the outback.'],
    ];
    opts.forEach(([n, desc], i) => {
      const b = this._btn(list, `${n}<small>${desc}</small>`, () => this.app.newGame(i), 'diff');
    });
    this._btn(list, 'BACK', () => this.mainMenu(), 'back');
  }

  intro(onDone) {
    this.clear();
    this.root.classList.add('intro');
    const lines = [
      'THE RED CENTRE, AUSTRALIA.',
      '',
      'For ninety years, the kangaroos kept their distance.',
      'They watched the humans lose the Great Emu War of 1932.',
      'They said nothing.',
      '',
      'Then the Outback Defence Force bulldozed the best grazing land',
      'for four hundred kilometres to build a secret missile base.',
      'Silo 7. One nuclear missile. Zero chill.',
      '',
      'One kangaroo has had enough.',
      'His name is SKIPPY. He has stolen a prototype H.O.P. suit,',
      '(Hazardous Outback Protection), and he has a plan:',
      '',
      'Break into the base. Reach the silo. Launch the nuke.',
      '',
      'Where it lands is a problem for later.',
    ];
    const box = el('div', 'introtext', this.root);
    const skip = el('div', 'skip', this.root, 'Click or press SPACE to begin');
    let i = 0;
    const iv = setInterval(() => {
      if (i >= lines.length) {
        clearInterval(iv);
        return;
      }
      el('div', lines[i] === '' ? 'gap' : 'ln', box, lines[i] || '&nbsp;');
      i++;
    }, 380);
    const done = () => {
      clearInterval(iv);
      window.removeEventListener('keydown', key);
      this.root.removeEventListener('click', done);
      onDone();
    };
    const key = (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') done();
    };
    setTimeout(() => {
      window.addEventListener('keydown', key);
      this.root.addEventListener('click', done);
    }, 400);
  }

  optionsMenu(back) {
    this.clear();
    this.root.classList.add('menu-bg', 'dim');
    const s = this.app.settings;
    const wrap = el('div', 'menu wide', this.root);
    el('div', 'mtitle', wrap, 'OPTIONS');
    const grid = el('div', 'opts', wrap);
    const slider = (label, key, min, max, step, fmt = (v) => v, onChange) => {
      const row = el('div', 'orow', grid);
      el('label', '', row, label);
      const inp = el('input', '', row);
      inp.type = 'range';
      inp.min = min;
      inp.max = max;
      inp.step = step;
      inp.value = s[key];
      const val = el('span', 'oval', row, fmt(s[key]));
      inp.addEventListener('input', () => {
        s[key] = parseFloat(inp.value);
        val.textContent = fmt(s[key]);
        this.app.applySettings();
        if (onChange) onChange();
      });
    };
    const toggle = (label, key) => {
      const row = el('div', 'orow', grid);
      el('label', '', row, label);
      const b = el('button', 'otog', row, s[key] ? 'ON' : 'OFF');
      b.addEventListener('click', () => {
        s[key] = !s[key];
        b.textContent = s[key] ? 'ON' : 'OFF';
        audio.play('ui_click', { volume: 0.6 });
        this.app.applySettings();
      });
    };
    const choice = (label, key, options) => {
      const row = el('div', 'orow', grid);
      el('label', '', row, label);
      const b = el('button', 'otog', row, options.find((o) => o[0] === s[key])?.[1] || '?');
      b.addEventListener('click', () => {
        const i = options.findIndex((o) => o[0] === s[key]);
        const n = options[(i + 1) % options.length];
        s[key] = n[0];
        b.textContent = n[1];
        audio.play('ui_click', { volume: 0.6 });
        this.app.applySettings();
      });
    };
    slider('Mouse sensitivity', 'sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2));
    toggle('Invert mouse', 'invertY');
    slider('Field of view', 'fov', 60, 100, 1, (v) => v + '°');
    choice('Resolution', 'renderScale', [[0.35, 'CRUNCHY (software)'], [0.5, 'RETRO 640x480-ish'], [0.75, 'MEDIUM'], [1, 'FULL']]);
    toggle('Smooth textures', 'smoothTextures');
    slider('Brightness', 'brightness', 0.6, 1.8, 0.05, (v) => v.toFixed(2));
    slider('Volume', 'volume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    slider('Music', 'music', 0, 1, 0.05, (v) => Math.round(v * 100) + '%');
    toggle('Spoken voices (TTS)', 'voices');
    toggle('First person view', 'firstPerson');
    toggle('Auto-hop (hold SPACE)', 'autoHop');
    toggle('Show FPS', 'showFps');
    const list = el('div', 'mlist row', wrap);
    this._btn(list, 'BACK', () => back(), 'back');
  }

  controlsMenu(back) {
    this.clear();
    this.root.classList.add('menu-bg', 'dim');
    const wrap = el('div', 'menu wide', this.root);
    el('div', 'mtitle', wrap, 'CONTROLS');
    const t = el('div', 'ctrls', wrap);
    for (const [k, d] of CONTROLS) el('div', 'crow', t, `<kbd>${k}</kbd><span>${d}</span>`);
    const list = el('div', 'mlist row', wrap);
    this._btn(list, 'BACK', () => back(), 'back');
  }

  creditsMenu() {
    this.clear();
    this.root.classList.add('menu-bg', 'dim');
    const wrap = el('div', 'menu wide', this.root);
    el('div', 'mtitle', wrap, 'CREDITS');
    el(
      'div',
      'credits',
      wrap,
      `<p><b>HALF-HOP</b> — a love letter to 1998, starring a kangaroo.</p>
       <p>Everything you see and hear is generated in your browser at load time:
       procedural textures, a lightmap compiler with ray-traced shadows,
       synthesised sound effects and music.</p>
       <p>Built with three.js.</p>
       <p>No emus were harmed. The emus know what they did.</p>`
    );
    const list = el('div', 'mlist row', wrap);
    this._btn(list, 'BACK', () => this.mainMenu(), 'back');
  }

  pauseMenu() {
    this.clear();
    this.screen = 'pause';
    this.root.classList.add('pause');
    const wrap = el('div', 'menu', this.root);
    el('div', 'mtitle', wrap, 'PAUSED');
    const list = el('div', 'mlist', wrap);
    this._btn(list, 'RESUME', () => this.app.resume());
    this._btn(list, 'QUICK SAVE', () => {
      this.app.game.quicksave();
      this.toast('Game saved.');
    });
    this._btn(list, 'LOAD LAST SAVE', () => this.app.loadQuick());
    this._btn(list, 'OPTIONS', () => this.optionsMenu(() => this.pauseMenu()));
    this._btn(list, 'CONTROLS', () => this.controlsMenu(() => this.pauseMenu()));
    this._btn(list, 'QUIT TO MENU', () => this.app.quitToMenu());
    const g = this.app.game;
    if (g && g.objectives.length) {
      const o = el('div', 'pobj', wrap, '<div class="h">OBJECTIVES</div>');
      for (const ob of g.objectives) el('div', ob.done ? 'done' : '', o, (ob.done ? '☑ ' : '☐ ') + ob.text);
    }
  }

  // ------------------------------------------------------------------ ending
  ending(stats, onDone) {
    this.clear();
    this.root.classList.add('ending');
    const t = Math.floor(stats.time);
    const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
    const wrap = el('div', 'endwrap', this.root);
    el('div', 'endtitle', wrap, 'MISSION COMPLETE');
    el('div', 'endsub', wrap, 'THE OUTBACK IS AVENGED. SORT OF.');
    el(
      'div',
      'endstats',
      wrap,
      `<div><span>TIME</span><b>${mm}:${ss}</b></div>
       <div><span>KILLS</span><b>${stats.kills}</b></div>
       <div><span>ACCURACY</span><b>${acc}%</b></div>
       <div><span>SECRETS</span><b>${stats.secrets} / ${stats.secretsTotal}</b></div>
       <div><span>SUPER HOPS</span><b>${stats.superHops || 0}</b></div>
       <div><span>DEATHS</span><b>${stats.deaths}</b></div>`
    );
    const cr = el('div', 'endcredits', wrap);
    const lines = [
      'HALF-HOP',
      '',
      'Starring SKIPPY as Himself',
      'The Outback Defence Force as The Outback Defence Force',
      'Assorted Dingoes as Very Good Boys (Evil)',
      'The K-Man as The K-Man',
      'The Moon as The Moon',
      '',
      'Thank you for playing.',
    ];
    lines.forEach((l, i) => setTimeout(() => el('div', 'cl', cr, l || '&nbsp;'), 800 + i * 500));
    setTimeout(() => {
      const list = el('div', 'mlist row', wrap);
      this._btn(list, 'MAIN MENU', () => onDone());
    }, 800 + lines.length * 500);
  }
}
