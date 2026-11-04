import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { addTask, deleteTask, listCollected, listTasks, setCollected, setTaskDone, TrophyTask } from "../../db/collections";
import type { Game, Trophy } from "../../db/games";
import { addObjective, createSession, deleteObjective, listSessions, PlaySession } from "../../db/sessions";
import { es } from "../../i18n/es";
import { todayIso } from "../../i18n/format";
import { collectionFor } from "./collections";
import type { CollectionItem, TrophyCollection } from "./collections/types";

/** Un punto de la lista de un trofeo: de la app o añadido por el usuario. */
export interface CheckItem extends Partial<CollectionItem> {
  key: string;
  name: string;
  done: boolean;
  /** Hecho solo porque su trofeo relacionado ya está ganado (no se puede desmarcar). */
  auto: boolean;
  /** Id del punto propio del usuario (si lo es). */
  taskId?: string;
}

export interface Progress {
  done: number;
  total: number;
  /** El primer punto pendiente: lo siguiente que toca. */
  next: CheckItem | null;
}

export interface GameCtx {
  game: Game;
  openTrophy: (trophy: Trophy) => void;
  collectionOf: (trophy: Trophy) => TrophyCollection | null;
  checklist: (trophy: Trophy) => CheckItem[];
  progress: (trophy: Trophy) => Progress | null;
  toggleItem: (trophy: Trophy, item: CheckItem) => Promise<void>;
  addOwnItem: (trophy: Trophy, title: string) => Promise<void>;
  removeOwnItem: (taskId: string) => Promise<void>;
  today: PlaySession | null;
  inToday: (trophy: Trophy) => boolean;
  toggleToday: (trophy: Trophy) => Promise<void>;
  /** Añade una tarea libre (sin trofeo) al plan de hoy. */
  addFreeToday: (title: string) => Promise<void>;
  reloadToday: () => Promise<void>;
}

const Ctx = createContext<GameCtx | null>(null);
export const GameContextProvider = Ctx.Provider;

export function useGame(): GameCtx | null {
  return useContext(Ctx);
}

/** Estado común de un juego: listas marcadas, puntos propios y plan de hoy. */
export function useGameState(game: Game, trophies: Trophy[] | null, openTrophy: (t: Trophy) => void): GameCtx {
  const [collected, setCollectedKeys] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<TrophyTask[]>([]);
  const [today, setToday] = useState<PlaySession | null>(null);
  const day = todayIso();

  const reloadToday = useCallback(async () => {
    const sessions = await listSessions(game.id);
    setToday(sessions.find((s) => s.played_on === day) ?? null);
  }, [game.id, day]);

  useEffect(() => {
    listCollected(game.id).then(setCollectedKeys);
    listTasks(game.id).then(setTasks);
    reloadToday();
  }, [game.id, reloadToday]);

  const earned = (psnId: number | undefined) =>
    psnId !== undefined && !!trophies?.find((x) => x.psn_trophy_id === psnId)?.earned_at;

  const collectionOf = (trophy: Trophy) => collectionFor(game.np_communication_id, trophy.psn_trophy_id);

  const checklist = (trophy: Trophy): CheckItem[] => {
    const own = tasks
      .filter((t) => t.trophy_id === trophy.id)
      .map((t) => ({ key: `task-${t.id}`, name: t.title, how: "", group: es.sheet.ownGroup, verified: true, done: t.done || !!trophy.earned_at, auto: !!trophy.earned_at, taskId: t.id }));
    const items = (collectionOf(trophy)?.items ?? []).map((i) => {
      const auto = !!trophy.earned_at || earned(i.doneWithTrophy);
      return { ...i, done: auto || collected.has(i.key), auto };
    });
    return [...items, ...own];
  };

  const progress = (trophy: Trophy): Progress | null => {
    const list = checklist(trophy);
    if (list.length === 0) return null;
    return { done: list.filter((i) => i.done).length, total: list.length, next: list.find((i) => !i.done) ?? null };
  };

  async function toggleItem(_trophy: Trophy, item: CheckItem) {
    if (item.auto) return;
    if (item.taskId) {
      await setTaskDone(item.taskId, !item.done);
      setTasks(await listTasks(game.id));
    } else {
      await setCollected(game.id, item.key, !item.done);
      setCollectedKeys(await listCollected(game.id));
    }
  }

  async function addOwnItem(trophy: Trophy, title: string) {
    if (!title.trim()) return;
    await addTask(game.id, trophy.id, title);
    setTasks(await listTasks(game.id));
  }

  async function removeOwnItem(taskId: string) {
    await deleteTask(taskId);
    setTasks(await listTasks(game.id));
  }

  const inToday = (trophy: Trophy) => !!today?.objectives.some((o) => o.trophy_id === trophy.id);

  async function ensureToday(): Promise<string> {
    if (today) return today.id;
    return createSession(game.id, day, []);
  }

  async function toggleToday(trophy: Trophy) {
    const existing = today?.objectives.find((o) => o.trophy_id === trophy.id);
    if (existing) await deleteObjective(existing.id);
    else await addObjective(await ensureToday(), { title: trophy.name, trophy_id: trophy.id, guide_entry_id: null });
    await reloadToday();
  }

  async function addFreeToday(title: string) {
    if (!title.trim()) return;
    await addObjective(await ensureToday(), { title, trophy_id: null, guide_entry_id: null });
    await reloadToday();
  }

  return {
    game,
    openTrophy,
    collectionOf,
    checklist,
    progress,
    toggleItem,
    addOwnItem,
    removeOwnItem,
    today,
    inToday,
    toggleToday,
    addFreeToday,
    reloadToday,
  };
}
