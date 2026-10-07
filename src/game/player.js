// The player kangaroo: movement physics, camera, health/armour, interaction.
import * as THREE from 'three';
import { moveBody, unstick } from '../engine/physics.js';
import { audio } from '../engine/audio.js';
import { clamp, damp, lerp, rand, wrapAngle } from '../engine/util.js';
import { KangarooModel } from './kangaroo.js';
import { WeaponSystem, WEAPONS } from './weapons.js';
import { ViewModel } from './viewmodel.js';
import { rayBox } from '../engine/world.js';

const STAND_H = 1.7, CROUCH_H = 1.0;
const RUN = 6.2, WALK = 3.0, CROUCH_SPEED = 2.3;
const ACCEL = 10, AIR_ACCEL = 14, AIR_CAP = 1.1, FRICTION = 5.5, STOP = 2.0;
const GRAVITY = 20;
const HOP_V = 7.2, SUPER_V_MIN = 10, SUPER_V_MAX = 13.8;
const LADDER_SPEED = 3.6;

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _tmp = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.body = {
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      half: 0.34,
      height: STAND_H,
      onGround: false,
      ground: null,
      stepHeight: 0.56,
      forPlayer: true,
      ignore: null,
    };
    this.body.ignore = this;
    this.yaw = 0;
    this.pitch = 0;
    this.health = 100;
    this.armor = 0;
    this.alive = true;
    this.crouched = false;
    this.crouchTime = 0;
    this.charge = 0;
    this.keys = new Set();
    this.flashlight = false;
    this.battery = 100;
    this.onLadder = false;
    this.weapons = new WeaponSystem(this);
    this.model = new KangarooModel(game.shared);
    this.viewModel = new ViewModel(game);
    this.view = game.app.settings.firstPerson ? 'first' : 'third';
    this.action = null;
    this.actionT = 0;
    this.actionDur = 1;
    this.pain = 0;
    this.lightT = 0;
    this.light = [0.6, 0.6, 0.6];
    this.camDist = 2.6;
    this.camPos = new THREE.Vector3();
    this.eyeY = 1.45;
    this.aimPoint = new THREE.Vector3();
    this.aimEntity = null;
    this.punch = new THREE.Vector2(); // view punch (recoil)
    this.stepT = 0;
    this.lastHop = 0;
    this.airTime = 0;
    this.fallStartY = 0;
    this.deathT = 0;
    this.hevCooldown = {};
    this.useTarget = null;
    this.chargeSoundPlayed = false;
    this.hopsHeld = false;
    this.inWater = false;
    this.speedMul = 1;
    this.frozen = false;
  }

  destroy() {
    this.viewModel.destroy();
  }

  spawnAt(pos, yaw) {
    this.body.pos.set(pos[0], pos[1], pos[2]);
    this.body.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.camPos.set(pos[0], pos[1] + 1.6, pos[2]);
    unstick(this.game.world, this.body);
  }

  giveStart() {
    this.health = 100;
    this.armor = 0;
  }

  // ------------------------------------------------------------- persistence
  getCarry() {
    return { health: this.health, armor: this.armor, weapons: this.weapons.save(), flashlight: this.flashlight, battery: this.battery };
  }
  applyCarry(c) {
    this.health = c.health;
    this.armor = c.armor;
    this.weapons.load(c.weapons);
    this.battery = c.battery ?? 100;
    this.onWeaponChanged();
  }
  save() {
    return {
      pos: this.body.pos.toArray(),
      vel: this.body.vel.toArray(),
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      armor: this.armor,
      keys: [...this.keys],
      weapons: this.weapons.save(),
      crouched: this.crouched,
      battery: this.battery,
    };
  }
  load(s) {
    this.body.pos.fromArray(s.pos);
    this.body.vel.fromArray(s.vel);
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this.health = s.health;
    this.armor = s.armor;
    this.keys = new Set(s.keys);
    this.weapons.load(s.weapons);
    this.battery = s.battery ?? 100;
    if (s.crouched) {
      this.crouched = true;
      this.body.height = CROUCH_H;
    }
    this.camPos.set(s.pos[0], s.pos[1] + 1.6, s.pos[2]);
    this.onWeaponChanged();
  }

  // ------------------------------------------------------------- helpers
  posArr() {
    return [this.body.pos.x, this.body.pos.y + 1, this.body.pos.z];
  }
  center() {
    return [this.body.pos.x, this.body.pos.y + this.body.height * 0.55, this.body.pos.z];
  }
  eye() {
    return [this.body.pos.x, this.body.pos.y + this.eyeY, this.body.pos.z];
  }
  getBox() {
    const b = this.body;
    return { min: [b.pos.x - b.half, b.pos.y, b.pos.z - b.half], max: [b.pos.x + b.half, b.pos.y + b.height, b.pos.z + b.half] };
  }
  getHitboxes() {
    if (!this.alive) return null;
    const b = this.getBox();
    return [{ min: b.min, max: b.max, group: 'body' }];
  }
  speedH() {
    return Math.hypot(this.body.vel.x, this.body.vel.z);
  }
  forwardVec(out = _f) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  rightVec() {
    return [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
  }
  shootOrigin() {
    const b = this.body.pos;
    return [b.x, b.y + (this.crouched ? 0.75 : 1.3), b.z];
  }
  muzzlePos() {
    if (this.view === 'first') return this.viewModel.muzzleWorld(this.game.app.renderer, this);
    this.model.muzzleWorld(_tmp);
    return [_tmp.x, _tmp.y, _tmp.z];
  }
  setAction(name, dur) {
    this.action = name;
    this.actionT = 0;
    this.actionDur = dur;
    this.viewModel.action(name, dur);
  }
  recoil(k) {
    this.punch.x += k * 0.035;
    this.punch.y += (Math.random() - 0.5) * k * 0.02;
    this.model.fireRecoil(k * 0.6);
    this.viewModel.recoil(k);
  }
  pushBack(f) {
    const fw = this.forwardVec();
    this.body.vel.x -= fw.x * f;
    this.body.vel.z -= fw.z * f;
  }
  onWeaponChanged() {
    this.model.setWeapon(WEAPONS[this.weapons.current].model);
    this.viewModel.setWeapon(WEAPONS[this.weapons.current].model);
    if (this.weapons.pending || true) this.setAction('switch', 0.45);
    const hint = WEAPONS[this.weapons.current].hint;
    if (hint && !this.game.flags['hint_' + this.weapons.current]) {
      this.game.flags['hint_' + this.weapons.current] = true;
      this.game.hint(hint, 4);
    }
  }
  hasKey(k) {
    return this.keys.has(k);
  }
  addKey(k) {
    this.keys.add(k);
  }

  hev(id, text, cooldown = 30) {
    const now = this.game.time;
    if (this.hevCooldown[id] && now - this.hevCooldown[id] < cooldown) return;
    this.hevCooldown[id] = now;
    this.game.say('H.O.P. SUIT', text);
  }

  // ------------------------------------------------------------- damage
  damage(amount, dir, attacker, group, type, point) {
    if (!this.alive || this.game.godMode || this.game.cutscene?.invulnerable) return;
    const g = this.game;
    if (attacker !== this && type !== 'fall') amount *= g.diff.dmgTaken;
    let take = amount;
    if (this.armor > 0 && type !== 'fall' && type !== 'drown') {
      const absorbed = Math.min(this.armor * 2, amount * 0.7);
      this.armor = Math.max(0, this.armor - absorbed / 2);
      take = amount - absorbed;
      if (this.armor <= 0) this.hev('armor_gone', 'Warning. Pouch armour depleted.', 60);
    }
    this.health -= take;
    this.pain = 1;
    // view punch
    this.punch.x += rand(-0.03, 0.05) * Math.min(3, amount / 10);
    this.punch.y += rand(-0.04, 0.04) * Math.min(3, amount / 10);
    let from = null;
    if (point && attacker && attacker.center) from = attacker.center();
    else if (dir) from = [this.body.pos.x - dir[0] * 5, this.body.pos.y, this.body.pos.z - dir[2] * 5];
    g.app.hud.damage(amount, from, type);
    if (Math.random() < 0.6 || amount > 15) audio.play('pain', { volume: 0.8, rate: rand(0.9, 1.1) });
    if (this.health <= 0) {
      this.health = 0;
      this.die(attacker, type);
      return;
    }
    if (this.health < 30) this.hev('critical', 'Warning. Vital signs critical. Seek eucalyptus immediately.', 45);
    else if (this.health < 50 && amount > 15) this.hev('lamington', 'Lamington administered.', 60);
    if (type === 'fall' && amount > 18) this.hev('fracture', 'Major tail fracture detected.', 20);
  }
  knockback(dir, f) {
    this.body.vel.x += dir[0] * f * 0.6;
    this.body.vel.y += Math.max(0, dir[1]) * f * 0.6;
    this.body.vel.z += dir[2] * f * 0.6;
    if (dir[1] > 0.1) this.body.onGround = false;
  }
  heal(n, max = 100) {
    if (this.health >= max) return 0;
    const before = this.health;
    this.health = Math.min(max, this.health + n);
    return this.health - before;
  }
  addArmor(n) {
    if (this.armor >= 100) return 0;
    const before = this.armor;
    this.armor = Math.min(100, this.armor + n);
    return this.armor - before;
  }

  die(attacker, type) {
    if (!this.alive) return;
    this.alive = false;
    this.deathT = 0;
    this.game.stats.deaths++;
    this.game.app.sessionDeaths = (this.game.app.sessionDeaths || 0) + 1;
    audio.play('player_die', { volume: 1 });
    this.game.app.hud.death();
    this.flashlight = false;
    if (type === 'explosion') this.game.fx.blood(this.center(), [0, 1, 0], 3);
  }

  // ------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    const input = g.input;
    const hud = g.app.hud;
    this.frozen = !!g.cutscene;
    this.pain = Math.max(0, this.pain - dt * 3);
    this.punch.multiplyScalar(Math.exp(-dt * 10));
    if (this.action) {
      this.actionT += dt;
      if (this.actionT >= this.actionDur) this.action = null;
    }

    if (!this.alive) {
      this.deathT += dt;
      this.body.vel.x *= 0.9;
      this.body.vel.z *= 0.9;
      this.body.vel.y -= GRAVITY * dt;
      this.body.height = 0.6;
      moveBody(g.world, this.body, dt);
      this._animate(dt);
      if (this.deathT > 1.5 && (input.hit('attack') || input.hit('jump') || input.hit('use'))) g.restartFromLast();
      return;
    }

    // mouse look
    const ui = g.app.ui;
    if (!this.frozen) {
      const [mx, my] = input.consumeMouse();
      this.yaw -= mx;
      this.pitch -= my;
      if (input.is('turnLeft')) this.yaw += 2.4 * dt;
      if (input.is('turnRight')) this.yaw -= 2.4 * dt;
      this.pitch = clamp(this.pitch, -1.45, 1.45);
      this.yaw = wrapAngle(this.yaw);
    } else input.consumeMouse();

    if (input.hit('view')) {
      this.view = this.view === 'third' ? 'first' : 'third';
      g.app.settings.firstPerson = this.view === 'first';
      g.app.saveSettings();
    }

    // flashlight
    if (input.hit('flashlight')) {
      if (this.flashlight || this.battery > 2) {
        this.flashlight = !this.flashlight;
        audio.play('flashlight', { volume: 0.6 });
      }
    }
    if (this.flashlight) {
      this.battery -= dt * 1.2;
      if (this.battery <= 0) {
        this.battery = 0;
        this.flashlight = false;
      }
    } else this.battery = Math.min(100, this.battery + dt * 4);

    if (g.noclip) return this._noclip(dt, input);

    this._move(dt, input);

    // weapons
    if (!this.frozen) {
      for (let i = 1; i <= 5; i++) if (input.hit('slot' + i)) this.weapons.slot(i);
      if (input.hit('nextWeapon')) this.weapons.cycle(1);
      if (input.hit('prevWeapon')) this.weapons.cycle(-1);
      const winput = {
        attack: input.hit('attack') && !hud.consumeClick(),
        attackHeld: input.is('attack') && !hud.menuOpen(),
        attack2: input.hit('attack2'),
        attack2Held: input.is('attack2'),
        reload: input.hit('reload'),
        kick: input.hit('kick'),
        grenade: input.hit('grenade'),
      };
      if (hud.menuOpen() && (winput.attack || input.hit('attack'))) {
        hud.closeWeaponMenu();
        winput.attack = false;
        winput.attackHeld = false;
      }
      this.weapons.update(dt, winput);
      if (input.hit('use')) this._use();
    }
    this._findUseTarget();
    this._animate(dt);
    // flashlight uniforms
    const sh = g.shared;
    sh.flOn.value = this.flashlight ? 1 : 0;
  }

  _move(dt, input) {
    const g = this.game;
    const b = this.body;
    const wasGround = b.onGround;
    // wish direction
    let fm = 0, sm = 0;
    if (!this.frozen) {
      if (input.is('forward')) fm += 1;
      if (input.is('back')) fm -= 1;
      if (input.is('right')) sm += 1;
      if (input.is('left')) sm -= 1;
    }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fm + cy * sm, wz = -cy * fm - sy * sm;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    // crouch & super-hop charge
    const wantCrouch = !this.frozen && input.is('crouch');
    if (wantCrouch && !this.crouched) {
      this.crouched = true;
      b.height = CROUCH_H;
      if (!b.onGround) {
        // tuck legs mid-air: lift the hull bottom (HL duck-jump)
        const lift = STAND_H - CROUCH_H;
        if (g.world.boxFree([b.pos.x - b.half, b.pos.y + lift, b.pos.z - b.half], [b.pos.x + b.half, b.pos.y + lift + CROUCH_H, b.pos.z + b.half], this, true)) b.pos.y += lift * 0.8;
      }
    } else if (!wantCrouch && this.crouched) {
      // stand up if there's room
      if (g.world.boxFree([b.pos.x - b.half, b.pos.y, b.pos.z - b.half], [b.pos.x + b.half, b.pos.y + STAND_H, b.pos.z + b.half], this, true)) {
        this.crouched = false;
        b.height = STAND_H;
      } else if (!b.onGround && g.world.boxFree([b.pos.x - b.half, b.pos.y - 0.7, b.pos.z - b.half], [b.pos.x + b.half, b.pos.y - 0.7 + STAND_H, b.pos.z + b.half], this, true)) {
        b.pos.y -= 0.7;
        this.crouched = false;
        b.height = STAND_H;
      }
    }
    const headroom = g.world.boxFree([b.pos.x - b.half, b.pos.y + 0.1, b.pos.z - b.half], [b.pos.x + b.half, b.pos.y + STAND_H + 0.3, b.pos.z + b.half], this, true);
    if (this.crouched && b.onGround && headroom) {
      this.crouchTime += dt;
      const prev = this.charge;
      this.charge = clamp((this.crouchTime - 0.15) / 0.5, 0, 1);
      if (prev < 1 && this.charge >= 1 && !this.chargeSoundPlayed) {
        audio.play('beep', { volume: 0.25, rate: 1.4 });
        this.chargeSoundPlayed = true;
      }
    } else if (!this.crouched || !headroom) {
      this.crouchTime = 0;
      if (b.onGround) this.charge = 0;
      this.chargeSoundPlayed = false;
    }

    // ladders
    this.onLadder = false;
    if (g.world.ladders) {
      const bb = this.getBox();
      for (const l of g.world.ladders) {
        if (bb.max[0] > l.min[0] && bb.min[0] < l.max[0] && bb.max[1] > l.min[1] && bb.min[1] < l.max[1] && bb.max[2] > l.min[2] && bb.min[2] < l.max[2]) {
          this.onLadder = true;
          break;
        }
      }
    }

    let maxSpeed = (input.is('walk') ? WALK : RUN) * this.speedMul;
    if (this.crouched) maxSpeed = CROUCH_SPEED;
    const wishspeed = wl > 0 ? maxSpeed : 0;

    const jumpHeld = !this.frozen && input.is('jump');
    const jumpPressed = !this.frozen && input.hit('jump');

    if (this.onLadder && !b.onGround || (this.onLadder && fm > 0)) {
      // HL ladder: look direction decides up/down
      const climb = fm !== 0 ? (this.pitch > -0.35 ? 1 : -1) * fm : 0;
      b.vel.y = climb * LADDER_SPEED;
      b.vel.x = wx * 2.0 * Math.abs(sm);
      b.vel.z = wz * 2.0 * Math.abs(sm);
      if (fm !== 0 && sm === 0) {
        b.vel.x = -sy * 0.6 * Math.sign(fm);
        b.vel.z = -cy * 0.6 * Math.sign(fm);
      }
      if (jumpPressed) {
        b.vel.x = sy * 4;
        b.vel.z = cy * 4;
        b.vel.y = 3;
        this.onLadder = false;
      }
      this.stepT += Math.abs(climb) * dt;
      if (this.stepT > 0.35) {
        this.stepT = 0;
        audio.play('step_metal', { pos: this.posArr(), volume: 0.4 });
      }
    } else if (b.onGround) {
      const jump = jumpPressed || (jumpHeld && g.app.settings.autoHop);
      if (jump) {
        this._jump(wx, wz, wl);
      } else {
        // friction
        const speed = Math.hypot(b.vel.x, b.vel.z);
        if (speed > 0) {
          const drop = Math.max(speed, STOP) * FRICTION * dt;
          const ns = Math.max(0, speed - drop) / speed;
          b.vel.x *= ns;
          b.vel.z *= ns;
        }
        this._accel(wx, wz, wishspeed, ACCEL, dt, wishspeed);
      }
    } else {
      this._accel(wx, wz, wishspeed, AIR_ACCEL, dt, Math.min(wishspeed, AIR_CAP));
    }
    if (!(this.onLadder && (!b.onGround || fm > 0))) b.vel.y -= GRAVITY * dt;
    // cap horizontal speed (bhop sanity)
    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (hs > 15) {
      b.vel.x *= 15 / hs;
      b.vel.z *= 15 / hs;
    }

    if (!b.onGround && !this.onLadder) this.airTime += dt;
    if (b.onGround) this.fallStartY = b.pos.y;
    const vyBefore = b.vel.y;
    const res = moveBody(g.world, b, dt);
    if (res.landed && !this.onLadder) {
      const ls = res.landSpeed;
      this.model.land(clamp(ls / 14, 0.15, 1));
      this.viewModel.land(clamp(ls / 14, 0, 1));
      if (ls > 16) {
        const dmg = Math.round((ls - 16) * 4.2);
        this.damage(dmg, [0, -1, 0], null, 'body', 'fall');
        audio.play('land', { pos: this.posArr(), volume: 1, rate: 0.7 });
      } else if (ls > 4) {
        audio.play(this._stepSound(res.groundSolid), { pos: this.posArr(), volume: clamp(ls / 10, 0.3, 0.9), rate: 0.85 });
      }
      if (ls > 6) this.game.noise(this.posArr(), ls * 0.8, this);
      this.airTime = 0;
    }
    if (res.hitCeil && vyBefore > 0) b.vel.y = Math.min(b.vel.y, 0);
    // footsteps tied to the hop gait
    if (b.onGround && this.speedH() > 1) {
      const freq = clamp(1.2 + this.speedH() * 0.2, 1.4, 2.7);
      this.stepT += dt * freq;
      if (this.stepT >= 1) {
        this.stepT -= 1;
        const vol = this.crouched ? 0.12 : input.is('walk') ? 0.2 : 0.45;
        audio.play(this._stepSound(b.ground), { pos: this.posArr(), volume: vol });
        if (!this.crouched && !input.is('walk')) this.game.noise(this.posArr(), 7, this);
      }
    } else if (!this.onLadder) this.stepT = 0.7;
    if (!b.onGround && b.pos.y < (g.world.bounds.min[1] - 20)) this.die(null, 'fall');
  }

  _stepSound(ground) {
    const s = this.game.surfaceOf(ground && ground.brush ? ground.brush : ground, null);
    if (s === 'metal') return 'step_metal';
    if (s === 'wood') return 'step_wood';
    if (s === 'dirt') return 'step_dirt';
    return 'step_concrete';
  }

  _jump(wx, wz, wl) {
    const b = this.body;
    const g = this.game;
    if (this.crouched && this.charge > 0.05) {
      // SUPER HOP
      const c = this.charge;
      b.vel.y = lerp(SUPER_V_MIN, SUPER_V_MAX, c);
      if (wl > 0) {
        // long-jump flavour: keep the full height, add a forward boost
        const hs = Math.max(this.speedH(), lerp(4, 8.5, c));
        b.vel.x = wx * hs;
        b.vel.z = wz * hs;
      }
      // spring out of the crouch
      if (g.world.boxFree([b.pos.x - b.half, b.pos.y, b.pos.z - b.half], [b.pos.x + b.half, b.pos.y + STAND_H, b.pos.z + b.half], this, true)) {
        this.crouched = false;
        b.height = STAND_H;
      }
      this.charge = 0;
      this.crouchTime = 0;
      audio.play('superhop', { pos: this.posArr(), volume: 0.8 });
      g.fx.puff([b.pos.x, b.pos.y + 0.05, b.pos.z], [0, 1, 0], [0.6, 0.45, 0.35], 6, 0.5);
      g.noise(this.posArr(), 10, this);
      this.game.stats.superHops = (this.game.stats.superHops || 0) + 1;
    } else {
      b.vel.y = HOP_V;
      audio.play('hop', { pos: this.posArr(), volume: 0.35 });
    }
    b.onGround = false;
    this.model.land(0.2);
  }

  _accel(wx, wz, wishspeed, accel, dt, capSpeed) {
    const b = this.body;
    const cur = b.vel.x * wx + b.vel.z * wz;
    const add = capSpeed - cur;
    if (add <= 0) return;
    const acc = Math.min(accel * dt * wishspeed, add);
    b.vel.x += acc * wx;
    b.vel.z += acc * wz;
  }

  _noclip(dt, input) {
    const f = this.forwardVec();
    let fm = 0, sm = 0, um = 0;
    if (input.is('forward')) fm++;
    if (input.is('back')) fm--;
    if (input.is('right')) sm++;
    if (input.is('left')) sm--;
    if (input.is('jump')) um++;
    if (input.is('crouch')) um--;
    const sp = input.is('walk') ? 4 : 14;
    const r = this.rightVec();
    this.body.pos.x += (f.x * fm + r[0] * sm) * sp * dt;
    this.body.pos.y += (f.y * fm + um) * sp * dt;
    this.body.pos.z += (f.z * fm + r[2] * sm) * sp * dt;
    this.body.vel.set(0, 0, 0);
    this._animate(dt);
  }

  // ------------------------------------------------------------- use
  _findUseTarget() {
    const g = this.game;
    const e = this.eye();
    const f = this.forwardVec();
    let best = null, bestT = 2.4;
    for (const ent of g.entities) {
      if (ent.removed || !ent.useBox) continue;
      const box = ent.useBox();
      if (!box) continue;
      const r = rayBox(e[0], e[1], e[2], f.x, f.y, f.z, box.min, box.max, bestT);
      if (r && r.t < bestT) {
        bestT = r.t;
        best = ent;
      }
    }
    if (!best) {
      // proximity fallback in front of the kangaroo
      let bd = 1.6;
      for (const ent of g.entities) {
        if (ent.removed || !ent.useBox) continue;
        const box = ent.useBox();
        if (!box) continue;
        const cx = (box.min[0] + box.max[0]) / 2, cy = (box.min[1] + box.max[1]) / 2, cz = (box.min[2] + box.max[2]) / 2;
        const dx = cx - e[0], dz = cz - e[2], dy = cy - e[1];
        const d = Math.hypot(dx, dz);
        if (d > bd || Math.abs(dy) > 1.5) continue;
        const dot = (dx * f.x + dz * f.z) / (d || 1) / (Math.hypot(f.x, f.z) || 1);
        if (dot < 0.5) continue;
        bd = d;
        best = ent;
      }
    }
    this.useTarget = best;
  }
  _use() {
    const t = this.useTarget;
    if (t && t.use) {
      const ok = t.use(this);
      if (ok === false) audio.play('denied', { volume: 0.6 });
    } else audio.play('denied', { volume: 0.25 });
  }

  // ------------------------------------------------------------- animation & camera
  _animate(dt) {
    const g = this.game;
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = 0.1;
      const c = g.sampleLight([this.body.pos.x, this.body.pos.y + 0.2, this.body.pos.z], [0, 0, 0]);
      this.light = c;
    }
    const L = this.light;
    this.model.setLight([L[0] * 0.8 + 0.1, L[1] * 0.8 + 0.09, L[2] * 0.8 + 0.08], [L[0] * 0.55 + 0.06, L[1] * 0.55 + 0.05, L[2] * 0.55 + 0.05]);
    this.viewModel.setLight(L);
    const b = this.body;
    this.model.root.position.set(b.pos.x, b.pos.y, b.pos.z);
    const sh = this.speedH();
    const fv = this.forwardVec();
    this.model.update(dt, {
      yaw: this.yaw,
      pitch: this.pitch,
      speed: sh,
      onGround: b.onGround || this.onLadder,
      vy: b.vel.y,
      crouch: this.crouched,
      charge: this.charge,
      action: this.action,
      actionT: this.action ? this.actionT / this.actionDur : 0,
      punchSide: this.weapons.punchSide,
      climbing: this.onLadder && !b.onGround,
      dead: !this.alive,
      pain: this.pain,
    });
  }

  updateCamera(dt) {
    const g = this.game;
    const cam = g.app.renderer.camera;
    const b = this.body;
    const targetEye = this.crouched ? 0.85 : 1.45;
    this.eyeY = damp(this.eyeY, targetEye, 12, dt);
    const pivotY = b.pos.y + this.eyeY;
    // smooth vertical for stairs
    const pv = this._pivot || (this._pivot = new THREE.Vector3(b.pos.x, pivotY, b.pos.z));
    pv.x = b.pos.x;
    pv.z = b.pos.z;
    pv.y = Math.abs(pv.y - pivotY) > 1.5 ? pivotY : damp(pv.y, pivotY, 18, dt);
    const shake = g.shake;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.08 : 0;
    const sy2 = shake > 0 ? (Math.random() - 0.5) * shake * 0.08 : 0;
    const yaw = this.yaw + this.punch.y + sx;
    const pitch = clamp(this.pitch + this.punch.x + sy2, -1.5, 1.5);
    const cp = Math.cos(pitch);
    const fwd = _f.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    const right = _r.set(Math.cos(yaw), 0, -Math.sin(yaw));

    if (g.cutscene && g.cutscene.camera) {
      g.cutscene.camera(cam, dt);
      this.model.setOpacity(1);
      this.viewModel.visible(false);
    } else if (!this.alive) {
      // orbit the fallen roo
      const a = this.yaw + this.deathT * 0.25;
      const d = Math.min(3.5, 1.5 + this.deathT);
      const target = new THREE.Vector3(b.pos.x, b.pos.y + 0.3, b.pos.z);
      const want = new THREE.Vector3(b.pos.x + Math.sin(a) * d, b.pos.y + 0.6 + this.deathT * 0.4, b.pos.z + Math.cos(a) * d);
      const dir = want.clone().sub(target);
      const len = dir.length();
      dir.normalize();
      const hit = g.world.raycast(target.x, target.y, target.z, dir.x, dir.y, dir.z, len, {});
      cam.position.copy(target).addScaledVector(dir, hit ? Math.max(0.3, hit.t - 0.2) : len);
      cam.lookAt(target);
      this.model.setOpacity(1);
      this.viewModel.visible(false);
    } else if (this.view === 'first') {
      cam.position.set(b.pos.x, pv.y + 0.08, b.pos.z);
      cam.rotation.set(pitch, yaw, -this._roll(dt), 'YXZ');
      this.model.setOpacity(0);
      this.viewModel.visible(true);
      this.camDist = 0;
    } else {
      // over the shoulder third person; fall back to tighter offsets in vents/corners
      const crouchK = this.crouched ? 1 : 0;
      const wantDist = lerp(3.0, 2.2, crouchK);
      const shoulder = lerp(1.0, 0.7, crouchK);
      const lift = lerp(0.5, 0.35, crouchK);
      const cands = [
        [shoulder, lift, wantDist],
        [shoulder * 0.45, lift * 0.25, wantDist],
        [0.15, -0.05, wantDist * 0.8],
      ];
      let best = null;
      for (const [sh, li, wd] of cands) {
        const want = _tmp.set(pv.x, pv.y, pv.z).addScaledVector(fwd, -wd).addScaledVector(right, sh);
        want.y += li;
        const dir = want.clone().sub(pv);
        const len = dir.length();
        dir.normalize();
        const hit = g.world.raycast(pv.x, pv.y, pv.z, dir.x, dir.y, dir.z, len + 0.25, {});
        const free = hit ? Math.max(0.12, hit.t - 0.25) : len;
        if (!best || free > best.free + 0.35) best = { dir, free: Math.min(free, len), len };
        if (free >= len - 0.01) break;
      }
      const target = best.dir.clone().multiplyScalar(best.free);
      if (!this.camOff) this.camOff = target.clone();
      this.camOff.lerp(target, 1 - Math.exp(-dt * 10));
      // never let the smoothed offset poke through geometry
      const ol = this.camOff.length();
      const od = this.camOff.clone().divideScalar(ol || 1);
      const h2 = g.world.raycast(pv.x, pv.y, pv.z, od.x, od.y, od.z, ol + 0.2, {});
      const finalLen = h2 ? Math.min(ol, Math.max(0.1, h2.t - 0.2)) : ol;
      this.camDist = finalLen;
      cam.position.copy(pv).addScaledVector(od, finalLen);
      cam.rotation.set(pitch, yaw, -this._roll(dt) * 0.5, 'YXZ');
      const op = clamp((this.camDist - 0.55) / 0.6, 0, 1);
      this.model.setOpacity(op);
      this.viewModel.visible(false);
    }
    // aim point from the crosshair
    const cf = this.forwardVec(_tmp.clone());
    const o = [cam.position.x, cam.position.y, cam.position.z];
    const hit = g.trace(o, [cf.x, cf.y, cf.z], 200, { ignore: this, bullet: true });
    if (hit && hit.t > 0.3) {
      this.aimPoint.set(hit.point[0], hit.point[1], hit.point[2]);
      this.aimEntity = hit.entity;
    } else {
      this.aimPoint.set(o[0] + cf.x * 200, o[1] + cf.y * 200, o[2] + cf.z * 200);
      this.aimEntity = null;
    }
    // flashlight from the head
    const sh = g.shared;
    sh.flPos.value.set(b.pos.x, b.pos.y + this.eyeY, b.pos.z);
    sh.flDir.value.copy(cf);
    // listener
    audio.setListener([cam.position.x, cam.position.y, cam.position.z], [fwd.x, fwd.y, fwd.z]);
    this.viewModel.update(dt, this);
  }

  _roll(dt) {
    // slight roll when strafing (cl_rollangle)
    const r = this.rightVec();
    const side = this.body.vel.x * r[0] + this.body.vel.z * r[2];
    this._rollV = damp(this._rollV || 0, clamp(side / 6.2, -1, 1) * 0.035, 10, dt);
    return this._rollV;
  }
}
