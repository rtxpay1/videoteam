# Stimm-Labor für den Stimm-Agenten: spricht dieselben Testsätze mit Einstellung A und B ein und misst beide.
# Aufruf: tts-env/bin/python engine/voicelab.py <ausgabeordner> '<json A>' '<json B>' < saetze.txt
#   A/B z. B. '{"EXAG": 2.3, "CFGW": 0.18, "TEMP": 0.8}'
# Ergebnis: <ordner>/a.wav, <ordner>/b.wav (Sätze hintereinander) und <ordner>/werte.json mit
#   score (Anteil richtig verstandener Wörter), conf (mittlere Sicherheit der Spracherkennung je Wort),
#   wps (Wörter pro Sekunde), dyn (Lautstärke-Schwankung in dB: höher = lebendiger), dur (Sekunden)
import json, os, re, subprocess, sys, torch, torchaudio
HERE = os.path.dirname(__file__)
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
A, B = json.loads(sys.argv[2]), json.loads(sys.argv[3])
lines = [l.strip() for l in sys.stdin if l.strip()]
from faster_whisper import WhisperModel
asr = WhisperModel('small', device='cpu', compute_type='int8')
res = {}
for name, cfg in (('a', A), ('b', B)):
    d = os.path.join(out, name); os.makedirs(d, exist_ok=True)
    env = dict(os.environ, **{k: str(v) for k, v in cfg.items()}, CHECK='0')
    subprocess.run([sys.executable, os.path.join(HERE, 'tts.py'), d], input='\n'.join(lines), text=True, env=env, check=True, capture_output=True)
    parts = [torchaudio.load(os.path.join(d, f's{i}.wav')) for i in range(1, len(lines) + 1)]
    sr = parts[0][1]; gap = torch.zeros(1, int(sr * .5))
    wav = torch.cat([x for w, _ in parts for x in (w, gap)], dim=1); torchaudio.save(os.path.join(out, f'{name}.wav'), wav, sr)
    pcm = torchaudio.functional.resample(wav.mean(0), sr, 16000).numpy().astype('float32')
    segs, _ = asr.transcribe(pcm, language='de', beam_size=1, word_timestamps=True)
    ws = [w for s in segs for w in s.words]
    want = re.findall(r'[a-zäöüß]+', ' '.join(lines).lower()); heard = re.findall(r'[a-zäöüß]+', ' '.join(w.word for w in ws).lower())
    score = sum(1 for w in want if w in heard) / max(1, len(want))
    frames = wav[0].unfold(0, int(sr * .05), int(sr * .05)); db = 20 * torch.log10(frames.pow(2).mean(1).sqrt() + 1e-6); db = db[db > db.max() - 40]
    dur = wav.shape[1] / sr
    res[name] = {'settings': cfg, 'score': round(score, 3), 'conf': round(sum(w.probability for w in ws) / max(1, len(ws)), 3), 'wps': round(len(want) / dur, 2), 'dyn': round(float(db.std()), 2), 'dur': round(dur, 2)}
json.dump(res, open(os.path.join(out, 'werte.json'), 'w'), indent=1)
print(json.dumps(res, ensure_ascii=False))
