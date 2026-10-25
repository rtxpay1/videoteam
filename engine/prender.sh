#!/bin/bash
# Paralleles Rendern: teilt das Video in N Stücke, rendert sie gleichzeitig und fügt sie verlustfrei zusammen.
# Aufruf: prender.sh <scene_built.html> <out.mp4> <dauer> [N=4] [fps=30]   (4 Teile: auf 4 Kernen gemessen ~20 % schneller als 3)
set -e
html="$1"; out="$2"; dur="$3"; N="${4:-4}"; FPS="${5:-30}"
tmp="$(dirname "$out")/.parts"; mkdir -p "$tmp"; rm -f "$tmp"/*
frames=$(python3 -c "print(round($dur*$FPS))")
per=$(( (frames + N - 1) / N ))
for k in $(seq 0 $((N-1))); do
  a=$(python3 -c "print($k*$per/$FPS)"); b=$(python3 -c "print(min($frames,($k+1)*$per)/$FPS)")
  START=$a node /home/user/videoteam/engine/render.js "$html" "$tmp/p$k.mp4" "$b" $FPS > "$tmp/p$k.log" 2>&1 &
done
wait
for k in $(seq 0 $((N-1))); do echo "file 'p$k.mp4'"; done > "$tmp/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$tmp/list.txt" -c copy -movflags +faststart "$out"
rm -rf "$tmp"
