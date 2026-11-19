"""Build the whiteboard version of video 1: per-scene narration + drawing, then join.

usage: python3 build_video1.py WORKDIR [scene numbers...]   (no scene numbers = all scenes, then join)
WORKDIR holds img/sNN.png (scene), img/pNN.png (narrator poses) and vo/lNN.mp3 (narration lines);
results go to WORKDIR/out and WORKDIR/AI_ozbek_tilida_oq_doska.mp4.
"""
import json, os, subprocess, sys
import numpy as np
from concurrent.futures import ThreadPoolExecutor

TOOLS = os.path.dirname(os.path.abspath(__file__))
WB = os.path.join(TOOLS, "wb2.py")
HAND = os.path.join(TOOLS, "assets", "hand.png")
HERE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
SR = 48000

# (scene, narration lines, number shown on the right, narrator pose image or None)
SCENES = [
    (1, [0], "", "p01"), (2, [1, 2], "", "p02"), (3, [3, 4, 5, 6], "3", None), (4, [7], "", "p04"),
    (5, [8], "", None), (6, [9], "", "p06"), (7, [10], "", None), (8, [11], "", None),
    (9, [12, 13], "", "p09"), (10, [14, 15], "", None), (11, [16], "", "p11"), (12, [17], "1", None),
    (13, [18], "2", None), (14, [19], "3", None), (15, [20], "", None), (16, [21], "1", None),
    (17, [22], "2", None), (18, [23], "3", "p18"), (19, [24], "4", None), (20, [25], "5", None),
    (21, [26], "", None), (22, [27], "", None), (23, [28], "", "p23"), (24, [29, 30, 31], "", "p24"),
]

LEAD, GAP, TAIL = 0.45, 0.45, 0.9


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").astype(np.float32)


def trim(y, thr_db=-45, pad=0.05):
    win = int(0.02 * SR)
    n = len(y) // win
    db = 20 * np.log10(np.sqrt(np.mean(y[:n * win].reshape(n, win) ** 2, 1)) + 1e-9)
    on = np.nonzero(db > thr_db)[0]
    if not len(on):
        return y
    a, b = max(0, on[0] * win - int(pad * SR)), min(len(y), (on[-1] + 1) * win + int(pad * SR))
    return y[a:b]


def scene_audio(sc, lines):
    parts = [np.zeros(int(LEAD * SR), np.float32)]
    for i, li in enumerate(lines):
        if i:
            parts.append(np.zeros(int(GAP * SR), np.float32))
        parts.append(trim(decode(os.path.join(HERE, "vo", f"l{li:02d}.mp3"))))
    parts.append(np.zeros(int(TAIL * SR), np.float32))
    y = np.concatenate(parts)
    out = os.path.join(HERE, "out", f"a{sc:02d}.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", out],
                   input=y.tobytes(), check=True)
    return out, len(y) / SR


def build_scene(spec):
    sc, lines, num, pose = spec
    wav, dur = scene_audio(sc, lines)
    silent = os.path.join(HERE, "out", f"v{sc:02d}.mp4")
    cmd = ["python3", "-I", WB, os.path.join(HERE, "img", f"s{sc:02d}.png"), HAND, silent,
           "--number", num, "--seconds", f"{dur:.3f}", "--hand-height", "1560"]
    if pose:
        cmd += ["--person", os.path.join(HERE, "img", f"{pose}.png"), "--person-x", "0.19", "--person-h", "0.86",
                "--start", "0.19,0.2"]
    else:
        cmd += ["--start", "0.3,0.3"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        return f"scene {sc}: FAILED\n{r.stderr[-1500:]}"
    final = os.path.join(HERE, "out", f"c{sc:02d}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-ar", str(SR), "-shortest", final], check=True)
    return f"scene {sc}: {dur:.1f}s ok"


def main():
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    want = set(map(int, sys.argv[2:]))
    specs = [s for s in SCENES if not want or s[0] in want]
    with ThreadPoolExecutor(4) as ex:
        for msg in ex.map(build_scene, specs):
            print(msg, flush=True)
    if not want:
        lst = os.path.join(HERE, "out", "list.txt")
        with open(lst, "w") as f:
            for s in SCENES:
                f.write(f"file 'c{s[0]:02d}.mp4'\n")
        joined = os.path.join(HERE, "out", "joined.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined], check=True)
        final = os.path.join(HERE, "AI_ozbek_tilida_oq_doska.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", joined, "-c:v", "copy", "-af",
                        "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", str(SR),
                        "-movflags", "+faststart", final], check=True)
        print("done", final)


if __name__ == "__main__":
    main()
