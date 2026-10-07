// Entity base class.
export class Entity {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.type = def.type;
    this.targetname = def.targetname || null;
    this.target = def.target || null;
    this.removed = false;
    this.solid = false;
  }
  spawn() {}
  update() {}
  trigger() {}
  getBox() {
    return null;
  }
  fireTargets(activator, target = this.target, delay = this.def.delay || 0) {
    if (target) this.game.fire(target, activator, delay);
  }
  save() {
    return undefined;
  }
  load() {}
  destroy() {
    if (this.mesh) {
      this.mesh.parent && this.mesh.parent.remove(this.mesh);
    }
  }
  playerInside(min, max) {
    const p = this.game.player;
    if (!p || !p.alive) return false;
    const b = p.getBox();
    return b.max[0] > min[0] && b.min[0] < max[0] && b.max[1] > min[1] && b.min[1] < max[1] && b.max[2] > min[2] && b.min[2] < max[2];
  }
}

export function boxOverlap(a, b, pad = 0) {
  return (
    a.max[0] + pad > b.min[0] && a.min[0] - pad < b.max[0] &&
    a.max[1] + pad > b.min[1] && a.min[1] - pad < b.max[1] &&
    a.max[2] + pad > b.min[2] && a.min[2] - pad < b.max[2]
  );
}
