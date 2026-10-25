# Erzeugt sound.json für das Erdtunnel-Video aus timing.json
import json
T = json.load(open('p-tunnel2/timing.json')); S = T['sentences']; P = T['phrases']
at = lambda i, f: round(S[i][0] + (S[i][1] - S[i][0]) * f, 3)
ph = lambda w: next((x[0] for x in P if w in x[2]), None)
# 16 Szenen auf 12 Sätze (wie in scene.html)
SEG = [S[0][0], S[1][0], S[2][0], ph('Am Anfang'), S[3][0], S[4][0], S[5][0], S[6][0], S[7][0], S[8][0], ph('Hin und her'), S[9][0], ph('Im Erdkern'), S[10][0], ph('Nicht mal'), S[11][0], S[11][1] + 3]
A = lambda k: SEG[k]
atk = lambda k, f: round(A(k) + (min(SEG[k + 1], S[11][1] if k == 15 else SEG[k + 1] - .3) - A(k)) * f, 3)
ev = []; E = lambda **k: ev.append(k)
E(t=0.0, type='wind', dd=A(1), gain=.25); E(t=0.0, type='riser', dd=1.2, f0=120, f1=1600, gain=.2); E(t=.5, type='boom', dd=1.2, f=40, gain=.4)
for f in (.35, .7): E(t=atk(0, f), type='pop', f=800, gain=.18)
kinds = [dict(type='whoosh', dd=.55, f0=400, f1=4500), dict(type='reverse', dd=.6), dict(type='swipe', dd=.3), dict(type='riser', dd=.5, f0=300, f1=1500), dict(type='whoosh', dd=.8, f0=150, f1=1800), dict(type='swipe', dd=.22), dict(type='reverse', dd=.45), dict(type='wind', dd=.7)]
for i, a in enumerate(SEG[1:16]):
    k = dict(kinds[i % len(kinds)]); k.update(t=a, pre=.8 if k['type'] != 'wind' else .4, gain=.1, pan=.3 + .4 * (i % 2)); E(**k)
for x in range(5): E(t=round(A(1) + .2 + x * .25, 3), type='pop', f=600 + x * 100, gain=.14)
E(t=A(2) + .3, type='riser', dd=atk(2, .55) - A(2) - .3, f0=200, f1=1200, gain=.1)
E(t=A(3), type='riser', dd=A(4) - A(3), f0=100, f1=2400, gain=.16); E(t=A(3), type='wind', dd=A(4) - A(3), gain=.2)
E(t=A(4), type='boom', dd=1.4, f=38, gain=.5); E(t=A(4), type='shimmer', dd=1.4, gain=.5)
E(t=ph('Die Erde zieht'), type='reverse', dd=1.0, gain=.15)
E(t=A(6), type='glitch', dd=.35, gain=.18); E(t=ph('Du wirst immer') + .5, type='scratch', dd=.4, gain=.18)
nz = ph('Von Deutschland'); E(t=nz, type='whoosh', dd=1.4, f0=300, f1=2000, gain=.14); E(t=nz + 1, type='pop', f=1200, gain=.2)
for x in range(16): E(t=round(A(8) + .2 + x * .14, 3), type='tick', f=2600, gain=.1)
E(t=ph('Nur rund') + 1, type='boom', dd=.9, f=50, gain=.38)
E(t=ph('Hält dich') + .4, type='reverse', dd=1.2, gain=.18)
E(t=A(10) + .1, type='wind', dd=2.5, gain=.1)
E(t=SEG[12] - .6, type='boom', dd=1.0, f=45, gain=.45); E(t=SEG[12] - .6, type='scratch', dd=.3, gain=.2)
E(t=A(12), type='wind', dd=2.5, gain=.2); E(t=atk(12, .5), type='shimmer', dd=1.2, gain=.4)
E(t=A(13) + .3, type='whoosh', dd=1.6, f0=1200, f1=150, gain=.14); E(t=atk(13, .75), type='pop', f=700, gain=.2)
E(t=atk(14, .35), type='boom', dd=.8, f=55, gain=.32)
for x in range(10): E(t=round(A(15) + .3 + x * .3, 3), type='tick', f=1800, gain=.09)
E(t=ph('Durch die Erde'), type='riser', dd=1.6, f0=300, f1=2000, gain=.12)
E(t=S[11][1] + .2, type='boom', dd=1.6, f=42, gain=.4); E(t=S[11][1] + .25, type='shimmer', dd=1.6, gain=.6)
json.dump({"dur": T['dur'], "bpm": 118, "seed": 38, "chords": [[52, 59, 64, 67], [50, 57, 62, 65], [48, 55, 60, 64], [47, 54, 59, 62], [45, 52, 57, 60], [47, 55, 59, 62]], "pattern": [0, 1, 2, 3], "pulse_from": 1.0, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-tunnel2/sound.json', 'w'))
print(len(ev), 'Effekte')
