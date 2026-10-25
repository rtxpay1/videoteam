# Baut aus den eingesprochenen Sätzen die Sprachspur und eine Timing-Datei für Motion.
# Aufruf: python3 timing.py <projektordner>   (erwartet lines.txt und v/s1.wav, v/s2.wav, ...)
# Ergebnis: voice.wav und timing.json mit Satz- und Teilsatz-Zeiten
import json, re, subprocess, sys, os

LEAD, GAP, TAIL = 0.55, 0.3, 1.8
# Stimmklang: FX=tiktok (schneller, heller, knackig komprimiert) oder klassisch
FX = os.environ.get('FX', 'klassisch')
TEMPO = 1.1 if FX == 'tiktok' else 1.06
EXTRA = ',highpass=f=120,equalizer=f=3500:t=q:w=1.2:g=4,equalizer=f=250:t=q:w=1:g=-3,acompressor=threshold=-22dB:ratio=4:attack=3:release=80' if FX == 'tiktok' else ''

def run(*a): return subprocess.run(a, capture_output=True, text=True)
def dur(f): return float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f).stdout)
def pauses(f):
    out = run('ffmpeg', '-hide_banner', '-i', f, '-af', 'silencedetect=n=-38dB:d=0.14', '-f', 'null', '-').stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    return list(zip(st, en))

d = sys.argv[1]
# Betonungszeichen [+] / [-] / [=] am Zeilenanfang gelten nur für die Stimme
lines = [re.sub(r'^\[[+\-=]\]\s*', '', l.strip()) for l in open(os.path.join(d, 'lines.txt'), encoding='utf-8') if l.strip()]
parts, t, sentences, phrases = [], LEAD, [], []
for i, line in enumerate(lines, 1):
    src, out = os.path.join(d, 'v', f's{i}.wav'), os.path.join(d, 'v', f't{i}.wav')
    # Ende sanft: leise Endlaute (s, t, f, n) bleiben stehen (-58 dB, 0,14 s Rest), dann kurzes Ausblenden statt hartem Schnitt
    run('ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af',
        f'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-58dB:start_silence=0.14,afade=t=in:d=0.04,areverse,atempo={TEMPO}{EXTRA}',
        '-ar', '24000', out)
    L = dur(out)
    ps = [(a, b) for a, b in pauses(out) if a > 0.15 and b < L - 0.1]
    # gesprochenes Ende = Beginn der letzten Stille am Ende, falls vorhanden
    tail = [a for a, b in pauses(out) if b >= L - 0.1]
    spoken = tail[0] if tail else L
    sentences.append([round(t, 3), round(t + spoken, 3)])
    # Teilsätze an Satzzeichen trennen und den erkannten Pausen zuordnen
    clauses = [c.strip() for c in re.findall(r'[^.?!:,]+[.?!:,]?', line) if c.strip()]
    if len(clauses) > 1:
        # Grenzen nach Textlänge schätzen, dann auf die nächste echte Sprechpause (±0,45 s) setzen
        tot = sum(len(c) for c in clauses); acc = 0; bounds = [(0.0, 0.0)]
        for c in clauses[:-1]:
            acc += len(c); est = spoken * acc / tot
            near = [q for q in ps if abs((q[0] + q[1]) / 2 - est) < 0.45 and q[0] > bounds[-1][1]]
            q = min(near, key=lambda q: abs((q[0] + q[1]) / 2 - est)) if near else (est, est)
            bounds.append(q)
        bounds.append((spoken, spoken))
        # Mindestdauer je Teilsatz (ca. 0,07 s pro Zeichen), damit kurze Wörter lesbar bleiben
        for k in range(1, len(bounds) - 1):
            need = bounds[k - 1][1] + 0.07 * len(clauses[k - 1])
            if bounds[k][0] < need:
                bounds[k] = (min(need, spoken - 0.2), min(need, spoken - 0.2))
        for k, c in enumerate(clauses):
            phrases.append([round(t + bounds[k][1], 3), round(t + bounds[k + 1][0], 3), c])
    else:
        phrases.append([round(t, 3), round(t + spoken, 3), line])
    parts.append(out); t += L + GAP
total = t - GAP + TAIL
# Sprachspur zusammensetzen
inputs, filt = [], []
silence = lambda s: ['-f', 'lavfi', '-t', f'{s:.3f}', '-i', 'anullsrc=r=24000:cl=mono']
inputs += silence(LEAD)
for k, f in enumerate(parts):
    inputs += ['-i', f]
    inputs += silence(GAP if k < len(parts) - 1 else TAIL)
n = 1 + 2 * len(parts)
run('ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', f'concat=n={n}:v=0:a=1', os.path.join(d, 'voice.wav'))
json.dump({'dur': round(total, 3), 'sentences': sentences, 'phrases': phrases}, open(os.path.join(d, 'timing.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps({'dur': round(total, 2), 'sentences': sentences}, ensure_ascii=False))
# Hausregel: 60–70 Sekunden
if not 60 <= total <= 70: print(f'LAENGE-WARNUNG: {total:.1f} s liegt außerhalb von 60–70 s, Skript anpassen', file=sys.stderr)
