# Hausstimme: Chatterbox Multilingual, Stimme nach Vorlage von Bernd Ungerer (HUI-Korpus, CC0)
# Aufruf: tts.py <ausgabeordner> < zeilen.txt   -> s1.wav, s2.wav, ...
import sys, os, torch, torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
# Stimme wählbar per Umgebungsvariable VOICE (karlsson | bernd | eva), Standard: karlsson (Hausstimme)
VOICE = os.environ.get('VOICE', 'karlsson')
REF = os.path.join(os.path.dirname(__file__), '..', 'voices', f'hausstimme_{VOICE}.wav')
EX, CFGW, TEMP = {'karlsson': (1.2, .3, .8), 'bernd': (1.3, .3, .8), 'eva': (.8, .35, .75)}[VOICE]
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
for i, line in enumerate([l.strip() for l in sys.stdin if l.strip()], 1):
    torch.manual_seed(1234)
    wav = model.generate(line, language_id='de', audio_prompt_path=REF, exaggeration=EX, cfg_weight=CFGW, temperature=TEMP)
    torchaudio.save(os.path.join(out, f's{i}.wav'), wav, model.sr)
    print(f's{i}.wav', round(wav.shape[-1] / model.sr, 2), flush=True)
