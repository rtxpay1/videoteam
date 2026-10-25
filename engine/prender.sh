#!/bin/bash
# Paralleles Rendern: teilt das Video in N Stücke, rendert sie gleichzeitig und fügt sie verlustfrei zusammen.
# Aufruf: prender.sh <scene_built.html> <out.mp4> <dauer> [N=3]
set -e
html="$1"; out="$2"; dur="$3"; N="${4:-3}"
tmp="$(dirname "$out")/.parts"; mkdir -p "$tmp"; rm -f "$tmp"/*
frames=$(python3 -c "print(round($dur*30))")
per=$(( (frames + N - 1) / N ))
for k in $(seq 0 $((N-1))); do
  a=$(python3 -c "print($k*$per/30)"); b=$(python3 -c "print(min($frames,($k+1)*$per)/30)")
  START=$a node /home/user/videoteam/engine/render.js "$html" "$tmp/p$k.mp4" "$b" 30 > "$tmp/p$k.log" 2>&1 &
done
wait
for k in $(seq 0 $((N-1))); do echo "file 'p$k.mp4'"; done > "$tmp/list.txt"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$tmp/list.txt" -c copy -movflags +faststart "$out"
rm -rf "$tmp"
