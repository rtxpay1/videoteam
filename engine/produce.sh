#!/bin/bash
# Ganze Produktion nach der Stimme: produce.sh <projektordner> <name>
#   Timing -> Musik & Effekte -> Mix -> Probe-Render mit Stillstand-Check -> Bild rendern -> Schnitt -> Web-Export -> Stillstand-Check
set -e
cd /home/user/videoteam
d="$1"; n="$2"
python3 engine/timing.py "$d" > /dev/null
python3 "$d/sound_gen.py"
python3 engine/sound.py "$d"
bash engine/mix.sh "$d"
python3 engine/build.py "$d"
# Erst Probe-Render (ca. 1 Min.): bei ruhigen Sekunden abbrechen, bevor das teure echte Rendern startet
if ! bash engine/draft.sh "$d"; then
  [ -n "$FORCE" ] || { echo "ABBRUCH: Stillstand im Probe-Render, Szenen nachbessern (oder FORCE=1 setzen)"; exit 2; }
fi
D=$(python3 -c "import json;print(json.load(open('$d/timing.json'))['dur'])")
bash engine/prender.sh "$d/scene_built.html" "$d/motion.mp4" "$D" 4
bash engine/export.sh "$d" "$n"
