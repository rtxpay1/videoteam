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
// Polarlicht-Bänder für farbige Hintergründe. Gerechnet auf einer Fläche in Viertel-Auflösung
// (Weichzeichner dort ist ca. 50× billiger) und weich hochskaliert.
const AUR = document.createElement('canvas'); AUR.width = W / 4; AUR.height = H / 4;
const AURX = AUR.getContext('2d'), AUR2 = document.createElement('canvas'); AUR2.width = W / 4; AUR2.height = H / 4;
const AURX2 = AUR2.getContext('2d');
function aurora(t, a, cols = [[255, 60, 200], [40, 230, 210], [120, 90, 255]]) {
  AURX.setTransform(1, 0, 0, 1, 0, 0); AURX.clearRect(0, 0, AUR.width, AUR.height); AURX.scale(.25, .25);
  AURX.globalCompositeOperation = 'lighter';
  cols.forEach((c, n) => {
    const y0 = 420 + n * 340, sp = .7 + n * .1, ph = n * 2;
    for (let k = 0; k < 3; k++) {
      AURX.beginPath();
      for (let x = -40; x <= W + 40; x += 30) { const y = y0 + Math.sin(x / 210 + t * sp + ph + k * .6) * 90 + Math.sin(x / 90 - t * sp * 1.7 + ph) * 26 + k * 34; x === -40 ? AURX.moveTo(x, y) : AURX.lineTo(x, y); }
      AURX.strokeStyle = rgb(c, .10 * a); AURX.lineWidth = 70 - k * 18; AURX.stroke();
    }
  });
  // einmal weichzeichnen (statt pro Linie), dann hochskaliert dazumischen
  AURX2.clearRect(0, 0, AUR2.width, AUR2.height); AURX2.filter = 'blur(4.5px)'; AURX2.drawImage(AUR, 0, 0); AURX2.filter = 'none';
  g.save(); g.globalCompositeOperation = 'lighter'; g.imageSmoothingQuality = 'high'; g.drawImage(AUR2, 0, 0, W, H); g.restore();
}
const STARS = (() => { const r = rng(42); return Array.from({ length: 220 }, () => ({ x: r() * W, y: r() * H, s: .6 + r() * 2.4, ph: r() * 6.28, sp: .6 + r() * 2 })); })();
function stars(t, a = 1, drift = 0) {
  STARS.forEach(s => { const al = (.35 + .65 * (.5 + .5 * Math.sin(t * s.sp * 2 + s.ph))) * a; g.fillStyle = `rgba(225,232,255,${al * .85})`; g.fillRect((s.x + drift * s.s * 20) % W, s.y, s.s, s.s); });
}

// ---------- Untertitel ----------
let CHUNKS = [];
function setupCaptions() {
  let WORDS = [];
  const TW = typeof TIMING !== 'undefined' && TIMING.words;
  if (TW && TW.length) {
    // Genaue Wort-Zeiten aus der Spracherkennung (engine/words.py). Ersetzungen (REPL) über mehrere Wörter:
    // die ersetzten Wörter teilen sich die Zeitspanne der Originalwörter.
    WORDS = TW.map(([a, b, w]) => ({ w, a, b }));
    (CFG.REPL || []).forEach(([x, y]) => {
      const xs = x.split(' '), ys = y.split(' ');
      for (let i = 0; i + xs.length <= WORDS.length; i++) {
        const seg = WORDS.slice(i, i + xs.length), txt = seg.map(o => o.w).join(' ');
        const m = txt.indexOf(x); if (m !== 0) continue;
        const rest = txt.slice(x.length), A = seg[0].a, B = seg[seg.length - 1].b;
        const rep = ys.map((w, k) => ({ w: w + (k === ys.length - 1 ? rest : ''), a: A + (B - A) * k / ys.length, b: A + (B - A) * (k + 1) / ys.length }));
        WORDS.splice(i, xs.length, ...rep); i += ys.length - 1;
      }
      WORDS.forEach(o => { if (o.w.includes(x)) o.w = o.w.split(x).join(y); });   // Ersetzung innerhalb eines Wortes
    });
  } else CFG.PHRASES.forEach(([a, b, s]) => {
    (CFG.REPL || []).forEach(([x, y]) => { s = s.split(x).join(y); });
    const ws = s.split(' '), wt = ws.map(w => w.length + 2), tot = wt.reduce((x, y) => x + y, 0); let acc = a;
    ws.forEach((w, i) => { const d = (b - a) * wt[i] / tot; WORDS.push({ w, a: acc, b: acc + d }); acc += d; });
  });
  CHUNKS = []; let cur = [];
  WORDS.forEach(w => { const len = cur.map(x => x.w).join(' ').length + w.w.length; if (cur.length && (cur.length >= 3 || len > 18 || w.a - cur[cur.length - 1].b > .2)) { CHUNKS.push(cur); cur = []; } cur.push(w); if (/[.?,:!]$/.test(w.w)) { CHUNKS.push(cur); cur = []; } });
  if (cur.length) CHUNKS.push(cur);
}
// Untertitel: Wörter erscheinen einzeln, wenn sie gesprochen werden (Pop mit kleinem Überschwingen und Kipp-Wackler).
// Farben: normale Wörter weiß, Schlüsselwörter gelb, das gerade gesprochene Wort grün (größer und mit Leuchten).
function captions(t, y = 1560) {
  // eine Wortgruppe bleibt kurz stehen, macht aber sofort Platz, sobald das nächste Wort gesprochen wird
  const endOf = k => Math.min(CHUNKS[k][CHUNKS[k].length - 1].b + .25, k + 1 < CHUNKS.length ? CHUNKS[k + 1][0].a - .06 : Infinity);
  const ci = CHUNKS.findIndex((c, k) => t >= c[0].a - .06 && t < endOf(k)); if (ci < 0) return; const ch = CHUNKS[ci];
  const size = 78; g.save(); g.font = `${size}px IDB`; g.textBaseline = 'middle';
  const widths = ch.map(w => g.measureText(w.w).width), sp = 40, total = widths.reduce((a, b) => a + b, 0) + sp * (ch.length - 1);
  const out = p(t, endOf(ci) - .15, endOf(ci));
  let x = W / 2 - total / 2;
  ch.forEach((w, i) => {
    const k = p(t, w.a - .06, w.a + .16); if (k <= 0) { x += widths[i] + sp; return; }
    const key = CFG.KEY.test(w.w), on = t >= w.a - .06 && t < w.b + .05, col = key ? '#ffd23f' : on ? '#7dff6a' : '#ffffff', e = eback(k), wob = (1 - k) * (i % 2 ? .12 : -.12);
    const sc = (.55 + .45 * e) * (on ? 1.06 : 1) * (1 - out * .2);
    g.save(); g.translate(x + widths[i] / 2, y + (1 - e) * 36 - out * 30); g.rotate(wob); g.scale(sc, sc); g.globalAlpha = clamp(k * 2.5) * (1 - out); g.textAlign = 'center';
    g.lineWidth = 15; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(w.w, 0, 0);
    if (on) { g.shadowColor = key ? 'rgba(255,210,63,.7)' : 'rgba(125,255,106,.7)'; g.shadowBlur = 34; }
    g.fillStyle = col; g.fillText(w.w, 0, 0); g.restore(); x += widths[i] + sp;
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
  const m = px * H / W + px;   // beide Kanäle um den Versatz größer, so decken sie das ganze Bild
  g.drawImage(a, -2 * px, -m, W + 2 * px, H + 2 * m); g.globalCompositeOperation = 'lighter'; g.drawImage(b, 0, -m + px * .3, W + 2 * px, H + 2 * m); g.restore();
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
  // Ein- und Ausblenden über Schwarz, außer bei Endlos-Schleifen (CFG.LOOP): da muss das letzte Bild ins erste übergehen
  const f = CFG.LOOP ? 1 : Math.min(1, t / .3, (CFG.DUR - t) / .5); if (f < 1) { g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, f)})`; g.fillRect(0, 0, W, H); }
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
  // Hausregel „nie Stillstand“: immer eine leichte Kamerafahrt unter jeder Szene.
  // Der Zoom wird pro Bild so gewählt, dass Verschiebung, Drehung und Wackeln nie den Bildrand freilegen.
  const shx = Math.sin(t * 90) * sh, shy = Math.cos(t * 70) * sh, tx = 10 * Math.sin(t * .5), ty = 12 * Math.cos(t * .41), rot = .006 * Math.sin(t * .6);
  const need = Math.max(1 + 2 * (Math.abs(tx * 1.1 + shx) + Math.abs(rot) * H / 2 + 3) / W, 1 + 2 * (Math.abs(ty * 1.1 + shy) + Math.abs(rot) * W / 2 + 3) / H);
  const zs = Math.max(1.035 + .02 * Math.sin(t * .9), need);
  g.save(); g.translate(shx, shy);
  g.translate(W / 2, H / 2); g.scale(zs, zs); g.rotate(rot); g.translate(-W / 2 + tx, -H / 2 + ty);
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
window.ready = document.fonts.ready.then(() => { setupCaptions(); return Promise.all(['IDB', 'IDX', 'IDS', 'IDM'].map(f => document.fonts.load(`40px ${f}`)).concat(window.READY3D || [])); });   // READY3D: 3D-Baukasten (fx3d.js) geladen
