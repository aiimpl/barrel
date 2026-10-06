"""The barrel's sound, synthesised (no recordings): python tools/audio.py <out.wav> [seconds]
  0-3 s     in the mouth of the tube: the wave's roar, open and bright, the lip slapping down
  3-13 s    inside: the roar goes hollow and boomy (a low resonance), hiss of the water running up the face
  12.6-14.8 the spit: a blast of air and spray from behind, out through the eye
  15-19 s   outside again: open air, a second spit coming at the camera
Times follow web/src/main.js.
"""
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(5)


def ss(a, b, x):
    k = np.clip((x - a) / (b - a), 0, 1)
    return k * k * (3 - 2 * k)


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    w = np.exp(-np.maximum(lo - f, 0) ** 2 / (2 * (0.3 * lo + 10) ** 2)) * np.exp(-np.maximum(f - hi, 0) ** 2 / (2 * (0.3 * hi + 10) ** 2))
    return np.fft.irfft(X * w, len(x))


def resonance(x, f0, q):
    """a soft peak around f0 (the hollow 'inside a tube' colour)"""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (1 + q * np.exp(-((f - f0) / (f0 * 0.25)) ** 2)), len(x))


def main():
    out = sys.argv[1]
    dur = float(sys.argv[2]) if len(sys.argv) > 2 else 19.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    w = rng.standard_normal(n)
    inside = ss(2.9, 3.2, t) * (1 - ss(14.6, 15.6, t))
    # the roar: broadband, slowly breathing
    breath = 0.75 + 0.25 * np.sin(2 * np.pi * 0.35 * t) * np.sin(2 * np.pi * 0.13 * t + 1)
    roar_open = band(w, 60, 6000) * breath
    roar_in = resonance(band(w, 30, 900), 95, 6.0) * breath * 1.6
    roar = roar_open * (1 - inside) * 0.8 + roar_in * inside
    # the water running up the face: a hiss that swells as the ride goes deeper
    hiss = band(rng.standard_normal(n), 2500, 11000) * (0.25 + 0.5 * ss(4, 12.5, t)) * inside * 0.5
    # slaps of the lip landing (outside), irregular
    slaps = np.zeros(n)
    for k in range(40):
        at = rng.random() * dur
        i = int(at * SR)
        L = min(int(0.5 * SR), n - i)
        tt = np.arange(L) / SR
        slaps[i:i + L] += band(rng.standard_normal(L), 80, 2500) * np.exp(-tt * 9) * (0.4 + 0.6 * rng.random())
    slaps *= (1 - inside * 0.85) * 0.5
    # the spits: a pressure blast (low thump + rushing air) each
    spit = np.zeros(n)
    for at, g in ((12.9, 1.0), (16.3, 0.8)):
        env = ss(at, at + 0.35, t) * (1 - ss(at + 1.2, at + 2.4, t))
        spit += band(rng.standard_normal(n), 400, 12000) * env * g * 1.3
        i = int(at * SR)
        L = min(int(1.2 * SR), n - i)
        tt = np.arange(L) / SR
        spit[i:i + L] += np.sin(2 * np.pi * (40 + 50 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 3) * g * 2.0
    mix = roar * 0.6 + hiss + slaps + spit * 0.5
    mix *= np.minimum(1, np.minimum(t / 0.3, (dur - t) / 0.8))
    mix /= np.max(np.abs(mix)) * 1.15
    st = np.stack([mix, np.roll(band(rng.standard_normal(n), 60, 6000) * 0.0 + mix, 220)], 1)
    with wave.open(out, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((st * 32767).astype(np.int16).tobytes())
    print(out, dur)


main()
