import { useEffect, useRef, useState } from "react";
import { Game, listGames } from "../../db/games";
import { PlayingGame, psnNowPlaying, psnStatus } from "../../db/psn";
import { PcGame, pcNowPlaying } from "../../db/pcGames";
import { GAME_MODE_CHANGED, GAME_MODE_POLL_MS, isGameModeEnabled, manualGameId, matchPcPlaying, matchPlaying } from "./gameMode";

export interface GameModeState {
  playing: Game | null;
  source: "pc" | "psn" | "manual" | null;
  /** Juego de PC abierto que todavía no figura en la biblioteca. */
  detectedPc: PcGame | null;
  error: string | null;
  checkedAt: Date | null;
}

/** PC cada 15 s, PSN como máximo una vez por minuto. La selección manual tiene prioridad. */
export function useGameMode(onStart: (game: Game) => void): GameModeState {
  const [state, setState] = useState<GameModeState>({ playing: null, source: null, detectedPc: null, error: null, checkedAt: null });
  const lastId = useRef<string | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    let cancelled = false, busy = false, requested = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastPsnCheck = -Infinity;
    let psnGames: PlayingGame[] = [];
    let psnError: string | null = null;

    async function tick() {
      if (cancelled) return;
      if (busy) { requested = true; return; }
      busy = true;
      clearTimeout(timer);
      try {
        const library = await listGames();
        const manual = library.find(g => g.id === manualGameId()) ?? null;
        let game = manual;
        let source: GameModeState["source"] = manual ? "manual" : null;
        let detectedPc: PcGame | null = null;
        let error: string | null = null;
        if (!manual && isGameModeEnabled()) {
          const pc = await pcNowPlaying().catch(err => { error = String(err); return [] as PcGame[]; });
          if (cancelled) return;
          detectedPc = pc[0] ?? null;
          game = matchPcPlaying(library, pc);
          if (game) source = "pc";
          // Un Fortnite de PC sin añadir nunca se sustituye por su edición de PSN.
          if (!detectedPc) {
            if (Date.now() - lastPsnCheck >= 60_000) {
              lastPsnCheck = Date.now();
              psnGames = [];
              psnError = null;
              try {
                if (await psnStatus()) psnGames = (await psnNowPlaying()).games;
              } catch (err) { psnError = String(err); }
            }
            game = matchPlaying(library.filter(g => g.platform === "ps4" || g.platform === "ps5"), psnGames);
            if (game) source = "psn";
            error = [error, psnError].filter(Boolean).join(" · ") || null;
          }
        }
        if (cancelled) return;
        const changed = game && game.id !== lastId.current;
        lastId.current = game?.id ?? null;
        setState({ playing: game, source, detectedPc, error, checkedAt: new Date() });
        if (changed) onStartRef.current(game!);
      } catch (err) {
        if (!cancelled) {
          lastId.current = null;
          setState({ playing: null, source: null, detectedPc: null, error: String(err), checkedAt: new Date() });
        }
      } finally {
        busy = false;
        if (!cancelled) {
          if (requested) { requested = false; void tick(); }
          else timer = setTimeout(tick, GAME_MODE_POLL_MS);
        }
      }
    }

    void tick();
    window.addEventListener(GAME_MODE_CHANGED, tick);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener(GAME_MODE_CHANGED, tick);
    };
  }, []);

  return state;
}
