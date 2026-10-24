#!/usr/bin/env python3
"""tools/make-voices.py: spoken lines, generated offline (owner direction, DECISIONS.md D-044).

Every line a character says is synthesised once with Piper and an open multi-speaker voice model trained on
LibriTTS (CC BY 4.0), then packed into a few MP3 "sprites" with an index. The game looks a line up by
speaker and the exact text on screen, so a line whose wording changes is simply regenerated on the next run.
Nothing is fetched at runtime.

Usage (from the repository root):
  PIPER_MODEL=/path/to/en-us-libritts-high.onnx python3 tools/make-voices.py
Needs: piper-tts and numpy (pip), ffmpeg with libmp3lame. Per-line audio is cached in .voice-cache/.
"""
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "voice")
CACHE = os.environ.get("VOICE_CACHE", os.path.join(ROOT, ".voice-cache"))
SAMPLE_RATE = 22050
GAP = 0.35  # seconds of silence between lines inside a sprite
SPRITE_SECONDS = 75

# Casting: a LibriTTS speaker for each character, a speed (Piper length_scale: above 1 is slower) and an
# optional filter. Chosen by pitch (tools could not listen); change a number here to recast a part.
CAST = {
    "bobbin": {"sid": 720, "scale": 1.06},
    "jogger": {"sid": 6, "scale": 0.88},
    "commuter": {"sid": 186, "scale": 1.12},
    "engineer": {"sid": 498, "scale": 1.12},
    "marcus": {"sid": 288, "scale": 0.96},
    "dominic": {"sid": 342, "scale": 1.0},
    "foreman": {"sid": 90, "scale": 0.94},
    "receptionist": {"sid": 552, "scale": 0.9},
    "lyrix": {"sid": 444, "scale": 0.95, "fx": "lyrix"},
    "lyra": {"sid": 18, "scale": 1.02},
    "coach": {"sid": 162, "scale": 0.98},
    "juno": {"sid": 558, "scale": 0.96},
    "host": {"sid": 588, "scale": 0.9},
    "choreographer": {"sid": 840, "scale": 0.9},
    "panelist": {"sid": 60, "scale": 1.0},
    "scanner": {"sid": 858, "scale": 0.95, "fx": "robot"},
    "klaxon": {"sid": 858, "scale": 0.9, "fx": "robot"},
}
SILENT = {"skein", "lead_swan"}  # they honk and call; the game plays their instrument signature instead

FX = {
    # a machine: phase-flattened spectrum, a little ring
    "robot": "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75,aecho=0.8:0.5:12:0.3",
    # a hologram's processed vocal: a quick chorus and a touch of shimmer
    "lyrix": "chorus=0.6:0.8:30|45:0.4|0.3:0.25|0.4:2|2.3,aecho=0.7:0.4:40:0.2",
}

# String families that are never spoken (interface, captions, names, labels).
UNSPOKEN = ("ui.", "set.", "menu.", "cal.", "book.", "diff.", "save.", "title.", "name.", "speaker.", "draft.",
            "caption.", "toast.", "puzzle.", "meta.", "end.", "thread.", "loom.pull", "loom.put_back", "loom.isolate",
            "loom.copy", "loom.drop", "loom.undrop", "loom.close", "loom.tag", "loom.threads", "loom.spool_thread",
            "film.episode")


def fnv1a(s: str) -> str:
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def line_id(speaker: str, text: str) -> str:
    """Must match lineId() in src/audio/voice-lines.ts."""
    return fnv1a(f"{speaker}\n{text}") + f"{len(text):x}"


def spoken(speaker: str, text: str) -> str:
    """What the voice says: stage directions in lower-case parentheses go; asides in capitals stay."""
    if speaker in SILENT:
        return ""
    t = re.sub(r"\((?=[a-z])[^)]*\)", " ", text)
    t = t.replace("(", "").replace(")", "").replace("™", "")
    # shouted signs read as words, not letters
    t = re.sub(r"\b([A-Z][A-Z'\-]{1,})\b", lambda m: m.group(1).capitalize(), t)
    t = re.sub(r"\s+", " ", t).strip()
    return t if re.search(r"[A-Za-z]", t) else ""


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def who_says_what(strings):
    """(speaker, key) pairs, from every place the game says a line."""
    pairs = set()
    said = set()
    for path in glob.glob(os.path.join(ROOT, "src", "**", "*.ts"), recursive=True):
        src = open(path, encoding="utf-8").read()
        for sp, key in re.findall(r'say\(\s*"(\w+)"\s*,\s*"([\w.\-]+)"', src):
            pairs.add((sp, key))
            said.add(key)
        # other literal keys in scripts (helpers that say a line for Bobbin)
        for key in re.findall(r'"([a-z0-9_]+\.[\w.\-]+)"', src):
            if key in strings and key not in said and not key.startswith(UNSPOKEN):
                pairs.add(("bobbin", key))
    for path in glob.glob(os.path.join(ROOT, "content", "dialogue", "*.json")):
        for node in load(path)["nodes"].values():
            pairs.add((node["speaker"], node["text"]))
    for path in glob.glob(os.path.join(ROOT, "content", "rooms", "*.json")):
        for h in load(path)["hotspots"]:
            pairs.add(("bobbin", h["look"]))
            if h.get("exit", {}).get("blocked"):
                pairs.add(("bobbin", h["exit"]["blocked"]))
            for action in list((h.get("drafts") or {}).values()) + [h.get("listen") or "", h.get("talk") or ""]:
                if isinstance(action, str) and action.startswith("say:"):
                    pairs.add(("bobbin", action[4:]))
    for path in glob.glob(os.path.join(ROOT, "content", "puzzles", "*.json")):
        for tier, key in enumerate(load(path).get("hints", [])):
            pairs.add(("skein" if tier == 0 else "bobbin", key))
    for key in strings:
        if key.startswith(("look.", "self.", "fail.", "film.")) and not key.startswith(UNSPOKEN):
            pairs.add(("bobbin", key))
    return sorted(p for p in pairs if p[1] in strings)


def fill(text, names):
    return re.sub(r"\{(\w+)\}", lambda m: names.get(m.group(1), m.group(0)), text)


def synth(voice, cfg_cls, speaker, text, path):
    cast = CAST.get(speaker, CAST["bobbin"])
    import numpy as np

    chunks = [c.audio_float_array for c in voice.synthesize(text, syn_config=cfg_cls(speaker_id=cast["sid"], length_scale=cast["scale"]))]
    a = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
    # trim silence, then bring every line to the same peak
    loud = np.where(np.abs(a) > 0.01)[0]
    if len(loud):
        a = a[max(0, loud[0] - 400): loud[-1] + 1200]
    a = a / max(1e-6, float(np.max(np.abs(a)))) * 0.85
    raw = path + ".raw.wav"
    with wave.open(raw, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes((a * 32767).astype("<i2").tobytes())
    fx = FX.get(cast.get("fx", ""))
    if fx:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", fx, "-ar", str(SAMPLE_RATE), "-ac", "1", path], check=True)
        os.remove(raw)
    else:
        os.replace(raw, path)


def read_wav(path):
    import numpy as np

    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32767


def main():
    model = os.environ.get("PIPER_MODEL")
    if not model:
        sys.exit("Set PIPER_MODEL to the .onnx voice model (see the top of this file).")
    import numpy as np
    from piper import PiperVoice
    from piper.config import SynthesisConfig

    strings = load(os.path.join(ROOT, "content", "strings", "en.json"))
    name_sets = load(os.path.join(ROOT, "content", "names.json"))["sets"]
    voice = PiperVoice.load(model, config_path=model + ".json")
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    lines = {}  # id -> (speaker, spoken text)
    for speaker, key in who_says_what(strings):
        for names in name_sets.values():
            shown = fill(strings[key], names)
            if re.search(r"\{\w+\}", shown):
                continue  # filled in at runtime with something else: left unvoiced
            words = spoken(speaker, shown)
            if words:
                lines[line_id(speaker, shown)] = (speaker, words)

    made = 0
    clips = {}
    for lid, (speaker, words) in sorted(lines.items()):
        cast = CAST.get(speaker, CAST["bobbin"])
        tag = hashlib.sha1(json.dumps([cast, FX.get(cast.get("fx", "")), words]).encode()).hexdigest()[:16]
        path = os.path.join(CACHE, f"{tag}.wav")
        if not os.path.exists(path):
            synth(voice, SynthesisConfig, speaker, words, path)
            made += 1
        clips[lid] = read_wav(path)

    for old in glob.glob(os.path.join(OUT, "*.mp3")):
        os.remove(old)
    index = {"sprites": [], "lines": {}}
    gap = np.zeros(int(GAP * SAMPLE_RATE), dtype=np.float32)
    batch, at = [], 0.0

    def flush():
        nonlocal batch, at
        if not batch:
            return
        name = f"voices_{len(index['sprites']):02d}.mp3"
        wav = os.path.join(CACHE, "sprite.wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes((np.concatenate(batch) * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "48k", "-ar", str(SAMPLE_RATE), "-ac", "1", os.path.join(OUT, name)], check=True)
        index["sprites"].append(name)
        batch, at = [], 0.0

    for lid in sorted(lines):
        a = clips[lid]
        if at + len(a) / SAMPLE_RATE > SPRITE_SECONDS:
            flush()
        # an MP3 encoder adds a little silence at the very start; the gap in front absorbs it
        batch.append(gap)
        at += GAP
        index["lines"][lid] = [len(index["sprites"]), round(at, 3), round(len(a) / SAMPLE_RATE, 3)]
        batch.append(a)
        at += len(a) / SAMPLE_RATE
    flush()
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"), sort_keys=True)
        f.write("\n")
    total = sum(len(c) for c in clips.values()) / SAMPLE_RATE
    print(f"{len(lines)} lines ({made} newly spoken), {total / 60:.1f} minutes, {len(index['sprites'])} sprites in assets/voice")


if __name__ == "__main__":
    main()
