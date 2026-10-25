# Setzt timing.json in die Szene ein: build.py <projektordner>  ->  scene_built.html
import sys, os, json
d = sys.argv[1]
src = open(os.path.join(d, 'scene.html'), encoding='utf-8').read()
tim = open(os.path.join(d, 'timing.json'), encoding='utf-8').read()
open(os.path.join(d, 'scene_built.html'), 'w', encoding='utf-8').write(src.replace('__TIMING__', tim))
