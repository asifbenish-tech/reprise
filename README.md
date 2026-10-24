# Reprise

A free point-and-click adventure where every action is a melody, built from the design document
*LOOM II: Reprise* (working draft v0.1). This folder holds **Release 1 / Episode 1**: the Prologue,
Act I (the Pop Stars) and Act II (the Producers), about two hours of play.

Free means free: no ads, purchases, accounts, tracking or network calls beyond the game's own files.
Saves stay on the player's device.

## Run it

```sh
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/, name set "original"
npm run build:loom     # the same game with the "loom" name set
npm run build:artifact # dist/artifact.html for hosts that wrap the page in their own document
```

## Check it

```sh
npm run check          # typecheck, lint, content validation, unit tests (includes the 100,000-seed fuzz)
npm run bot            # Playwright: Release 1 for 50 seeds, wrong moves, saves, the timing test
BOT_SEEDS=5 npm run bot
```

## How to play

The game teaches itself: a five-page guide opens before the first new game (it stays under "How to play" on
the title and in the menu), and tips appear in the scene the first time they are useful. In short:

- Click to walk; click an object to select it; double-click to look at it or talk. Hold **H** to show
  everything you can click.
- The Distaff along the bottom has eight notes (keys **1-8**). Four notes make a draft; play one with
  something selected to cast it on that thing, or with nothing selected to cast it on yourself.
- **C** combs a selected sound source into threads (the Loom View). **R** arms the Spindle to record the
  next draft into the selected spool; **[** and **]** choose a spool; **Backspace** clears it.
- **B** opens the Book of Patterns; **K** (or tapping Skein) asks for a hint; **M** opens the menu.
- Gamepad: right stick picks a note on the wheel, A plays it; D-pad cycles objects; X examines;
  Y asks Skein; LB/RB choose a spool; LT arms the Spindle; Start opens the menu.

## Where things live

| What | Where |
|---|---|
| Every player-facing string | `content/strings/en.json` |
| Every franchise name (two sets) | `content/names.json` |
| Rooms, puzzles, dialogue, songs, cast | `content/` (validated by `tools/validate-content.ts`) |
| Draft rules and fallback pool | `content/drafts.json`, `src/core/drafts.ts` |
| Music notation | `music/src/*.json` -> `tools/render-stems.py` -> `music/src/*.mid`, `assets/audio/stems/` |
| Images | `assets/manifest.json` -> `tools/make-placeholders.ts`, `tools/make-normals.ts` |
| Judgment calls and spec conflicts | `DECISIONS.md` |
| The story arc for the rest of the game | `STORY.md` |

## Replacing placeholders

Every image and stem is listed in `assets/manifest.json` with its status (`placeholder`, `generated`,
`final`). To drop in final art, replace the PNG at the same path and size and set its status to `final`;
the generators never overwrite `final` files. To drop in a recorded stem, put `<stem>.ogg` and
`<stem>.m4a` next to its `.hits.json`, keeping length and tempo, and set the status.

## What a person still has to do

- Final pixel art and final music performances (see `DECISIONS.md` D-017 and D-018).
- A full human playthrough on a desktop and a phone (§9.8).

## Publishing

- **GitHub Pages:** once, set Settings -> Pages -> Source to "GitHub Actions". Then Actions -> pages ->
  Run workflow (choose the name set). It builds and deploys `dist/`; nothing deploys on a plain push.
- **itch.io:** `npm run build`, zip the contents of `dist/`, upload as an HTML5 game ("This file will be
  played in the browser"), viewport 1280x720.

## Voices

Spoken lines live in `assets/voice/` (MP3 sprites and an index) and are made by `tools/make-voices.py`.
To regenerate after changing text: install `piper-tts` and `numpy` (pip) and ffmpeg, download the voice
pack `voice-en-us-libritts-high.tar.gz` from the Piper project's v0.0.2 release, unpack it, then run
`PIPER_MODEL=/path/en-us-libritts-high.onnx python3 tools/make-voices.py`. Only new or changed lines are
spoken again (cached in `.voice-cache/`). The cast (which speaker each character gets) is the `CAST` table
at the top of the script.

## Third-party

- [Phaser](https://phaser.io) and [Tone.js](https://tonejs.github.io), MIT.
- [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) via `@fontsource/pixelify-sans`, SIL Open Font
  License 1.1; the license ships with every build as `licenses/pixelify-sans-OFL.txt`.
- Voices generated with [Piper](https://github.com/rhasspy/piper) from a model trained on LibriTTS, CC BY
  4.0; see `licenses/voices.txt`.
