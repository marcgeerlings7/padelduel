"""
AI-voice-over voor de PadelDuel-video's (v3), gegenereerd met Piper TTS
(MIT, offline) en de Nederlandse stem "rdh" (dataset CC0 1.0).

    pip install piper-tts scipy
    PIPER_VOICE=/pad/naar/nl-rdh-medium.onnx python3 generate.py

De stem staat niet in de repo (63 MB); download:
https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-nl-rdh-medium.tar.gz

Schrijft ../public/audio/vo/<id>.wav en ../src/vo-timings.json (duur per regel),
zodat de scènes in Remotion zich naar de stem schikken.
"""
import json
import os
import subprocess
import tempfile

from scipy.io import wavfile

VOICE = os.environ.get("PIPER_VOICE", "nl-rdh-medium.onnx")
LENGTH_SCALE = "1.08"  # iets rustiger dan standaard

LINES = {
    # Uitlegvideo (website)
    "hook": "Jullie denken dat jullie het beste duo zijn? Bewijs het.",
    "problem": "Je rating meet alleen jou. Maar padel speel je samen.",
    "duo": "Op PadelDuel krijgt elk duo een eigen rating. Speel je met meerdere partners? Dan telt elke combinatie apart.",
    "tiers": "Je daagt duo's van jouw niveau uit, in je hele regio. Nooit kansloos, nooit saai.",
    "placement": "Nieuw duo? In je eerste tien wedstrijden mag je ook hoger uitdagen. Zo sta je snel op je echte niveau.",
    "flow": "Uitdagen. Binnen vijf dagen reageren. Spelen, en de uitslag invoeren. Afspraak is afspraak.",
    "screens": "Alles regel je in de app. De baan boek je gewoon bij je club.",
    "outro": "Je rating zegt hoe goed jij bent. PadelDuel zegt hoe goed jullie samen zijn. Probeer de demo op padelduel punt vercel punt app.",
    # Korte social-versie
    "s_hook": "Jullie denken dat jullie het beste duo zijn?",
    "s_duo": "Op PadelDuel krijgt elk duo een eigen rating.",
    "s_tiers": "Daag duo's van jouw niveau uit, in je hele regio.",
    "s_outro": "Bewijs het. Probeer de demo op padelduel punt vercel punt app.",
}

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.join(here, "..", "public", "audio", "vo")
os.makedirs(out_dir, exist_ok=True)
timings = {}
for key, text in LINES.items():
    path = os.path.join(out_dir, f"{key}.wav")
    cfg = VOICE + ".json"
    subprocess.run(
        ["python3", "-m", "piper", "-m", VOICE, "-c", cfg, "-f", path, "--length-scale", LENGTH_SCALE],
        input=text.encode(),
        check=True,
        capture_output=True,
    )
    sr, data = wavfile.read(path)
    timings[key] = {"seconds": round(len(data) / sr, 3), "text": text}
    print(f"{key:10s} {timings[key]['seconds']:5.2f}s  {text}")

with open(os.path.join(here, "..", "src", "vo-timings.json"), "w") as f:
    json.dump(timings, f, indent=2, ensure_ascii=False)
