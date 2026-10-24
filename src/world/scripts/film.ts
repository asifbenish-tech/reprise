// src/world/scripts/film.ts: the opening film's script: shots, events and Bobbin's narration in the black
// band, like the original's spoken prologue (owner direction, DECISIONS.md D-037). Skippable at any point.
import type { FilmEvent, FilmShot, Game } from "../game";

export async function openingFilm(g: Game): Promise<void> {
  const view = g.view;
  const hud = g.hud;
  if (g.fast || !view?.film || !hud?.cinema) return;
  const film = view.film();
  let skipped = false;
  const line = async (key: string) => {
    if (!skipped) await g.say("bobbin", key);
  };
  const shot = async (id: FilmShot) => {
    if (!skipped) await film.shot(id);
  };
  const event = (id: FilmEvent) => {
    if (!skipped) film.event(id);
  };
  await g.cutscene(async () => {
    hud.cinema?.(true, () => (skipped = true));
    await shot("island");
    await line("film.island1");
    await line("film.island2");
    event("tear");
    await line("film.tear1");
    event("slip");
    await line("film.tear2");
    await shot("space");
    await line("film.space1");
    await line("film.space2");
    event("song");
    if (!skipped) g.playSong("again_again");
    await line("film.song1");
    await line("film.song2");
    await line("film.song3");
    event("falter");
    await line("film.song4");
    await shot("earth");
    await line("film.earth1");
    await line("film.earth2");
    if (!skipped) {
      hud.titleCard?.(true);
      await g.waitSeconds(2.8);
    }
    await film.end(skipped ? 300 : 1200);
    hud.titleCard?.(false);
    hud.cinema?.(false);
    g.playSong("crossing");
  });
}
