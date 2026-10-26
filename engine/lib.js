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
// Feder: kommt schnell an, schießt leicht über und schwingt sich ein (wirkt lebendiger als eo/eback). x 0..1
const spring = (x, f = 1.6, d = 5.5) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-d * x) * Math.cos(f * Math.PI * 2 * x);
// Nacheinander statt alle gleichzeitig: Element i startet step Sekunden nach dem vorigen. Liefert 0..1
const nach = (t, t0, i, step = .07, d = .4) => p(t, t0 + i * step, t0 + i * step + d);
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

// ---------- Einblenden genau auf dem Wort ----------
// wort('Fallschirm') = Startzeit des gesprochenen Wortes aus den genauen Wort-Zeiten (TIMING.words),
// n = das wievielte Vorkommen. Mehrere Wörter ('Die Antwort') = Start der Wortfolge.
// Ohne Wort-Zeiten: Start des Teilsatzes. Nicht gefunden: 0 und Eintrag in FEHLT_ANKER (engine/ankercheck.py prüft vorab).
const _nw = w => w.toLowerCase().replace(/[^a-zäöüß0-9]/g, ''), _WM = new Map(), FEHLT_ANKER = new Set();
function wort(w, n = 1) {
  const id = w + '|' + n; if (_WM.has(id)) return _WM.get(id);
  const T = typeof TIMING !== 'undefined' ? TIMING : {}, TW = T.words || [], ks = w.split(/\s+/).map(_nw).filter(Boolean);
  let r = null, c = 0;
  for (let i = 0; i + ks.length <= TW.length && r == null; i++) if (ks.every((k, j) => _nw(TW[i + j][2]) === k) && ++c === n) r = TW[i][0];
  if (r == null) { const x = (T.phrases || []).find(x => x[2].includes(w)); if (x) r = x[0]; }
  if (r == null) { FEHLT_ANKER.add(w); r = 0; }
  _WM.set(id, r); return r;
}
// Fortschritt 0..1 einer Einblendung auf dem Wort: beginnt 0,08 s vorher, damit das Bild nie hinterherhinkt
const aufWort = (t, w, d = .35, n = 1) => p(t, wort(w, n) - .08, wort(w, n) - .08 + d);

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

// ---------- Szenen-Übergänge ----------
// Ist die Szene als Liste SC aufgebaut (SC[i] = Szene zu Satz i), blendet lib.js an jedem Schnitt die alte Szene
// mit einem Bewegungs-Übergang in die neue. Beide Szenen laufen dabei weiter (keine eingefrorenen Bilder).
// Art pro Schnitt: CFG.UEBERGANG = ['zoom', 'wisch', ...] (wird wiederholt) oder k => 'zoom' | { art: 'form', x, y }.
//   zoom     Kamera fliegt in die alte Szene hinein (Punkt x, y), die neue kommt aus der Nähe zur Ruhe
//   wisch    schneller Schwenk mit Bewegungsunschärfe (dir: 1 nach links, -1 nach rechts)
//   form     neue Szene öffnet sich als Kreis aus einem Punkt (x, y), z. B. aus einem Planeten oder einer Münze
//   schieben Eula fliegt von unten herein und schiebt die alte Szene nach oben weg
//   farbe    eine Farbwelle (farben: [vorne, hinten]) läuft über das Bild und gibt die neue Szene frei
//   hart     harter Schnitt
// CFG.UEBERGANG = false: alte Blitz-Übergänge (für ältere Videos). Ohne Angabe wechseln die Arten automatisch ab.
// Der Übergang liegt auf dem nächsten Achtel-Schlag der Musik kurz vor dem Schnitt (TIMING.bpm, setzt build.py),
// sonst 0,1 s davor: das Bild läuft der Stimme leicht voraus. engine/sound.py legt bei "wechsel": true den Wisch-Ton genau dorthin.
const UE = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; });
const UE_ARTEN = ['zoom', 'wisch', 'form', 'farbe', 'wisch', 'schieben'], UE_H = .22;
let UE_ON = null, UE3 = null;
const ueAktiv = () => UE_ON ?? (UE_ON = CFG.UEBERGANG !== false && typeof SC !== 'undefined' && Array.isArray(SC));
function ueZeit(tb) {
  const bpm = typeof TIMING !== 'undefined' && TIMING.bpm;
  if (bpm) { const b = 30 / bpm, c = Math.round((tb - .1) / b) * b; if (c >= tb - .25 && c <= tb + .05) return c; }
  return tb - .1;
}
function ueArt(k) {
  const u = CFG.UEBERGANG, a = typeof u === 'function' ? u(k) : Array.isArray(u) ? u[k % u.length] : UE_ARTEN[k % UE_ARTEN.length];
  return typeof a === 'string' ? { art: a } : a || { art: 'hart' };
}
function ueFinde(t) {
  if (!ueAktiv()) return null;
  for (let k = 0; k < CFG.CUTS.length; k++) {
    const c = ueZeit(CFG.CUTS[k]); if (Math.abs(t - c) >= UE_H || !SC[k] || !SC[k + 1]) continue;
    const o = ueArt(k); if (o.art !== 'hart' && UE_MAL[o.art]) return { ...o, k, u: (t - c + UE_H) / (2 * UE_H) };
  }
  return null;
}
// Szene fn auf eine Nebenfläche malen (gleiche Kamerafahrt wie im Hauptbild)
function malSzene(cnv, fn, t) {
  const ctx = cnv.getContext('2d'), keep = g; g = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); camera(ctx, t); fn(t); ctx.restore(); g = keep;
}
// Bild skaliert um (cx, cy) und verschoben zeichnen
function lage(img, s, dx, dy, a = 1, cx = W / 2, cy = H / 2) {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.translate(cx + dx, cy + dy); g.scale(s, s); g.translate(-cx, -cy); g.drawImage(img, 0, 0); g.restore();
}
const UE_MAL = {
  zoom(A, B, u, o) {
    const cx = o.x ?? 540, cy = o.y ?? 960, m = eio(p(u, .4, .6)), ea = Math.pow(p(u, 0, .6), 2.2), eb = 1 - eo(p(u, .4, 1));
    // Nachzieh-Kopien in Zoomrichtung = Bewegungsunschärfe
    const ZK = [.15, .125, .1, .075, .05, .025, 0].map((d, i, L) => [d, i === L.length - 1 ? 1 : .2]);
    ZK.forEach(([d, a]) => lage(A, (1 + ea * 1.9) * (1 + d * ea), 0, 0, a, cx, cy));
    if (m > 0) ZK.forEach(([d, a]) => lage(B, (1 + eb * 1.1) * (1 + d * eb), 0, 0, a * m, cx, cy));
  },
  wisch(A, B, u, o) {
    const dir = o.dir ?? (o.k % 2 ? -1 : 1), e = eio(u), v = Math.sin(Math.PI * u) ** 2, oa = -dir * W * e, ob = dir * W * (1 - e);
    [-3, -2, -1, 1, 2, 3].forEach(j => { lage(A, 1, oa + j * v * 22 * dir, 0, .16); lage(B, 1, ob + j * v * 22 * dir, 0, .16); });
    lage(A, 1, oa, 0); lage(B, 1, ob, 0);
  },
  form(A, B, u, o) {
    const cx = o.x ?? 540, cy = o.y ?? 960, e = eio(u), R = e * Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.03;
    lage(A, 1 + .1 * e, 0, 0, 1, cx, cy);
    g.save(); g.beginPath(); g.arc(cx, cy, Math.max(R, .1), 0, 7); g.clip(); lage(B, 1.15 - .15 * e, 0, 0, 1, cx, cy); g.restore();
    g.save(); g.strokeStyle = `rgba(255,236,190,${.9 * (1 - u)})`; g.lineWidth = 16; g.shadowColor = 'rgba(255,200,60,.9)'; g.shadowBlur = 40;
    g.beginPath(); g.arc(cx, cy, Math.max(R, .1), 0, 7); g.stroke(); g.restore();
  },
  schieben(A, B, u, o, t) {
    const e = eio(u), y = H * (1 - e);
    const v = Math.sin(Math.PI * u) ** 2;
    [3, 2, 1].forEach(j => { lage(A, 1, 0, -H * e + j * v * 24, .16); lage(B, 1, 0, H * (1 - e) + j * v * 24, .16); });
    lage(A, 1, 0, -H * e); lage(B, 1, 0, H * (1 - e));
    const sh = g.createLinearGradient(0, y - 140, 0, y); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = sh; g.fillRect(0, y - 140, W, 140);
    if (window.FX3D && FX3D.eula) {   // Eula drückt mit hochgestreckten Flügeln von unten gegen die Kante
      if (!UE3) { UE3 = FX3D.stage({ dist: 15, fov: 30 }); UE3.eu = UE3.add(FX3D.eula()); UE3.eu.scale.setScalar(.55); }
      UE3.eu.position.set(Math.sin(t * 3) * .3, (960 - (y + 230)) / 238.8, 0); UE3.eu.pose(t, { mood: 'wow' });
      g.drawImage(FX3D.render(UE3), 0, 0, W, H);
    }
  },
  farbe(A, B, u, o, t) {
    lage(u < .5 ? A : B, 1, 0, 0);
    const [c1, c2] = o.farben || ['#ff4fb0', '#ffc93a'];
    const band = (e1, e2, col, ph) => {
      const top = lerp(H + 260, -260, e1), bot = lerp(H + 260, -260, e2), wv = (x, y, s) => y + s * 46 * Math.sin(x / 130 + t * 9 + ph) + s * 22 * Math.sin(x / 57 - t * 13);
      g.beginPath(); g.moveTo(-10, wv(-10, top, 1));
      for (let x = 30; x <= W + 40; x += 40) g.lineTo(x, wv(x, top, 1));
      for (let x = W + 40; x >= -10; x -= 40) g.lineTo(x, wv(x, bot, -1));
      g.closePath(); g.fillStyle = col; g.fill();
    };
    band(eio(p(u, 0, .5)), eio(p(u, .5, 1)), c1, 0);
    band(eio(p(u, .05, .55)), eio(p(u, .45, .95)), c2, 2);
  },
};

// ---------- Blitz beim Schnitt, RGB-Split, Farblook, Korn ----------
// Mit den neuen Übergängen sind Blitz, Wackeln und Farbversatz am Schnitt nur noch ein Hauch (UE_ALT)
const UE_ALT = () => ueAktiv() ? .35 : 1;
function transition(t) {
  const f = UE_ALT();
  CFG.CUTS.forEach(tb => {
    const d = t - tb; if (Math.abs(d) > .32) return; const k = (1 - Math.abs(d) / .32) * f;
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
// Farblook. CFG.LOOK = 'kino' (Standard): Leuchten um helle Stellen, Schatten leicht türkis, Lichter leicht warm.
// CFG.LOOK = 'alt': nur Sättigung und Kontrast wie bei den ersten Videos. CFG.BLOOM = Stärke des Leuchtens (Standard .28)
const BL = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W / 8; c.height = H / 8; return c; });
function grade() {
  const kino = (CFG.LOOK || 'kino') === 'kino', ga = OFF[0].getContext('2d'); ga.globalCompositeOperation = 'source-over'; ga.drawImage(cv, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = kino ? 'saturate(1.3) contrast(1.12)' : 'saturate(1.3) contrast(1.06)'; g.drawImage(OFF[0], 0, 0); g.filter = 'none';
  if (kino) {
    // nur die hellsten Stellen (über ca. 85 %) in 1/8 Auflösung herausfiltern, weichzeichnen und sanft dazugeben
    const [a, b] = BL, xa = a.getContext('2d'), xb = b.getContext('2d');
    xa.filter = 'brightness(.5) contrast(7)'; xa.drawImage(cv, 0, 0, a.width, a.height); xa.filter = 'none';
    xb.clearRect(0, 0, b.width, b.height); xb.filter = 'blur(3px)'; xb.drawImage(a, 0, 0); xb.filter = 'none';
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = CFG.BLOOM ?? .28; g.imageSmoothingQuality = 'high'; g.drawImage(b, 0, 0, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(6,30,44,.32)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(255,247,236)'; g.fillRect(0, 0, W, H);
  }
  g.restore();
}
// Feines Filmkorn in voller Auflösung: belebt Flächen und verhindert Farbstufen in Verläufen
const NOISE = [0, 1, 2].map(k => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const id = x.createImageData(W, H); const r = rng(7 + k); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; });
function finish(t, frame) {
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .07; g.globalCompositeOperation = 'overlay'; g.drawImage(NOISE[frame % 3], 0, 0, W, H); g.restore();
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

// ---------- Kamera ----------
// Hausregel „nie Stillstand“: immer eine leichte Kamerafahrt unter jeder Szene.
// Der Zoom wird pro Bild so gewählt, dass Verschiebung, Drehung und Wackeln nie den Bildrand freilegen.
function camera(ctx, t) {
  const sh = CFG.CUTS.reduce((m, tb) => { const d = t - tb; return d > 0 && d < .25 ? (1 - d / .25) * 10 * UE_ALT() : m; }, 0) + (CFG.shake ? CFG.shake(t) : 0);
  const shx = Math.sin(t * 90) * sh, shy = Math.cos(t * 70) * sh, tx = 10 * Math.sin(t * .5), ty = 12 * Math.cos(t * .41), rot = .006 * Math.sin(t * .6);
  const need = Math.max(1 + 2 * (Math.abs(tx * 1.1 + shx) + Math.abs(rot) * H / 2 + 3) / W, 1 + 2 * (Math.abs(ty * 1.1 + shy) + Math.abs(rot) * W / 2 + 3) / H);
  const zs = Math.max(1.035 + .02 * Math.sin(t * .9), need);
  ctx.translate(shx, shy);
  ctx.translate(W / 2, H / 2); ctx.scale(zs, zs); ctx.rotate(rot); ctx.translate(-W / 2 + tx, -H / 2 + ty);
}

// ---------- Bewegungsunschärfe ----------
// Bewegt sich das Bild stark (Vergleich mit dem vorigen Bild in Mini-Auflösung), werden zwei Zwischenzeitpunkte
// zusätzlich gerechnet und gemittelt (wie eine echte Kamera mit offenem Verschluss). Ruhige Bilder kosten nichts extra.
// CFG.MBLUR = 0 schaltet aus. Nur bei echtem Rendern (ab 24 Bildern/s, window.FPS setzt render.js).
const MB = { acc: Object.assign(document.createElement('canvas'), { width: W, height: H }), mini: Object.assign(document.createElement('canvas'), { width: 54, height: 96 }), prev: null, prevT: null, n: 0, on: 0 };
function unterschied(t, fps) {
  const x = MB.mini.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0, 54, 96);
  const d = x.getImageData(0, 0, 54, 96).data; let s = 0;
  const ok = MB.prev && MB.prevT != null && Math.abs(t - 1 / fps - MB.prevT) < 1e-4;
  if (ok) for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - MB.prev[i]) + Math.abs(d[i + 1] - MB.prev[i + 1]) + Math.abs(d[i + 2] - MB.prev[i + 2]);
  MB.prev = d.slice(); MB.prevT = t;
  return ok ? s / (54 * 96 * 3) : 0;
}

// ---------- Rahmen pro Bild ----------
function rohbild(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  const ue = ueFinde(t);
  if (ue) {
    malSzene(UE[0], SC[ue.k], t); malSzene(UE[1], SC[ue.k + 1], t);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); UE_MAL[ue.art](UE[0], UE[1], ue.u, ue, t);
  } else { g.save(); camera(g, t); scene(t); g.restore(); }
  motes(t);
  transition(t);
}
window.renderFrame = (t, frame) => {
  rohbild(t);
  const fps = window.FPS || 30;
  // nicht während eines Übergangs (hat eigene Unschärfe) und nicht direkt an einem harten Schnitt (würde zwei Szenen mischen)
  const amSchnitt = ueFinde(t) || CFG.CUTS.some(tb => tb > t - .6 / fps && tb <= t + 1e-6);
  if ((CFG.MBLUR ?? 1) && fps >= 24 && !amSchnitt) {
    MB.n++;
    if (unterschied(t, fps) > (CFG.MB_SCHWELLE ?? 7)) {
      MB.on++;
      const ac = MB.acc.getContext('2d'); ac.globalAlpha = 1; ac.drawImage(cv, 0, 0);
      [1, 2].forEach(j => { rohbild(t - j * .25 / fps); ac.globalAlpha = 1 / (j + 1); ac.drawImage(cv, 0, 0); });
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(MB.acc, 0, 0);
    }
  }
  grade();
  const split = (CFG.split ? CFG.split(t) : 0) + CFG.CUTS.reduce((m, tb) => Math.max(m, 9 * UE_ALT() * Math.max(0, 1 - Math.abs(t - tb) / .2)), 0);
  rgbSplit(split);
  if (t < CFG.CAP_END) captions(t);
  finish(t, frame);
};
window.ready = document.fonts.ready.then(() => { setupCaptions(); return Promise.all(['IDB', 'IDX', 'IDS', 'IDM'].map(f => document.fonts.load(`40px ${f}`)).concat(window.READY3D || [])); });   // READY3D: 3D-Baukasten (fx3d.js) geladen
