// Rendert eine Canvas-Szene Bild für Bild zu einem Video.
// Aufruf: node render.js <scene.html> <out.mp4> <sekunden> [fps] [--frames 1.5,10,20]
// DRAFT=1: schneller Probe-Render in halber Auflösung (für Stillstand-Check und Sichtprüfung)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const [scene, out, dur, fpsArg, flag, list] = process.argv.slice(2);
  const fps = +(fpsArg || 30), W = 1080, H = 1920, DRAFT = !!process.env.DRAFT;
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DRAFT ? .5 : 1 });
  page.on('pageerror', e => console.error('Seitenfehler:', e.message));
  await page.goto('file://' + path.resolve(scene));
  await page.evaluate(() => window.ready);
  const clip = { x: 0, y: 0, width: W, height: H };
  // Bild direkt aus dem Canvas lesen statt Bildschirmfoto: viel schneller, vor allem mit 3D (WebGL)
  const grab = q => page.evaluate(q => document.getElementById('c').toDataURL('image/jpeg', q).split(',')[1], q).then(b => Buffer.from(b, 'base64'));

  if (flag === '--frames') {
    for (const s of list.split(',').map(Number)) {
      await page.evaluate(([t, f]) => window.renderFrame(t, f), [s, Math.round(s * fps)]);
      require('fs').writeFileSync(`${out}_${s}.jpg`, await grab(.85));
    }
    await browser.close(); return;
  }

  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', process.env.PRESET || (DRAFT ? 'veryfast' : 'fast'), '-crf', process.env.CRF || (DRAFT ? '26' : '17'), '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]   // Schlüsselbild jede Sekunde: fix.sh kann Stücke verlustfrei austauschen, { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(+dur * fps), i0 = Math.round(+(process.env.START || 0) * fps);   // START=Sekunden: nur ab dort rendern
  for (let i = i0; i < n; i++) {
    await page.evaluate(([t, f]) => window.renderFrame(t, f), [i / fps, i]);
    const buf = await grab(DRAFT ? .7 : .95);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`Bild ${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close();
})();
