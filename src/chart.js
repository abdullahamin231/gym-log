export function drawLineChart(canvas, points, { yLabel } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 220;
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, w, h);

  const padL = 46 * dpr;
  const padR = 12 * dpr;
  const padT = 14 * dpr;
  const padB = 26 * dpr;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.strokeStyle = 'rgba(239,237,232,0.3)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,106,99,0.95)';
  ctx.font = `${12 * dpr}px DM Mono, monospace`;

  if (yLabel) ctx.fillText(yLabel, 10 * dpr, 14 * dpr);

  if (!points.length) {
    ctx.fillStyle = 'rgba(107,106,99,0.75)';
    ctx.fillText('No data', padL + 10 * dpr, padT + plotH / 2);
    return;
  }

  const ys = points.map(p => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const yPad = (maxY - minY) * 0.12;
  minY -= yPad;
  maxY += yPad;

  const xToPx = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yToPx = (y) => padT + (1 - (y - minY) / (maxY - minY)) * plotH;

  const ticks = 4;
  ctx.fillStyle = 'rgba(107,106,99,0.9)';
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const yVal = minY + (1 - t) * (maxY - minY);
    const yPx = padT + t * plotH;
    ctx.strokeStyle = 'rgba(34,34,34,0.9)';
    ctx.beginPath();
    ctx.moveTo(padL, yPx);
    ctx.lineTo(padL + plotW, yPx);
    ctx.stroke();
    ctx.fillText(`${Math.round(yVal * 10) / 10}`, 6 * dpr, yPx + 4 * dpr);
  }

  ctx.strokeStyle = 'rgba(217,56,56,0.9)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xToPx(i);
    const y = yToPx(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(217,56,56,1)';
  points.forEach((p, i) => {
    const x = xToPx(i);
    const y = yToPx(p.y);
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });

  const firstDate = new Date(points[0].x);
  const lastDate = new Date(points[points.length - 1].x);
  ctx.fillStyle = 'rgba(107,106,99,0.9)';
  ctx.fillText(firstDate.toLocaleDateString(), padL, padT + plotH + 18 * dpr);
  const lastLabel = lastDate.toLocaleDateString();
  const metrics = ctx.measureText(lastLabel);
  ctx.fillText(lastLabel, padL + plotW - metrics.width, padT + plotH + 18 * dpr);
}
