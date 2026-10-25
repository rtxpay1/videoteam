#!/bin/bash
# Mix: Hausstimme klar vorne (laut, euphorisch), Musik und Effekte ducken unter der Stimme, Master auf −14 LUFS.
# Aufruf: mix.sh <projektordner>  ->  mix.wav
set -e
d="$1"
# Stimme: Rauschen raus, Zischlaute weicher, Präsenz und Glanz, Kompressor
# Effekte: leiser, Spitzen gekappt (Booms!) und unter der Stimme zusätzlich abgesenkt
ffmpeg -loglevel error -y -i "$d/voice.wav" -i "$d/music.wav" -i "$d/sfx.wav" -filter_complex "[0:a]aresample=44100,highpass=f=80,afftdn=nf=-40,deesser=i=0.35,equalizer=f=250:t=q:w=1:g=-1.5,equalizer=f=4000:t=q:w=1.2:g=2,equalizer=f=10000:t=h:w=1:g=1,acompressor=threshold=-24dB:ratio=3:attack=5:release=120,volume=1.15,pan=stereo|c0=c0|c1=c0,asplit=3[v][sc][sc2];[1:a]volume=0.8[m];[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=500[duck];[2:a]aresample=44100,volume=0.7,acompressor=threshold=-26dB:ratio=4:attack=2:release=150,alimiter=limit=0.28:attack=1:release=60:level=0[fx];[fx][sc2]sidechaincompress=threshold=0.03:ratio=4:attack=15:release=350[fxd];[v][duck][fxd]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 "$d/mix.wav"
ffmpeg -hide_banner -i "$d/mix.wav" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '
