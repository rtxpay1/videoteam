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
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';
import { Sky } from './vendor/jsm/objects/Sky.js';

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
  // die Hausstil-Lampen der Bühne (für Toon-Material gedacht) dämpfen, sonst wirkt echtes Material überbelichtet
  if (!st.gedaempft) { st.scene.traverse(l => { if (l.isLight) l.intensity *= o.lampen ?? .3; }); st.gedaempft = true; }
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


// ---------- Hochwertige Bausteine (statt nackter Kisten und Zylinder) ----------
// Grundsatz: Hauptobjekte nie aus einer einzigen Grundform. Abgerundete Kanten, mehrere Teile, echtes Material,
// ein Set mit Tiefe (vorne, Mitte, hinten, Nebel) und eine Kamera, die sich durch den Raum bewegt.

// Kiste mit abgerundeten Kanten (r = Rundung). Fängt Licht an den Kanten und wirkt sofort hochwertiger als BoxGeometry.
function rund(w, h, d, r = .15, mat = glanz(0xcccccc)) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat); }

// Detailliertes Auto (ca. 4,4 lang, Front zeigt nach +x). Lack mit Klarlack, getönte Scheiben, Felgen mit Speichen,
// Scheinwerfer, Rückleuchten, Spiegel, Türfugen. o.farbe, o.licht (0..1 Scheinwerfer).
// Teile zum Animieren: auto.tuer (Fahrertür, dreht um ihre vordere Kante: auto.tuer.rotation.y), auto.scheibe (Seitenscheibe Fahrer,
// auto.scheibe.visible = false nach dem Einschlagen), auto.raeder (dreht um z), auto.innen (Platz für Eula: auto.innen.add(eula)).
function auto(o = {}) {
  const g = new THREE.Group(), lack = glanz(o.farbe ?? 0xd8283c, { rau: .28, lack: 1 }), dunkel = glanz(0x1a1c24, { rau: .6, lack: 0 });
  const glas = new THREE.MeshPhysicalMaterial({ color: 0x2a4a68, metalness: .2, roughness: .04, clearcoat: 1, transparent: true, opacity: o.glas ?? .5, depthWrite: false, side: THREE.DoubleSide });
  const chrom = glanz(0xe8ecf4, { metall: 1, rau: .18 });
  const unten = rund(4.4, .85, 2, .32, lack); unten.position.y = .78; g.add(unten);
  const haube = rund(1.3, .3, 1.86, .14, lack); haube.position.set(1.45, 1.18, 0); haube.rotation.z = -.08; g.add(haube);
  // Fahrgastraum: Dach plus vier Scheiben, innen offen
  const dach = rund(2.2, .14, 1.7, .07, lack); dach.position.set(-.35, 2.02, 0); g.add(dach);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const p = rund(.17, .84, .17, .07, lack); p.position.set(-.35 + sx * 1.02 + (sx > 0 ? -.12 : .05), 1.62, sz * .8); p.rotation.z = sx > 0 ? .38 : -.2; g.add(p); });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.0), glas); front.position.set(.75, 1.62, 0); front.rotation.set(0, Math.PI / 2, .38); g.add(front);
  const heck = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .9), glas); heck.position.set(-1.42, 1.6, 0); heck.rotation.set(0, -Math.PI / 2, -.2); g.add(heck);
  const seite = z => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, .72), glas); m.position.set(-.35, 1.6, z); if (z < 0) m.rotation.y = Math.PI; g.add(m); return m; };
  seite(-.86); const scheibeF = seite(.86);
  // Chromleiste unter den Fenstern und Fensterrahmen: Glas liest sich als Glas
  [-.9, .9].forEach(z => { const l = rund(2.3, .05, .05, .02, chrom); l.position.set(-.3, 1.22, z); g.add(l); const t = rund(2.1, .05, .05, .02, chrom); t.position.set(-.35, 1.97, z); g.add(t); });
  const innenR = rund(2.0, .5, 1.6, .1, dunkel); innenR.position.set(-.4, 1.1, 0); g.add(innenR);
  // Fahrertür (vorne links, zur Kamera): eigene Gruppe mit Drehpunkt an der vorderen Kante
  const tuer = new THREE.Group(); tuer.position.set(.6, 0, 1.0); g.add(tuer);
  const tb = rund(1.5, .8, .08, .04, lack); tb.position.set(-.75, .8, .02); tuer.add(tb);
  const griff = rund(.28, .06, .06, .03, chrom); griff.position.set(-1.25, 1.02, .08); tuer.add(griff);
  const fuge = new THREE.Mesh(new THREE.BoxGeometry(.02, .78, .02), dunkel); fuge.position.set(-.05, .8, .07); tuer.add(fuge);
  const fuge2 = fuge.clone(); fuge2.position.x = -1.48; tuer.add(fuge2);
  // Räder: Reifen, Felge, 5 Speichen, Radkasten
  const raeder = [[1.35, 1], [1.35, -1], [-1.35, 1], [-1.35, -1]].map(([x, s]) => {
    const r = new THREE.Group(); r.position.set(x, .45, s * .95);
    const reifen = new THREE.Mesh(new THREE.TorusGeometry(.34, .13, 12, 32), glanz(0x15161a, { rau: .85, lack: 0 })); r.add(reifen);
    const felge = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .14, 32), chrom); felge.rotation.x = Math.PI / 2; r.add(felge);
    for (let k = 0; k < 5; k++) { const sp = rund(.05, .44, .05, .02, dunkel); sp.rotation.z = k * Math.PI * 2 / 5; sp.position.z = s * .08; r.add(sp); }
    const nabe = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .18, 16), chrom); nabe.rotation.x = Math.PI / 2; r.add(nabe);
    g.add(r); return r;
  });
  // Lichter, Grill, Stoßstangen, Spiegel
  const scheinw = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: o.licht ?? .8 });
  [-1, 1].forEach(s => {
    const l = rund(.12, .2, .42, .06, scheinw); l.position.set(2.18, .98, s * .62); g.add(l);
    const r = rund(.1, .18, .38, .05, new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xc00010, emissiveIntensity: .6 })); r.position.set(-2.19, 1.0, s * .65); g.add(r);
    const sp = rund(.26, .14, .1, .04, lack); sp.position.set(.62, 1.42, s * 1.05); g.add(sp);
  });
  const grill = rund(.08, .22, 1.0, .05, dunkel); grill.position.set(2.2, .82, 0); g.add(grill);
  [2.22, -2.22].forEach(x => { const b = rund(.16, .2, 2.02, .08, dunkel); b.position.set(x, .5, 0); g.add(b); });
  const innen = new THREE.Group(); innen.position.set(-.1, 1.2, .1); g.add(innen);
  g.tuer = tuer; g.scheibe = scheibeF; g.raeder = raeder; g.innen = innen; g.lack = lack;
  return g;
}

// Wasseroberfläche mit echten Wellen (Gitter, Höhe aus mehreren Sinuswellen) und Spiegelung der Lichtstimmung.
// w × d Fläche, o.farbe, o.tiefe (Deckkraft 0..1). Pro Bild: wasser.welle(t, staerke)
function wasser(w = 40, d = 40, o = {}) {
  const geo = new THREE.PlaneGeometry(w, d, 96, 96); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: o.farbe ?? 0x0e3c5a, roughness: .22, metalness: 0, clearcoat: 0, specularIntensity: o.spiegel ?? .35, transparent: true, opacity: o.tiefe ?? .92, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: o.spiegel ?? .35 });
  const m = new THREE.Mesh(geo, mat), pos = geo.attributes.position, base = Float32Array.from(pos.array);
  m.welle = (t, a = 1) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      pos.array[i * 3 + 1] = a * (.18 * Math.sin(x * .55 + t * 1.6) + .12 * Math.sin(z * .7 - t * 1.3) + .06 * Math.sin((x + z) * 1.6 + t * 2.7) + .03 * Math.sin(x * 3.1 - z * 2.3 + t * 4));
    }
    pos.needsUpdate = true; geo.computeVertexNormals(); return m;
  };
  return m.welle(0);
}
// Aufsteigende Luftblasen (glänzend, durchsichtig). Bereich [bx, by, bz] um den Ursprung, n Stück. Pro Bild: blasen.steigen(t)
function blasen(n = 60, b = [6, 8, 4], seed = 5) {
  const r = rng(seed), geo = new THREE.SphereGeometry(1, 16, 12), mat = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: .02, clearcoat: 1, transparent: true, opacity: .5, depthWrite: false });
  const m = new THREE.InstancedMesh(geo, mat, n), P = Array.from({ length: n }, () => ({ x: (r() - .5) * b[0], y: r() * b[1], z: (r() - .5) * b[2], s: .04 + r() * .14, v: .8 + r() * 1.6, ph: r() * 6.28 })), M = new THREE.Matrix4();
  m.steigen = t => { P.forEach((q, i) => { const y = (q.y + t * q.v) % b[1], w = Math.sin(t * 3 + q.ph) * .15; M.makeScale(q.s * (1 + w * .3), q.s * (1 - w * .3), q.s); M.setPosition(q.x + Math.sin(t * 2 + q.ph) * .2, y - b[1] / 2, q.z); m.setMatrixAt(i, M); }); m.instanceMatrix.needsUpdate = true; return m; };
  return m.steigen(0);
}
// Echter Himmel (Sonnenstand, Dunst) als Hintergrund der Bühne. o.sonne [Höhe in Grad, Richtung in Grad], o.dunst
function himmel(st, o = {}) {
  const sky = new Sky(); sky.scale.setScalar(4000); const u = sky.material.uniforms;
  u.turbidity.value = o.dunst ?? 4; u.rayleigh.value = o.rayleigh ?? 1.6; u.mieCoefficient.value = .005; u.mieDirectionalG.value = .8;
  const [hoehe, richtung] = o.sonne || [12, 200], phi = THREE.MathUtils.degToRad(90 - hoehe), th = THREE.MathUtils.degToRad(richtung);
  u.sunPosition.value.setFromSphericalCoords(1, phi, th); st.scene.add(sky); st.kino = true; st.himmel = sky; return sky;
}
// Nebel für Tiefe: Dinge weiter hinten verblassen in der Farbe (Unterwasser: blau, Himmel: hellblau)
function nebel(st, farbe = 0x8fb8d8, nah = 20, fern = 120) { st.scene.fog = new THREE.Fog(farbe, nah, fern); return st; }
// Kamerafahrt wie im Film: Stationen [{ t, pos: [x,y,z], ziel: [x,y,z], fov }] werden weich verbunden,
// dazu ein leichtes Handkamera-Atmen (o.hand, Standard .05). Pro Bild: FX3D.kamera(stage, t, stationen)
function kamera(st, t, keys, o = {}) {
  let i = 0; while (i < keys.length - 1 && t >= keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k0 = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const k = k0 < .5 ? 4 * k0 ** 3 : 1 - (-2 * k0 + 2) ** 3 / 2, L = (u, v) => u.map((x, j) => x + (v[j] - x) * k), h = o.hand ?? .05;
  const p = L(a.pos, b.pos), z = L(a.ziel || [0, 0, 0], b.ziel || a.ziel || [0, 0, 0]);
  st.cam.position.set(p[0] + Math.sin(t * 1.3) * h, p[1] + Math.sin(t * 1.7 + 1) * h, p[2]); st.cam.lookAt(z[0], z[1], z[2]);
  const fov = (a.fov ?? st.cam.fov) + ((b.fov ?? a.fov ?? st.cam.fov) - (a.fov ?? st.cam.fov)) * k; if (fov !== st.cam.fov) { st.cam.fov = fov; st.cam.updateProjectionMatrix(); }
  return st;
}
// Boden mit weichem Verlauf zum Horizont (Gras, Sand, Asphalt, Seegrund). o.farbe, o.rand, r = Radius
function boden(r = 60, o = {}) {
  const geo = new THREE.CircleGeometry(r, 64, 0, Math.PI * 2); geo.rotateX(-Math.PI / 2);
  const c1 = C(o.farbe ?? 0x6a8a4a), c2 = C(o.rand ?? 0x3a4a5a), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getZ(i)) / r; cc.copy(c1).lerp(c2, Math.min(1, d * 1.3)); col.set([cc.r, cc.g, cc.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
}

// ---------- Flugzeug, Kabine, Elefant, Wolken, Berg (Hochwertig-Baukasten) ----------
// Extrudierte Fläche aus Punkten [[x, y], ...] mit runden Kanten (Flügel, Leitwerk)
function platte(pts, dicke, mat) {
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: dicke, bevelEnabled: true, bevelThickness: dicke * .4, bevelSize: dicke * .4, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -dicke / 2); return new THREE.Mesh(geo, mat);
}
// Passagierjet (ca. 15 lang, Nase zeigt nach +x). o.farbe (Lackstreifen), o.logo (Farbe des Logos am Leitwerk).
// Teile: flz.tuer (vordere linke Tür auf der +z-Seite, Gruppe), flz.fenster (Fensterreihen), flz.fans (Triebwerksfächer, drehen um x).
function flugzeug(o = {}) {
  const g = new THREE.Group(), weiss = glanz(0xf4f6fa, { rau: .25, lack: 1 }), streifen = glanz(o.farbe ?? 0x1e4fb8, { rau: .3, lack: 1 });
  const grau = glanz(0xb8c0cc, { metall: .6, rau: .3 }), dunkel = glanz(0x16202e, { rau: .1, lack: 1 }), chrom = glanz(0xe8ecf4, { metall: 1, rau: .15 });
  const R = 1.1, L = 10;
  const rumpf = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 48, 1), weiss); rumpf.rotation.z = Math.PI / 2; g.add(rumpf);
  const nase = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), weiss); nase.rotation.z = -Math.PI / 2; nase.scale.set(1, 1.7, 1); nase.position.x = L / 2; g.add(nase);
  const heck = new THREE.Mesh(new THREE.CylinderGeometry(R, .28, 4, 48, 1), weiss); heck.rotation.z = Math.PI / 2; heck.position.set(-L / 2 - 2, .45, 0); heck.scale.set(1, 1, 1); g.add(heck);
  const bauch = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.005, R * 1.005, L, 48, 1, true, Math.PI * .62, Math.PI * .76), streifen); bauch.rotation.z = Math.PI / 2; g.add(bauch);
  // Cockpitfenster
  [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { const w = rund(.32, .22, .06, .05, dunkel); w.position.set(L / 2 + .95 + k * .32, .55 - k * .06, s * (.62 - k * .17)); w.rotation.y = s * (.9 + k * .35); w.rotation.z = -.35; g.add(w); } });
  // Fensterreihen auf beiden Seiten
  const fenster = [];
  [-1, 1].forEach(s => { for (let k = 0; k < 26; k++) { const x = L / 2 - 1.6 - k * .34; if (x < -L / 2 + .3) break; const w = rund(.16, .24, .05, .06, dunkel); w.position.set(x, .32, s * (R - .005)); g.add(w); fenster.push(w); } });
  // vordere linke Tür (Seite +z) mit Fuge, Griff und Bullauge
  const tuer = new THREE.Group(); tuer.position.set(L / 2 - .9, .05, R + .002); g.add(tuer);
  const fuge = new THREE.Mesh(new THREE.TorusGeometry(1, .018, 6, 40), dunkel); fuge.scale.set(.42, .82, 1); tuer.add(fuge);
  const bull = rund(.16, .2, .04, .06, dunkel); bull.position.set(0, .3, .01); tuer.add(bull);
  const griff = rund(.26, .05, .05, .02, chrom); griff.position.set(.08, -.1, .03); tuer.add(griff);
  // Flügel (gepfeilt) mit Winglet, Triebwerk mit Fächer
  const fans = [];
  [-1, 1].forEach(s => {
    const fl = platte([[0, 0], [2.6, 0], [-.6, 6.8], [-1.6, 6.8]], .16, weiss); fl.rotation.x = s * Math.PI / 2; fl.position.set(.9, -.55, 0); g.add(fl);   // Spannweite zeigt nach s·z
    const wl = platte([[0, 0], [.6, 0], [.2, 1], [-.1, 1]], .08, streifen); wl.position.set(-1.6, -.55, s * 6.8); g.add(wl);
    const tw = new THREE.Group(); tw.position.set(1.4, -1.25, s * 2.3); g.add(tw);
    const gond = new THREE.Mesh(new THREE.CylinderGeometry(.5, .44, 1.8, 40, 1, true), grau); gond.material.side = THREE.DoubleSide; gond.rotation.z = Math.PI / 2; tw.add(gond);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.5, .06, 10, 40), chrom); lip.rotation.y = Math.PI / 2; lip.position.x = .9; tw.add(lip);
    const fan = new THREE.Group(); fan.position.x = .75; tw.add(fan); fans.push(fan);
    const nabe = new THREE.Mesh(new THREE.ConeGeometry(.16, .35, 24), chrom); nabe.rotation.z = -Math.PI / 2; nabe.position.x = .1; fan.add(nabe);
    for (let k = 0; k < 14; k++) { const b = rund(.04, .42, .1, .02, glanz(0x2a3040, { metall: .8, rau: .3 })); b.position.y = .25; const h = new THREE.Group(); h.add(b); h.rotation.x = k * Math.PI * 2 / 14; b.rotation.y = .5; fan.add(h); }
    const py = rund(1.2, .5, .12, .05, weiss); py.position.set(1.0, -.85, s * 2.3); g.add(py);
    const hoehe = platte([[0, 0], [1.4, 0], [.2, 2.4], [-.4, 2.4]], .1, weiss); hoehe.position.set(-L / 2 - 2.6, .55, 0); hoehe.rotation.x = s * Math.PI / 2; g.add(hoehe);
  });
  // Seitenleitwerk mit Logo (goldener Token)
  const seite = platte([[0, 0], [2.4, 0], [.6, 3.2], [-.3, 3.2]], .14, streifen); seite.position.set(-L / 2 - 3.2, 1.1, 0); g.add(seite);
  [-1, 1].forEach(s => { const logo = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .04, 32), glanz(o.logo ?? 0xffc23a, { metall: 1, rau: .25 })); logo.rotation.x = Math.PI / 2; logo.position.set(-L / 2 - 2.5, 2.4, s * .12); g.add(logo); });
  g.tuer = tuer; g.fenster = fenster; g.fans = fans;
  return g;
}
// Kabine von innen (Gang entlang -z, Blick nach +z zur Tür am Ende). Sitzreihen links und rechts, Gepäckfächer, Fenster mit Himmel,
// Deckenlicht. o.reihen, o.himmel (Farbe hinter den Fenstern). Teile: kab.tuer (Tür am Gangende, siehe tuerInnen), kab.fenster
function sitz(stoff = 0x1e2c5a) {
  const g = new THREE.Group(), m = glanz(stoff, { rau: .85, lack: 0 }), hell = glanz(0xe8ecf2, { rau: .6, lack: 0 }), arm = glanz(0x9aa2ae, { metall: .5, rau: .35 });
  const kissen = rund(.9, .2, .85, .08, m); kissen.position.y = .45; g.add(kissen);
  const lehne = rund(.9, 1.1, .2, .1, m); lehne.position.set(0, 1.05, -.38); lehne.rotation.x = -.12; g.add(lehne);
  const kopf = rund(.62, .3, .06, .04, hell); kopf.position.set(0, 1.45, -.27); kopf.rotation.x = -.12; g.add(kopf);
  [-1, 1].forEach(s => { const a = rund(.08, .1, .7, .04, arm); a.position.set(s * .48, .72, -.02); g.add(a); });
  const fuss = rund(.7, .35, .1, .04, arm); fuss.position.set(0, .18, 0); g.add(fuss);
  return g;
}
function tuerInnen() {
  const g = new THREE.Group(), weiss = glanz(0xe6e9ee, { rau: .45, lack: .3 }), chrom = glanz(0xe8ecf4, { metall: 1, rau: .15 }), dunkel = glanz(0x2a3446, { rau: .5, lack: 0 });
  const blatt = rund(1.8, 3.2, .25, .2, weiss); blatt.position.y = 1.6; g.add(blatt);
  const rahmen = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 10, 48), dunkel); rahmen.scale.set(1.02, 1.72, 1); rahmen.position.set(0, 1.6, .02); g.add(rahmen);
  const bull = new THREE.Mesh(new THREE.CircleGeometry(.22, 32), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6ab8f0, emissiveIntensity: .8 })); bull.position.set(0, 2.5, .135); g.add(bull);
  const bullR = new THREE.Mesh(new THREE.TorusGeometry(.24, .04, 10, 32), chrom); bullR.position.set(0, 2.5, .14); g.add(bullR);
  // großer Hebel (dreht um z an der Achse links)
  const hebel = new THREE.Group(); hebel.position.set(-.45, 1.5, .2); g.add(hebel);
  const lager = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .12, 20), chrom); lager.rotation.x = Math.PI / 2; hebel.add(lager);
  const stange = rund(.95, .1, .1, .05, chrom); stange.position.x = .48; hebel.add(stange);
  const knauf = rund(.22, .16, .16, .07, glanz(0x20242c, { rau: .4 })); knauf.position.x = .98; hebel.add(knauf);
  const schild = rund(.36, .16, .02, .03, new THREE.MeshStandardMaterial({ color: 0xe02030, emissive: 0x900010, emissiveIntensity: .4 })); schild.position.set(.4, 2.05, .14); g.add(schild);
  const rutsche = rund(1.5, .45, .3, .08, glanz(0x8a929e, { rau: .5 })); rutsche.position.set(0, .3, .22); g.add(rutsche);
  g.hebel = hebel; return g;
}
function kabine(o = {}) {
  const g = new THREE.Group(), n = o.reihen ?? 9, wand = glanz(0xb8bec9, { rau: .6, lack: .15 });
  const boden = rund(4.6, .1, n * 1.2 + 4, .04, glanz(0x2a3a6a, { rau: .9, lack: 0 })); boden.position.set(0, -.05, -n * .6 + 1); g.add(boden);
  const gang = rund(.7, .02, n * 1.2 + 4, .01, glanz(0x3a1a2a, { rau: .9, lack: 0 })); gang.position.set(0, .01, -n * .6 + 1); g.add(gang);
  [-1, 1].forEach(s => {
    const w = rund(.15, 2.6, n * 1.2 + 4, .06, wand); w.position.set(s * 2.35, 1.3, -n * .6 + 1); g.add(w);
    const fach = rund(1.0, .55, n * 1.2 + 3, .1, glanz(0xc4c9d2, { rau: .45, lack: .4 })); fach.position.set(s * 1.8, 2.7, -n * .6 + 1); fach.rotation.z = s * .15; g.add(fach);
    for (let r = 0; r < n; r++) {
      const z = -r * 1.2 - .5;
      [0, 1].forEach(k => { const st = sitz(o.stoff ?? 0x1e2c5a); st.position.set(s * (.85 + k * .95), 0, z); g.add(st); });
      const f = rund(.4, .55, .05, .16, new THREE.MeshStandardMaterial({ color: o.himmel ?? 0x8fd0ff, emissive: o.himmel ?? 0x7ac0f0, emissiveIntensity: .55 })); f.position.set(s * 2.27, 1.55, z + .2); f.rotation.y = s * Math.PI / 2; g.add(f);
    }
  });
  const decke = rund(2.6, .08, n * 1.2 + 4, .04, new THREE.MeshStandardMaterial({ color: 0xd8d2c4, emissive: 0xfff0d0, emissiveIntensity: .22 })); decke.position.set(0, 3.2, -n * .6 + 1); g.add(decke);
  const stirn = rund(4.7, 3.4, .2, .06, wand); stirn.position.set(0, 1.6, 2.6); g.add(stirn);
  const tuer = tuerInnen(); tuer.position.set(0, 0, 2.45); tuer.rotation.y = Math.PI; g.add(tuer);
  g.tuer = tuer; return g;
}
// Elefant im Hausstil (rund, freundlich), ca. 3 hoch, schaut nach +z. Teile: ele.ruessel (Gruppe, dreht um x)
function elefant(o = {}) {
  const g = new THREE.Group(), haut = glanz(o.farbe ?? 0x9aa0b4, { rau: .75, lack: .1 }), innen = glanz(0xf0a0b8, { rau: .7, lack: 0 }), weiss = glanz(0xfff8ec, { rau: .3, lack: .6 });
  const leib = new THREE.Mesh(new THREE.SphereGeometry(1.4, 40, 28), haut); leib.scale.set(1.25, 1, 1); leib.position.y = 1.9; g.add(leib);
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(.95, 40, 28), haut); kopf.position.set(0, 2.5, 1.35); g.add(kopf);
  [-1, 1].forEach(s => {
    const ohr = new THREE.Mesh(new THREE.SphereGeometry(.85, 32, 20), haut); ohr.scale.set(1, 1.15, .18); ohr.position.set(s * .95, 2.6, .95); ohr.rotation.y = s * .5; g.add(ohr);
    const oi = new THREE.Mesh(new THREE.SphereGeometry(.65, 32, 20), innen); oi.scale.set(1, 1.1, .12); oi.position.set(s * .97, 2.6, 1.02); oi.rotation.y = s * .5; g.add(oi);
    const auge = new THREE.Mesh(new THREE.SphereGeometry(.13, 20, 14), glanz(0x140a24, { rau: .1 })); auge.position.set(s * .38, 2.75, 2.15); g.add(auge);
    const glanzP = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); glanzP.position.set(s * .38 + .04, 2.8, 2.27); g.add(glanzP);
    const zahn = new THREE.Mesh(new THREE.ConeGeometry(.09, .6, 16), weiss); zahn.position.set(s * .32, 2.0, 2.0); zahn.rotation.x = 1.9; g.add(zahn);
    [-1, 1].forEach(v => { const bein = rund(.62, 1.3, .62, .3, haut); bein.position.set(s * .8, .65, v * .65); g.add(bein);
      for (let k = 0; k < 3; k++) { const z = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), weiss); z.scale.y = .6; z.position.set(s * .8 + (k - 1) * .18, .08, v * .65 + .3); g.add(z); } });
  });
  const ruessel = new THREE.Group(); ruessel.position.set(0, 2.25, 2.1); g.add(ruessel);
  const kurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.5, .35), new THREE.Vector3(0, -1.1, .4), new THREE.Vector3(0, -1.45, .75)]);
  ruessel.add(new THREE.Mesh(new THREE.TubeGeometry(kurve, 30, .2, 16), haut));
  const schw = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.4, -.25), new THREE.Vector3(0, -.8, -.2)]), 12, .06, 8), haut); schw.position.set(0, 2.2, -1.7); g.add(schw);
  g.ruessel = ruessel; return g;
}
// Wolke aus vielen weichen Kugeln (o.groesse, o.seed, o.farbe)
function wolke(o = {}) {
  const g = new THREE.Group(), r = rng(o.seed ?? 1), m = glanz(o.farbe ?? 0xffffff, { rau: .95, lack: 0 }), s = o.groesse ?? 3;
  for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(s * (.35 + r() * .3), 24, 16), m); b.position.set((r() - .5) * s * 2.2, (r() - .3) * s * .5, (r() - .5) * s * .9); b.scale.y = .75; g.add(b); }
  return g;
}
// Berg mit Schneekappe (Höhe h)
function berg(h = 6, o = {}) {
  const g = new THREE.Group();
  const fels = new THREE.Mesh(jitter(new THREE.ConeGeometry(h * .75, h, 28, 8), .1, o.seed ?? 4), glanz(o.farbe ?? 0x6a6478, { rau: .9, lack: 0 })); fels.position.y = h / 2; g.add(fels);
  const schnee = new THREE.Mesh(jitter(new THREE.ConeGeometry(h * .27, h * .36, 28, 3), .06, 9), glanz(0xf6f8ff, { rau: .6, lack: .2 })); schnee.position.y = h * .83; g.add(schnee);
  return g;
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

window.FX3D = { THREE, stage, toon, solid, paintFaces, jitter, planet, moon, rock, crystal, paperStack, ring, figure, eula, render, canvas: out, rng, licht, glanz, schatten, rund, auto, wasser, blasen, himmel, nebel, kamera, boden, platte, flugzeug, sitz, kabine, tuerInnen, elefant, wolke, berg };
envLaden.then(() => { if (window.__ready3d) window.__ready3d(); });
