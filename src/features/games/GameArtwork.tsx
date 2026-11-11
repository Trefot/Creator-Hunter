import type { Game } from "../../db/games";
import fortniteCover from "../../assets/games/fortnite-cover.jpg";
import landscape from "../../assets/games/creative-landscape.svg";
/** Ilustración decorativa original cuando todavía no se ha elegido una portada. */
export function GameArtwork({game,className=""}:{game:Pick<Game,"title"|"cover">;className?:string}) {
  return <img className={className} src={game.cover??(/fortnite/i.test(game.title)?fortniteCover:landscape)} alt={game.cover?game.title:""}/>;
}
