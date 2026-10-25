// 3D-Baukasten im Hausstil „Goldener Token 3D“ (three.js, WebGL).
// Stil: Low-Poly mit flachen Facetten, Toon-Licht in 3 Stufen, dunkle Kontur,
// warmes Führungslicht plus Türkis- und Pink-Gegenlicht. Die 3D-Ebene ist durchsichtig
// und wird in scene(t) über den 2D-Hintergrund gelegt: g.drawImage(FX3D.render(stage), 0, 0)
//
// Einbinden in einer Szene (vor lib.js):
//   <script>window.READY3D = new Promise(r => window.__ready3d = r);</script>
//   <script type="module" src="../engine/fx3d.js"></script>
import * as THREE from './vendor/three.module.js';

const W = 1080, H = 1920;
// Die 3D-Ebene wird in geringerer Auflösung gerechnet und hochskaliert (Software-Grafik ist langsam);
// Facetten und Konturen bleiben dabei scharf genug. SCALE per window.FX3D_SCALE änderbar.
const SCALE = window.FX3D_SCALE || .75, RW = Math.round(W * SCALE), RH = Math.round(H * SCALE);
const canvas = document.createElement('canvas'); canvas.width = RW; canvas.height = RH;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(RW, RH, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Toon-Verlauf: drei harte Lichtstufen statt weicher Schattierung
const GRAD = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1);
GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x140a24, side: THREE.BackSide });

// Gleiche Zufallszahlen bei jedem Render (wichtig für Bild-für-Bild-Rendern)
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Eine 3D-Bühne: Szene, Kamera und das Hausstil-Licht
function stage(o = {}) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(o.fov || 32, W / H, .1, 5000); cam.position.set(0, 0, o.dist || 40);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(-6, 9, 10); scene.add(key);
  const rimA = new THREE.DirectionalLight(0x3ff0ff, 2.2); rimA.position.set(9, -1, -7); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0xff4fb0, 1.6); rimB.position.set(-9, -5, -5); scene.add(rimB);
  scene.add(new THREE.AmbientLight(0x7060b0, 1.1));
  return { scene, cam, add: obj => (scene.add(obj), obj) };
}
function toon(color, o = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: GRAD, flatShading: true, vertexColors: !!o.vertexColors, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 0, transparent: o.opacity != null, opacity: o.opacity ?? 1 });
}
// Mesh mit dunkler Kontur (umgedrehte, leicht größere Hülle)
function solid(geo, mat, outline = .05) {
  const grp = new THREE.Group(), m = new THREE.Mesh(geo, mat); grp.add(m);
  if (outline) { const o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(1 + outline); grp.add(o); }
  grp.userData.mesh = m; return grp;
}
// Flächen einzeln einfärben (Low-Poly-Look): fn(Mittelpunkt) -> THREE.Color
function paintFaces(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    v.set(0, 0, 0); for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(pos, i + k)); v.divideScalar(3);
    const c = fn(v, i / 3); for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// Ecken zufällig verschieben (Felsen, Asteroiden)
function jitter(geo, amt, seed = 1) {
  const r = rng(seed), pos = geo.attributes.position, seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map(x => x.toFixed(3)).join();
    if (!seen.has(key)) seen.set(key, 1 + (r() - .5) * amt);
    const f = seen.get(key); pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals(); return geo;
}
const C = c => new THREE.Color(c);

// ---------- Fertige Objekte ----------
// Planet: Meer, Land und Polkappen als Facetten
function planet(r = 4, o = {}) {
  const sea = C(o.sea || 0x1f7ae0), sea2 = C(o.sea2 || 0x2a9cf0), land = C(o.land || 0x3fcf6a), land2 = C(o.land2 || 0x2aa85a), ice = C(0xf2f8ff);
  const geo = paintFaces(new THREE.IcosahedronGeometry(r, 3), (v, n) => {
    const y = v.y / r, h = Math.sin(v.x * 1.3 + 1) * Math.cos(v.z * 1.1) + Math.sin(v.y * 1.7) * .6;
    if (Math.abs(y) > .86) return ice;
    if (h > .35) return n % 3 ? land : land2;
    return n % 2 ? sea : sea2;
  });
  return solid(geo, toon(0xffffff, { vertexColors: true }), o.outline ?? .035);
}
function moon(r = 1.2, o = {}) {
  const a = C(0xe4e6f2), b = C(0xb8bcd4);
  const geo = paintFaces(jitter(new THREE.IcosahedronGeometry(r, 2), .08, 7), (v, n) => (Math.sin(v.x * 3) * Math.cos(v.z * 2.6) > .4 ? b : a));
  return solid(geo, toon(0xffffff, { vertexColors: true }), o.outline ?? .05);
}
function rock(r = 1, o = {}) {
  const geo = jitter(new THREE.DodecahedronGeometry(r, 1), o.rough ?? .45, o.seed || 3);
  return solid(geo, toon(o.color || 0x8a5a4a), o.outline ?? .06);
}
function crystal(color = 0x7af0ff, s = 1) {
  const geo = new THREE.OctahedronGeometry(s, 0); geo.scale(.6, 1.4, .6);
  return solid(geo, toon(color, { emissive: color, ei: .25 }), .07);
}
// Papierstapel aus n Blättern (Höhe h), Lagen abwechselnd leicht getönt
function paperStack(n = 12, w = 3, d = 4.2, h = 2) {
  const grp = new THREE.Group(), th = h / n;
  for (let i = 0; i < n; i++) { const b = solid(new THREE.BoxGeometry(w, th * .92, d), toon(i % 2 ? 0xfff6e4 : 0xffeccc), .02); b.position.y = th * i + th / 2; b.rotation.y = Math.sin(i * 1.7) * .03; grp.add(b); }
  return grp;
}
function ring(r = 5, tube = .12, color = 0xffd23f) { return solid(new THREE.TorusGeometry(r, tube, 6, 48), toon(color, { emissive: color, ei: .3 }), .1); }
// Einfache Low-Poly-Figur (Kopf + Körper), Blick zur Kamera
function figure(color = 0xff5a8a) {
  const grp = new THREE.Group();
  const body = solid(new THREE.CapsuleGeometry(.55, 1.1, 2, 6), toon(color), .06); body.position.y = .9; grp.add(body);
  const head = solid(new THREE.IcosahedronGeometry(.5, 1), toon(0xffd7b0), .06); head.position.y = 2.25; grp.add(head);
  return grp;
}

// Rendert die Bühne und gibt die durchsichtige 3D-Ebene zurück (zeichnen mit g.drawImage(ebene, 0, 0, 1080, 1920))
// Die Pixel werden direkt ausgelesen und in eine normale 2D-Fläche kopiert: das ist mit Software-Grafik
// viel schneller, als die WebGL-Fläche selbst ins Video-Canvas zu zeichnen.
const gl = renderer.getContext(), PIX = new Uint8Array(RW * RH * 4), out = document.createElement('canvas'); out.width = RW; out.height = RH;
const octx = out.getContext('2d', { willReadFrequently: true }), IMG = octx.createImageData(RW, RH), ROW = RW * 4;
function render(st) {
  renderer.render(st.scene, st.cam);
  gl.readPixels(0, 0, RW, RH, gl.RGBA, gl.UNSIGNED_BYTE, PIX);
  for (let y = 0; y < RH; y++) IMG.data.set(PIX.subarray((RH - 1 - y) * ROW, (RH - y) * ROW), y * ROW);   // WebGL liefert die Zeilen von unten nach oben
  // WebGL liefert vormultiplizierte Farben, ImageData erwartet gerade Farben
  const d = IMG.data; for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a && a < 255) { const f = 255 / a; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } }
  octx.putImageData(IMG, 0, 0); return out;
}

window.FX3D = { THREE, stage, toon, solid, paintFaces, jitter, planet, moon, rock, crystal, paperStack, ring, figure, render, canvas: out, rng };
if (window.__ready3d) window.__ready3d();
