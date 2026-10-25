# Erzeugt sound.json für das Dino-Video aus timing.json
import json
T = json.load(open('p-dinos/timing.json')); S = T['sentences']
at = lambda i, f: round(S[i][0] + (S[i][1] - S[i][0]) * f, 3)
ev = []; A = lambda **k: ev.append(k)
P = T['phrases']; ph = lambda w: next(x[0] for x in P if w in x[2]); fr = lambda i, w: (ph(w) - S[i][0]) / (S[i][1] - S[i][0])
# Hook: Brüllen (tiefer Boom + Scratch), Glitches
A(t=0.0, type='riser', dd=.4, f0=120, f1=2000, gain=.25); A(t=.4, type='boom', dd=1.6, f=38, gain=.5); A(t=.4, type='scratch', dd=.5, gain=.22)
A(t=.9, type='glitch', dd=.2, gain=.14, pan=.3); A(t=at(0, .35), type='pop', f=700, gain=.2); A(t=at(0, .7), type='pop', f=950, gain=.2)
kinds = [dict(type='whoosh', dd=.55, f0=400, f1=4500), dict(type='reverse', dd=.6), dict(type='swipe', dd=.3), dict(type='riser', dd=.5, f0=300, f1=1500), dict(type='whoosh', dd=.8, f0=150, f1=1800), dict(type='swipe', dd=.22), dict(type='reverse', dd=.45), dict(type='wind', dd=.7)]
for i, (a, b) in enumerate(S[1:]):
    k = dict(kinds[i % len(kinds)]); k.update(t=a, pre=.8 if k['type'] != 'wind' else .4, gain=.1, pan=.3 + .4 * (i % 2)); A(**k)
# Split-Screen-Kreuz, Fragezeichen
A(t=at(1, .3), type='scratch', dd=.3, gain=.18); A(t=ph('Und der Grund'), type='boom', dd=.8, f=55, gain=.3)
# Warp + Zähler + Einschlag
A(t=S[2][0], type='riser', dd=at(2, .45) - S[2][0], f0=200, f1=3000, gain=.16)
for x in range(10): A(t=round(S[2][0] + .1 + x * .17, 3), type='tick', f=2200 + x * 80, gain=.12)
A(t=at(2, .45), type='whoosh', dd=1.0, f0=150, f1=1500, gain=.14, pan=.2)
imp = at(2, .92); A(t=imp, type='boom', dd=2.2, f=32, gain=.6); A(t=imp, type='glitch', dd=.4, gain=.16); A(t=imp + .1, type='wind', dd=1.6, gain=.15)
# Pixel-Zerfall, dann Glück
for x in range(12): A(t=round(at(3, .08) + x * .14, 3), type='pop', f=300 + (x * 97) % 600, gain=.1, pan=(x % 5) / 5)
A(t=ph('Und genau das') + .3, type='shimmer', dd=1.2, gain=.45)
# Iris + Kamerafahrt zur Maus
A(t=S[4][0], type='boom', dd=1.0, f=44, gain=.4); A(t=ph('Aber die meisten') - .3, type='whoosh', dd=1.6, f0=1200, f1=200, gain=.12); A(t=ph('Aber die meisten') + 1.4, type='pop', f=1400, gain=.18)
# Karte: Icons poppen auf, Stempel
pl = ph('Die großen Plätze')
for x in range(12): A(t=round(pl + x * .08, 3), type='pop', f=600 + x * 50, gain=.12, pan=.2 + .05 * x)
A(t=pl + 1.1, type='boom', dd=.7, f=60, gain=.32)
# Zeitraffer
A(t=S[6][0], type='riser', dd=1.6, f0=300, f1=2400, gain=.14); A(t=ph('wurde Platz frei'), type='shimmer', dd=1.2, gain=.45)
# Morphing: jede Stufe ein anderer Klang
for f, ty in [(fr(7, 'Wale'), 'swipe'), (fr(7, 'Pferde'), 'reverse'), (fr(7, 'Affen'), 'whoosh'), (fr(7, 'irgendwann') + .02, 'shimmer')]:
    d = dict(type=ty, dd=.5, gain=.12, pan=.5)
    if ty == 'whoosh': d.update(f0=300, f1=3000)
    d['t'] = at(7, f) - (.3 if ty != 'shimmer' else 0); A(**d)
A(t=at(7, fr(7, 'irgendwann') + .02), type='boom', dd=.9, f=48, gain=.35)
# Zurückspulen + Vorbeiflug
A(t=S[8][0], type='scratch', dd=.6, gain=.25); A(t=S[8][0] + .05, type='reverse', dd=1.0, gain=.18)
A(t=at(8, .45), type='whoosh', dd=1.4, f0=200, f1=2500, gain=.15, pan=.8); A(t=at(8, .82), type='boom', dd=.7, f=58, gain=.32)
# Diagramm
sm = ph('Und die Säugetiere'); A(t=sm - .4, type='riser', dd=.9, f0=200, f1=1600, gain=.13); A(t=sm + .5, type='pop', f=500, gain=.2)
# Zeichnung + Dino-Mensch
A(t=at(10, .04), type='wind', dd=2.5, gain=.12); A(t=ph('Ein Forscher') + .4, type='boom', dd=.6, f=62, gain=.28)
for x in range(4): A(t=round(S[11][0] + x * .9, 3), type='glitch', dd=.15, gain=.1, pan=.2 + .2 * x)
for x in (ph('aufrecht'), ph('große Augen'), ph('große Augen') + .9): A(t=x, type='pop', f=900, gain=.18)
A(t=ph('Reines'), type='boom', dd=.7, f=58, gain=.3)
# Das Verrückte
A(t=S[12][0], type='boom', dd=1.4, f=40, gain=.48); A(t=S[12][0] + .05, type='shimmer', dd=1.5, gain=.5)
# Vögel: Wind
A(t=S[13][0], type='wind', dd=3.2, gain=.2); A(t=ph('die Vögel'), type='shimmer', dd=1.2, gain=.45)
# Röntgen-Scan, Schrumpfen
for x in range(3): A(t=round(S[14][0] + x * 1.8, 3), type='riser', dd=.9, f0=800, f1=2400, gain=.08)
A(t=ph('Sie sind nur klein') + .3, type='reverse', dd=.8, gain=.16)
# Pointe + Endkarte
A(t=S[15][0] + .5, type='tick', f=3000, gain=.12); A(t=S[15][1] - .6, type='riser', dd=.8, f0=200, f1=1800, gain=.14)
A(t=S[15][1] + .2, type='boom', dd=1.6, f=42, gain=.4); A(t=S[15][1] + .25, type='shimmer', dd=1.6, gain=.6)
json.dump({"dur": T['dur'], "bpm": 104, "seed": 66, "chords": [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61], [53, 57, 60, 65], [55, 59, 62, 67]], "pattern": [0, 1, 2, 3], "pulse_from": 3.0, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-dinos/sound.json', 'w'))
print(len(ev), 'Effekte')
