# Ankerwort-Check: Jedes Wort, auf das ein Bild-Element oder Ton wartet (ph('…'), pw('…'), wort('…'), aufWort(t, '…')),
# muss im gesprochenen Text vorkommen. Sonst erscheint das Element still und heimlich bei 0 s.
# Zählt außerdem, wie viele Einblendungen auf ein Wort gelegt sind und wie viele nur geschätzt (at(i, Anteil)).
# Aufruf: python3 engine/ankercheck.py <projektordner>   -> Exit 1, wenn ein Ankerwort fehlt
import json, os, re, sys
d = sys.argv[1]
T = json.load(open(os.path.join(d, 'timing.json'), encoding='utf-8'))
norm = lambda w: re.sub(r'[^a-zäöüß0-9]', '', w.lower())
words = [norm(w[2]) for w in T.get('words', [])]
phr = [p[2] for p in T['phrases']]
def da(a, fn):
    if fn in ('ph', 'pw') or not words: return any(a in p for p in phr)
    ks = [norm(x) for x in a.split() if norm(x)]
    return any(words[i:i + len(ks)] == ks for i in range(len(words))) or any(a in p for p in phr)
fehlt, n_wort, n_at = [], 0, 0
for f in ('scene.html', 'sound_gen.py'):
    fp = os.path.join(d, f)
    if not os.path.exists(fp): continue
    src = open(fp, encoding='utf-8').read()
    for fn, a in re.findall(r"\b(ph|pw|wort|aufWort)\((?:t,\s*)?['\"]([^'\"]+)['\"]", src):
        n_wort += f == 'scene.html'
        if not da(a, fn): fehlt.append(f'{f}: {fn}(\'{a}\')')
    if f == 'scene.html': n_at += len(re.findall(r'\bat\(\s*\d+\s*,\s*\.?\d', src))
print(f'Einblendungen auf einem Wort: {n_wort} | nur geschätzt (at): {n_at}')
if n_at > n_wort: print('Hinweis: mehr geschätzte als wortgenaue Einblendungen. Zahlen, Gegenstände und Text besser mit aufWort(t, \'Wort\') einblenden.')
if fehlt: print('FEHLT im gesprochenen Text (Element käme bei 0 s):\n  ' + '\n  '.join(dict.fromkeys(fehlt))); sys.exit(1)
print('Ankerwörter ok.')
