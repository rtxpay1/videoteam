#!/bin/bash
# Ganze Produktion nach der Stimme: produce.sh <projektordner> <name>
#   Timing -> Musik & Effekte -> Mix -> Probe-Render mit Stillstand-Check -> Bild rendern -> Schnitt -> Web-Export -> Stillstand-Check
set -e
cd /home/user/videoteam
d="$1"; n="$2"
# Ende-Marke: $d/produce.exit enthält am Schluss den Exit-Code (0 = fertig). Darauf warten, nicht auf pgrep.
rm -f "$d/produce.exit"; trap 'echo $? > "$d/produce.exit"' EXIT
bash engine/check.sh
python3 engine/timing.py "$d" > /dev/null
# genaue Wort-Zeiten für die Untertitel (Spracherkennung)
./tts-env/bin/python engine/words.py "$d"
# jedes Ankerwort (ph, wort, aufWort) muss gesprochen werden, sonst käme das Element bei 0 s
python3 engine/ankercheck.py "$d"
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
