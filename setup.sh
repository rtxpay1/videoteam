#!/bin/bash
# Baut das Studio in einer frischen Sitzung wieder auf (ca. 5–10 Minuten).
# Braucht Netzwerkzugriff auf: download.pytorch.org, pypi.org, huggingface.co, *.hf.co
set -e
cd "$(dirname "$0")"
mkdir -p wheels
for w in torch-2.6.0%2Bcpu-cp313-cp313-linux_x86_64.whl torchaudio-2.6.0%2Bcpu-cp313-cp313-linux_x86_64.whl; do
  f="wheels/$(python3 -c "import urllib.parse;print(urllib.parse.unquote('$w'))")"
  [ -f "$f" ] || curl -sSL -o "$f" "https://download.pytorch.org/whl/cpu/$w"
done
[ -d tts-env ] || python3 -m venv tts-env
./tts-env/bin/pip install -q wheels/torch-2.6.0+cpu-*.whl wheels/torchaudio-2.6.0+cpu-*.whl
./tts-env/bin/pip install -q "setuptools<81" chatterbox-tts==0.1.7 faster-whisper==1.2.1
# Sprachmodell einmal vorladen (kommt von Hugging Face)
./tts-env/bin/python -c "from chatterbox.mtl_tts import ChatterboxMultilingualTTS; ChatterboxMultilingualTTS.from_pretrained(device='cpu')"
# Spracherkennung für die Satzprüfung vorladen
./tts-env/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
echo "Studio bereit."
