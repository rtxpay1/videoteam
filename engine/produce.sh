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
bash engine/prender.sh "$d/scene_built.html" "$d/motion.mp4" "$D" 3
ffmpeg -loglevel error -y -i "$d/motion.mp4" -i "$d/mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$d/${n}_hq.mp4"
# Bitrate so wählen, dass der Web-Export unter 19 MB bleibt
VB=$(python3 -c "print(min(2200, int(19e6*8/$D/1000 - 160)))")
ffmpeg -loglevel error -y -i "$d/motion.mp4" -i "$d/mix.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -b:v ${VB}k -maxrate $((VB*12/10))k -bufsize $((VB*2))k -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart "$d/${n}_web.mp4"
for f in voice:ton_stimme:64k mix:mix:160k; do IFS=: read a b c <<< "$f"; ffmpeg -loglevel error -y -i "$d/$a.wav" -c:a libopus -b:a $c "$d/$b.webm"; done
ffmpeg -loglevel error -y -i "$d/music.wav" -i "$d/sfx.wav" -filter_complex amix=inputs=2:normalize=0 -c:a libopus -b:a 112k "$d/ton_musik_sfx.webm"
python3 engine/stillcheck.py "$d/${n}_web.mp4" || true
echo FERTIG "$d" "$D"
