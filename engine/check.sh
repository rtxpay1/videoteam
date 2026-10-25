#!/bin/bash
# Schneller Vorab-Check (wenige Sekunden): Ist alles da, was die Produktion braucht?
# Läuft am Anfang von produce.sh und fix.sh, damit ein fehlendes Teil sofort auffällt und nicht erst nach Minuten.
cd /home/user/videoteam
bad=0
miss() { echo "FEHLT: $1"; bad=1; }
for t in ffmpeg ffprobe node; do command -v $t >/dev/null || miss "$t"; done
python3 -c "import numpy" 2>/dev/null || miss "numpy im System-Python (python3 -m pip install numpy)"
[ -x tts-env/bin/python ] || miss "tts-env (./setup.sh laufen lassen)"
[ -x tts-env/bin/python ] && { tts-env/bin/python -c "import torch, torchaudio, faster_whisper" 2>/dev/null || miss "torch/torchaudio/faster_whisper in tts-env"; }
node -e "require('playwright')" 2>/dev/null || miss "playwright für node"
[ $bad = 0 ] && echo "Check ok." || { echo "ABBRUCH: Studio unvollständig, erst das Fehlende installieren."; exit 3; }
