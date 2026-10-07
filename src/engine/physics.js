// AABB hull movement (the same idea as GoldSrc's player hulls): sweep each
// axis against nearby solids, step up stairs, stick to the ground, ride
// moving platforms.

const SKIN = 0.002;
const solids = [];

function boxOf(b, out) {
  const h = b.half;
  out.min[0] = b.pos.x - h;
  out.min[1] = b.pos.y;
  out.min[2] = b.pos.z - h;
  out.max[0] = b.pos.x + h;
  out.max[1] = b.pos.y + b.height;
  out.max[2] = b.pos.z + h;
  return out;
}
const _box = { min: [0, 0, 0], max: [0, 0, 0] };

// Sweep along a single axis. Returns the allowed movement and the solid hit.
function sweepAxis(world, body, axis, delta, gather = true) {
  if (delta === 0) return { move: 0, hit: null };
  const b = boxOf(body, _box);
  const qmin = b.min.slice(), qmax = b.max.slice();
  if (delta > 0) qmax[axis] += delta;
  else qmin[axis] += delta;
  if (gather) world.gatherSolids(qmin, qmax, body.ignore, solids, body.forPlayer);
  let allowed = delta, hit = null;
  const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
  for (const s of solids) {
    // must overlap on the other two axes
    if (s.max[o1] <= b.min[o1] + 1e-5 || s.min[o1] >= b.max[o1] - 1e-5) continue;
    if (s.max[o2] <= b.min[o2] + 1e-5 || s.min[o2] >= b.max[o2] - 1e-5) continue;
    if (delta > 0) {
      if (s.min[axis] < b.max[axis] - 1e-4) continue; // already overlapping / behind
      const d = s.min[axis] - b.max[axis] - SKIN;
      if (d < allowed) {
        allowed = Math.max(0, d);
        hit = s;
      }
    } else {
      if (s.max[axis] > b.min[axis] + 1e-4) continue;
      const d = s.max[axis] - b.min[axis] + SKIN;
      if (d > allowed) {
        allowed = Math.min(0, d);
        hit = s;
      }
    }
  }
  return { move: allowed, hit };
}

function setAxis(body, axis, v) {
  if (axis === 0) body.pos.x += v;
  else if (axis === 1) body.pos.y += v;
  else body.pos.z += v;
}

// Move a body by its velocity for dt. body: {pos, vel, half, height, onGround,
// stepHeight, ignore, forPlayer, ground}
export function moveBody(world, body, dt, opts = {}) {
  const res = { hitWall: false, hitCeil: false, landed: false, landSpeed: 0, wallNormal: null, groundSolid: null };
  const wasOnGround = body.onGround;
  // ride platforms
  if (body.ground && body.ground.brush && body.ground.brush.moveDelta) {
    const md = body.ground.brush.moveDelta;
    if (md[0] || md[1] || md[2]) {
      const dy = sweepAxis(world, body, 1, md[1]);
      body.pos.y += dy.move;
      const dx = sweepAxis(world, body, 0, md[0]);
      body.pos.x += dx.move;
      const dz = sweepAxis(world, body, 2, md[2]);
      body.pos.z += dz.move;
    }
  }

  // vertical
  const vy = body.vel.y * dt;
  const ry = sweepAxis(world, body, 1, vy);
  body.pos.y += ry.move;
  let onGround = false;
  let ground = null;
  if (ry.hit) {
    if (vy < 0) {
      onGround = true;
      ground = ry.hit;
      if (!wasOnGround) {
        res.landed = true;
        res.landSpeed = -body.vel.y;
      }
    } else res.hitCeil = true;
    body.vel.y = 0;
  }

  // horizontal with step up
  const dx = body.vel.x * dt, dz = body.vel.z * dt;
  if (dx !== 0 || dz !== 0) {
    const sx = body.pos.x, sy = body.pos.y, sz = body.pos.z;
    const rx = sweepAxis(world, body, 0, dx);
    body.pos.x += rx.move;
    const rz = sweepAxis(world, body, 2, dz);
    body.pos.z += rz.move;
    const blocked = (rx.hit && Math.abs(rx.move) < Math.abs(dx) - 1e-4) || (rz.hit && Math.abs(rz.move) < Math.abs(dz) - 1e-4);
    if (blocked && (onGround || wasOnGround) && body.stepHeight > 0 && body.vel.y <= 0.01) {
      // try stepping
      const ax = body.pos.x, ay = body.pos.y, az = body.pos.z;
      body.pos.x = sx; body.pos.y = sy; body.pos.z = sz;
      const up = sweepAxis(world, body, 1, body.stepHeight);
      body.pos.y += up.move;
      const rx2 = sweepAxis(world, body, 0, dx);
      body.pos.x += rx2.move;
      const rz2 = sweepAxis(world, body, 2, dz);
      body.pos.z += rz2.move;
      const down = sweepAxis(world, body, 1, -up.move - 0.05);
      body.pos.y += down.move;
      const d1 = (ax - sx) ** 2 + (az - sz) ** 2;
      const d2 = (body.pos.x - sx) ** 2 + (body.pos.z - sz) ** 2;
      if (down.hit && d2 > d1 + 1e-6) {
        onGround = true;
        ground = down.hit;
        res.stepped = body.pos.y - ay;
        if (rx2.hit && Math.abs(rx2.move) < Math.abs(dx) - 1e-4) { body.vel.x = 0; res.hitWall = true; }
        if (rz2.hit && Math.abs(rz2.move) < Math.abs(dz) - 1e-4) { body.vel.z = 0; res.hitWall = true; }
      } else {
        body.pos.x = ax; body.pos.y = ay; body.pos.z = az;
        if (rx.hit && Math.abs(rx.move) < Math.abs(dx) - 1e-4) { body.vel.x = 0; res.hitWall = true; res.wallNormal = [-Math.sign(dx), 0, 0]; res.wallSolid = rx.hit; }
        if (rz.hit && Math.abs(rz.move) < Math.abs(dz) - 1e-4) { body.vel.z = 0; res.hitWall = true; res.wallNormal = [0, 0, -Math.sign(dz)]; res.wallSolid = rz.hit; }
      }
    } else {
      if (rx.hit && Math.abs(rx.move) < Math.abs(dx) - 1e-4) { body.vel.x = 0; res.hitWall = true; res.wallNormal = [-Math.sign(dx), 0, 0]; res.wallSolid = rx.hit; }
      if (rz.hit && Math.abs(rz.move) < Math.abs(dz) - 1e-4) { body.vel.z = 0; res.hitWall = true; res.wallNormal = [0, 0, -Math.sign(dz)]; res.wallSolid = rz.hit; }
    }
  }

  // ground probe (stick to ground when walking down slopes/steps)
  if (!onGround && body.vel.y <= 0) {
    const probe = sweepAxis(world, body, 1, wasOnGround && opts.stickDown !== false ? -body.stepHeight : -0.03);
    if (probe.hit) {
      if (wasOnGround && opts.stickDown !== false) body.pos.y += probe.move;
      if (probe.move > -0.031 || wasOnGround) {
        onGround = true;
        ground = probe.hit;
        if (!wasOnGround) {
          res.landed = true;
          res.landSpeed = -body.vel.y;
        }
        body.vel.y = 0;
      }
    }
  }
  body.onGround = onGround;
  body.ground = ground;
  res.groundSolid = ground;
  return res;
}

// Push the body out if something (a door, a platform) moved into it.
export function unstick(world, body) {
  const b = boxOf(body, _box);
  if (world.boxFree(b.min, b.max, body.ignore, body.forPlayer)) return true;
  const tries = [
    [0, 0.3, 0], [0.3, 0, 0], [-0.3, 0, 0], [0, 0, 0.3], [0, 0, -0.3], [0, 0.6, 0],
    [0.6, 0, 0], [-0.6, 0, 0], [0, 0, 0.6], [0, 0, -0.6], [0, 1.0, 0], [0, -0.3, 0],
  ];
  for (const t of tries) {
    const mn = [b.min[0] + t[0], b.min[1] + t[1], b.min[2] + t[2]];
    const mx = [b.max[0] + t[0], b.max[1] + t[1], b.max[2] + t[2]];
    if (world.boxFree(mn, mx, body.ignore, body.forPlayer)) {
      body.pos.x += t[0];
      body.pos.y += t[1];
      body.pos.z += t[2];
      return true;
    }
  }
  return false;
}

export function bodyBox(body) {
  return {
    min: [body.pos.x - body.half, body.pos.y, body.pos.z - body.half],
    max: [body.pos.x + body.half, body.pos.y + body.height, body.pos.z + body.half],
  };
}
