// Gemeinsame Motion-Bibliothek für alle Shorts (1080×1920).
// Ein Video setzt window.CFG = { DUR, CUTS: [...], PHRASES: [[start, ende, text], ...], KEY: /regex/ }
// und definiert eine Funktion scene(t). Danach rendert window.renderFrame(t, frame) alles.
const W = 1080, H = 1920, cv = document.getElementById('c');
let g = cv.getContext('2d');   // let: Techniken wie dissolve() zeichnen kurz auf eine Nebenfläche

// ---------- Mathe & Easing ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const p = (t, a, b) => clamp((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3);
const eo5 = x => 1 - Math.pow(1 - x, 5);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eback = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mix = (c1, c2, k) => c1.map((v, i) => Math.round(lerp(v, c2[i], k)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const SPEC = [[255, 59, 48], [255, 140, 30], [255, 214, 10], [52, 199, 89], [0, 199, 190], [10, 132, 255], [140, 80, 255]];

// ---------- Zeichen-Helfer ----------
function text(s, x, y, size, font, fill, o = {}) {
  g.save();
  g.font = `${size}px ${font}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  if (o.ls != null) g.letterSpacing = o.ls + 'px';
  g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 40; }
  if (o.sc && o.sc !== 1) { g.translate(x, y); g.scale(o.sc, o.sc); x = 0; y = 0; }
  if (o.rot) { if (!(o.sc && o.sc !== 1)) { g.translate(x, y); x = 0; y = 0; } g.rotate(o.rot); }
  if (o.mblur) g.filter = `blur(${o.mblur}px)`;
  if (o.stroke) { g.lineWidth = o.stroke; g.lineJoin = 'round'; g.strokeStyle = o.strokeColor || 'rgba(0,0,0,.6)'; g.strokeText(s, x, y); }
  g.fillStyle = fill; g.fillText(s, x, y);
  g.restore();
}
// Wörter nacheinander einschlagen lassen (kinetische Typo)
function slam(words, x, y, size, font, fill, t0, step, o = {}) {
  g.save(); g.font = `${size}px ${font}`; if (o.ls != null) g.letterSpacing = o.ls + 'px';
  const ws = words.map(w => g.measureText(w).width), gap = size * .28, tot = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  g.restore();
  let cx = x - tot / 2;
  words.forEach((w, i) => {
    const k = p(t0.t, t0.s + i * step, t0.s + i * step + .35);
    if (k > 0) text(w, cx + ws[i] / 2, y, size, font, fill, { ...o, alpha: clamp(k * 3) * (o.alpha ?? 1), sc: lerp(o.from || 1.8, 1, eback(k)), mblur: (1 - eo(k)) * 10 });
    cx += ws[i] + gap;
  });
}
function glow(x, y, r, c, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgb(c, a)); gr.addColorStop(.35, rgb(c, a * .35)); gr.addColorStop(1, rgb(c, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
function beam(x1, y1, x2, y2, w, c, a = 1) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  [[w * 6, .08], [w * 2.5, .22], [w, .9]].forEach(([lw, al]) => { g.strokeStyle = rgb(c, al * a); g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); });
  g.restore();
}
function arrow(x1, y1, x2, y2, c, w = 8, a = 1) {
  const ang = Math.atan2(y2 - y1, x2 - x1), hl = w * 3.2;
  g.save(); g.globalAlpha = a; g.strokeStyle = rgb(c); g.fillStyle = rgb(c); g.lineWidth = w; g.lineCap = 'round';
  g.shadowColor = rgb(c, .7); g.shadowBlur = 20;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - Math.cos(ang) * hl * .8, y2 - Math.sin(ang) * hl * .8); g.stroke();
  g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - Math.cos(ang - .5) * hl, y2 - Math.sin(ang - .5) * hl); g.lineTo(x2 - Math.cos(ang + .5) * hl, y2 - Math.sin(ang + .5) * hl); g.closePath(); g.fill();
  g.restore();
}
function bg(stops, angle = 0) {
  const gr = angle ? g.createLinearGradient(0, 0, W, H) : g.createLinearGradient(0, 0, 0, H);
  stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// Polarlicht-Bänder für farbige Hintergründe
function aurora(t, a, cols = [[255, 60, 200], [40, 230, 210], [120, 90, 255]]) {
  g.save(); g.globalCompositeOperation = 'lighter';
  cols.forEach((c, n) => {
    const y0 = 420 + n * 340, sp = .7 + n * .1, ph = n * 2;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = -40; x <= W + 40; x += 30) { const y = y0 + Math.sin(x / 210 + t * sp + ph + k * .6) * 90 + Math.sin(x / 90 - t * sp * 1.7 + ph) * 26 + k * 34; x === -40 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.strokeStyle = rgb(c, .10 * a); g.lineWidth = 70 - k * 18; g.filter = 'blur(18px)'; g.stroke();
    }
  });
  g.restore(); g.filter = 'none';
}
const STARS = (() => { const r = rng(42); return Array.from({ length: 220 }, () => ({ x: r() * W, y: r() * H, s: .6 + r() * 2.4, ph: r() * 6.28, sp: .6 + r() * 2 })); })();
function stars(t, a = 1, drift = 0) {
  STARS.forEach(s => { const al = (.35 + .65 * (.5 + .5 * Math.sin(t * s.sp * 2 + s.ph))) * a; g.fillStyle = `rgba(225,232,255,${al * .85})`; g.fillRect((s.x + drift * s.s * 20) % W, s.y, s.s, s.s); });
}

// ---------- Untertitel ----------
let CHUNKS = [];
function setupCaptions() {
  const WORDS = [];
  CFG.PHRASES.forEach(([a, b, s]) => {
    (CFG.REPL || []).forEach(([x, y]) => { s = s.split(x).join(y); });
    const ws = s.split(' '), wt = ws.map(w => w.length + 2), tot = wt.reduce((x, y) => x + y, 0); let acc = a;
    ws.forEach((w, i) => { const d = (b - a) * wt[i] / tot; WORDS.push({ w, a: acc, b: acc + d }); acc += d; });
  });
  CHUNKS = []; let cur = [];
  WORDS.forEach(w => { const len = cur.map(x => x.w).join(' ').length + w.w.length; if (cur.length && (cur.length >= 3 || len > 18 || w.a - cur[cur.length - 1].b > .2)) { CHUNKS.push(cur); cur = []; } cur.push(w); if (/[.?,:!]$/.test(w.w)) { CHUNKS.push(cur); cur = []; } });
  if (cur.length) CHUNKS.push(cur);
}
function captions(t, y = 1560) {
  const ch = CHUNKS.find(c => t >= c[0].a - .05 && t < c[c.length - 1].b + .25); if (!ch) return;
  const size = 76; g.save(); g.font = `${size}px IDB`; g.textBaseline = 'middle';
  const widths = ch.map(w => g.measureText(w.w).width), sp = 34, total = widths.reduce((a, b) => a + b, 0) + sp * (ch.length - 1);
  let x = W / 2 - total / 2; const inA = eo(p(t, ch[0].a - .05, ch[0].a + .12));
  ch.forEach((w, i) => {
    const on = t >= w.a && t < w.b + .05, past = t >= w.b, key = CFG.KEY.test(w.w);
    const pop = on ? 1 + .05 * Math.sin(p(t, w.a, w.a + .18) * Math.PI) : 1;
    g.save(); g.translate(x + widths[i] / 2, y + (1 - inA) * 30); g.scale(pop, pop); g.globalAlpha = inA; g.textAlign = 'center';
    g.lineWidth = 14; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(w.w, 0, 0);
    g.fillStyle = on ? (key ? '#ffd23f' : '#ffffff') : (past ? (key ? '#ffd23f' : '#f2f2f2') : 'rgba(255,255,255,.55)');
    if (on && key) { g.shadowColor = 'rgba(255,210,63,.6)'; g.shadowBlur = 30; }
    g.fillText(w.w, 0, 0); g.restore(); x += widths[i] + sp;
  });
  g.restore();
}

// ---------- Übergänge, RGB-Split, Farbanhebung, Korn ----------
function transition(t) {
  CFG.CUTS.forEach(tb => {
    const d = t - tb; if (Math.abs(d) > .32) return; const k = 1 - Math.abs(d) / .32;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,255,255,${k * k * .3})`; g.fillRect(0, 0, W, H);
    const bx = lerp(-600, W + 600, (d + .32) / .64), gr = g.createLinearGradient(bx - 180, 0, bx + 180, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,250,235,${k * .3})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.translate(W / 2, H / 2); g.rotate(-.35); g.translate(-W / 2, -H / 2); g.fillStyle = gr; g.fillRect(-600, -400, W + 1200, H + 800);
    g.restore();
  });
}
const OFF = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; });
function rgbSplit(px) {
  if (px < .5) return;
  const [a, b] = OFF, ga = a.getContext('2d'), gb = b.getContext('2d');
  [[ga, '#ff0000'], [gb, '#00ffff']].forEach(([x, col]) => { x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.drawImage(a, -px, 0); g.globalCompositeOperation = 'lighter'; g.drawImage(b, px, px * .3); g.restore();
}
function grade() {
  const ga = OFF[0].getContext('2d'); ga.globalCompositeOperation = 'source-over'; ga.drawImage(cv, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'saturate(1.3) contrast(1.06)'; g.drawImage(OFF[0], 0, 0); g.restore(); g.filter = 'none';
}
const NOISE = [0, 1, 2].map(k => { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'); const id = x.createImageData(540, 960); const r = rng(7 + k); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; });
function finish(t, frame) {
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .06; g.globalCompositeOperation = 'overlay'; g.drawImage(NOISE[frame % 3], 0, 0, W, H); g.restore();
  const f = Math.min(1, t / .3, (CFG.DUR - t) / .5); if (f < 1) { g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, f)})`; g.fillRect(0, 0, W, H); }
}

// Schwebende Lichtpartikel über allem: auch ruhige Bilder bewegen sich jede Sekunde
const MOTES = (() => { const r = rng(99); return Array.from({ length: 34 }, () => ({ x: r() * W, y: r() * H, s: 2 + r() * 5, sp: 20 + r() * 50, ph: r() * 6.28 })); })();
function motes(t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  MOTES.forEach(m => { const y = ((m.y - t * m.sp) % H + H) % H, x = m.x + Math.sin(t * .7 + m.ph) * 30; g.fillStyle = `rgba(255,245,220,${.18 + .12 * Math.sin(t * 2 + m.ph)})`; g.beginPath(); g.arc(x, y, m.s, 0, 7); g.fill(); });
  g.restore();
}

// ---------- Rahmen pro Bild ----------
window.renderFrame = (t, frame) => {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  const sh = CFG.CUTS.reduce((m, tb) => { const d = t - tb; return d > 0 && d < .25 ? (1 - d / .25) * 10 : m; }, 0) + (CFG.shake ? CFG.shake(t) : 0);
  g.save(); g.translate(Math.sin(t * 90) * sh, Math.cos(t * 70) * sh);
  // Hausregel „nie Stillstand“: immer eine leichte Kamerafahrt unter jeder Szene
  g.translate(W / 2, H / 2); g.scale(1.04 + .025 * Math.sin(t * .9), 1.04 + .025 * Math.sin(t * .9)); g.rotate(.01 * Math.sin(t * .6)); g.translate(-W / 2 + 18 * Math.sin(t * .5), -H / 2 + 22 * Math.cos(t * .41));
  scene(t);
  g.restore();
  motes(t);
  transition(t);
  grade();
  const split = (CFG.split ? CFG.split(t) : 0) + CFG.CUTS.reduce((m, tb) => Math.max(m, 9 * Math.max(0, 1 - Math.abs(t - tb) / .2)), 0);
  rgbSplit(split);
  if (t < CFG.CAP_END) captions(t);
  finish(t, frame);
};
window.ready = document.fonts.ready.then(() => { setupCaptions(); return Promise.all(['IDB', 'IDX', 'IDS', 'IDM'].map(f => document.fonts.load(`40px ${f}`))); });
