// Pure geometry predicates shared by all collision checks.
// Balls use precise circle-based tests since they are drawn as circles;
// rectangular entities (player, projectiles, obstacles, power-ups) use AABB.

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleOverlap(c1, c2) {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const r = c1.radius + c2.radius;
  return dx * dx + dy * dy < r * r;
}

export function circleRectOverlap(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

// Resolves a circle overlapping a static rect: pushes the circle's (x, y)
// out of the rect along the axis of least penetration and reports which
// side of the rect it was pushed out of ('top' | 'bottom' | 'left' |
// 'right'), or null if there is no overlap. Mutates circle.x/circle.y.
// Handles both the common case (circle center outside the rect) and deep
// penetration (circle center already inside the rect, e.g. a high-speed
// ball that moved most of the way through in one step) so it doubles as
// the anti-tunneling correction once the caller has sub-stepped movement
// finely enough that a single step can't skip over the rect entirely.
export function resolveCircleRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= circle.radius * circle.radius) return null;

  if (dx !== 0 || dy !== 0) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const penetration = circle.radius - dist;
    circle.x += nx * penetration;
    circle.y += ny * penetration;
    return Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'bottom' : 'top');
  }

  // Circle center landed exactly inside the rect: push out via whichever
  // side is closest.
  const distLeft = circle.x - rect.x;
  const distRight = rect.x + rect.w - circle.x;
  const distTop = circle.y - rect.y;
  const distBottom = rect.y + rect.h - circle.y;
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min === distLeft) { circle.x = rect.x - circle.radius; return 'left'; }
  if (min === distRight) { circle.x = rect.x + rect.w + circle.radius; return 'right'; }
  if (min === distTop) { circle.y = rect.y - circle.radius; return 'top'; }
  circle.y = rect.y + rect.h + circle.radius;
  return 'bottom';
}
