# DECISIONS.md

Every judgment call the design document leaves open, with the section it interprets. Conflicts between
sections are marked **Conflict** and were resolved by the document's own order: section 10 over 9 over 6
over 4 over everything else, and, when that still left a dead end, "the simplest behaviour that keeps the
no-dead-ends rule" (section 10).

## Scope and process

**D-001 · Release 1 only (§0, §10).** This build covers the Prologue, Act I and Act II (M0 to M7 and the
Release 1 polish). Act III, Act IV and the finale are Release 2 and are not started: "Finish and ship
Release 1 before starting Act III." The owner asked for the game to be built in one go, so milestones M0 to
M7 were built back to back rather than reviewed one by one; the review now happens on Release 1 as a whole.

**D-002 · Where the code lives.** The game was first built in a `reprise/` folder of the owner's
timetable repository (the only repository attached to that session) and then moved, with its history, to
this repository. GitHub Pages deployment is a workflow that only runs when started by hand, so nothing is
published until the owner decides (§0: "publish free" happens after the owner reviews each release).

**D-003 · Default name set: `original` (§1).** The owner picks the set at build time. `npm run build`
uses `original` (Tam Threadwell, the Weavers, *Reprise*) because it is the takedown-safe set;
`npm run build:loom` builds with `loom`. Nothing else differs. A content check fails the build if a
franchise name is written into `strings/en.json` instead of coming from `names.json`.

## Drafts and notes

**D-004 · Draft generator retries (§9.6).** With five reversible drafts on only c, d and e, the greedy
generator of §9.6 paints itself into a corner for about 2% of seeds (no room left for Unmasking, even in
the fallback pool). `generateDrafts` runs §9.6's loop again from the same random stream, up to 20 times.
The result is still a pure function of the seed. The unit test checks every rule over 100,000 seeds.

**D-005 · Conflict: Unmasking's note range (§6 puzzle 1 vs §4.2 and the puzzle map).** Puzzle 1 says the
four notes are "randomized from c-f". But §4.2 says a draft only uses notes Bobbin owns when it is taught,
f only returns at A1-6, and A1-6 is cast *with* Unmasking: an f in Unmasking would make A1-6 unplayable,
a dead end. Unmasking, like Tuning, uses c-e (`highestNote: 2`). Act II drafts use c-f, Act III c-g,
Act IV c-a.

**D-006 · Conflict: "two puzzles open at once" (§6.4).** The rule says that after each act's first two
puzzles at least two puzzles must be open, climaxes excepted. The fixed needs in the same table make A1-5
to A1-7 and A2-6 to A2-7 strictly sequential. The table's needs are "implement exactly" (§0), so they win;
the rule holds where the table allows it (A1-3 with A1-4, A2-3 with A2-4, A2-8 with A2-9).

**D-007 · The two-beat reset (§9.6) and pillar 6.** A half-played draft resets after two beats of silence,
as in §9.6's code. Because a fast tempo makes two beats short, Settings also offers "four beats" and
"never". The default is the document's.

**D-008 · The Distaff before the crack (§3, §4.6).** During the Crossing the Distaff is whole (eight notes);
the crack in P3 leaves c, d and e. The flock's calls only use c-e, so nothing learned there is lost.

## Combing, the Spindle and puzzles

**D-009 · How long a pull lasts (§4.3).** "While the Loom View is open, or until put back": closing the
Loom View puts every pulled thread back. Knots untied by Tuning stay untied (a change).

**D-010 · Solved routes stay open.** No dead ends (§0): once a route is opened by a state, it stays open.
The A1-4 dancers, frozen without their click, drift off to find a beat; Juno wedges the Sidechain Gate;
the conveyor ride is remembered. Every teaching source and every thread source stays where it is.

**D-011 · Learning by isolating (A1-3).** The coach's scale is learned the moment her voice thread is
isolated, and she sings it once clearly. Isolation is a hold, so learning on release would be a timing test.

**D-029 · The golden thread is braided (§6 puzzle 1, §9.6).** The golden thread "is braided with" the
knotted lead vocal, so pulling or hushing the vocal while the knot is tied takes the golden thread with it
(`braid` on the golden stem). Without this, pulling every thread uncovered it and skipped Tuning, which the
solvability bot's wrong-move test caught. §9.6's masking formula is unchanged.

**D-012 · Puzzle 2's alarm (§6).** One Hushing on the kick: the gate opens for exactly that bar, and the
DEAD AIR klaxon sounds as the silent bar ends; the scene resets. Hushing looped before the kick is covered:
the alarm sounds after two bars and the foreman clears the spool that holds the loop. Walking through
needs the copy on a spool *and* the loop.

**D-013 · Puzzle 3's counter-moves (§6).** Dominic reacts to states, not to an order of clicks: both drops
done -> the canned chant appears; the chant held silent by a loop and the microphone open -> he knots
Lyra's live voice; Tuning on it -> the encore. Rousing on the muted microphone works for one bar; looped,
it opens the microphone, but her recorded voice still plays over her, so the crowd hears two Lyras.

**D-014 · A2-8's out-of-tune copy.** Copying the piano before Tuning gives "the piano (out of tune)",
which Lyra will not turn for. A2-8 is solved by a copy of the tuned piano.

**D-015 · "Solved when" for learning and carrying.** Learning a draft sets `learned_<id>`; copying a
thread sets `spooled:<song>:<stem>`. A puzzle never counts as solved before its needs are met, even if
its flag was set early.

**D-016 · Hints before Skein (§4.7).** Skein becomes the hint system in P2 (she is the one fading in P2).
P1 and P2 have hint text in their files, but nobody gives it yet; both are short and teach themselves.

## Sound and music

**D-017 · Placeholder music pipeline (§8.9).** Hand-writing binary MIDI is not practical, so each song's
editable source is notation JSON in `music/src/`. `tools/render-stems.py` writes the `.mid` file for
musicians, the hit data the game reads, and the expanded notes the placeholder synths play. With FluidSynth
and a `$SOUNDFONT` installed it also renders OGG and M4A stems, normalised with ffmpeg to -18 LUFS / -1 dBTP
(§8.7), and marks them `generated`. Without them, stems stay `placeholder` and play in the browser from the
same notes, so swapping in real stems changes no code.

**D-018 · The score's sources (§8.1, §8.6).** No recording of any piece is used. The swan theme (Tchaikovsky)
and the Neptune-like choir (Holst) are short approximations written from memory, marked placeholder. The
Rhapsody in Blue arrangements need transcription from Gershwin's 1924 two-piano score, which this build
cannot verify note for note; every Rhapsody cue (title, factory, Lyra's andantino) is original placeholder
material in a similar idiom until a musician arranges from the public-domain score. Lyra's song and the
hooks are newly written (§8.1).

**D-019 · The Distaff bed (§8.4).** Simplified: the score ducks while Bobbin plays and comes back after a
cast. The vamp re-arrangement around C is left for when real stems exist.

**D-020 · Expert's golden thread (§6 build notes).** In Expert the golden thread's volume is its level
cubed, so it stays quieter for longer. Expert's extra closing scene belongs to the finale (Release 2).

## Look

**D-021 · Drained and restored (§7.3, §7.4).** Placeholder rooms are drawn once in the location's colours.
"Drained" is a camera colour-matrix that desaturates them; restoring a location (f for the park and the
Spire, g for the factory and the arena) lifts it. Drained rooms animate locked to the beat; restored rooms
drift. The flock's whiteness grows with each note won back after the crack.

**D-022 · Lighting (§7.2).** Characters and one background layer per room are lit with normal maps from
`tools/make-normals.ts`. The banded light post-filter is not used; the placeholders bake dithered bands in.
Settings has a low-detail switch that turns lighting off.

**D-023 · Below 1x (§7.1).** On a screen smaller than 640x360 (a phone held upright) there is no whole-number
scale, so the stage shrinks fractionally and a hint suggests turning the phone. At 1x and above, scaling is
whole numbers only.

**D-024 · Close-up icons (§4.1).** The selected object's icon is the first frame of its sprite, drawn
pixel for pixel; objects painted into the background show their initial.

**D-030 · The LOOM layout, literally (§4.1, owner direction).** The owner asked for the original's screen:
the scene fills the top 296 rows and a black panel takes the bottom 64. The panel holds the speech line
(centred, in the speaker's colour, no name shown; screen readers still hear the name) and the carved
Distaff drawn as art (`ui_distaff`), with a note button on each socket, the letters under the staff, the
Spindle around its head and the close-up box at the right. Walkable floors stop at y 294 so feet stay in
the scene; a unit test keeps it that way.

**D-031 · Close-up conversations fill the scene (§4.1, §7.9, owner direction).** §7.9 sizes dialogue
portraits at 160x160. The owner asked for the original's look instead: a conversation line replaces the
scene with a 640x296 painted close-up, head and shoulders on the right and the words on the left. The
`por_*` images are therefore 640x296. Speakers without a close-up speak in the world, above the panel.

**D-032 · Pixel lettering is still HTML text (§7.9).** §7.9 says text is not pixel art: it must stay
crisp, scale, reach screen readers and allow right-to-left languages. The lettering is a pixel typeface
(Pixelify Sans, SIL Open Font License, bundled with the build, no network) set on the HTML layer, so all
four still hold; scripts it lacks (Hebrew, for one) fall back to the serif. Settings has "Pixel lettering"
to switch to the plain serif for readability.

**D-033 · Casting is visible in the world (§4.1, §7.5, owner direction).** While notes sound, Bobbin
lifts the Distaff (sprite frames 9 and 10) and its tip glows in each note's colour, lighting the room
through the normal-mapped layers. A finished draft flares, sends sparks along an arc to its target and
bursts there; a phrase that is no draft fizzles grey. The Spindle's looped casts only pulse at their
target, so a loop never makes Bobbin wave the staff every bar. Low detail, reduced motion and the bot
get fewer sparks and no flare.

**D-034 · The notation strip (§4.1, §7.6).** The contour line above the Distaff became five thin lines with
a coloured note head over each played socket (in Expert, evenly spaced, so only the contour shows), and
a played note's glyph floats up off its socket. This is how the owner's "notes, like a music box" request
is met without adding a second note display.

**D-035 · Placeholder labels and signs (§7.9).** §7.9 labels placeholder characters with their ID. The
owner asked for better-looking art, so the second-pass placeholders are drawn without ID labels; the
manifest still marks every image `placeholder`. Signs painted into rooms use the words the strings
already say (the billboard, the Spire's slogan), never a franchise name.

**D-036 · Cynicism and the fourth wall (§1 pillar 4, owner direction).** The owner asked for more cynical
humour and a little fourth-wall breaking. The premise gains a reason to land: the flock caught Earth's hit
from across the dark, and the eldest wants a word with whoever made it, which pays off when the same
song greys the swans in the park. Bobbin's voice rules still hold (plain, short, never cruel): his asides
to the player are parenthetical or come from Skein, and after three phrases in a row that are no draft he
speaks kindly to the hands on the Distaff. The satire stays aimed at the system, never at a person.

**D-037 · An opening film before the Crossing (§3 Prologue, §7.1, owner direction).** §3 makes the
Prologue a playable title sequence. The owner asked for a short film first, in the game's own graphics,
that tells how the first game ended and why the flock comes down on Earth. It plays once per new game
and is skippable at any moment (Skip, Esc). It is four painted plates (the Island with the Pattern in
its sky, the flock in space, the song reaching them, Earth up close) with sprites moved across them and
light drawn on top; nothing is scaled or rotated, and the closer view of Earth is its own plate, as §7.1
asks. Bobbin narrates in the black band, as the original's spoken prologue did. The tear shows "a hunger
that followed the flock out of the first game" (§2) slipping through behind them, unnamed. The first
game is told without its names: the name set supplies the island, the guild and the hero. The playable
Crossing that follows is now the flock's descent, the eldest calling formations to bring them down
together.

**D-038 · A living title screen and larger lettering (owner direction).** The title screen runs over a
painted night (a great moon rising behind the city, the Pattern faint in the sky) with the flock crossing
the moon, shooting stars and pink notes rising off the rooftops: the Hum. The lettering is larger
throughout: the speech line, close-up text, the letters under the Distaff and the menus.

**D-039 · Exits can be selected (§4.1, a bug the owner found).** Clicking a hotspot that was also an exit
walked there and tried the exit but never selected it, so the locked park gate (and the factory gate and
the talent elevator) could not be the target of a draft by mouse; the bot selects targets directly, so it
never noticed. Every click on a hotspot now selects it, and gold corners pulse around the selection in the
scene, so the player sees what the next draft will touch.

**D-040 · Moving text on, and the drain made visible (owner direction).** Every line of speech has a
Next button (it still moves on by itself unless Settings asks for clicks); close-up conversations have a
labelled Next button. The song's drain is drawn, not only told: in the film, threads of the swans' own
light are pulled out of them back towards Earth while their glow dims; in the park, threads stream from
the flock into the jogger's phone as he runs past.

**D-041 · LOOM on the title (§1 names, owner direction).** The title shows the name set's short title in
our own lettering (`title.logo`): "LOOM II" over "Reprise" with the loom set, "Reprise" over "a weaver's
song" with the original set. The original LOOM logo artwork is never copied (§7.8). The repository
default stays `original` (§1); the owner chose the loom set for the published page, knowing §1's
takedown warning.

**D-042 · Standing beside things, and the landing told on screen (§3 Prologue, owner direction).**
Bobbin walks up beside what he uses, on the side nearer to him, never on top of it (a unit test checks
every hotspot in every room); something wide is approached from the front, and an open way out is walked
into. The park is now a swan room until he weaves himself a body, as §3 tells it (before, he arrived
already a man). The landing shows the story instead of telling it: the eldest gives up; the flock keeps
losing threads of light up into the Spire every few bars while the city's hit has them; Bobbin says he
could fly on alone and chooses not to; threads close round the swan in a cocoon, a flash, and he is a man
down on one knee (a new sprite frame), greyed and spent; the Distaff cracks; he stands and says the drain
is taking him too.

**D-043 · The hook lets nothing else through (premise, owner direction).** The premise says each play of
the hit pulls a thread from the flock. The owner wanted the why to be visible and understood early: the
hook never stops, and while it plays no other music gets through, and a swan lives on song. The film
shows the flock's calls passing from swan to swan until a ring of pink notes closes round them, after
which every call greys and falls; Bobbin narrates the cause. In the park the jogger stops by the water,
rings of the hook spread from his phone, the flock's calls and then Bobbin's own note are swallowed, and
Bobbin says what it means before the swans grey.

**D-044 · Spoken lines (§ at a glance "Voice", §8.8, owner direction).** The document says no voice acting.
The owner asked for it. With no actors, every line is generated offline by `tools/make-voices.py` with
Piper and an open multi-speaker model trained on LibriTTS (CC BY 4.0, credited on the end card and in
`licenses/voices.txt`). Each character has one speaker from the model, cast by pitch because the tools
cannot listen; the cast is one table in the script. Stage directions in lower-case parentheses are not
spoken; the swans stay silent (their instrument signatures still play, as §8.8 wants). Lines are keyed by
speaker and the exact text on screen, so a reworded line is regenerated and a line filled in at runtime
(a thread's name, say) stays text. The browser's own speech was not used: it varies by device and some
browsers send the text to an online service. A spoken line moves on when the voice ends; Settings can
turn voices off and set their level, and the score dips under them. Real actors can replace the files
later without code changes.

**D-045 · The street takes a note, and Marcus gives it back (§3 Prologue, owner direction).** Out of the
park the city's hit is everywhere, and it takes the e from the Distaff (two notes left; the socket breaks
on screen). Marcus's rhythm leans back where every other beat stands to attention; Bobbin asks how, and
Marcus's memory is told as a short film in his own voice: the street when every kind of music played on
it, the Producers' Guild and its formula greying it, the fight they lost, and Marcus now, keeping his own
sound in his headphones. Bobbin listens, his gold notes flow back into the Distaff, the e returns, and
Marcus's roll teaches Waking as before. Bobbin names his road: each sound he helps remember gives a note.
Bobbin's voice was recast (speaker 876 instead of 720, livelier delivery for everyone) after the owner
found it robotic.

**D-046 · Title music and a music switch (owner direction).** The title theme is twelve bars now (the
clarinet's climb, then a slow tune over harp, strings and bass), and starts on the first click anywhere on
the title, since browsers keep sound off until then. Music can be switched off from the title screen, from
a ♪ button on the panel and in Settings; the choice is remembered.

**D-047 · The owner's story arc (§3, §2, owner direction).** `STORY.md` replaces the plan for Release 2:
worlds of music (rock, country and more) instead of the Studios and the Lawyers; a note back for every
world that finds its own sound; a finale at the top of the Producers' Guild tower, inside their building,
where the head of the Guild releases the catchiest song yet, everyone Bobbin helped and the swans fall under
it, and three attempts at held notes braid their styles into a burst that frees them all. The genres, the
head of the Guild and the fate of the Monotone are open questions for the owner. The end card already points
down this road.

**D-048 · Art pass in the same style (§7, owner direction).** Same palette, scale and lighting, better
drawing. People are built from parts (legs, torso, arms with an elbow, head, hair) that are each shaded as a
volume lit from the upper left and outlined in a dark shade of their own colour, with a face (eyes, brows,
nose, mouth, ears), clothes with a cut (tee, open jacket or coat over a shirt, hoodie, hi-vis vest,
turtleneck, dress) and hair with a sheen; props sit in the hands the painter reports. Bobbin keeps his
silhouette and gains a mantle, a lined hood, sleeves, a cord belt and a carved Distaff wound with thread
(the staff tip is where it was, so the casting light still lines up). Swans have an S-neck, layered wing
feathers and the black knob on the beak; Skein is a grey cygnet. Close-ups get a face shape each and black
hair that stays black. Everyone on the ground casts a soft shadow. The plainest rooms (the fitting room, the
focus lounge, the talent elevator) are furnished.

**D-049 · How to play (owner direction).** Two layers, both skippable. A five-page guide (walk and look, the
Distaff, drafts, the Book of Patterns, getting unstuck) drawn with the game's own sprites, note colours and
key caps: it opens before the first new game on a device and is kept on the title screen and in the menu.
Then tips in the scene, one at a time and only when the scene is quiet: how to answer the eldest's call in the
Crossing, how to move and look in the park, how to weave a draft on something, where the Book is, Skein after
ninety seconds without progress, and Combing and the Spindle when they arrive. Each shows once per device;
"No more tips" and a Settings switch turn them off (switching them on again starts them over). The bot plays
with `fast` on, which hides both.

**D-050 · The Chairman, and the genres (owner direction).** The worlds go pop (most formulaic, Act I), rock,
then K-pop (formula perfected); the Hit Factory stays as Act II, where the formulas are made. The Monotone is
kept, as the voice behind the head of the Guild. That head is a new character, the Chairman, hinted at all
through the game: his seal (a gold hook in a ring) on every billboard and poster, a meeting at the start of
Act I where he plays Bobbin a demo with a gap "where you go" and offers a contract, which Bobbin refuses (the
three answers all end there; reaching for the pen fails because the Distaff won't have it), mentions by the
receptionist and Dominic, and his voice over the dome after the encore. The refusal is why the finale's hit
exists. His speaking signature is one low note, twice: the Monotone under him. The scene runs once, on the
first entry to the Spire's lobby; the debug harness now waits for the room scene before loading a save,
which this scene's timing exposed.

**D-051 · The Chairman's fate and the K-pop world (owner direction, recorded in `STORY.md`).** In the
finale the burst also wakes the Chairman's own people, who go and sign the originals; he loses his power by
being left with no one to work for him and no one who wants his hook. The K-pop act centres on a girl who
doesn't meet the agency's standards and finds her own sound. Nothing is built yet: both are Release 2.

## Data formats (§9.5) extensions

**D-025 · Extra fields.** `HotspotDef` gains `name`, `talk`, `listen`, `person`, `stand`, `when`, `sprite`
and `exit`; `StemDef` gains `label`, `instrument`, `when` and `level`; `PuzzleDef` gains `room`, `focus`
and `title`; dialogue nodes gain `else`. Draft actions on the room itself live on a `_self` hotspot.
Actions may be chained with `;`. Scripts receive whether a cast came from a loop, so looped casts stay
quiet. All marked "ext" in `src/content/types.ts`.

**D-026 · Rooms and strings were first written by generator scripts.** The JSON under `content/` is now
the source of truth and is edited directly.

## Testing

**D-027 · The bot's speed (§9.8).** The solvability bot plays through the real AudioContext at four times
the tempo, with lines that don't wait to be read, one page at a time. Running several headless pages at
once on a small machine starves them of audio time and makes bar-based states flaky.

**D-028 · The timing test (§9.8).** An offline render of one bar with two spools, using one-sample impulses
on raw buffer sources so the first non-zero sample is exactly where each note landed. Synth onsets were
tried first and measured the synth's attack, not the scheduler.
