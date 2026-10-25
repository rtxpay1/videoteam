# Hausstimme: Chatterbox Multilingual mit Stimmvorlage, danach Prüfung jedes Satzes per Spracherkennung (Whisper)
# Aufruf: tts.py <ausgabeordner> < zeilen.txt   -> s1.wav, s2.wav, ...
#
# Betonung pro Satz über ein Zeichen am Zeilenanfang (wird vor dem Einsprechen entfernt):
#   [+] Hook, große Zahl, Pointe: maximal aufgedreht      [-] Erklärsatz: ruhiger, damit man folgen kann
# Aussprache: engine/aussprache.json ersetzt Wörter nur für die Stimme (Untertitel bleiben wie geschrieben).
# Prüfung: Whisper hört jeden Satz ab. Fehlen Wörter oder ist der Satz viel zu lang (Gestammel), wird er
# mit anderem Zufallswert neu eingesprochen (höchstens 2-mal), der beste Versuch bleibt.
import sys, os, re, json, difflib, torch, torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

HERE = os.path.dirname(__file__)
# Stimme wählbar per Umgebungsvariable VOICE (eigen | karlsson | bernd | eva).
# Standard: eigen (eigene Stimmvorlage des Kanals), wenn die Vorlage da ist, sonst karlsson.
REF_OF = lambda v: os.path.join(HERE, '..', 'voices', f'hausstimme_{v}.wav')
VOICE = os.environ.get('VOICE') or ('eigen' if os.path.exists(REF_OF('eigen')) else 'karlsson')
REF = REF_OF(VOICE)
EX, CFGW, TEMP = {'karlsson': (1.2, .3, .8), 'bernd': (1.3, .3, .8), 'eva': (.8, .35, .75), 'eigen': (1.9, .22, .8)}[VOICE]
# Feineinstellung per Umgebungsvariable: EXAG (Ausdruck), CFGW (kleiner = lebendiger), TEMP
EX, CFGW, TEMP = float(os.environ.get('EXAG', EX)), float(os.environ.get('CFGW', CFGW)), float(os.environ.get('TEMP', TEMP))
MOOD = {'+': (EX + .2, max(.15, CFGW - .04)), '-': (max(.5, EX - .6), CFGW + .1), '': (EX, CFGW)}
CHECK = os.environ.get('CHECK', '1') != '0'

AUS = json.load(open(os.path.join(HERE, 'aussprache.json'), encoding='utf-8'))
def speakable(s):
    for k, v in AUS.items():
        s = re.sub(r'(?<!\w)' + re.escape(k) + r'(?!\w)', v, s)
    return s

# Zahlwörter schreibt Whisper oft als Ziffern, deshalb werden sie bei der Prüfung nicht verlangt
NUM = re.compile(r'(null|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zig|ßig|hundert|tausend|million|milliard|billion|trillion)')
words = lambda s: re.findall(r'[a-zäöüß]+', s.lower())
def score(text, heard):
    want = [w for w in words(text) if len(w) > 2 and not NUM.search(w)]
    got = words(heard)
    if not want: return 1.0
    return sum(1 for w in want if difflib.get_close_matches(w, got, n=1, cutoff=.75)) / len(want)

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
asr = None
if CHECK:
    from faster_whisper import WhisperModel
    asr = WhisperModel('small', device='cpu', compute_type='int8')

for i, raw in enumerate([l.strip() for l in sys.stdin if l.strip()], 1):
    m = re.match(r'^\[([+\-=])\]\s*', raw); mood = m.group(1).replace('=', '') if m else ''; text = raw[m.end():] if m else raw
    ex, cfg = MOOD[mood]
    best = None
    for k in range(3 if asr else 1):
        torch.manual_seed(1234 + k)
        wav = model.generate(speakable(text), language_id='de', audio_prompt_path=REF, exaggeration=ex, cfg_weight=cfg, temperature=TEMP)
        dur = wav.shape[-1] / model.sr
        if not asr: best = (1, wav, ''); break
        pcm = torchaudio.functional.resample(wav, model.sr, 16000)[0].numpy().astype('float32')   # direkt aus dem Speicher, ohne Datei
        heard = ' '.join(s.text for s in asr.transcribe(pcm, language='de', beam_size=1)[0])
        sc = score(text, heard) - (.3 if dur > len(words(text)) * .7 + 1.5 else 0)   # viel zu lang = Gestammel
        if best is None or sc > best[0]: best = (sc, wav, heard)
        if sc >= .9: break
        print(f'  s{i} Versuch {k + 1}: {sc:.2f} gehört: {heard.strip()}', flush=True)
    torchaudio.save(os.path.join(out, f's{i}.wav'), best[1], model.sr)
    print(f's{i}.wav', round(best[1].shape[-1] / model.sr, 2), f'Prüfung {best[0]:.2f}' if asr else '', flush=True)
