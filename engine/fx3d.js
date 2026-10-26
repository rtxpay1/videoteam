// 3D-Baukasten im Hausstil „Goldener Token 3D“ (three.js, WebGL).
// Stil: Low-Poly mit flachen Facetten, Toon-Licht in 3 Stufen, dunkle Kontur,
// warmes Führungslicht plus Türkis- und Pink-Gegenlicht. Die 3D-Ebene ist durchsichtig
// und wird in scene(t) über den 2D-Hintergrund gelegt: g.drawImage(FX3D.render(stage), 0, 0)
//
// Einbinden in einer Szene (vor lib.js):
//   <script>window.READY3D = new Promise(r => window.__ready3d = r);</script>
//   <script type="module" src="../engine/fx3d.js"></script>
import * as THREE from './vendor/three.module.js';
import { EXRLoader } from './vendor/jsm/loaders/EXRLoader.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

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

// ---------- Echtes Licht: Lichtstimmungen (HDRI) und Glanz ----------
// Lichtstimmungen von Poly Haven (CC0, engine/assets/hdri): studio, sunset, night, city, forest, sky, warehouse, dawn.
// Vorher im <head> anmelden (werden beim Laden vorbereitet):  <script>window.LICHT3D = ['studio'];</script>
// 'raum' (gleichmäßiges Studiolicht, wird berechnet) geht immer ohne Anmeldung.
// FX3D.licht(stage, 'sunset', { staerke: 1 }) setzt die Stimmung als Umgebungslicht und Spiegelung und schaltet
// für diese Bühne Film-Tonwerte ein (ACES: weiche Lichter, satte Schatten). Wirkt vor allem auf glanz()-Material;
// das Hausstil-Material toon() bleibt flach.
const pmrem = new THREE.PMREMGenerator(renderer), ENV = {};
const HDRI = ['studio', 'sunset', 'night', 'city', 'forest', 'sky', 'warehouse', 'dawn'];
const envLaden = Promise.all((window.LICHT3D || []).filter(n => HDRI.includes(n)).map(async n => {
  const uri = (await import(`./assets/hdri/${n}.exr.js`)).default, tex = await new EXRLoader().loadAsync(uri);
  ENV[n] = pmrem.fromEquirectangular(tex).texture; tex.dispose();
})).catch(e => console.error('Lichtstimmung nicht geladen:', e.message));
function licht(st, name = 'raum', o = {}) {
  if (!ENV[name] && name !== 'raum') { console.error(`Lichtstimmung „${name}“ nicht in window.LICHT3D angemeldet, nehme „raum“`); name = 'raum'; }
  if (!ENV.raum && name === 'raum') ENV.raum = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  st.scene.environment = ENV[name]; st.scene.environmentIntensity = o.staerke ?? 1; st.kino = true;
  if (o.hintergrund) st.scene.background = ENV[name];
  return st;
}
// Glänzendes, echt beleuchtetes Material (Münzen, Metall, Lack, nasse Steine). metall 0..1, rau 0..1 (0 = Spiegel), lack 0..1 (Klarlack)
function glanz(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: o.metall ?? 0, roughness: o.rau ?? .3, clearcoat: o.lack ?? .5, clearcoatRoughness: .12, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 0 });
}
// Weicher Bodenschatten (statt teurer Schattenberechnung): flacher dunkler Fleck unter einem Objekt. r = Radius, a = Deckkraft
let SCHATTEN_TEX = null;
function schatten(r = 1.5, a = .5) {
  if (!SCHATTEN_TEX) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.45, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    SCHATTEN_TEX = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: SCHATTEN_TEX, transparent: true, opacity: a, depthWrite: false, color: 0x0a0418 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = -1; return m;
}

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

// ---------- Maskottchen Eula ----------
// Die Wissens-Eule des Kanals: rund (keine Facetten), rote Cappie mit goldenem Token, goldene Augen.
// Benutzung:  const eu = st.add(FX3D.eula());  und in scene(t):  eu.pose(t, { mood: 'wave' })
// Stimmungen: idle (schwebt leicht), wave (winkt), wow (staunt, Flügel hoch), point (zeigt zur Seite, dir: 1 rechts / -1 links),
// fly (flattert), think (Flügel am Kinn, Blick nach oben), happy (Augen zu Lachbögen), sleepy (müde: Lider halb zu, Kopf nickt weg;
// mit o.lid = 1 schläft sie ganz). Blinzeln läuft automatisch.
// Weitere Optionen: look [x, y] (-1..1, Blickrichtung), blink false (aus), k (0..1, Stärke der Pose, für weiche Übergänge),
// ziel [x, y, z] (Weltpunkt: Kopf und Augen folgen ihm, z. B. dem Objekt, über das sie gerade spricht),
// hop t0 (Sprung ab Zeit t0: erst in die Hocke, dann hoch, Landung federt ab), squash false (Stauchen und Strecken aus).
// Automatisch: Stauchen beim Aufkommen, Strecken bei schneller Bewegung, Federohren und Cappie schwingen nach.
const clamp01 = x => Math.min(1, Math.max(0, x)), mixv = (a, b, k) => a + (b - a) * k;
function soft(color, o) { const m = toon(color, o); m.flatShading = false; return m; }
function eulaFace(o) {
  const grp = new THREE.Group(), black = new THREE.MeshBasicMaterial({ color: 0x140a24 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const disc = (r, c, z, x = 0, y = 0) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); return m; };
  // Auge: Augapfel mit Kontur, goldene Iris, Pupille, zwei Glanzpunkte, Lid und Wimpernlinie zum Blinzeln
  const eyes = [-1, 1].map(s => {
    const e = new THREE.Group(), r = o.eye, front = r * .62;
    const w = solid(new THREE.SphereGeometry(r, 32, 20), white, .13); w.scale.set(1, 1.08, .62); e.add(w);
    const look = new THREE.Group(); e.add(look);
    look.add(disc(r * .62, 0xc87a10, front + .004), disc(r * .55, 0xffb81a, front + .006), disc(r * .33, 0x140a24, front + .008));
    look.add(disc(r * .15, 0xffffff, front + .01, r * .2, r * .2), disc(r * .07, 0xffffff, front + .01, -r * .16, -r * .17));
    const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.16, 28, 16), new THREE.MeshBasicMaterial({ color: 0xf09a30 })); lid.visible = false; e.add(lid);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(r * .75, r * .07, 6, 20, Math.PI), black); lash.rotation.z = Math.PI; lash.position.set(0, r * .1, r * .8); lash.visible = false; e.add(lash);
    const happy = new THREE.Mesh(new THREE.TorusGeometry(r * .6, r * .1, 6, 20, Math.PI), black); happy.position.set(0, -r * .2, r * .8); happy.visible = false; e.add(happy);
    e.userData = { look, lid, lash, happy, r, s };
    e.position.set(s * o.gap, o.ey, o.z); e.rotation.y = s * .12; grp.add(e); return e;
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(o.mouth, o.mouth * .22, 6, 12, Math.PI), black); smile.rotation.z = Math.PI; smile.position.set(0, o.my, o.z); grp.add(smile);
  const open = new THREE.Mesh(new THREE.SphereGeometry(o.mouth * .8, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5a0a20 })); open.scale.set(.9, 1.2, .3); open.position.set(0, o.my - o.mouth * .3, o.z); grp.add(open);
  const cheeks = [-1, 1].map(s => { const c = new THREE.Mesh(new THREE.CircleGeometry(o.eye * .42, 20), new THREE.MeshBasicMaterial({ color: 0xff7aa0, transparent: true, opacity: .75 })); c.position.set(s * o.gap * 1.5, o.ey - o.eye * 1.15, o.z - .1); c.rotation.y = s * .45; grp.add(c); return c; });
  grp.userData = { eyes, smile, open, cheeks };
  return grp;
}
function eula() {
  const grp = new THREE.Group(), rig = new THREE.Group(), S = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h); grp.add(rig);
  // Körper mit eingefärbtem ovalem Bauch und hellem Gesichtskranz (Farbe pro Ecke, dadurch weiche Ränder)
  const BS = new THREE.Vector3(1, 1.12, .9), onBody = (ph, th, r = 1.5) => new THREE.Vector3(-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th)).multiply(BS);
  const bgeo = S(1.5, 128, 96), bp = bgeo.attributes.position, bc = new Float32Array(bp.count * 3), cO = C(0xffa83a), cB = C(0xffe6b8), cF = C(0xffe2b4), cc = new THREE.Color();
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), d = Math.hypot(x / .95, (y + .62) / .82), dE = Math.min(Math.hypot(x - .55, y - .49), Math.hypot(x + .55, y - .49));
    cc.copy(cO).lerp(cB, z > 0 ? clamp01((1.08 - d) / .1) : 0); if (z > 0) cc.lerp(cF, clamp01((.6 - dE) / .14)); bc.set([cc.r, cc.g, cc.b], i * 3);
  }
  bgeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const body = solid(bgeo, soft(0xffffff, { vertexColors: true }), .035); body.scale.copy(BS); rig.add(body);
  [[1.98, [-.3, 0, .3]], [2.22, [-.45, -.15, .15, .45]], [2.45, [-.3, 0, .3]]].forEach(([th, phs]) => phs.forEach(d => {
    const pos = onBody(Math.PI / 2 + d, th, 1.53), fe = new THREE.Mesh(new THREE.TorusGeometry(.12, .028, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0xe8a860 }));
    fe.position.copy(pos); fe.lookAt(pos.clone().divide(BS).divide(BS).multiplyScalar(3)); fe.rotateZ(Math.PI); rig.add(fe);
  }));
  const face = eulaFace({ eye: .4, gap: .55, ey: .55, my: -.06, mouth: .13, z: 1.12 }); rig.add(face);
  const beak = solid(new THREE.ConeGeometry(.17, .38, 12), soft(0xff6a2a), .06); beak.rotation.x = Math.PI / 2 + .35; beak.position.set(0, .2, 1.33); rig.add(beak);
  // Federohren: je zwei spitze Federbüschel schräg über der Cappie
  const ears = [-1, 1].map(s => {
    const ear = new THREE.Group();
    [[0, .95, .3, 0xe8862a], [s * .28, .65, .22, 0xffa83a]].forEach(([x, h, r, c], k) => { const fe = solid(new THREE.ConeGeometry(r, h, 14), soft(c), .07); fe.position.set(x, h / 2, k * .05); fe.rotation.z = -s * k * .35; ear.add(fe); });
    ear.position.set(s * .95, 1.35, .1); ear.rotation.set(-.1, 0, -s * .62); rig.add(ear); return ear;
  });
  // rote Cappie mit goldenem Token
  const cap = new THREE.Group(), red = soft(0xe8263a);
  const crown = solid(new THREE.SphereGeometry(1.05, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), red, .04); crown.scale.set(1, .78, 1); cap.add(crown);
  const brim = solid(new THREE.CylinderGeometry(.85, .85, .07, 28), soft(0xc81a2e), .06); brim.scale.set(1, 1, .8); brim.position.set(0, .02, .78); cap.add(brim);
  const knob = solid(S(.11, 12, 8), red, .1); knob.position.y = .82; cap.add(knob);
  const logo = solid(new THREE.CylinderGeometry(.24, .24, .06, 20), soft(0xffc93a, { emissive: 0xffa000, ei: .25 }), .1); logo.rotation.x = Math.PI / 2 - .25; logo.position.set(0, .28, .98); cap.add(logo);
  cap.position.set(0, 1.18, 0); cap.rotation.set(-.08, 0, -.1); rig.add(cap);
  const wings = [-1, 1].map(s => { const w = solid(S(.7, 20, 14), soft(0xe8862a), .05); w.scale.set(.35, 1, .6); w.position.y = -.6; const a = new THREE.Group(); a.add(w); a.position.set(s * 1.38, .1, 0); rig.add(a); return a; });
  const feet = [-1, 1].map(s => { const ft = solid(S(.26, 16, 10), soft(0xff6a2a), .08); ft.scale.set(1.1, .45, 1.3); ft.position.set(s * .5, -1.68, .35); rig.add(ft); return ft; });

  // Pose setzen: Flügelwinkel (z) pro Seite, Körperneigung, Hüpfen, Mimik
  grp.pose = (t, o = {}) => {
    const mood = o.mood || 'idle', k = o.k ?? 1, dir = o.dir || 1, U = face.userData;
    const bounce = mood === 'wow' || mood === 'happy' || o.hop != null;
    // Höhe über der Grundposition zu einem Zeitpunkt (für Bewegung, Tempo und Stauchen)
    const hopH = tt => { if (o.hop == null) return 0; const u = (tt - o.hop) / .65; return u > 0 && u < 1 ? 1.5 * Math.sin(Math.PI * u) : 0; };
    const hb = tt => hopH(tt) + (mood === 'wow' ? Math.abs(Math.sin(tt * 6)) * .35 : mood === 'fly' ? .6 + Math.sin(tt * 4) * .25 : mood === 'think' ? Math.sin(tt * 1.5) * .05
      : mood === 'sleepy' ? Math.sin(tt * 1.1) * .03 : mood === 'happy' ? Math.abs(Math.sin(tt * 7)) * .22 : Math.sin(tt * 2.2) * .08);
    let wl = -.25, wr = .25, bob = Math.sin(t * 2.2) * .08, tilt = Math.sin(t * 1.3) * .04, turn = 0, lean = 0, wowF = 0, happyF = 0, sleepF = 0, look = o.look || [0, 0], lift = 0;
    if (mood === 'wave') { wr = 2.3 + Math.sin(t * 9) * .45; tilt = -.06; turn = -.25; }
    if (mood === 'wow') { wl = -2.5 + Math.sin(t * 12) * .15; wr = 2.5 - Math.sin(t * 12) * .15; bob = Math.abs(Math.sin(t * 6)) * .35; tilt = Math.sin(t * 9) * .04; wowF = 1; }
    if (mood === 'point') { if (dir > 0) wr = 1.45 + Math.sin(t * 5) * .06; else wl = -1.45 - Math.sin(t * 5) * .06; turn = dir * .35; look = o.look || [dir, .1]; }
    if (mood === 'fly') { const fl = Math.sin(t * 16) * .9; wl = -1.6 - fl; wr = 1.6 + fl; lift = .6 + Math.sin(t * 4) * .25; bob = 0; lean = .25; }
    if (mood === 'think') { wr = 2.05; tilt = .12; look = o.look || [.4, .8]; bob = Math.sin(t * 1.5) * .05; }
    if (mood === 'sleepy') { sleepF = 1; const nod = Math.max(0, Math.sin(t * 1.1)); lean = .22 * nod * nod; wl = -.08; wr = .08; bob = Math.sin(t * 1.1) * .03; tilt = Math.sin(t * .7) * .08; look = o.look || [0, -.5]; }
    if (mood === 'happy') { happyF = 1; bob = Math.abs(Math.sin(t * 7)) * .22; wl = -.6 - Math.abs(Math.sin(t * 7)) * .4; wr = .6 + Math.abs(Math.sin(t * 7)) * .4; }
    if (o.ziel && mood !== 'point') {   // Kopf und Blick folgen einem Punkt im Raum
      const P = new THREE.Vector3(); grp.getWorldPosition(P); const zv = Array.isArray(o.ziel) ? new THREE.Vector3(...o.ziel) : o.ziel, d = zv.clone().sub(P), L = d.length() || 1;
      turn = Math.max(-.6, Math.min(.6, Math.atan2(d.x, Math.max(d.z, .5)) * .6)); look = o.look || [Math.max(-1, Math.min(1, d.x / L * 1.6)), Math.max(-1, Math.min(1, d.y / L * 1.6))];
    }
    // Tempo der Auf-und-ab-Bewegung: daraus Strecken, Stauchen und das Nachschwingen von Ohren, Flügeln und Cappie
    const vel = (hb(t + .02) - hb(t - .02)) / .04, h = hb(t), pre = o.hop != null ? Math.max(0, 1 - Math.abs(t - o.hop + .12) / .12) : 0;
    const land = o.hop != null ? Math.max(0, 1 - Math.abs(t - o.hop - .7) / .12) : 0, ground = bounce ? Math.max(0, 1 - h / .06) * (o.hop != null && mood !== 'wow' && mood !== 'happy' ? 0 : 1) : 0;
    const q = Math.max(ground, pre, land), str = Math.min(.14, Math.abs(vel) * .06);
    const sy = o.squash === false ? 1 : 1 + mixv(0, str * (1 - q) - .17 * q, k), sx = 1 / Math.sqrt(sy);
    wl += vel * .12; wr -= vel * .12;
    wings[0].rotation.z = mixv(-.25, wl, k); wings[1].rotation.z = mixv(.25, wr, k); wings[1].rotation.y = mood === 'think' ? mixv(0, -1.1, k) : 0;
    rig.position.y = mixv(0, bob + lift + hopH(t), k) + (sy - 1) * 1.68; rig.scale.set(sx, sy, sx);   // Füße bleiben beim Stauchen am Boden
    cap.rotation.z = -.1 - vel * .05; cap.rotation.x = -.08 + Math.min(0, vel) * -.04; feet.forEach(f => f.rotation.x = mood === 'fly' ? mixv(0, .6, k) : 0);
    rig.rotation.set(mixv(0, lean, k), mixv(0, turn, k), mixv(0, tilt, k));
    ears.forEach((e, i) => e.rotation.z = -(i ? 1 : -1) * (.62 + Math.sin(t * 3 + i) * .05 + wowF * .2 - vel * .1 + q * .15));
    U.smile.visible = wowF * k < .5; U.open.visible = wowF * k >= .5;
    // automatisches Blinzeln (zweimal kurz hintereinander alle paar Sekunden, gleiche Zeiten bei jedem Render)
    const ph = (t + 1.3) % 3.7, bl = o.blink === false ? 0 : clamp01(Math.max(1 - Math.abs(ph - .1) / .1, 0));
    U.eyes.forEach(e => {
      const { lid, lash, happy, r } = e.userData, h = happyF * k > .5, b = h ? 0 : bl;
      e.scale.setScalar(1 + wowF * k * .18);
      e.userData.look.position.set(look[0] * r * .2 - e.userData.s * r * .06, look[1] * r * .2 - r * .04, 0);
      lid.visible = b > .02 || h; lash.visible = b > .85; happy.visible = h;
      const sl = sleepF * k * (o.lid ?? (.55 + .3 * Math.max(0, Math.sin(t * 1.1)))), kk = h ? 1 : Math.max(b, sl);
      lid.visible = kk > .02; lash.visible = kk > .85;
      lid.scale.set(1, Math.max(kk, .02) * 1.08, .7); lid.position.y = r * 1.2 * (1 - kk);
    });
    return grp;
  };
  grp.pose(0);
  return grp;
}

// Rendert die Bühne und gibt die durchsichtige 3D-Ebene zurück (zeichnen mit g.drawImage(ebene, 0, 0, 1080, 1920))
// Die Pixel werden direkt ausgelesen und in eine normale 2D-Fläche kopiert: das ist mit Software-Grafik
// viel schneller, als die WebGL-Fläche selbst ins Video-Canvas zu zeichnen.
const gl = renderer.getContext(), PIX = new Uint8Array(RW * RH * 4), out = document.createElement('canvas'); out.width = RW; out.height = RH;
const octx = out.getContext('2d', { willReadFrequently: true }), IMG = octx.createImageData(RW, RH), ROW = RW * 4;
function render(st) {
  renderer.toneMapping = st.kino ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.toneMappingExposure = st.belichtung ?? 1.05;
  renderer.render(st.scene, st.cam);
  gl.readPixels(0, 0, RW, RH, gl.RGBA, gl.UNSIGNED_BYTE, PIX);
  for (let y = 0; y < RH; y++) IMG.data.set(PIX.subarray((RH - 1 - y) * ROW, (RH - y) * ROW), y * ROW);   // WebGL liefert die Zeilen von unten nach oben
  // WebGL liefert vormultiplizierte Farben, ImageData erwartet gerade Farben
  const d = IMG.data; for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a && a < 255) { const f = 255 / a; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } }
  octx.putImageData(IMG, 0, 0); return out;
}

window.FX3D = { THREE, stage, toon, solid, paintFaces, jitter, planet, moon, rock, crystal, paperStack, ring, figure, eula, render, canvas: out, rng, licht, glanz, schatten };
envLaden.then(() => { if (window.__ready3d) window.__ready3d(); });
