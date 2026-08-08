// Pure geometry predicates shared by all collision checks.
// Balloons use precise circle-based tests since they are drawn as circles;
// rectangular entities (player, projectiles, platforms, power-ups) use AABB.

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
