import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { Game, listGames } from "../../db/games";
import { es } from "../../i18n/es";
import { GAME_MODE_CHANGED, isAutoAddEnabled, isGameModeEnabled, selectManualGame, setAutoAddEnabled, setGameModeEnabled } from "./gameMode";
import { PcDetection } from "./PcDetection";
import { InstalledGames } from "./InstalledGames";

/** Ajustes → Juegos detectados: todo lo de detección fuera de la biblioteca. */
export function GameDetectionSettings() {
  const [games, setGames] = useState<Game[]>([]), [on, setOn] = useState(isGameModeEnabled()), [autoAdd, setAutoAdd] = useState(isAutoAddEnabled()), [error, setError] = useState("");
  async function refresh() { try { setGames(await listGames()); } catch (e) { setError(String(e)); } }
  useEffect(() => {
    void refresh();
    const sync = () => { setOn(isGameModeEnabled()); setAutoAdd(isAutoAddEnabled()); };
    window.addEventListener(GAME_MODE_CHANGED, sync);
    return () => window.removeEventListener(GAME_MODE_CHANGED, sync);
  }, []);
  const pc = games.filter((g) => g.platform === "pc");
  return <section className="form">
    <label className="checkbox"><input type="checkbox" checked={on} onChange={(e) => { setGameModeEnabled(e.target.checked); setOn(e.target.checked); }} /><Radar size={16} /> <strong>{es.games.gameMode}</strong></label>
    <p className="muted small">Nexus reconoce el juego abierto en tu PC o en PSN y lo pone como «Jugando ahora» en Juegos.</p>
    <label className="checkbox"><input type="checkbox" checked={autoAdd} onChange={(e) => { setAutoAddEnabled(e.target.checked); setAutoAdd(e.target.checked); }} />Añadir a la biblioteca los juegos detectados</label>
    <button className="ghost" onClick={() => selectManualGame(null)}>Volver a la detección automática</button>
    <InstalledGames onChanged={refresh} />
    <h3>Ejecutables de tus juegos de PC</h3>
    <p className="muted small">Solo hace falta para juegos que Nexus no reconoce solo. Abre el juego y elige su .exe (no Steam ni el lanzador).</p>
    {pc.map((g) => <div key={g.id}><strong>{g.title}</strong><PcDetection game={g} /></div>)}
    {!pc.length && <p className="muted small">Todavía no hay juegos de PC en tu biblioteca.</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
