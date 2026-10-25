# Erzeugt sound.json für das Kola-Video aus timing.json
import json
T = json.load(open('p-kola/timing.json')); S = T['sentences']; P = T['phrases']
at = lambda i, f: round(S[i][0] + (S[i][1] - S[i][0]) * f, 3)
ph = lambda w: next((x[0] for x in P if w in x[2]), None)
ev = []; E = lambda **k: ev.append(k)
# Hook: tiefes Grollen aus dem Loch, kurzer Glitch
E(t=0.0, type='riser', dd=.6, f0=120, f1=1800, gain=.16); E(t=.3, type='boom', dd=1.2, f=40, gain=.36); E(t=at(0, .6), type='shimmer', dd=.8, gain=.25)
kinds = [dict(type='whoosh', dd=.55, f0=400, f1=4500), dict(type='reverse', dd=.6), dict(type='swipe', dd=.3), dict(type='riser', dd=.5, f0=300, f1=1500), dict(type='whoosh', dd=.8, f0=150, f1=1800), dict(type='swipe', dd=.22), dict(type='reverse', dd=.45), dict(type='wind', dd=.7)]
for i, (a, b) in enumerate(S[1:]):
    k = dict(kinds[i % len(kinds)]); k.update(t=a, pre=.8 if k['type'] != 'wind' else .4, gain=.1, pan=.3 + .4 * (i % 2)); E(**k)
cm = ph('dreiundzwanzig'); E(t=cm - .4, type='pop', f=900, gain=.16); E(t=cm, type='reverse', dd=.5, gain=.12); E(t=cm + .9, type='pop', f=600, gain=.16)
E(t=S[2][0], type='wind', dd=S[3][0] - S[2][0], gain=.14)
for i in range(16): E(t=round(S[2][0] + .1 + i * .2, 3), type='tick', f=1400 + i * 40, gain=.07)
ev_ = ph('Everest'); E(t=S[3][0] + .2, type='riser', dd=.8, f0=400, f1=120, gain=.1); E(t=ev_, type='riser', dd=.6, f0=200, f1=2400, gain=.12); E(t=S[3][1] - .3, type='boom', dd=.7, f=55, gain=.26)
for i in range(8): E(t=round(S[4][0] + .6 + i * .08 * 1.75, 3), type='pop', f=800 + i * 90, gain=.1, pan=i / 8)
E(t=ph('sechs Kilometer'), type='shimmer', dd=.8, gain=.2)
hot = ph('fast doppelt'); E(t=S[5][0] + .1, type='riser', dd=hot - S[5][0], f0=150, f1=2600, gain=.12); E(t=hot, type='boom', dd=.9, f=46, gain=.34); E(t=hot + .1, type='scratch', dd=.25, gain=.14)
E(t=S[6][0], type='wind', dd=S[7][0] - S[6][0], gain=.16); sch = ph('war Schluss'); E(t=sch + .2, type='boom', dd=.8, f=60, gain=.3)
E(t=at(7, .55), type='pop', f=500, gain=.18); E(t=at(7, .55) + .1, type='shimmer', dd=1.0, gain=.22)
dive = at(8, .75); E(t=S[8][0] + .2, type='riser', dd=dive - S[8][0] - .2, f0=200, f1=3500, gain=.14); E(t=dive, type='boom', dd=1.6, f=36, gain=.48); E(t=dive, type='glitch', dd=.3, gain=.14)
E(t=S[9][0], type='wind', dd=S[10][0] - S[9][0], gain=.2); E(t=S[9][0] + .2, type='riser', dd=S[10][0] - S[9][0] - .3, f0=80, f1=900, gain=.1)
E(t=ph('Sonne'), type='whoosh', dd=.6, f0=300, f1=3000, gain=.14); E(t=ph('Sonne') + .2, type='shimmer', dd=1.2, gain=.25)
for i in range(18): E(t=round(S[11][0] + .1 + i * .18, 3), type='tick', f=1800 + (i % 2) * 400, gain=.07)
fr = ph('einzigen Frage'); E(t=fr, type='reverse', dd=.8, gain=.14); E(t=S[-1][1] - .2, type='riser', dd=.6, f0=200, f1=1600, gain=.12)
json.dump({"dur": T['dur'], "bpm": 100, "seed": 23, "chords": [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55], [45, 52, 57, 64], [38, 45, 50, 53]], "pattern": [0, 1, 2, 3], "pulse_from": 1.5, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-kola/sound.json', 'w'))
print(len(ev), 'Effekte')
