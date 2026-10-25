// Technik-Katalog: wiederverwendbare Animationstechniken (nach lib.js einbinden).
// Jede Technik ist eine Funktion, die in scene(t) aufgerufen wird.

const OFFX = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; });

// ---------- Formen & Morphing ----------
// Formen sind Punktlisten im Einheitsquadrat [[x, y], ...]; resample macht sie morph-fähig.
function resample(pts, n = 160) {
  const seg = [], P = pts.concat([pts[0]]); let L = 0;
  for (let i = 0; i < P.length - 1; i++) { const d = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(d); L += d; }
  const out = []; let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const want = L * k / n;
    while (acc + seg[i] < want && i < seg.length - 1) { acc += seg[i]; i++; }
    const f = seg[i] ? (want - acc) / seg[i] : 0;
    out.push([lerp(P[i][0], P[i + 1][0], f), lerp(P[i][1], P[i + 1][1], f)]);
  }
  return out;
}
function shapePath(pts, x, y, w, h, flip = false) {
  g.beginPath();
  pts.forEach(([u, v], i) => { const px = x + (flip ? 1 - u : u) * w - w / 2, py = y + v * h - h / 2; i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath();
}
function shape(pts, x, y, w, h, fill, o = {}) {
  g.save(); if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 40; }
  shapePath(pts, x, y, w, h, o.flip); g.fillStyle = fill; g.fill();
  if (o.stroke) { g.shadowBlur = 0; g.lineWidth = o.stroke; g.lineJoin = 'round'; g.strokeStyle = o.strokeColor || '#fff'; g.stroke(); }
  g.restore();
}
// Form A wird zu Form B (beide mit resample vorbereitet), mit leichtem Wirbel in der Mitte
function morph(A, B, k, x, y, w, h, fill, o = {}) {
  const e = eio(clamp(k)), tw = Math.sin(e * Math.PI) * (o.twist ?? .08);
  const pts = A.map((a, i) => { const b = B[i], u = lerp(a[0], b[0], e), v = lerp(a[1], b[1], e), ang = tw * Math.sin(i * .3); return [.5 + (u - .5) * Math.cos(ang) - (v - .5) * Math.sin(ang), .5 + (u - .5) * Math.sin(ang) + (v - .5) * Math.cos(ang)]; });
  shape(pts, x, y, w, h, fill, o);
}

// ---------- Masken-Reveal (Iris) ----------
function iris(k, cx, cy, draw, o = {}) {
  if (k <= 0) return; const r = eo(clamp(k)) * Math.hypot(W, H);
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip(); draw(); g.restore();
  if (k < 1 && o.ring !== false) { g.save(); g.strokeStyle = o.ring || 'rgba(255,255,255,.9)'; g.lineWidth = 10; g.shadowColor = g.strokeStyle; g.shadowBlur = 30; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore(); }
}

// ---------- Split-Screen mit schrägem Trenner ----------
function splitScreen(k, left, right, o = {}) {
  const e = eo(clamp(k)), tilt = o.tilt ?? 120, mid = W / 2;
  g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(mid + tilt - (1 - e) * W, 0); g.lineTo(mid - tilt - (1 - e) * W, H); g.lineTo(0, H); g.closePath(); g.clip(); left(); g.restore();
  g.save(); g.beginPath(); g.moveTo(W, 0); g.lineTo(mid + tilt + (1 - e) * W, 0); g.lineTo(mid - tilt + (1 - e) * W, H); g.lineTo(W, H); g.closePath(); g.clip(); right(); g.restore();
  if (e > 0) { g.save(); g.strokeStyle = o.line || '#fff'; g.lineWidth = 14; g.shadowColor = o.line || '#fff'; g.shadowBlur = 40; g.beginPath(); g.moveTo(mid + tilt, -20); g.lineTo(mid - tilt, H + 20); g.globalAlpha = e; g.stroke(); g.restore(); }
}

// ---------- Pixel-Zerfall: Bild zerfällt in Blöcke, die wegfliegen ----------
const DIS = (() => { const r = rng(91), cs = 30, out = []; for (let y = 0; y < H; y += cs) for (let x = 0; x < W; x += cs) out.push({ x, y, cs, th: r(), vx: (r() - .5) * 900, vy: -200 - r() * 900, rot: (r() - .5) * 6 }); return out; })();
function dissolve(k, draw, o = {}) {
  const c = OFFX[1], x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
  const keep = g; g = x; draw(); g = keep;
  if (k <= 0) { g.drawImage(c, 0, 0); return; }
  const dir = o.dir || [0, 1];
  DIS.forEach(d => {
    const start = d.th * .7 + ((d.x / W) * dir[0] + (d.y / H) * dir[1]) * .3 * (o.sweep ?? 1), q = clamp((k - start) / .3);
    if (q >= 1) return;
    g.save(); g.globalAlpha = 1 - q * q;
    g.translate(d.x + d.cs / 2 + d.vx * q * q, d.y + d.cs / 2 + d.vy * q * q); g.rotate(d.rot * q); const s = 1 - q * .6; g.scale(s, s);
    g.drawImage(c, d.x, d.y, d.cs, d.cs, -d.cs / 2, -d.cs / 2, d.cs, d.cs); g.restore();
  });
}

// ---------- 3D-Drehung um die Hochachse (Karten-/Münzeffekt) ----------
function spin3d(ang, cx, cy, draw, o = {}) {
  const c = Math.cos(ang), s = Math.max(.02, Math.abs(c));
  g.save(); g.translate(cx, cy); g.transform(s, Math.sin(ang) * (o.skew ?? .12), 0, 1, 0, 0); g.translate(-cx, -cy); draw(c < 0); g.restore();
}

// ---------- Strichzeichnung, die sich selbst zeichnet ----------
// paths: Liste von Punktlisten (offene Linien). k: 0..1 Fortschritt über alle Linien.
function drawOn(paths, k, x, y, w, h, col, lw = 10, o = {}) {
  const lens = paths.map(P => P.reduce((s, p2, i) => i ? s + Math.hypot((p2[0] - P[i - 1][0]) * w, (p2[1] - P[i - 1][1]) * h) : 0, 0)), tot = lens.reduce((a, b) => a + b, 0);
  let left = tot * clamp(k);
  g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = o.glow || col; g.shadowBlur = o.blur ?? 30;
  let tip = null;
  paths.forEach((P, n) => {
    if (left <= 0) return; let rem = Math.min(left, lens[n]); left -= lens[n];
    g.beginPath(); g.moveTo(x + (P[0][0] - .5) * w, y + (P[0][1] - .5) * h);
    for (let i = 1; i < P.length && rem > 0; i++) {
      const ax = x + (P[i - 1][0] - .5) * w, ay = y + (P[i - 1][1] - .5) * h, bx = x + (P[i][0] - .5) * w, by = y + (P[i][1] - .5) * h, d = Math.hypot(bx - ax, by - ay);
      const f = Math.min(1, rem / d); g.lineTo(lerp(ax, bx, f), lerp(ay, by, f)); tip = [lerp(ax, bx, f), lerp(ay, by, f)]; rem -= d;
    }
    g.stroke();
  });
  g.restore();
  if (tip && k < 1 && o.spark !== false) { g.save(); g.globalCompositeOperation = 'lighter'; glow(tip[0], tip[1], 60, [255, 255, 255], .9); g.restore(); }
}

// ---------- Flüssige Wellen-Hintergründe ----------
function liquid(t, cols, o = {}) {
  cols.forEach((c, n) => {
    const y0 = (o.y0 ?? 300) + n * (o.gap ?? 260), amp = (o.amp ?? 70) * (1 + n * .2);
    g.fillStyle = rgb(c); g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, y0 + Math.sin(x / 160 + t * (1.3 + n * .3) + n) * amp + Math.sin(x / 70 - t * 2.1 + n * 2) * amp * .3);
    g.lineTo(W, H); g.closePath(); g.fill();
  });
}

// ---------- Warp-Tunnel (Zeitreise / Hyperraum) ----------
const WARP = (() => { const r = rng(13); return Array.from({ length: 260 }, () => ({ a: r() * 6.283, z: r(), c: SPEC[(r() * SPEC.length) | 0] })); })();
function warp(t, speed = 1, a = 1, cx = 540, cy = 960) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  WARP.forEach(s => {
    const z = (s.z + t * .5 * speed) % 1, r1 = Math.pow(z, 2.2) * 1500, r2 = Math.pow(Math.min(1, z + .04 * speed), 2.2) * 1500;
    g.strokeStyle = rgb(s.c, a * z); g.lineWidth = 1 + z * 7;
    g.beginPath(); g.moveTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1); g.lineTo(cx + Math.cos(s.a) * r2, cy + Math.sin(s.a) * r2); g.stroke();
  });
  g.restore();
}

// ---------- Partikel-Explosion ----------
const BURST = (() => { const r = rng(5); return Array.from({ length: 180 }, () => ({ a: r() * 6.283, v: 300 + r() * 1400, s: 4 + r() * 16, c: SPEC[(r() * SPEC.length) | 0], spin: r() })); })();
function burst(t, t0, cx, cy, o = {}) {
  const u = t - t0; if (u < 0 || u > (o.life || 1.6)) return;
  const life = o.life || 1.6, k = u / life;
  g.save(); g.globalCompositeOperation = 'lighter';
  BURST.forEach(b => { const d = b.v * (1 - Math.pow(1 - k, 3)) * (o.scale || 1), x = cx + Math.cos(b.a) * d, y = cy + Math.sin(b.a) * d + 400 * k * k * (o.grav ?? 1); g.fillStyle = rgb(o.col || b.c, 1 - k); g.save(); g.translate(x, y); g.rotate(b.spin * 10 * k); g.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * .5); g.restore(); });
  g.restore();
}

// ---------- Icons poppen nacheinander auf ----------
function popIn(k) { return k <= 0 ? 0 : eback(clamp(k)); }

// ---------- Balken-Diagramm, das wächst ----------
function bars(data, k, x, y, w, h, o = {}) {   // data: [{v (0..1), c, label}]
  const n = data.length, bw = w / n * .62;
  data.forEach((d, i) => {
    const kk = eback(clamp(k * 1.4 - i * .25)), bh = h * d.v * kk, bx = x + (i + .5) * w / n - bw / 2;
    g.save(); g.fillStyle = rgb(d.c); g.shadowColor = rgb(d.c, .7); g.shadowBlur = 40; g.beginPath(); g.roundRect(bx, y - bh, bw, bh, 18); g.fill(); g.restore();
    if (d.label) text(d.label, bx + bw / 2, y + 60, o.size || 48, 'IDX', '#fff', { alpha: clamp(kk) });
  });
}

// ---------- Parallax-Ebenen (Kamerafahrt durch Schichten) ----------
function parallax(layers, travel) {   // layers: [{depth, draw(offset)}], weiter hinten = kleineres depth
  layers.forEach(L => { g.save(); g.translate(0, 0); L.draw(travel * L.depth); g.restore(); });
}
