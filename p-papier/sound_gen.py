# Erzeugt sound.json für das Papier-Video aus timing.json
import json
T = json.load(open('p-papier/timing.json')); S = T['sentences']; P = T['phrases']
at = lambda i, f: round(S[i][0] + (S[i][1] - S[i][0]) * f, 3)
ph = lambda w: next((x[0] for x in P if w in x[2]), None)
ev = []; E = lambda **k: ev.append(k)
SNAP = at(0, .6)
E(t=0.0, type='riser', dd=SNAP, f0=200, f1=2400, gain=.18); E(t=SNAP, type='scratch', dd=.3, gain=.22); E(t=SNAP, type='boom', dd=1.2, f=44, gain=.45); E(t=SNAP + .05, type='whoosh', dd=.9, f0=200, f1=3000, gain=.14)
kinds = [dict(type='whoosh', dd=.55, f0=400, f1=4500), dict(type='reverse', dd=.6), dict(type='swipe', dd=.3), dict(type='riser', dd=.5, f0=300, f1=1500), dict(type='whoosh', dd=.8, f0=150, f1=1800), dict(type='swipe', dd=.22), dict(type='reverse', dd=.45), dict(type='wind', dd=.7)]
for i, (a, b) in enumerate(S[1:]):
    k = dict(kinds[i % len(kinds)]); k.update(t=a, pre=.8 if k['type'] != 'wind' else .4, gain=.1, pan=.3 + .4 * (i % 2)); E(**k)
gs = ph('Die meisten')
for i in range(4): E(t=round(gs + i * .2, 3), type='pop', f=700 + i * 120, gain=.16, pan=.2 + .2 * i)
dbl = ph('Und jede'); E(t=dbl, type='swipe', dd=.5, gain=.18); E(t=dbl + .4, type='boom', dd=.6, f=60, gain=.3)
for i in (3, 4, 5, 6): E(t=S[i][0] + .05, type='swipe', dd=.35, gain=.16, pan=.5); E(t=S[i][0] + .15, type='pop', f=900, gain=.15)
E(t=S[4][0] + .1, type='riser', dd=at(4, .7) - S[4][0], f0=200, f1=1400, gain=.1)
E(t=S[5][0] + .1, type='riser', dd=S[6][0] - S[5][0] - .3, f0=150, f1=2200, gain=.12)
E(t=S[6][0], type='wind', dd=S[7][0] - S[6][0], gain=.16)
E(t=S[7][0], type='boom', dd=1.4, f=38, gain=.5); E(t=S[7][0] + .2, type='riser', dd=S[8][0] - S[7][0] - .2, f0=100, f1=3000, gain=.14)
for x in range(12): E(t=round(ph('Nach zweiundvierzig') + x * .18, 3), type='tick', f=2200 + x * 60, gain=.1)
E(t=S[8][0], type='shimmer', dd=1.6, gain=.45)
hb = ph('Weil das')
for x in range(8): E(t=round(hb + x * .35, 3), type='pop', f=1200 - x * 90, gain=.12, pan=(x % 2) * .6 + .2)
rec = ph('Der Weltrekord'); E(t=rec, type='whoosh', dd=1.4, f0=300, f1=1600, gain=.12); E(t=rec + .3, type='boom', dd=.7, f=58, gain=.32)
E(t=S[11][0] + .2, type='riser', dd=S[11][1] - S[11][0] - .4, f0=150, f1=3000, gain=.13); E(t=ph('Mit nur') + .7, type='shimmer', dd=1.4, gain=.5)
E(t=S[11][1] + .2, type='boom', dd=1.6, f=42, gain=.4); E(t=S[11][1] + .25, type='shimmer', dd=1.6, gain=.6)
json.dump({"dur": T['dur'], "bpm": 110, "seed": 42, "chords": [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [48, 55, 60, 67], [43, 50, 55, 62]], "pattern": [0, 1, 2, 3], "pulse_from": 1.5, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-papier/sound.json', 'w'))
print(len(ev), 'Effekte')
