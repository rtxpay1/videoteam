// Rendert eine Canvas-Szene Bild für Bild zu einem Video.
// Aufruf: node render.js <scene.html> <out.mp4> <sekunden> [fps] [--frames 1.5,10,20]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const [scene, out, dur, fpsArg, flag, list] = process.argv.slice(2);
  const fps = +(fpsArg || 30), W = 1080, H = 1920;
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('Seitenfehler:', e.message));
  await page.goto('file://' + path.resolve(scene));
  await page.evaluate(() => window.ready);
  const clip = { x: 0, y: 0, width: W, height: H };

  if (flag === '--frames') {
    for (const s of list.split(',').map(Number)) {
      await page.evaluate(([t, f]) => window.renderFrame(t, f), [s, Math.round(s * fps)]);
      await page.screenshot({ path: `${out}_${s}.jpg`, type: 'jpeg', quality: 85, clip });
    }
    await browser.close(); return;
  }

  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(+dur * fps), i0 = Math.round(+(process.env.START || 0) * fps);   // START=Sekunden: nur ab dort rendern
  for (let i = i0; i < n; i++) {
    await page.evaluate(([t, f]) => window.renderFrame(t, f), [i / fps, i]);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95, clip });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`Bild ${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close();
})();
