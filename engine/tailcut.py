# Schneidet erfundenes Gestammel am Satzende ab: Die Spracherkennung liefert Wort-Zeiten; kommen nach dem letzten
# Wort des Skripts noch weitere Wörter (z. B. „… da sind. Abzieh ihr es.“), wird die Aufnahme direkt nach dem
# letzten echten Wort abgeschnitten.
# Als Modul: cut(asr, wav, sr, text) -> (wav, abgeschnitten_sekunden)
# Als Befehl: tts-env/bin/python engine/tailcut.py <satz.wav> "<text des satzes>"   (überschreibt die Datei)
import re, sys, difflib, torch, torchaudio

norm = lambda w: re.sub(r'[^a-zäöüß0-9]', '', w.lower())

def cut(asr, wav, sr, text):
    pcm = torchaudio.functional.resample(wav, sr, 16000)[0].numpy().astype('float32')
    ws = [w for s in asr.transcribe(pcm, language='de', beam_size=5, word_timestamps=True)[0] for w in s.words if norm(w.word)]
    last = [norm(w) for w in text.split() if norm(w)][-2:]
    if not ws or not last: return wav, 0.0
    # letztes gehörtes Wort, das zu einem der letzten beiden Skriptwörter passt
    hit = max((k for k, w in enumerate(ws) if difflib.get_close_matches(norm(w.word), last, n=1, cutoff=.7)), default=None)
    if hit is None or hit == len(ws) - 1: return wav, 0.0
    if ws[hit + 1].start < ws[hit].end + .15: return wav, 0.0   # direkt angehängt: vermutlich doch Teil des Satzes
    # Whisper setzt Wortenden oft zu früh: erst in der ersten echten Stille nach dem Wort schneiden, damit die Endung bleibt
    x = wav[0].abs(); w = int(.02 * sr); pk = float(x.max()) + 1e-9
    a, b = int((ws[hit].end + .05) * sr), int(ws[hit + 1].start * sr)
    end = None
    for i in range(a, max(a, b - w), w):
        if float(x[i:i + w].pow(2).mean().sqrt()) < pk * .02: end = i / sr + .06; break   # ca. -34 dB unter Spitze
    if end is None: end = max(ws[hit].end + .3, (ws[hit].end + ws[hit + 1].start) / 2)
    n = min(wav.shape[-1], int(end * sr)); fade = int(.05 * sr)
    out = wav[..., :n].clone(); out[..., -fade:] *= torch.linspace(1, 0, fade)
    return out, round((wav.shape[-1] - n) / sr, 2)

if __name__ == '__main__':
    from faster_whisper import WhisperModel
    asr = WhisperModel('small', device='cpu', compute_type='int8')
    wav, sr = torchaudio.load(sys.argv[1])
    out, cutoff = cut(asr, wav, sr, re.sub(r'^\[[+\-=]\]\s*', '', sys.argv[2]))
    if cutoff: torchaudio.save(sys.argv[1], out, sr)
    print(f'{sys.argv[1]}: {cutoff} s abgeschnitten')
