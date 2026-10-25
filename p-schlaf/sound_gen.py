# Erzeugt sound.json für das Schlaf-Video aus timing.json
import json
T = json.load(open('p-schlaf/timing.json')); S = T['sentences']; P = T['phrases']
at = lambda i, f: round(S[i][0] + (S[i][1] - S[i][0]) * f, 3)
ph = lambda w: next((x[0] for x in P if w in x[2]), None)
ev = []; E = lambda **k: ev.append(k)
# Hook: Wecker tickt, Eula reißt die Augen auf
for i in range(10): E(t=round(.1 + i * .3, 3), type='tick', f=2200 if i % 2 else 1700, gain=.12)
E(t=0.9, type='pop', f=900, gain=.2); E(t=.3, type='riser', dd=.7, f0=200, f1=2000, gain=.12)
kinds = [dict(type='whoosh', dd=.55, f0=400, f1=4500), dict(type='reverse', dd=.6), dict(type='swipe', dd=.3), dict(type='riser', dd=.5, f0=300, f1=1500), dict(type='whoosh', dd=.8, f0=150, f1=1800), dict(type='swipe', dd=.22), dict(type='reverse', dd=.45), dict(type='wind', dd=.7)]
for i, (a, b) in enumerate(S[1:]):
    k = dict(kinds[i % len(kinds)]); k.update(t=a, pre=.8 if k['type'] != 'wind' else .4, gain=.1, pan=.3 + .4 * (i % 2)); E(**k)
pm = ph('Promille'); E(t=pm, type='pop', f=600, gain=.18); E(t=pm + .3, type='shimmer', dd=.9, gain=.2)
off = ph('Dein Gehirn')
for k in range(4): E(t=round(off + k * 1.1, 3), type='glitch', dd=.2, gain=.1)
E(t=S[3][0] + .3, type='wind', dd=S[4][0] - S[3][0], gain=.12)
E(t=S[4][0], type='wind', dd=ph('dieser Müll') - S[4][0], gain=.16); E(t=ph('dieser Müll'), type='scratch', dd=.3, gain=.14)
E(t=S[5][0], type='reverse', dd=1.2, gain=.14); E(t=S[5][0] + .3, type='shimmer', dd=2.2, gain=.22)
for i in range(9): E(t=round(S[5][0] + .3 + i * .22, 3), type='pop', f=500 + i * 70, gain=.09, pan=i / 9)
E(t=ph('Randy'), type='swipe', dd=.4, gain=.12)
for i in range(11): E(t=round(S[7][0] + .1 + i * .16, 3), type='pop', f=400 + i * 60, gain=.12)
h = ph('zweihundertvierundsechzig'); E(t=h, type='boom', dd=1.0, f=44, gain=.4)
for i in range(7): E(t=round(ph('er vergaß') + i * .18, 3), type='pop', f=700 + (i % 3) * 200, gain=.1)
E(t=S[9][0] + .2, type='whoosh', dd=1.0, f0=200, f1=2000, gain=.14)
for i in range(16): E(t=round(S[10][0] + .1 + i * .2, 3), type='tick', f=1900, gain=.06)
E(t=S[11][0] + .1, type='boom', dd=.7, f=60, gain=.3); E(t=ph('Guinness') + .4, type='scratch', dd=.3, gain=.16)
E(t=ph('sonst fragst'), type='riser', dd=S[-1][1] - ph('sonst fragst') + .3, f0=200, f1=1800, gain=.12)
json.dump({"dur": T['dur'], "bpm": 92, "seed": 7, "chords": [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [48, 55, 62, 64], [40, 47, 52, 55]], "pattern": [0, 1, 2, 3], "pulse_from": 1.5, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-schlaf/sound.json', 'w'))
print(len(ev), 'Effekte')
