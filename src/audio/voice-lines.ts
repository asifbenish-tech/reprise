// src/audio/voice-lines.ts: spoken lines (owner direction, DECISIONS.md D-044). tools/make-voices.py speaks every
// line offline and packs the audio into a few sprites; a line is found by its speaker and the exact text on
// screen, so a line with no recording simply stays text. Sprites load and decode only when a line needs them.
import * as Tone from "tone";
import index from "../../assets/voice/index.json";

const urls = import.meta.glob("../../assets/voice/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const VOICE = index as unknown as { sprites: string[]; lines: Record<string, [number, number, number]> };
const LINES = VOICE.lines;
const SPRITES = VOICE.sprites;
const KEEP = 4; // decoded sprites kept in memory

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Must match line_id() in tools/make-voices.py. */
export function lineId(speaker: string, text: string): string {
  return fnv1a(`${speaker}\n${text}`) + text.length.toString(16);
}

export function hasLine(speaker: string, text: string): boolean {
  return lineId(speaker, text) in LINES;
}

export class VoiceLines {
  private decoded = new Map<number, Promise<AudioBuffer | null>>();
  private playing: { src: AudioBufferSourceNode; done: () => void } | null = null;
  private seq = 0;

  constructor(
    private out: () => Tone.ToneAudioNode | null,
    private onSpeaking: (on: boolean) => void = () => {},
  ) {}

  private sprite(i: number): Promise<AudioBuffer | null> {
    let p = this.decoded.get(i);
    if (!p) {
      const url = urls[`../../assets/voice/${SPRITES[i]}`];
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => (Tone.getContext().rawContext as BaseAudioContext).decodeAudioData(b))
        .catch(() => null);
      this.decoded.set(i, p);
      while (this.decoded.size > KEEP) this.decoded.delete(this.decoded.keys().next().value as number);
    }
    return p;
  }

  /**
   * Plays the line if it was recorded: resolves true when it ends or is stopped, false if the audio could not
   * be played after all; null when there is no recording to play.
   */
  play(speaker: string, text: string): Promise<boolean> | null {
    const entry = LINES[lineId(speaker, text)];
    const out = this.out();
    if (!entry || !out) return null;
    this.stop();
    const ticket = ++this.seq;
    const [spriteIndex, start, dur] = entry;
    return new Promise((res) => {
      void this.sprite(spriteIndex).then((buf) => {
        if (!buf || ticket !== this.seq) return res(!!buf);
        const ctx = Tone.getContext().rawContext as AudioContext;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        Tone.connect(src, out);
        const done = () => {
          if (this.playing?.src === src) {
            this.playing = null;
            this.onSpeaking(false);
          }
          res(true);
        };
        src.onended = done;
        this.playing = { src, done };
        this.onSpeaking(true);
        src.start(ctx.currentTime + 0.02, start, dur + 0.05);
      });
    });
  }

  stop(): void {
    this.seq++;
    const p = this.playing;
    if (!p) return;
    this.playing = null;
    try {
      p.src.stop();
    } catch {
      // already stopped
    }
    this.onSpeaking(false);
    p.done();
  }
}
