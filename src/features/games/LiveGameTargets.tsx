import { useEffect, useState } from "react";
import { Game, listGames } from "../../db/games";
import { GameBroadcastPanel } from "./GameBroadcastPanel";

/** En directo → Ajustes del directo → Objetivos de juego (antes estaba dentro de Juegos). */
export function LiveGameTargets({ active }: { active: boolean }) {
  const [games, setGames] = useState<Game[] | null>(null), [error, setError] = useState("");
  useEffect(() => { if (active && games === null) listGames().then(setGames).catch((e) => setError(String(e))); }, [active, games]);
  if (!active) return null;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (games === null) return <p className="muted">Cargando tus juegos…</p>;
  if (!games.length) return <p className="muted">Añade un juego en Juegos para mostrar sus objetivos en OBS.</p>;
  return <GameBroadcastPanel games={games} />;
}
