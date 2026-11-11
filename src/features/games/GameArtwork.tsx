import type { Game } from "../../db/games";
import landscape from "../../assets/games/creative-landscape.svg";
/** Ilustración decorativa original cuando todavía no se ha elegido una portada. */
export function GameArtwork({game,className=""}:{game:Pick<Game,"title"|"cover">;className?:string}) {
  return <img className={className} src={game.cover??landscape} alt={game.cover?game.title:""}/>;
}
