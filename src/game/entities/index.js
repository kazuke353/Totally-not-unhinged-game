// Entity registry: map entity "classname" -> implementation.
import { Door, Button, Trigger, ChangeLevel, Relay, Counter, Message, Chapter, Objective, Autosave, Music, Script, Breakable, Hurt, Secret, Alarm, AlarmLight, SoundEnt, Glow, Searchlight } from './world.js';
import { Pickup, Charger, Barrel, Elevator } from './items.js';
import { Grenade, Rocket } from './projectiles.js';
import { Soldier } from './soldier.js';
import { Dingo } from './dingo.js';
import { Turret } from './turret.js';
import { Entity } from './base.js';
import { EXTRA_TYPES } from './extra.js';

// Spawns a batch of entities when triggered (reinforcements, ambushes).
class Spawner extends Entity {
  constructor(game, d) {
    super(game, d);
    this.done = false;
  }
  trigger(activator) {
    if (this.done && this.def.once !== false) return;
    this.done = true;
    const list = this.def.spawns || [];
    list.forEach((s, i) => {
      this.game.after((this.def.interval || 0) * i, () => {
        const e = this.game.spawnEntity({ ...s });
        if (e && s.hunt && e.alertTo) {
          const p = this.game.player;
          e.lastSeen = p.center();
          e.lastSeenTime = this.game.time;
          e.alertTo(p.center(), true);
        }
      });
    });
  }
  save() {
    return { done: this.done };
  }
  load(s) {
    this.done = s.done;
  }
}

const TYPES = {
  door: Door,
  button: Button,
  trigger: Trigger,
  changelevel: ChangeLevel,
  relay: Relay,
  counter: Counter,
  message: Message,
  chapter: Chapter,
  objective: Objective,
  autosave: Autosave,
  music: Music,
  script: Script,
  breakable: Breakable,
  hurt: Hurt,
  secret: Secret,
  alarm: Alarm,
  alarmlight: AlarmLight,
  sound: SoundEnt,
  glow: Glow,
  searchlight: Searchlight,
  pickup: Pickup,
  charger: Charger,
  barrel: Barrel,
  elevator: Elevator,
  grenade: Grenade,
  rocket: Rocket,
  soldier: Soldier,
  dingo: Dingo,
  turret: Turret,
  spawner: Spawner,
  ...EXTRA_TYPES,
};

export function createEntity(game, def) {
  const T = TYPES[def.type];
  if (!T) {
    console.warn('Unknown entity type', def.type);
    return null;
  }
  return new T(game, def);
}
