#!/usr/bin/env python3
"""Does the beat and BPM machinery actually work?

Until now the only way to find out was a night out: the analyser opened the
microphone, so nothing about tempo, beat or envelope could be checked at a
desk. P1 lets it analyse a file instead, and this feeds it one whose tempo we
know exactly, then reads back what the app made of it.

    python3 scripts/check-dryrun.py           # 128 BPM four-on-the-floor
    python3 scripts/check-dryrun.py 174       # any tempo
    python3 scripts/check-dryrun.py mio.wav   # or your own file (no assertion
                                              # on tempo — it just reports)

The tone is synthesised here rather than committed: a couple of megabytes of
wav in the repo to assert one number is a bad trade, and generating it keeps
the expected tempo and the signal in the same place.
"""
import math
import os
import pathlib
import re
import struct
import subprocess
import sys
import time
import wave

REPO = pathlib.Path(__file__).resolve().parent.parent
LOG_DIR = pathlib.Path.home() / ".djtographikz" / "logs"
SR = 44100
SECONDS = 30
SETTLE_MS = 26000


def make_wav(path: pathlib.Path, bpm: float) -> None:
    """Four-on-the-floor: a decaying sine kick on every beat, noise hats on the
    off-eighths, over a continuous sub-bass and a pad.

    The bass and pad are not decoration. A bare metronome is *below the noise
    gate* between hits — `NOISE_GATE = 0.015` in AudioAnalyzer exists precisely
    to reject a room that is almost silent — so a sparse fixture reads as
    silence three frames out of four and the tracker free-runs. Real music is
    continuous; the fixture has to be too, or it tests the gate instead of the
    beat detection."""
    beat = 60.0 / bpm
    n = int(SR * SECONDS)
    samples = [0.0] * n
    rnd = 0x2F6E2B1  # xorshift, so two runs produce the same file

    def noise():
        nonlocal rnd
        rnd ^= (rnd << 13) & 0xFFFFFFFF
        rnd ^= rnd >> 17
        rnd ^= (rnd << 5) & 0xFFFFFFFF
        return (rnd / 0x7FFFFFFF) - 1.0

    t = 0.0
    while t < SECONDS:
        start = int(t * SR)
        for i in range(int(SR * 0.22)):
            if start + i >= n:
                break
            env = math.exp(-i / (SR * 0.045))
            # pitch sweep 110 → 45 Hz: what makes a kick read as a kick
            f = 45 + 65 * math.exp(-i / (SR * 0.02))
            samples[start + i] += 0.85 * env * math.sin(2 * math.pi * f * i / SR)
        t += beat

    t = beat / 2
    while t < SECONDS:
        start = int(t * SR)
        for i in range(int(SR * 0.04)):
            if start + i >= n:
                break
            samples[start + i] += 0.16 * math.exp(-i / (SR * 0.006)) * noise()
        t += beat

    # Continuous bed: a 55 Hz sub with a moving eighth-note envelope, plus a
    # quiet mid pad. Keeps the signal above the gate between kicks without
    # putting a second transient anywhere near the beat grid.
    eighth = beat / 2
    for i in range(n):
        tt = i / SR
        swell = 0.55 + 0.45 * abs(math.sin(math.pi * tt / eighth))
        # Quiet enough that the adaptive normaliser does not pin the bass band
        # at 1.0 and starve everything else — it tracks a decaying peak, so one
        # loud continuous tone flattens the whole reading.
        samples[i] += 0.10 * swell * math.sin(2 * math.pi * 55 * tt)
        samples[i] += 0.06 * math.sin(2 * math.pi * 220 * tt)
        samples[i] += 0.05 * math.sin(2 * math.pi * 330 * tt + 0.7)
        samples[i] += 0.04 * math.sin(2 * math.pi * 1400 * tt + 1.3)

    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples))


def newest_log(after: float):
    logs = [p for p in LOG_DIR.glob("*.log") if p.stat().st_mtime >= after]
    return max(logs, key=lambda p: p.stat().st_mtime, default=None)


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else "128"
    expected = None
    if arg.replace(".", "").isdigit():
        expected = float(arg)
        audio = pathlib.Path(os.environ.get("DJG_SHOT_DIR", "/tmp")) / f"djg-dryrun-{arg}.wav"
        print(f"genero {SECONDS}s a {expected:g} BPM…")
        make_wav(audio, expected)
    else:
        audio = pathlib.Path(arg).resolve()
        if not audio.exists():
            print(f"FALLITO: {audio} non esiste")
            return 1
        print(f"file: {audio.name} (nessuna attesa sul tempo — riporto e basta)")

    started = time.time() - 1
    env = {
        **os.environ,
        "DJG_SELFTEST": str(pathlib.Path(os.environ.get("DJG_SHOT_DIR", "/tmp")) / "djg-dryrun.png"),
        "DJG_SELFTEST_AUDIO": str(audio),
        "DJG_SELFTEST_DELAY_MS": str(SETTLE_MS),
    }
    env.pop("ELECTRON_RUN_AS_NODE", None)   # silently kills Electron
    print("avvio app…")
    proc = subprocess.run(["yarn", "dev"], cwd=REPO, env=env,
                          capture_output=True, text=True, timeout=180)

    log = newest_log(started)
    text = (log.read_text(errors="replace") if log else "") + proc.stdout
    rows = re.findall(
        r"\[DryRun\] t=([\d.]+)s bpm=(\d+) conf=([\d.]+) beats=(\d+) energy=([\d.]+) bass=([\d.]+)",
        text)
    if not rows:
        print("FALLITO: l'app non ha analizzato il file")
        for line in text.splitlines():
            if "DryRun" in line:
                print("   ", line[-160:])
        return 1

    t, _, conf, beats, _, _ = rows[-1]
    t, conf, beats = float(t), float(conf), int(beats)
    # The tempo readout wobbles frame to frame while the estimator settles;
    # the median of the tail is what the app is actually showing, not whichever
    # instant the run happened to end on.
    tail_bpm = sorted(int(r[1]) for r in rows[-8:])
    bpm = tail_bpm[len(tail_bpm) // 2]
    # Energy is read one frame at a time and a kick-driven track swings hard
    # between hits; average the tail instead of sampling whichever instant the
    # run happened to end on.
    tail = rows[-6:]
    energy = sum(float(r[4]) for r in tail) / len(tail)
    bass = sum(float(r[5]) for r in tail) / len(tail)
    print(f"dopo {t:.0f}s di brano: bpm={bpm} conf={conf:.2f} battiti={beats} "
          f"energia={energy:.2f} bassi={bass:.2f} (media sugli ultimi {len(tail)}s)")

    ok = True
    if energy < 0.05:
        print("FALLITO: l'analisi non sente niente — energia a zero")
        ok = False
    if beats < t * 0.5:
        print(f"FALLITO: {beats} battiti in {t:.0f}s sono troppo pochi")
        ok = False
    if expected is not None:
        # Half and double time are the classic failure and they are *not* it:
        # the file is a bare four-on-the-floor, the grid is unambiguous.
        if abs(bpm - expected) > 2:
            print(f"FALLITO: atteso {expected:g} BPM, letto {bpm}")
            ok = False
        want = t / (60.0 / expected)
        if not (want * 0.75 <= beats <= want * 1.25):
            print(f"FALLITO: attesi ~{want:.0f} battiti, contati {beats}")
            ok = False

    print("OK: l'analisi segue il brano" if ok else "")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
