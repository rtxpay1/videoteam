# Setzt timing.json in die Szene ein: build.py <projektordner>  ->  scene_built.html
# Steht in sound.json ein Tempo (bpm), kommt es als TIMING.bpm mit: lib.js legt die Übergänge damit auf den Takt.
import sys, os, json
d = sys.argv[1]
src = open(os.path.join(d, 'scene.html'), encoding='utf-8').read()
T = json.load(open(os.path.join(d, 'timing.json'), encoding='utf-8'))
sj = os.path.join(d, 'sound.json')
if os.path.exists(sj): T['bpm'] = json.load(open(sj)).get('bpm', 96)
open(os.path.join(d, 'scene_built.html'), 'w', encoding='utf-8').write(src.replace('__TIMING__', json.dumps(T, ensure_ascii=False)))
