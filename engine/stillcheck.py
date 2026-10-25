# Stillstand-Check: prüft jede Sekunde eines Videos auf sichtbare Bewegung.
# Aufruf: python3 stillcheck.py <video.mp4> [schwelle]   ->  listet ruhige Sekunden, Exit-Code 1 wenn welche gefunden
import subprocess, sys
f = sys.argv[1]; TH = float(sys.argv[2]) if len(sys.argv) > 2 else 1.2
w, h, fps = 108, 192, 10
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-vf', f'fps={fps},scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
n = len(raw) // (w * h); fr = [raw[i * w * h:(i + 1) * w * h] for i in range(n)]
diff = [0.0] + [sum(abs(a - b) for a, b in zip(fr[i], fr[i - 1])) / (w * h) for i in range(1, n)]
still = []
for sec in range(int(n / fps)):
    m = max(diff[sec * fps + 1:(sec + 1) * fps] or [0])
    if m < TH: still.append((sec, round(m, 2)))
print('Sekunden geprüft:', int(n / fps), '| ruhig:', still if still else 'keine')
sys.exit(1 if still else 0)
