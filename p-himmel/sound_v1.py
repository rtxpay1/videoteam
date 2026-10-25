# Ton: Musikbett und Soundeffekte per Synthese erzeugen
import numpy as np, wave

SR, DUR = 44100, 30.24
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
    if ts < 3.1 or ts > 28.3: continue
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

for tb in (3.11, 7.67, 11.76, 16.94, 21.94):
    add(whoosh(), tb - .32, .22); add(boom(), tb, .32)
add(boom(1.4, 45), 1.72, .45)          # BLAU? schlägt ein
add(shimmer(1.6), 4.56, .9)            # Regenbogen
add(pop(700), 8.37, .5); add(pop(950), 8.67, .5)   # N2 / O2
for k in range(6): add(pop(1200 + k * 120), 12.96 + k * .45, .25, .3 + .4 * (k % 2))   # Streu-Pulse
add(shimmer(1.2), 14.0, .6)            # Zähler
add(whoosh(1.2, 200, 2500), 23.0, .18) # Sonne sinkt
add(boom(1.8, 40), 28.24, .4); add(shimmer(2.0), 28.3, .7)  # Schlusskarte
sfx[0] = lowpass(sfx[0], 9000); sfx[1] = lowpass(sfx[1], 9000)
save('sfx.wav', sfx)
print('ok')
