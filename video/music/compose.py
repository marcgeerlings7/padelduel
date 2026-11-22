"""
Zelf gecomponeerde, synthetische achtergrondmuziek voor de PadelDuel-uitlegvideo.
Volledig in code gegenereerd (geen samples) -> rechtenvrij, geen licentie nodig.

120 BPM, 4/4, A-mineur (Am - F - C - G). 1 maat = 2 s = 60 frames bij 30 fps.
Structuur (maten): 0-2 intro | 2-17 beat | 17-19 break | 19-24 beat | 24-25 outro | 25 slotakkoord.
Uitvoer: ../public/audio/<preset>.wav (44.1 kHz, stereo, 16-bit).

    python3 compose.py            # v2 -> music.wav
    python3 compose.py v3         # uitlegvideo v3 -> music-v3.wav (rustiger onder de voice-over)
    python3 compose.py social     # korte social-versie -> music-social.wav
"""
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
PRESET = sys.argv[1] if len(sys.argv) > 1 else "v2"
# per preset: aantal maten, maten met beat, break-maten, intro-maten,
# balwissels (s) en ducking (muziekvolume onder de voice-over)
PRESETS = {
    "v2": dict(bars=26, beat=set(range(2, 17)) | set(range(19, 24)), brk={17, 18}, intro=2,
               hits=[0.0, 1.0, 1.5], whooshes=[b * 2.0 - 0.45 for b in (2, 4, 7, 10, 13, 17, 19, 22)],
               gain=1.0, out="music.wav"),
    # v3: scènes 4,4,8,6,8,8,4,10 s → wissels op 4,8,16,22,30,38,42 s
    "v3": dict(bars=26, beat=set(range(2, 21)), brk={21}, intro=2,
               hits=[t - 0.25 for t in (4, 8, 16, 22, 30, 38, 42)], whooshes=[t - 0.3 for t in (4, 8, 16, 22, 30, 38, 42)],
               gain=0.55, out="music-v3.wav"),
    # social: scènes 4,4,4,8 s → wissels op 4,8,12 s
    "social": dict(bars=10, beat=set(range(1, 9)), brk=set(), intro=1,
                   hits=[t - 0.25 for t in (4, 8, 12)], whooshes=[t - 0.3 for t in (4, 8, 12)],
                   gain=0.6, out="music-social.wav"),
}
P = PRESETS[PRESET]
BARS = P["bars"]
N = int(BARS * BAR * SR) + SR  # 1 s staart
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)


def t_of(n):
    return np.arange(n) / SR


def add(sig, start_s, pan=0.0, gain=1.0):
    i = int(start_s * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * np.cos((pan + 1) * np.pi / 4)
    R[i : i + len(sig)] += sig * np.sin((pan + 1) * np.pi / 4)


def lp(sig, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "low", fs=SR, output="sos"), sig)


def hp(sig, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "high", fs=SR, output="sos"), sig)


def env(n, a=0.005, d=0.1, s=0.0, rel=0.05, hold=None):
    """Eenvoudige ADSR; hold = duur van het sustain-deel in s."""
    t = t_of(n)
    e = np.ones(n) * s
    ai = int(a * SR)
    di = int(d * SR)
    e[:ai] = np.linspace(0, 1, max(ai, 1))[:ai]
    e[ai : ai + di] = np.linspace(1, s, max(di, 1))[: len(e[ai : ai + di])]
    if hold is not None:
        ri = int((a + d + hold) * SR)
        if ri < n:
            e[ri:] = s * np.exp(-(t[ri:] - t[ri]) / max(rel, 1e-3))
    return e


def saw(freq, n, detune=0.0):
    t = t_of(n)
    f = freq * (1 + detune)
    return 2 * ((t * f) % 1) - 1


def note(name):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    base, octv = name[:-1], int(name[-1])
    semis = names[base[0]] + (1 if "#" in base else 0) + (octv - 4) * 12
    return 440 * 2 ** (semis / 12)


# --- instrumenten ---------------------------------------------------------
def kick():
    n = int(0.35 * SR)
    t = t_of(n)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 0.95


def clap():
    n = int(0.25 * SR)
    noise = rng.uniform(-1, 1, n)
    e = np.exp(-t_of(n) * 22)
    return hp(lp(noise, 6000), 900) * e * 0.5


def hat(open_=False):
    n = int((0.22 if open_ else 0.06) * SR)
    noise = rng.uniform(-1, 1, n)
    return hp(noise, 7500, 4) * np.exp(-t_of(n) * (12 if open_ else 60)) * 0.22


def bass(freq, dur):
    n = int(dur * SR)
    s = saw(freq, n) * 0.6 + np.sin(2 * np.pi * freq * t_of(n)) * 0.6
    return lp(s, 420) * env(n, 0.004, dur * 0.6, 0.35, 0.03, hold=dur * 0.3) * 0.5


def pad(freqs, dur, cutoff=1400):
    n = int(dur * SR)
    s = np.zeros(n)
    for f in freqs:
        for dt in (-0.006, 0.0, 0.007):
            s += saw(f, n, dt)
    s = lp(s / (len(freqs) * 3), cutoff)
    return s * env(n, 0.25, 0.3, 0.8, 0.4, hold=dur - 0.6) * 0.32


def pluck(freq, dur=0.22):
    n = int(dur * SR)
    s = saw(freq, n) * 0.5 + np.sin(2 * np.pi * 2 * freq * t_of(n)) * 0.25
    return lp(s, 3200) * np.exp(-t_of(n) * 14) * 0.22


def ball_hit():
    """Padelbal-'pok': korte toon + ruisklik."""
    n = int(0.12 * SR)
    t = t_of(n)
    tone = np.sin(2 * np.pi * 1150 * t) * np.exp(-t * 55)
    click = hp(rng.uniform(-1, 1, n), 2500) * np.exp(-t * 120)
    return (tone * 0.7 + click * 0.5) * 0.8


def whoosh(dur=0.5):
    n = int(dur * SR)
    noise = rng.uniform(-1, 1, n)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        cutoff = 400 + 7000 * (k / steps) ** 2
        out[a:b] = lp(noise, cutoff)[a:b]
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return out * e * 0.18


CHORDS = [  # Am, F, C, G
    ("A2", ["A3", "C4", "E4"]),
    ("F2", ["F3", "A3", "C4"]),
    ("C3", ["G3", "C4", "E4"]),
    ("G2", ["G3", "B3", "D4"]),
]

BEAT_BARS = P["beat"]
BREAK_BARS = P["brk"]
INTRO = P["intro"]

for bar in range(BARS):
    t0 = bar * BAR
    root, tones = CHORDS[bar % 4]
    freqs = [note(x) for x in tones]
    last = bar == BARS - 1

    if last:
        # slotakkoord: Am, lang uitklinkend
        add(pad([note("A3"), note("C4"), note("E4"), note("A4")], 2.0, 1800), t0, gain=1.2)
        add(bass(note("A2"), 1.5), t0)
        add(kick(), t0)
        add(ball_hit(), t0 + 0.02, pan=0.2)
        continue

    cutoff = 700 if bar < INTRO else (1000 if bar in BREAK_BARS or bar == BARS - 2 else 1600)
    add(pad(freqs, BAR, cutoff), t0, gain=1.0)

    # arpeggio (16e), in de intro gedempt
    arp = freqs + [freqs[0] * 2]
    for k in range(16):
        f = arp[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]] * 2
        g = 0.5 if bar < INTRO else (0.9 if bar in BREAK_BARS else 0.7)
        add(pluck(f), t0 + k * BEAT / 4, pan=0.35 if k % 2 else -0.35, gain=g)

    if bar in BEAT_BARS:
        for b in range(4):
            add(kick(), t0 + b * BEAT)
            add(hat(), t0 + b * BEAT + BEAT / 2, pan=0.25)
            if b in (1, 3):
                add(clap(), t0 + b * BEAT, pan=-0.1)
        add(hat(open_=True), t0 + 3.5 * BEAT, pan=0.3)
        for k in range(8):
            add(bass(note(root), BEAT / 2 * 0.9), t0 + k * BEAT / 2)
    elif bar < INTRO:
        for k in range(8):
            add(hat(), t0 + k * BEAT / 2, pan=0.25, gain=0.5)

# Geluidseffecten, synchroon met de video (seconden)
# muziek (alles behalve effecten) zachter onder een voice-over
L *= P["gain"]
R *= P["gain"]
for s_ in P["hits"]:
    add(ball_hit(), max(0.0, s_), pan=0.2)
for w in P["whooshes"]:
    add(whoosh(), max(0.0, w), pan=0.0)

mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.4) / np.tanh(1.4)  # zachte limiter
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = mix / np.max(np.abs(mix)) * (0.89 if PRESET == "v2" else 0.5)
wavfile.write(f"../public/audio/{P['out']}", SR, (mix * 32767).astype(np.int16))
print(f"{P['out']}: {len(mix) / SR:.1f} s")
