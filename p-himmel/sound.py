# Ton: Musikbett und Soundeffekte per Synthese erzeugen
import numpy as np, wave

SR, DUR = 44100, 32.13
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)

def save(name, x):
    x = np.clip(x, -1, 1)
    st = (np.stack([x[0], x[1]], 1) * 32767).astype(np.int16) if x.ndim == 2 else (np.stack([x, x], 1) * 32767).astype(np.int16)
    with wave.open(name, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())

def env(n, a, d):
    e = np.ones(n); ai = min(int(a * SR), n // 2); di = min(int(d * SR), n // 2)
    e[:ai] = np.linspace(0, 1, ai); e[-di:] *= np.linspace(1, 0, di); return e

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

# --- Musik: warme Akkordflächen + Puls, 96 BPM
bpm = 96; beat = 60 / bpm
chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]  # Am F C G
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
music = np.zeros((2, N))
bar = beat * 4
for b in range(int(DUR / bar) + 1):
    ch = chords[b % 4]; s0 = int(b * bar * SR); n = min(int(bar * SR) + int(.6 * SR), N - s0)
    if n <= 0: break
    tt = np.arange(n) / SR; e = env(n, .5, .9)
    for k, m in enumerate(ch):
        for det, pan in ((-.08, 0), (.08, 1)):
            f = hz(m) * (1 + det / 100)
            v = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * 2 * f * tt + k)) * e * .045
            music[pan, s0:s0 + n] += v
    # Bass
    fb = hz(ch[0] - 12); vb = np.sin(2 * np.pi * fb * tt) * env(n, .02, .4) * .12
    music[:, s0:s0 + n] += vb
# Achtel-Puls (Pluck) ab Szene 2
for i in range(int(DUR / (beat / 2))):
    ts = i * beat / 2
    if ts < 3.31 or ts > 30.1: continue
    ch = chords[int(ts / bar) % 4]; m = ch[[0, 2, 1, 3][i % 4]] + 12
    s0 = int(ts * SR); n = min(int(.35 * SR), N - s0); tt = np.arange(n) / SR
    v = np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 14) * .05
    music[i % 2, s0:s0 + n] += v; music[1 - i % 2, s0:s0 + n] += v * .5
music[0] = lowpass(music[0], 2400); music[1] = lowpass(music[1], 2400)
fade = np.clip(t / 1.5, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
music *= fade
save('music.wav', music)

# --- Effekte
sfx = np.zeros((2, N))
def add(x, at, gain=1.0, pan=.5):
    s0 = int(at * SR); n = min(len(x), N - s0)
    sfx[0, s0:s0 + n] += x[:n] * gain * (1 - pan) * 2 * .5 + x[:n] * gain * .5 * (pan < .5)
    sfx[1, s0:s0 + n] += x[:n] * gain * pan * 2 * .5 + x[:n] * gain * .5 * (pan >= .5)
def whoosh(d=.6, f0=300, f1=4000):
    n = int(d * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    cut = f0 + (f1 - f0) * np.sin(np.pi * tt / d) ** 2; y = np.zeros(n); acc = 0.0
    for i in range(n):
        a = np.exp(-2 * np.pi * cut[i] / SR); acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y * np.sin(np.pi * tt / d) ** 1.5 * 1.6
def boom(d=.9, f=55):
    n = int(d * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 60 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 4.5) * .9
def shimmer(d=1.2):
    n = int(d * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for f in (1760, 2217, 2637, 3520):
        x += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) * (.5 + .5 * np.sin(2 * np.pi * 7 * tt))
    return x * .08 * np.clip(tt / .05, 0, 1)
def pop(f=900):
    n = int(.12 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 - tt * 3) * tt) * np.exp(-tt * 40) * .5

def riser(d=.8, f0=200, f1=1800):
    n = int(d * SR); tt = np.arange(n) / SR; f = f0 * (f1 / f0) ** (tt / d)
    ph = 2 * np.pi * np.cumsum(f) / SR; x = np.sin(ph) + .5 * np.sin(2 * ph) + rng.standard_normal(n) * .25
    return x * (tt / d) ** 2 * .35
def reverse_swell(d=.7):
    n = int(d * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    return lowpass(x, 2500) * (tt / d) ** 3 * 2.2
def swipe(d=.25):
    n = int(d * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    hp = x - lowpass(x, 3000)
    return hp * np.sin(np.pi * tt / d) ** 2 * 1.1
def glitch(d=.4):
    n = int(d * SR); x = np.zeros(n); k = 0
    while k < n:
        L = int(SR * rng.uniform(.015, .045)); f = rng.choice([220, 440, 880, 1320, 1760]); tt = np.arange(min(L, n - k)) / SR
        x[k:k + len(tt)] = np.sign(np.sin(2 * np.pi * f * tt)) * .25 * rng.uniform(.4, 1); k += L + int(SR * rng.uniform(0, .02))
    return lowpass(x, 6000)

# Hook am Anfang: Warp-Riser, Einschlag, Glitch
add(riser(.5, 120, 2400), 0.0, .35); add(boom(1.2, 48), .45, .38); add(glitch(.35), .45, .18, .3)
add(boom(1.4, 45), 1.9, .32); add(glitch(.25), 1.9, .12, .7)   # BLAU?
# Übergänge: jedes Mal ein anderer Sound, dezent
trans = [
    (3.31, lambda: whoosh(.55, 400, 5000), .12, .3),
    (7.96, lambda: reverse_swell(.6), .14, .5),
    (12.96, lambda: swipe(.28), .16, .7),
    (18.16, lambda: riser(.5, 300, 1400), .12, .4),
    (23.16, lambda: whoosh(.8, 150, 1800), .11, .6),
]
for tb, fn, gain, pan in trans:
    x = fn(); add(x, tb - len(x) / SR * .8, gain, pan)
for tb in (7.96, 18.16):
    add(boom(.7, 60), tb, .14)
add(shimmer(1.6), 5.4, .9)            # Regenbogen
add(pop(700), 8.66, .5); add(pop(950), 8.96, .5)   # N2 / O2
for k in range(6): add(pop(1200 + k * 120), 14.16 + k * .45, .25, .3 + .4 * (k % 2))   # Streu-Pulse
add(shimmer(1.2), 15.6, .6)            # Zähler
add(whoosh(1.2, 200, 2500), 24.2, .08) # Sonne sinkt
add(boom(1.8, 40), 30.1, .4); add(shimmer(2.0), 30.15, .7)  # Schlusskarte
sfx[0] = lowpass(sfx[0], 9000); sfx[1] = lowpass(sfx[1], 9000)
save('sfx.wav', sfx)
print('ok')
