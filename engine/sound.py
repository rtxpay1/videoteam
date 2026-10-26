# Ton: Musikbett und Soundeffekte per Synthese.
# Aufruf: python3 sound.py <projektordner>   (liest sound.json, schreibt music.wav und sfx.wav)
# sound.json: { "dur": 30.2, "bpm": 96, "seed": 3, "chords": [[57,60,64,69], ...], "pulse_from": 3.3, "pulse_to": 28,
#               "events": [ {"t": 0.0, "type": "riser", "gain": .35, "pan": .5, "d": .5}, ... ] }
# Titelmelodie: {"t": .., "type": "motif", "gain": .25} – zweimal (Start, Eula-Urteil)
# Erkennungs-Sound: {"t": .., "type": "eula", "gain": .3} – genau zweimal pro Video (erster Eula-Auftritt, Pointe)
# "wechsel": true – legt an jeden Szenen-Übergang automatisch einen Wisch-Ton, genau auf die Zeit, die lib.js für den
#   Übergang nimmt (nächster Achtel-Schlag kurz vor dem Schnitt). Dann in sound_gen.py keine eigenen Schnitt-Wischer mehr.
import json, os, sys, wave
import numpy as np

d = sys.argv[1]
C = json.load(open(os.path.join(d, 'sound.json')))
SR, DUR = 44100, C['dur']
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(C.get('seed', 3))

def save(name, x):
    st = (np.clip(x, -1, 1).T * 32767).astype(np.int16)
    with wave.open(os.path.join(d, name), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
def env(n, a, dd):
    e = np.ones(n); ai = min(int(a * SR), n // 2); di = min(int(dd * SR), n // 2)
    e[:ai] = np.linspace(0, 1, ai); e[-di:] *= np.linspace(1, 0, di); return e
def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

# --- Musik
bpm = C.get('bpm', 96); beat = 60 / bpm; bar = beat * 4; chords = C['chords']
music = np.zeros((2, N))
for b in range(int(DUR / bar) + 1):
    ch = chords[b % len(chords)]; s0 = int(b * bar * SR); n = min(int(bar * SR) + int(.6 * SR), N - s0)
    if n <= 0: break
    tt = np.arange(n) / SR; e = env(n, .5, .9)
    for k, m in enumerate(ch):
        for det, pan in ((-.08, 0), (.08, 1)):
            f = hz(m) * (1 + det / 100)
            music[pan, s0:s0 + n] += (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * 2 * f * tt + k)) * e * .045
    music[:, s0:s0 + n] += np.sin(2 * np.pi * hz(ch[0] - 12) * tt) * env(n, .02, .4) * .12
pat = C.get('pattern', [0, 2, 1, 3])
for i in range(int(DUR / (beat / 2))):
    ts = i * beat / 2
    if ts < C.get('pulse_from', 3) or ts > C.get('pulse_to', DUR - 2): continue
    ch = chords[int(ts / bar) % len(chords)]; m = ch[pat[i % len(pat)] % len(ch)] + 12
    s0 = int(ts * SR); n = min(int(.35 * SR), N - s0); tt = np.arange(n) / SR
    v = np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 14) * .05
    music[i % 2, s0:s0 + n] += v; music[1 - i % 2, s0:s0 + n] += v * .5
music[0] = lowpass(music[0], 2400); music[1] = lowpass(music[1], 2400)
music *= np.clip(t / 1.5, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
save('music.wav', music)

# --- Effekte
def whoosh(dd=.6, f0=300, f1=4000):
    n = int(dd * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    cut = f0 + (f1 - f0) * np.sin(np.pi * tt / dd) ** 2; y = np.zeros(n); acc = 0.0
    for i in range(n): a = np.exp(-2 * np.pi * cut[i] / SR); acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y * np.sin(np.pi * tt / dd) ** 1.5 * 1.6
def boom(dd=.9, f=55):
    n = int(dd * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 60 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 4.5) * .9
def shimmer(dd=1.2):
    n = int(dd * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for f in (1760, 2217, 2637, 3520): x += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) * (.5 + .5 * np.sin(2 * np.pi * 7 * tt))
    return x * .08 * np.clip(tt / .05, 0, 1)
def pop(f=900):
    n = int(.12 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 - tt * 3) * tt) * np.exp(-tt * 40) * .5
def riser(dd=.8, f0=200, f1=1800):
    n = int(dd * SR); tt = np.arange(n) / SR; f = f0 * (f1 / f0) ** (tt / dd)
    ph = 2 * np.pi * np.cumsum(f) / SR; x = np.sin(ph) + .5 * np.sin(2 * ph) + rng.standard_normal(n) * .25
    return x * (tt / dd) ** 2 * .35
def reverse(dd=.7):
    n = int(dd * SR); tt = np.arange(n) / SR
    return lowpass(rng.standard_normal(n), 2500) * (tt / dd) ** 3 * 2.2
def swipe(dd=.25):
    n = int(dd * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    return (x - lowpass(x, 3000)) * np.sin(np.pi * tt / dd) ** 2 * 1.1
def glitch(dd=.4):
    n = int(dd * SR); x = np.zeros(n); k = 0
    while k < n:
        L = int(SR * rng.uniform(.015, .045)); f = rng.choice([220, 440, 880, 1320, 1760]); tt = np.arange(min(L, n - k)) / SR
        x[k:k + len(tt)] = np.sign(np.sin(2 * np.pi * f * tt)) * .25 * rng.uniform(.4, 1); k += L + int(SR * rng.uniform(0, .02))
    return lowpass(x, 6000)
def scratch(dd=.35):
    n = int(dd * SR); tt = np.arange(n) / SR; f = 300 + 900 * np.abs(np.sin(2 * np.pi * 3 / dd * tt))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (rng.standard_normal(n) * .3 + .7) * np.sin(np.pi * tt / dd) * .5
def tick(f=2400):
    n = int(.05 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 90) * .6
def wind(dd=2.0):
    n = int(dd * SR); tt = np.arange(n) / SR
    return lowpass(rng.standard_normal(n), 900) * (np.sin(np.pi * tt / dd) ** 2) * (1 + .5 * np.sin(2 * np.pi * 1.3 * tt)) * 1.8
def eula():
    # Erkennungs-Sound des Kanals: helles „Huu!“ der Eule plus Münzklingeln. Immer gleich (kein Zufall), ca. 0,45 s
    n = int(.45 * SR); tt = np.arange(n) / SR
    f = np.where(tt < .07, 620 + 900 * tt, 683 - 260 * (tt - .07)) * (1 + .012 * np.sin(2 * np.pi * 9 * tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    hoot = (np.sin(ph) + .35 * np.sin(2 * ph) + .12 * np.sin(3 * ph)) * np.clip(tt / .02, 0, 1) * np.exp(-np.maximum(tt - .12, 0) * 9) * .45
    c = np.clip(tt - .16, 0, None); on = (tt >= .16)
    coin = sum(a * np.sin(2 * np.pi * fr * c) * np.exp(-c * k) for fr, a, k in ((2350, .5, 14), (3810, .35, 18), (5240, .22, 24), (6900, .1, 30))) * on * .5
    return hoot + coin
def motif():
    # Titelmelodie des Kanals (4 Töne, ca. 1,1 s): kommt in jedem Video zweimal (Start und Eula-Urteil), immer gleich
    out = np.zeros(int(1.15 * SR))
    for k, (f, at) in enumerate(((784, 0), (988, .18), (1175, .36), (1568, .56))):
        n = int((.55 if k == 3 else .3) * SR); tt = np.arange(n) / SR
        x = (np.sin(2 * np.pi * f * tt) + .4 * np.sin(4 * np.pi * f * tt) + .15 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * (4 if k == 3 else 9)) * np.clip(tt / .005, 0, 1)
        s0 = int(at * SR); out[s0:s0 + n] += x[:len(out) - s0] * .32
    return out
GEN = {'motif': motif, 'eula': eula, 'whoosh': whoosh, 'boom': boom, 'shimmer': shimmer, 'pop': pop, 'riser': riser, 'reverse': reverse, 'swipe': swipe, 'glitch': glitch, 'scratch': scratch, 'tick': tick, 'wind': wind}

# Übergangs-Zeiten wie in lib.js (ueZeit): Achtel-Schlag in [Schnitt - 0,25 s, Schnitt + 0,05 s], sonst Schnitt - 0,1 s
def ue_zeit(tb):
    b = 30 / bpm; c = np.floor((tb - .1) / b + .5) * b
    return float(c) if tb - .25 <= c <= tb + .05 else tb - .1
if C.get('wechsel'):
    T = json.load(open(os.path.join(d, 'timing.json')))
    for i, (a, _) in enumerate(T['sentences'][1:]):
        C['events'].append(dict([('t', ue_zeit(a)), ('pre', .5)] + list(([('type', 'whoosh'), ('dd', .45), ('f0', 500), ('f1', 5000)], [('type', 'swipe'), ('dd', .3)])[i % 2]) + [('gain', .1), ('pan', .3 + .4 * (i % 2))]))

sfx = np.zeros((2, N))
for ev in C['events']:
    kw = {k: v for k, v in ev.items() if k not in ('t', 'type', 'gain', 'pan', 'pre')}
    x = GEN[ev['type']](**kw)
    at = ev['t'] - (len(x) / SR * ev.get('pre', 0))
    s0 = max(0, int(at * SR)); n = min(len(x), N - s0)
    if n <= 0: continue
    pan = ev.get('pan', .5); gain = ev.get('gain', .2)
    sfx[0, s0:s0 + n] += x[:n] * gain * (1 - pan) * 1.4
    sfx[1, s0:s0 + n] += x[:n] * gain * pan * 1.4
sfx[0] = lowpass(sfx[0], 9000); sfx[1] = lowpass(sfx[1], 9000)
save('sfx.wav', sfx)
print('ok')
