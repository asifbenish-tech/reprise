// src/world/scripts/act1.ts: the Guild of Pop Stars, "Who is singing?" (A1-1 to A1-7).
import * as Tone from "tone";
import type { Game, LogicFactory, ScriptFn } from "../game";

/** Says a line once per save. */
function once(g: Game, flag: string, key: string, speaker = "bobbin"): void {
  if (g.flag(flag)) return;
  g.setFlag(flag);
  void g.say(speaker, key);
}

/** A1-3: her voice heard on its own lifts her scale out of the piano: isolate it, or pull out the piano that buries
 *  it. Pulling only the metronome, or her voice, gets a word that points the right way (owner feedback). */
const fitting: LogicFactory = (g) => {
  let heard = false;
  const hear = (key: string) => {
    if (heard || g.library.learned.has("tuning")) return;
    heard = true;
    void g.cutscene(async () => {
      await g.say("bobbin", key);
      await g.teach("coach", "tuning");
      await g.say("coach", "fitting.coach_hears");
    });
  };
  return {
    cast(e) {
      if (e.id !== "_isolate" || e.target?.kind !== "thread" || e.target.stem !== "voice") return false;
      hear("fitting.isolated");
      return true;
    },
    loomOpened() {
      if (g.loom?.song.def.id === "warmup" && !g.library.learned.has("tuning")) once(g, "said_fitting_threads", "fitting.threads");
    },
    update() {
      const m = g.loom?.song.def.id === "warmup" ? g.loom.song.model : null;
      if (!m || heard || g.library.learned.has("tuning")) return;
      if (m.pulled.has("voice")) once(g, "said_voice_out", "fitting.voice_out");
      else if (m.pulled.has("piano")) hear("fitting.piano_out");
      else if (m.pulled.has("metronome")) once(g, "said_metronome_out", "fitting.metronome_out");
    },
  };
};

/** A1-4: the dancers hang on the click; pull it and they freeze, then drift off to find a beat. */
const corridor: LogicFactory = (g) => ({
  enter() {
    if (g.flag("dancers_frozen")) g.view?.setSprite("dancers", { frame: 0 });
  },
  update() {
    if (g.flag("dancers_frozen") || g.loom?.song.def.id !== "mirror") return;
    if (g.loom.song.model.tether("click", Tone.now()) === "slack") {
      g.setFlag("dancers_frozen");
      g.view?.setSprite("dancers", { frame: 0 });
      void g.say("bobbin", "corridor.frozen");
    }
  },
  loomClosed() {
    if (!g.flag("dancers_frozen") || g.flag("dancers_gone")) return;
    void g.cutscene(async () => {
      await g.say("bobbin", "corridor.waiting");
      await g.view?.moveSprite("dancers", 760, 268, 2.5);
      g.setFlag("dancers_gone");
      await g.say("bobbin", "corridor.drift");
    });
  },
});

/** A1-5, puzzle 1: "The Hit That Ate a Song". */
const hall: LogicFactory = (g) => {
  let dancersFrozen = false;
  return {
    loomOpened() {
      if (g.loom?.song.def.id === "again_again" && !g.flag("golden_revealed:again_again")) once(g, "said_glint", "hall.glint");
    },
    cast(e) {
      if (e.id === "_isolate" && e.target?.kind === "thread" && e.target.stem === "vocal") {
        if (g.loom?.song.model.isTied("vocal")) void g.say("bobbin", "hall.robotic");
        return true;
      }
      return false;
    },
    update() {
      const lv = g.loom;
      if (lv?.song.def.id !== "again_again") {
        if (dancersFrozen) {
          dancersFrozen = false;
          g.view?.setSprite("dancers", { anim: "dancers" });
        }
        return;
      }
      const m = lv.song.model;
      const now = Tone.now();
      const slack = m.tether("kick", now) !== "taut";
      if (slack !== dancersFrozen) {
        dancersFrozen = slack;
        g.view?.setSprite("dancers", slack ? { frame: 0 } : { anim: "dancers" });
        if (slack) once(g, "said_dancers_stop", "hall.dancers_stop");
      }
      if (g.flag("golden_revealed:again_again") || g.busy) return;
      const level = m.goldenLevel(now);
      const pulled = (id: string) => m.pulled.has(id);
      if (["kick", "bass", "supersaw", "vocal", "riser"].every(pulled)) once(g, "said_miming", "hall.miming");
      else if (pulled("supersaw") && m.isTied("vocal") && level > 0.5) once(g, "said_braided", "hall.braided");
      else if (level > 0.2 && level < 0.6) once(g, "said_closer", "hall.closer");
      if (level >= 0.99) {
        void g.cutscene(async () => {
          g.setFlag("golden_revealed:again_again");
          await g.say("bobbin", "hall.revealed1");
          await g.teach("hum", "unmasking");
          await g.say("bobbin", "hall.revealed2");
        });
      }
    },
  };
};

/** The Chairman's demo: three bars of glossy hook and one left empty, the space he means for Bobbin. */
const DEMO = [76, 76, 79, 76, 74, 72, 74, 76, 79, 81, 79, 76];

export const scripts: Record<string, ScriptFn> = {
  /** Act I opens on the head of the Producers' Guild, come down to sign Bobbin; Bobbin won't (STORY.md, D-050). */
  async chairman_lobby(g) {
    if (g.flag("chairman_met")) return;
    await g.cutscene(async () => {
      g.setFlag("chairman_here");
      g.view?.refreshHotspots();
      g.view?.setSprite("chairman", { frame: 2 });
      await g.view?.moveSprite("chairman", 196, 266, 2.4);
      g.view?.setSprite("chairman", { frame: 0 });
      await g.dialogue("chairman_offer");
      g.setFlag("chairman_met");
      g.view?.setSprite("chairman", { frame: 2 });
      await g.view?.moveSprite("chairman", 484, 266, 2.4);
      g.setFlag("chairman_here", false);
      g.view?.refreshHotspots();
      await g.say("receptionist", "lobby.chairman_gone");
      await g.say("bobbin", "lobby.chairman_bobbin");
    });
  },

  async chairman_demo(g) {
    g.view?.setSprite("chairman", { frame: 1 });
    g.caption("caption.chairman_demo");
    const step = g.conductor.beatSeconds() / 2;
    if (!g.fast) g.voice.melody("jingle", DEMO, Tone.now() + 0.1, step);
    // the empty bar after the hook is part of the demo
    await g.waitSeconds(step * (DEMO.length + 8));
    g.view?.setSprite("chairman", { frame: 0 });
  },

  /** A1-2: the engineer takes Bobbin for the Chairman's new project, shows him a song in layers, and hands him
   *  his pocket mixer to help; on the Distaff it becomes the comb (owner feedback: the tool needs a giver). */
  async watch_engineer(g) {
    if (g.flag("watched_engineer")) return void (await g.say("bobbin", "mixing.desk_again"));
    await g.cutscene(async () => {
      await g.say("engineer", "mixing.solo1");
      const m = g.model("again_again");
      for (const stem of ["kick", "bass", "supersaw", "vocal"]) {
        m.isolated = stem;
        await g.say("engineer", `mixing.solo_${stem}`);
        await g.waitSeconds(g.conductor.barSeconds() * 0.75);
      }
      m.isolated = null;
      await g.say("engineer", "mixing.gift1");
      await g.view?.hand?.("engineer", "fx_mixer");
      await g.say("bobbin", "mixing.flax1");
      await g.say("bobbin", "mixing.flax2");
      await g.say("bobbin", "mixing.gift2");
      g.giveTool("combing");
      g.setFlag("watched_engineer");
      await g.say("bobbin", "mixing.flax3");
      await g.say("bobbin", "mixing.gift3");
    });
  },

  async detune_engine(g, _arg, quiet) {
    const m = g.model("again_again");
    const now = Tone.now();
    for (const s of m.stems()) g.effects.apply(m.key(s.id), "tuning_rev", now, g.conductor.barSeconds());
    if (quiet) return;
    await g.cutscene(async () => {
      await g.say("choreographer", "hall.detune_shriek");
      await g.say("bobbin", "hall.detune_phones");
    });
  },

  async unmask_lyrix(g) {
    await g.cutscene(async () => {
      g.view?.flash(0x66e0ff, 500);
      await g.say("bobbin", "hall.unmask1");
      g.setFlag("lyra_unmasked");
      g.view?.refreshHotspots();
      await g.dialogue("lyra_unmasked");
      g.playSong("lyra");
      g.caption("caption.lyra_hum");
      await g.waitBars(4);
      g.playSong("again_again");
      await g.dialogue("lyra_after");
    });
  },

  async mask_self(g) {
    if (g.flag("masked")) return void (await g.say("bobbin", "elevator.already_masked"));
    await g.cutscene(async () => {
      g.view?.flash(0x9a8cc8, 400);
      await g.say("bobbin", "elevator.masked1");
      g.view?.setSprite("scanner", { frame: 1 });
      g.setFlag("masked");
      await g.say("bobbin", "elevator.scanner_ok");
      await g.say("lyra", "elevator.lyra_bye");
    });
  },
};

export const logic: Record<string, LogicFactory> = { fitting, corridor, hall };
