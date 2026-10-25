# Erzeugt sound.json für das Spring-Video aus timing.json
import json
T = json.load(open('p-sprung/timing.json')); S = T['sentences']; P = T['phrases']
at = lambda i, f: round(S[i][0] + (S[i][1] - S[i][0]) * f, 3)
ph = lambda w: next(x[0] for x in P if w in x[2])
ev = []; A = lambda **k: ev.append(k)
J = at(0, .55)
A(t=0.0, type='riser', dd=J, f0=150, f1=2600, gain=.22); A(t=J + .5, type='boom', dd=1.8, f=36, gain=.6); A(t=J + .5, type='scratch', dd=.4, gain=.2)
for f in (.25, .6, .8): A(t=at(0, f), type='pop', f=700 + f * 400, gain=.18)
kinds = [dict(type='whoosh', dd=.55, f0=400, f1=4500), dict(type='reverse', dd=.6), dict(type='swipe', dd=.3), dict(type='riser', dd=.5, f0=300, f1=1500), dict(type='whoosh', dd=.8, f0=150, f1=1800), dict(type='swipe', dd=.22), dict(type='reverse', dd=.45), dict(type='wind', dd=.7)]
for i, (a, b) in enumerate(S[1:]):
    k = dict(kinds[i % len(kinds)]); k.update(t=a, pre=.8 if k['type'] != 'wind' else .4, gain=.1, pan=.3 + .4 * (i % 2)); A(**k)
# Fragen: Wackeln, Wegfliegen
for x in range(6): A(t=round(S[1][0] + .2 + x * .1, 3), type='tick', f=1800, gain=.1)
A(t=ph('Fliegt sie'), type='whoosh', dd=1.0, f0=200, f1=2500, gain=.14, pan=.8); A(t=ph('Die Antwort'), type='shimmer', dd=1.0, gain=.35)
# Zähler
w0 = ph('Alle Menschen')
for x in range(16): A(t=round(w0 + x * .2, 3), type='tick', f=1600 + x * 60, gain=.11)
# Waage
ea = ph('Aber die Erde'); A(t=ea, type='pop', f=500, gain=.2); A(t=ea + .5, type='boom', dd=1.0, f=44, gain=.42)
# Zoom raus
A(t=S[4][0] + .1, type='reverse', dd=1.6, gain=.15); A(t=at(4, .7), type='shimmer', dd=1.0, gain=.35)
# Kraftpfeile
why = ph('Weil du'); A(t=why + .2, type='swipe', dd=.4, gain=.15, pan=.3); A(t=why + .8, type='swipe', dd=.4, gain=.15, pan=.7)
# Split: Sprung
A(t=at(6, .12), type='riser', dd=.8, f0=300, f1=1800, gain=.12); A(t=at(6, .12) + 1.6, type='pop', f=300, gain=.25)
# Alle gemeinsam
jt = at(7, .45); A(t=jt + .8, type='boom', dd=1.2, f=40, gain=.45)
# Warp ins Atom
A(t=S[8][0], type='riser', dd=ph('Weniger als') - S[8][0] + .3, f0=200, f1=3500, gain=.15); A(t=ph('Weniger als') + .4, type='shimmer', dd=1.4, gain=.5)
# Feder zurück
land = ph('Wenn wir landen'); A(t=S[9][0] + .2, type='whoosh', dd=1.0, f0=800, f1=200, gain=.12); A(t=land + .3, type='reverse', dd=.6, gain=.16)
for x in range(4): A(t=round(land + .4 + x * .25, 3), type='pop', f=900 - x * 120, gain=.12)
# Fadenkreuz
A(t=at(10, .3), type='pop', f=1400, gain=.2); A(t=at(10, .55), type='tick', f=3000, gain=.15)
# Seismograf
A(t=S[11][0], type='wind', dd=ph('Auch da') - S[11][0], gain=.12)
for x in range(8): A(t=round(S[11][0] + x * .2, 3), type='tick', f=900, gain=.1)
# Verpuffen
for x in range(10): A(t=round(S[12][0] + .2 + x * .12, 3), type='pop', f=400 + x * 40, gain=.08, pan=x / 10)
A(t=ph('Der Stoß') + .4, type='wind', dd=1.4, gain=.15)
# Schlafende Erde
A(t=S[13][0] + .3, type='shimmer', dd=2.0, gain=.25)
# Twist
A(t=S[14][0], type='boom', dd=1.4, f=40, gain=.5); A(t=S[14][0] + .05, type='glitch', dd=.3, gain=.15)
you = ph('Und das passiert'); A(t=you, type='shimmer', dd=1.2, gain=.45); A(t=you + .1, type='riser', dd=1.2, f0=200, f1=900, gain=.1)
# Pointe
for x in range(14): A(t=round(S[15][0] + .2 + x * .15, 3), type='tick', f=1800 + x * 70, gain=.1)
A(t=at(15, .55), type='boom', dd=1.0, f=48, gain=.38)
A(t=S[15][1] + .2, type='boom', dd=1.6, f=42, gain=.4); A(t=S[15][1] + .25, type='shimmer', dd=1.6, gain=.6)
json.dump({"dur": T['dur'], "bpm": 112, "seed": 8, "chords": [[52, 59, 64, 67], [48, 55, 60, 64], [55, 62, 67, 71], [50, 57, 62, 66], [57, 60, 64, 69], [53, 60, 65, 69]], "pattern": [0, 1, 2, 3], "pulse_from": 2.0, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-sprung/sound.json', 'w'))
print(len(ev), 'Effekte')
