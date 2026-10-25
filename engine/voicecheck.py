# Findet Problemwörter in fertigen Stimmspuren: Wörter, die die Spracherkennung nur unsicher erkennt
# oder anders schreibt als im Skript. Kandidaten für engine/aussprache.json.
# Aufruf: tts-env/bin/python engine/voicecheck.py <stimme.(wav|webm)> <skript.txt> [weitere Paare ...]
# Ausgabe (JSON): [{"wort": ..., "gehoert": ..., "sicherheit": ..., "datei": ...}, ...]
import json, re, sys, difflib, subprocess, tempfile, os, torchaudio
from faster_whisper import WhisperModel
asr = WhisperModel('small', device='cpu', compute_type='int8')
norm = lambda w: re.sub(r'[^a-zäöüß0-9]', '', w.lower())
NUM = re.compile(r'(null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zig|ßig|hundert|tausend|million|milliard)')
found = []
args = sys.argv[1:]
for audio, script in zip(args[::2], args[1::2]):
    tmp = tempfile.mktemp(suffix='.wav'); subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', audio, '-ac', '1', '-ar', '16000', tmp], check=True)
    wav, sr = torchaudio.load(tmp); os.remove(tmp)
    segs, _ = asr.transcribe(wav[0].numpy().astype('float32'), language='de', beam_size=5, word_timestamps=True)
    heard = [(norm(w.word), w.word.strip(), w.probability) for s in segs for w in s.words if norm(w.word)]
    text = re.sub(r'^\[[+\-=]\]\s*', '', open(script, encoding='utf-8').read(), flags=re.M)
    want = [w for w in text.split() if norm(w)]
    sm = difflib.SequenceMatcher(a=[norm(w) for w in want], b=[h[0] for h in heard], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == 'equal':
            for k in range(a1 - a0):
                if heard[b0 + k][2] < .45 and len(heard[b0 + k][0]) > 3: found.append({'wort': want[a0 + k], 'gehoert': heard[b0 + k][1], 'sicherheit': round(heard[b0 + k][2], 2), 'datei': audio})
        elif op == 'replace':
            for k in range(a0, a1):
                w = want[k]
                if len(norm(w)) > 3 and not NUM.search(norm(w)): found.append({'wort': w, 'gehoert': ' '.join(h[1] for h in heard[b0:b1]), 'sicherheit': 0, 'datei': audio})
print(json.dumps(found, ensure_ascii=False, indent=1))
