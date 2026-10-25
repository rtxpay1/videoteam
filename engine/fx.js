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

// ---------- Aufrufe an die Zuschauer ----------
// Abo-Knopf: ploppt ab t0 auf, wird bei t0+tap (Eula tippt/zeigt drauf) gedrückt, wechselt auf „ABONNIERT ✓“, Glocke klingelt.
// Dauer ca. 2,8 s. Platz: im sicheren Bereich über den Untertiteln (y ≤ 1300), neben Eula, damit sie darauf zeigen kann.
//   subscribeCTA(t, ph('abonnier'), 540, 1180)
function subscribeCTA(t, t0, x, y, o = {}) {
  const k = t - t0, tap = o.tap ?? .9, end = o.dur ?? 2.8;
  if (k < 0 || k > end) return;
  const inK = popIn(k / .35), outK = clamp((end - k) / .3), press = k > tap && k < tap + .18 ? 1 - Math.sin((k - tap) / .18 * Math.PI) * .12 : 1;
  const done = k >= tap + .09, sc = inK * press * (o.scale || 1), w = 600, h = 120;
  g.save(); g.globalAlpha *= outK; g.translate(x, y); g.scale(sc, sc);
  g.shadowColor = done ? 'rgba(0,0,0,.4)' : 'rgba(255,40,60,.8)'; g.shadowBlur = done ? 20 : 50 + Math.sin(k * 12) * 15;
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = done ? '#3a3a44' : '#ff1e3c'; g.fill();
  g.shadowBlur = 0; g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
  text(done ? 'ABONNIERT ✓' : 'ABONNIEREN', 42, 4, 56, 'IDB', '#fff', { ls: 1 });
  // Glocke links im Knopf, schwingt nach dem Drücken
  const sw = done ? Math.sin((k - tap) * 22) * Math.exp(-(k - tap) * 2.5) * .5 : 0;
  g.save(); g.translate(-w / 2 + 70, 0); g.rotate(sw); g.fillStyle = '#ffd23f';
  g.beginPath(); g.moveTo(-26, 22); g.quadraticCurveTo(-26, -30, 0, -32); g.quadraticCurveTo(26, -30, 26, 22); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, 30, 8, 0, 7); g.fill(); g.restore();
  g.restore();
  if (done) burst(t, t0 + tap + .05, x - (w / 2 - 70) * sc, y, { n: 40, scale: .5 });
}
// Kommentar-Aufruf: Sprechblase mit drei Punkten ploppt neben Eula auf und wippt (ca. 2,5 s). Die Frage selbst sagt die Stimme.
//   commentCTA(t, ph('Schreib'), 760, 1050)
function commentCTA(t, t0, x, y, o = {}) {
  const k = t - t0, end = o.dur ?? 2.5;
  if (k < 0 || k > end) return;
  const sc = popIn(k / .35) * clamp((end - k) / .3) * (o.scale || 1), bob = Math.sin(k * 6) * 8;
  g.save(); g.translate(x, y + bob); g.scale(sc, sc);
  g.shadowColor = 'rgba(54,232,255,.7)'; g.shadowBlur = 40;
  g.beginPath(); g.roundRect(-150, -95, 300, 170, 60); g.moveTo(-60, 70); g.lineTo(-110, 130); g.lineTo(-10, 74); g.fillStyle = '#fff'; g.fill();
  g.shadowBlur = 0;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-70 + i * 70, -10 - Math.max(0, Math.sin(k * 8 - i)) * 14, 18, 0, 7); g.fillStyle = '#2a7bff'; g.fill(); }
  g.restore();
}

// Rate-mal-Frage: drei Antwort-Karten (A/B/C) ploppen nacheinander auf (ab t0, ca. 3 s sichtbar).
// Später löst reveal() auf: die richtige Karte leuchtet grün, die anderen werden grau.
//   quiz(t, ph('Rate mal'), ['Eiffelturm', 'Everest', 'bis zum Mond'], { y: 1000 })
//   quiz(t, ph('Auflösung'), [...], { y: 1000, right: 1, reveal: true })
function quiz(t, t0, opts, o = {}) {
  const k = t - t0, end = o.dur ?? 3.2;
  if (k < 0 || k > end) return;
  const out = clamp((end - k) / .3), y0 = o.y ?? 1000, cols = ['#36e8ff', '#ffd23f', '#ff4fd8'];
  opts.forEach((s, i) => {
    const ki = popIn((k - i * .18) / .35); if (ki <= 0) return;
    const y = y0 + i * 150, right = o.reveal && i === o.right, wrong = o.reveal && i !== o.right && k > .5;
    g.save(); g.globalAlpha *= out * (wrong ? .45 : 1); g.translate(540, y); g.scale(ki * (right && k > .5 ? 1 + Math.sin(k * 10) * .03 + .06 : 1), ki);
    g.shadowColor = right && k > .5 ? 'rgba(93,255,168,.9)' : 'rgba(0,0,0,.5)'; g.shadowBlur = right && k > .5 ? 50 : 20;
    g.beginPath(); g.roundRect(-400, -58, 800, 116, 30); g.fillStyle = right && k > .5 ? '#1f8a4c' : wrong ? '#3a3a44' : 'rgba(14,18,48,.92)'; g.fill();
    g.shadowBlur = 0; g.lineWidth = 6; g.strokeStyle = right && k > .5 ? '#5dffa8' : cols[i]; g.stroke();
    g.beginPath(); g.arc(-330, 0, 38, 0, 7); g.fillStyle = cols[i]; g.fill();
    text('ABC'[i], -330, 3, 48, 'IDB', '#0b0e24');
    text(s, -260, 3, 52, 'IDB', '#fff', { align: 'left' });
    if (right && k > .5) text('✓', 340, 3, 64, 'IDB', '#fff');
    g.restore();
  });
}
// Eula-Urteil: Stempel knallt schräg aufs Bild (Markenzeichen am Ende jeder Folge), bleibt bis Videoende.
//   verdict(t, ph('Urteil'), 'Überlebens-Chance', 2)   -> „GETESTET“ + „Überlebens-Chance: 2/10“
function verdict(t, t0, label, score, o = {}) {
  const k = t - t0; if (k < 0) return;
  const hit = k < .22 ? 2.6 - eo(k / .22) * 1.6 : 1 + Math.sin(Math.min(1, (k - .22) / .3) * Math.PI) * .06;
  g.save(); g.translate(o.x ?? 540, o.y ?? 560); g.rotate(-.12); g.scale(hit, hit); g.globalAlpha *= clamp(k / .1);
  const red = '#ff2a4a';
  g.lineWidth = 14; g.strokeStyle = red; g.shadowColor = 'rgba(255,42,74,.6)'; g.shadowBlur = 30;
  g.beginPath(); g.roundRect(-380, -150, 760, 300, 26); g.stroke();
  g.shadowBlur = 0; g.lineWidth = 5; g.beginPath(); g.roundRect(-356, -126, 712, 252, 16); g.stroke();
  text('GETESTET', 0, -45, 120, 'IDB', red, { ls: 6 });
  text(`${label}: ${score}/10`, 0, 70, 56, 'IDB', '#fff', { stroke: 10, strokeColor: red });
  g.restore();
  if (k < .3) { g.save(); g.globalAlpha = (1 - k / .3) * .35; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.restore(); }
}
