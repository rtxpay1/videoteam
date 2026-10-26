# Stillstand-Check: prüft jede Sekunde eines Videos auf sichtbare Bewegung.
# Aufruf: python3 stillcheck.py <video.mp4> [schwelle]   ->  listet ruhige Sekunden, Exit-Code 1 wenn welche gefunden
# Zusätzlich AUFTAKT-Check: In den ersten 5 Sekunden muss sich jede Sekunde mindestens 15 % des Bildes bewegen
# (Anteil der Pixel, die sich von Bild zu Bild sichtbar ändern). Sonst wirkt der Anfang wie ein Standbild und die Leute wischen weg.
import subprocess, sys
f = sys.argv[1]; TH = float(sys.argv[2]) if len(sys.argv) > 2 else 1.2
w, h, fps = 108, 192, 10
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-vf', f'fps={fps},scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
n = len(raw) // (w * h); fr = [raw[i * w * h:(i + 1) * w * h] for i in range(n)]
diff = [0.0] + [sum(abs(a - b) for a, b in zip(fr[i], fr[i - 1])) / (w * h) for i in range(1, n)]
AUFTAKT, MIN_COV = 5, 15.0
cov = [0.0] + [100 * sum(1 for a, b in zip(fr[i], fr[i - 1]) if abs(a - b) > 10) / (w * h) for i in range(1, n)]
lahm = [(sec, round(sum(cov[sec * fps + 1:(sec + 1) * fps]) / max(1, len(cov[sec * fps + 1:(sec + 1) * fps])), 1)) for sec in range(min(AUFTAKT, int(n / fps)))]
lahm = [x for x in lahm if x[1] < MIN_COV]
still = []
for sec in range(int(n / fps)):
    m = max(diff[sec * fps + 1:(sec + 1) * fps] or [0])
    if m < TH: still.append((sec, round(m, 2)))
print('Sekunden geprüft:', int(n / fps), '| ruhig:', still if still else 'keine')
print(f'Auftakt (erste {AUFTAKT} s, mind. {MIN_COV:.0f} % Bewegung je Sekunde):', ('zu wenig Bewegung in Sekunde ' + ', '.join(f'{s} ({c} %)' for s, c in lahm)) if lahm else 'ok')
sys.exit(1 if still or lahm else 0)
