import { useEffect, useRef, useState } from "react";
import { Game, listGames } from "../../db/games";
import { psnNowPlaying, psnStatus } from "../../db/psn";
import { GAME_MODE_POLL_MS, isGameModeEnabled, matchPlaying } from "./gameMode";

export interface GameModeState {
  /** Juego de la biblioteca abierto ahora en la consola, o null. */
  playing: Game | null;
  /** Último error al consultar PSN (por ejemplo, estado en línea oculto). */
  error: string | null;
  checkedAt: Date | null;
}

/**
 * Modo juego (G5): mientras la app está abierta, pregunta a PSN cada minuto qué se está jugando.
 * `onStart` se llama una sola vez cada vez que empieza a jugarse un juego de la biblioteca.
 */
export function useGameMode(onStart: (game: Game) => void): GameModeState {
  const [state, setState] = useState<GameModeState>({ playing: null, error: null, checkedAt: null });
  const lastId = useRef<string | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!isGameModeEnabled() || !(await psnStatus().catch(() => false))) {
        lastId.current = null;
        if (!cancelled) setState({ playing: null, error: null, checkedAt: null });
        return;
      }
      try {
        const [now, library] = await Promise.all([psnNowPlaying(), listGames()]);
        const game = matchPlaying(library, now.games);
        if (game && game.id !== lastId.current) onStartRef.current(game);
        lastId.current = game?.id ?? null;
        if (!cancelled) setState({ playing: game, error: null, checkedAt: new Date() });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, error: String(err), checkedAt: new Date() }));
      }
    }

    tick();
    const timer = setInterval(tick, GAME_MODE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return state;
}
