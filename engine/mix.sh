#!/bin/bash
# Mix: Hausstimme klar vorne (laut, euphorisch), Musik duckt unter der Stimme, Master auf −14 LUFS.
# Aufruf: mix.sh <projektordner>  ->  mix.wav
set -e
d="$1"
ffmpeg -loglevel error -y -i "$d/voice.wav" -i "$d/music.wav" -i "$d/sfx.wav" -filter_complex "[0:a]aresample=44100,highpass=f=80,equalizer=f=250:t=q:w=1:g=-1.5,equalizer=f=4000:t=q:w=1.2:g=1.5,acompressor=threshold=-24dB:ratio=3:attack=5:release=120,volume=1.15,pan=stereo|c0=c0|c1=c0,asplit=2[v][sc];[1:a]volume=0.8[m];[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=500[duck];[v][duck][2:a]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 "$d/mix.wav"
ffmpeg -hide_banner -i "$d/mix.wav" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '
