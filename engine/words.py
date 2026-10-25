# Genaue Wort-Zeiten für die Untertitel: Whisper hört jeden eingesprochenen Satz (v/tN.wav aus timing.py) ab
# und liefert für jedes Wort Start und Ende. Die Zeiten werden den Wörtern aus dem Skript zugeordnet
# (Zahlen, die Whisper als Ziffern schreibt, und andere Abweichungen werden zwischen ihren Nachbarn eingepasst).
# Aufruf: tts-env/bin/python engine/words.py <projektordner>   -> ergänzt timing.json um "words": [[start, ende, wort], ...]
import json, os, re, sys, difflib, torchaudio
from faster_whisper import WhisperModel

d = sys.argv[1]
T = json.load(open(os.path.join(d, 'timing.json'), encoding='utf-8'))
norm = lambda w: re.sub(r'[^a-zäöüß0-9]', '', w.lower())
asr = WhisperModel('small', device='cpu', compute_type='int8')
words = []
for i, (s0, s1) in enumerate(T['sentences'], 1):
    script = [w for ph in T['phrases'] if s0 - .01 <= ph[0] < s1 + .01 for w in ph[2].split()]
    wav, sr = torchaudio.load(os.path.join(d, 'v', f't{i}.wav'))   # direkt als Zahlen übergeben (Whispers Datei-Leser passt nicht zur installierten PyAV-Version)
    pcm = torchaudio.functional.resample(wav.mean(0), sr, 16000).numpy().astype('float32')
    segs, _ = asr.transcribe(pcm, language='de', beam_size=1, word_timestamps=True)
    heard = [(s0 + w.start, s0 + w.end, norm(w.word)) for seg in segs for w in seg.words if norm(w.word)]
    got = [None] * len(script)
    sm = difflib.SequenceMatcher(a=[norm(w) for w in script], b=[h[2] for h in heard], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == 'equal' or (op == 'replace' and a1 - a0 == b1 - b0):
            for k in range(a1 - a0): got[a0 + k] = heard[b0 + k][:2]
        elif op == 'replace' and b1 > b0:   # z. B. „vierundsechzig Felder“ gegen „64 Felder“: Zeitspanne anteilig verteilen
            A, B = heard[b0][0], heard[b1 - 1][1]; L = [len(script[k]) + 1 for k in range(a0, a1)]; acc = A
            for k, l in zip(range(a0, a1), L): got[k] = (acc, acc + (B - A) * l / sum(L)); acc = got[k][1]
    # Lücken (nichts gehört) zwischen den Nachbarn nach Wortlänge einpassen
    k = 0
    while k < len(script):
        if got[k]: k += 1; continue
        j = k
        while j < len(script) and not got[j]: j += 1
        A = got[k - 1][1] if k else s0; B = got[j][0] if j < len(script) else s1
        L = [len(script[m]) + 1 for m in range(k, j)]; acc = A
        for m, l in zip(range(k, j), L): got[m] = (acc, acc + max(0, B - A) * l / sum(L)); acc = got[m][1]
        k = j
    words += [[round(a, 3), round(max(b, a + .08), 3), w] for (a, b), w in zip(got, script)]
T['words'] = words
json.dump(T, open(os.path.join(d, 'timing.json'), 'w'), ensure_ascii=False, indent=1)
print(len(words), 'Wörter mit genauen Zeiten')
