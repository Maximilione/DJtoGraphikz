#!/usr/bin/env python3
"""Does any effect, post or Auto VJ post chain paint the projector white, black
or flat? Launches the built app once with DJG_SELFTEST_SWEEP, which walks all
of them in the real pipeline and probes the output window after each; this
reads the lines back and fails on the first wall nobody wants.

    yarn build && python3 scripts/check-sweep.py          # ~5 min, one launch
    DJG_SWEEP_DEV=1 python3 scripts/check-sweep.py         # against yarn dev
"""
import os
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

REPO = pathlib.Path(__file__).resolve().parent.parent
LOG_DIR = pathlib.Path.home() / ".djtographikz" / "logs"
WHITE_MEAN, BLACK_MEAN, FLAT_STD = 0.92, 0.015, 0.006
SETTLE_MS = 420000


def main() -> int:
    started = time.time() - 1
    env = {**os.environ,
           "DJG_SELFTEST": "/tmp/djg-sweep.png",
           "DJG_SELFTEST_SWEEP": "1",
           "DJG_SELFTEST_DELAY_MS": str(SETTLE_MS)}
    # --audio: the same sweep with a synthetic 128 BPM track playing (looped),
    # the condition that pushes bloom + feedback + strobes toward WHITE. The
    # default run is silence, the condition that pushes toward black. Both
    # matter; the audio one is audible on the machine for the whole sweep.
    if "--audio" in sys.argv:
        import importlib.util
        spec = importlib.util.spec_from_file_location("dryrun", REPO / "scripts" / "check-dryrun.py")
        dry = importlib.util.module_from_spec(spec); spec.loader.exec_module(dry)
        wav = pathlib.Path("/tmp/djg-sweep-128.wav")
        dry.make_wav(wav, 128.0)
        env["DJG_SELFTEST_AUDIO"] = str(wav)
        print("con audio sintetico a 128 BPM (si sente)")
    env.pop("ELECTRON_RUN_AS_NODE", None)
    cmd = ["yarn", "dev"] if os.environ.get("DJG_SWEEP_DEV") else ["yarn", "preview"]
    print("avvio app, sweep di effetti, post e catene Auto VJ (~5 min)…")
    proc = subprocess.run(cmd, cwd=REPO, env=env, capture_output=True, text=True, timeout=SETTLE_MS / 1000 + 90)
    logs = [p for p in LOG_DIR.glob("*.log") if p.stat().st_mtime >= started]
    text = "".join(p.read_text(errors="replace") for p in logs) + proc.stdout
    rows = re.findall(r"\[Sweep\] kind=(\w+) id=(\S+) mean=([\d.]+) std=([\d.]+) bright=([\d.]+) fps=(\d+)", text)
    noprobe = re.findall(r"\[Sweep\] kind=(\w+) id=(\S+) NOPROBE", text)
    done = "[Sweep] done" in text
    if not rows:
        print("FALLITO: nessuna misura (lo sweep non e' partito?)")
        for line in text.splitlines():
            if "Sweep" in line or "error" in line.lower():
                print("   ", line[-160:])
        return 1
    bad = []
    for kind, ident, mean, std, bright, fps in rows:
        mean, std, bright = float(mean), float(std), float(bright)
        flag = ("BIANCO" if mean > WHITE_MEAN else "NERO" if mean < BLACK_MEAN else "PIATTO" if std < FLAT_STD else "")
        if flag:
            bad.append((flag, kind, ident, mean, std))
    print(f"{len(rows)} misure, sweep {'completo' if done else 'INTERROTTO'}, {len(noprobe)} senza risposta")
    for flag, kind, ident, mean, std in bad:
        print(f"  {flag:7} {kind:6} {ident:40} media={mean:.3f} std={std:.3f}")
    worst = max(rows, key=lambda r: float(r[2]))
    print(f"  piu' chiaro: {worst[0]} {worst[1]} media={worst[2]}  ·  piu' scuro: " +
          "{0} {1} media={2}".format(*min(rows, key=lambda r: float(r[2]))))
    if bad or not done or noprobe:
        print("FALLITO")
        return 1
    print("OK: nessun effetto, post o catena dipinge il proiettore bianco, nero o fermo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
