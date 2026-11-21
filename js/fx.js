// =====================================================================
// fx.js — Kleine teken-hulpjes die door meerdere modules gebruikt worden
// =====================================================================

/** Zigzaggende bliksemschicht van (x1,y1) naar (x2,y2). */
export function makeBoltPoints(x1, y1, x2, y2, jitter = 22) {
  const points = [{ x: x1, y: y1 }];
  const segments = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 35));
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    points.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter * 2,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter * 0.6
    });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

/** Tekent een bliksemschicht met gloed. */
export function drawBolt(ctx, points, alpha) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255, 240, 150, ${0.35 * alpha})`;
  ctx.lineWidth = 12;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();
}
