# videoteam

Video-Produktionsteam „Zum Goldenen Token“: deutsche Erklär-Shorts (9:16, 1080×1920, 60–70 s) für TikTok und YouTube.

## Aufbau

| Ordner / Datei | Inhalt |
|---|---|
| `engine/lib.js` | Grundgerüst jeder Szene: Untertitel, Übergänge, RGB-Split, Farbe, Korn, Dauerbewegung |
| `engine/fx.js` | Effekt-Bibliothek (Morphing, Pixel-Zerfall, Iris, Split-Screen, 3D-Drehung, Strichzeichnung, Warp, Partikel, Diagramme, Parallax …) |
| `engine/fx3d.js` | 3D-Baukasten im Hausstil „Goldener Token 3D“ (three.js): Low-Poly, Toon-Licht, Kontur; Planet, Mond, Felsen, Kristall, Ring, Papierstapel, Figur und das Maskottchen Eula (`FX3D.eula()`, Posen idle/wave/wow/point/think/happy/fly über `eu.pose(t, { mood })`). Beispiele: `qa/demo3d.html`, `qa/eula.html` |
| `engine/vendor/` | three.js 0.186.1 (MIT-Lizenz) |
| `engine/tts.py` | Hausstimme „Karlsson euphorisch“ (Chatterbox Multilingual, MIT; Vorlage aus dem HUI-Korpus, CC0) |
| `engine/timing.py` | Sprachspur + Satz-/Teilsatz-Zeiten, prüft die Länge 60–70 s |
| `engine/sound.py`, `engine/mix.sh` | Musik und Effekte erzeugen, Endmix auf −14 LUFS |
| `engine/render.js`, `engine/prender.sh` | Bild rendern (Playwright + ffmpeg), parallel in 4 Teilen, Schlüsselbild jede Sekunde |
| `engine/draft.sh` | Probe-Render (halbe Auflösung, 10 Bilder/s, ca. 1 Min.) mit Stillstand-Check und Übersichtsbild |
| `engine/produce.sh` | Alles nach der Stimme in einem Schritt: erst Probe-Render, dann echtes Rendern, Export, Stillstand-Check |
| `engine/export.sh` | Schnitt & Export aus motion.mp4 + mix.wav (HQ, Web unter 19 MB, Tonspuren) |
| `engine/fix.sh` | Nachbessern ohne komplettes Neu-Rendern: nur die korrigierten Sekunden neu, verlustfrei eingesetzt |
| `engine/stillcheck.py` | Prüft jede Sekunde auf sichtbare Bewegung |
| `voices/hausstimme_*.wav` | Stimmvorlagen |
| `p-*/` | Ein Ordner pro Video: `lines.txt` (Skript), `scene.html` (Animation), `sound_gen.py`, `sound.json`, `timing.json` |
| `kneipe/kneipe.html` | Quelltext der Kneipe (Arbeitsoberfläche, veröffentlicht als Claude-Artifact) |

## Neue Sitzung

```bash
./setup.sh                                   # Stimme + Sprachmodell installieren
./tts-env/bin/python engine/tts.py p-xyz/v < p-xyz/lines.txt
bash engine/produce.sh p-xyz xyz             # Timing, Ton, Mix, Render, Export, Stillstand-Check
bash engine/fix.sh p-xyz xyz 41 45           # nach einer Korrektur in scene.html nur 41–45 s neu rendern
```

Die Hausregeln stehen in der Kneipe (Datenbank `config/house`).
