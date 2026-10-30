# Erzeugt sound.json für „Eula testet: Die Flugzeugtür im Reiseflug öffnen #1“ aus timing.json
import json
T = json.load(open('p-tuer/timing.json')); S = T['sentences']; W = T.get('words', [])
norm = lambda w: ''.join(c for c in w.lower() if c.isalnum())
def wort(w, n=1):
    c = 0
    for a, b, x in W:
        if norm(x) == norm(w):
            c += 1
            if c == n: return a
    return next(x[0] for x in T['phrases'] if w in x[2])
ev = []; E = lambda **k: ev.append(k)
# Marke: Titelmelodie genau zweimal (0 s und Urteil), Eula-Erkennungston genau zweimal (erster Auftritt, Kommentar-Aufruf)
E(t=0.0, type='motif', gain=.25); E(t=0.9, type='eula', gain=.3)
E(t=wort('Urteil'), type='motif', gain=.25); E(t=wort('Schreib'), type='eula', gain=.3)
# Kabinenrauschen (Triebwerke) leise unter allem
E(t=0.0, type='wind', dd=S[0][1], gain=.06)
E(t=wort('Millimeter') - .1, type='tick', f=900, gain=.08)
# Draußen: Wind und Uhr
E(t=S[1][0], type='wind', dd=S[2][0] - S[1][0], gain=.09)
for i in range(6): E(t=round(wort('Minute') + i * .25, 3), type='tick', f=1500 + (i % 2) * 300, gain=.05)
# Luft wird hineingepumpt
for i in range(8): E(t=round(S[2][0] + .3 + i * .35, 3), type='pop', f=600 + i * 40, gain=.05, pan=.3 + .05 * i)
E(t=wort('zweitausend'), type='shimmer', dd=.9, gain=.12)
E(t=wort('drückt'), type='riser', dd=.7, f0=200, f1=1200, gain=.08)
# Elefant landet auf dem Quadratmeter
E(t=wort('Elefant') + .3, type='boom', dd=.9, f=45, gain=.26)
E(t=wort('Stöpsel'), type='pop', f=420, gain=.14)
E(t=wort('Druck'), type='boom', dd=.6, f=70, gain=.16)
E(t=wort('Kraft'), type='riser', dd=.6, f0=300, f1=1600, gain=.09)
# Eula-Fail: Effekt liegt unter der Musik (kein Loch)
FI = 8; FT = max(S[FI][0] + .4, T['dur'] * .6)
E(t=FT + .1, type='scratch', dd=.3, gain=.05); E(t=FT + 1.0, type='pop', f=260, gain=.2); E(t=FT + 1.2, type='swipe', dd=.4, gain=.09)
# Landung: Wind wird leiser, Korea: Tür reißt auf
E(t=wort('klein'), type='shimmer', dd=.8, gain=.1)
E(t=wort('Notausgangstür'), type='wind', dd=1.4, gain=.16); E(t=wort('Notausgangstür'), type='swipe', dd=.35, gain=.1)
E(t=wort('strafbar'), type='boom', dd=.5, f=80, gain=.16)
json.dump({"dur": T['dur'], "bpm": 100, "seed": 41, "wechsel": True, "chords": [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55], [45, 52, 57, 64], [38, 45, 50, 53]], "pattern": [0, 1, 2, 3], "pulse_from": 1.5, "pulse_to": round(S[-1][1], 2), "events": ev}, open('p-tuer/sound.json', 'w'))
print(len(ev), 'Effekte')
