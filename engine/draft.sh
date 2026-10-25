#!/bin/bash
# Probe-Render vor dem echten Rendern: halbe Auflösung, 10 Bilder/s, parallel (ca. 1 Minute).
# Prüft jede Sekunde auf Stillstand und baut ein Übersichtsbild (1 Bild pro 4 s) zur Sichtprüfung.
# Aufruf: draft.sh <projektordner>   ->  <projekt>/draft.mp4, <projekt>/draft_sheet.jpg; Exit 1 bei ruhigen Sekunden
set -e
cd /home/user/videoteam
d="$1"
python3 engine/build.py "$d"
D=$(python3 -c "import json;print(json.load(open('$d/timing.json'))['dur'])")
DRAFT=1 bash engine/prender.sh "$d/scene_built.html" "$d/draft.mp4" "$D" 3 10
ffmpeg -loglevel error -y -i "$d/draft.mp4" -vf "fps=1/4,scale=135:-1,tile=8x2" -frames:v 1 "$d/draft_sheet.jpg"
python3 engine/stillcheck.py "$d/draft.mp4"
