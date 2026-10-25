#!/bin/bash
# Nachbessern ohne komplettes Neu-Rendern: rendert nur die Sekunden <von>–<bis> neu, setzt sie in motion.mp4 ein
# und macht danach Schnitt & Export (export.sh). Spart pro Korrektur rund 8 Minuten.
# Aufruf: fix.sh <projektordner> <name> <von> <bis>      (mehrere Stellen: fix.sh mehrfach aufrufen)
set -e
cd /home/user/videoteam
d="$1"; n="$2"
bash engine/check.sh
python3 engine/build.py "$d"
# Schnittpunkte auf Schlüsselbilder von motion.mp4 legen (render.js setzt jede Sekunde eins), dann ohne Neukodieren austauschen
read a b <<< "$(python3 - "$d" "$3" "$4" <<'PY'
import json, subprocess, sys
d, A, B = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
D = json.load(open(f'{d}/timing.json'))['dur']
out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-skip_frame', 'nokey', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', f'{d}/motion.mp4'], capture_output=True, text=True).stdout
keys = sorted(float(x.split(',')[0]) for x in out.split() if x.split(',')[0].strip())
a = max([k for k in keys if k <= A + 1e-3] or [0]); after = [k for k in keys if k >= B - 1e-3]; b = after[0] if after else D
print(a, b)
PY
)"
[ -n "$a" ] && [ -n "$b" ] || { echo "fix.sh: Schnittpunkte nicht gefunden"; exit 1; }
echo "Neu gerendert wird $a bis $b s"
START=$a node engine/render.js "$d/scene_built.html" "$d/.fix.mp4" "$b" 30
python3 - "$d" "$a" "$b" <<'PY'
import subprocess, sys, json
d, a, b = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); D = json.load(open(f'{d}/timing.json'))['dur']
L = []
if a > 0: L += ["file 'motion.mp4'", f"outpoint {a}"]
L += ["file '.fix.mp4'"]
if b < D - .01: L += ["file 'motion.mp4'", f"inpoint {b}"]
open(f'{d}/.fix.txt', 'w').write('\n'.join(L) + '\n')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{d}/.fix.txt', '-c', 'copy', '-movflags', '+faststart', f'{d}/.motion_fix.mp4'], check=True)
PY
rm -f "$d/.fix.txt"
mv "$d/.motion_fix.mp4" "$d/motion.mp4"; rm -f "$d/.fix.mp4"
bash engine/export.sh "$d" "$n"
