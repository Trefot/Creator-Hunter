import { LivePage } from "./features/live/LivePage";
import { useEffect, useState } from "react";
import { ComingSoon } from "./components/ComingSoon";
import { Sidebar } from "./components/Sidebar";
import { BackupsPage } from "./features/backups/BackupsPage";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { GamesPage } from "./features/games/GamesPage";
import { useGameMode } from "./features/games/useGameMode";
import { applySkin, skinFromCover } from "./features/games/gameSkin";
import { Gamepad2 } from "lucide-react";
import { GoalsPage } from "./features/goals/GoalsPage";
import { IdeasPage } from "./features/ideas/IdeasPage";
import { IncomePage } from "./features/income/IncomePage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { ProfilesPage } from "./features/profiles/ProfilesPage";
import { autoSyncYouTube } from "./features/profiles/youtubeSync";
import { es } from "./i18n/es";
import { Section } from "./sections";
import "./App.css";

function App() {
  const [section, setSection] = useState<Section>("dashboard");
  /** Proyecto que Proyectos debe abrir al entrar (por ejemplo, desde el calendario). */
  const [projectToOpen, setProjectToOpen] = useState<string | null>(null);
  /** Cambia cuando llegan datos nuevos de fuera (sincronización) para recargar la sección visible. */
  const [dataVersion, setDataVersion] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  /** Juego que Juegos debe abrir al entrar (modo juego o banner). */
  const [gameToOpen, setGameToOpen] = useState<string | null>(null);
  const [gameView, setGameView] = useState<"today" | undefined>(undefined);

  // Modo juego: al empezar a jugar en la PS5 un juego de la biblioteca, la app abre su ficha.
  const gameMode = useGameMode((game) => openGame(game.id, "today"));

  // Skin del juego: mientras se juega, la app toma los colores y el arte de su portada.
  const playingCover = gameMode.playing?.cover ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!playingCover) {
      applySkin(null, null);
      return;
    }
    skinFromCover(playingCover)
      .then((skin) => !cancelled && applySkin(skin, playingCover))
      .catch(() => applySkin(null, null));
    return () => {
      cancelled = true;
    };
  }, [playingCover]);

  // Sincronización automática de YouTube al abrir (como mucho cada 3 horas).
  useEffect(() => {
    autoSyncYouTube()
      .then((data) => {
        if (!data) return;
        setDataVersion((v) => v + 1);
        setNotice({
          text: data.warning ? es.youtube.syncedWithWarning : es.youtube.synced(data.videosSynced),
          error: !!data.warning,
        });
      })
      .catch((err) => setNotice({ text: `${es.youtube.syncFailed} ${err}`, error: true }));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 9000 : 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function select(next: Section) {
    setProjectToOpen(null);
    setGameToOpen(null);
    setSection(next);
  }

  function openGame(gameId: string, view?: "today") {
    setGameToOpen(gameId);
    setGameView(view);
    setSection("games");
  }

  function openProject(projectId: string) {
    setProjectToOpen(projectId);
    setSection("projects");
  }

  return (
    <div className="layout">
      <Sidebar current={section} onSelect={select} />
      <main className="content" key={dataVersion}>
        {gameMode.playing && (
          <div className="now-playing">
            <Gamepad2 size={18} />
            <span>
              {es.games.nowPlaying} <strong>{gameMode.playing.title}</strong>
            </span>
            {!(section === "games" && gameToOpen === gameMode.playing.id) && (
              <button className="small-button" onClick={() => openGame(gameMode.playing!.id, "today")}>
                {es.games.openToday}
              </button>
            )}
          </div>
        )}
        {section === "dashboard" ? (
          <DashboardPage onNavigate={select} onOpenProject={openProject} />
        ) : section === "profiles" ? (
          <ProfilesPage />
        ) : section === "goals" ? (
          <GoalsPage />
        ) : section === "ideas" ? (
          <IdeasPage />
        ) : section === "projects" ? (
          <ProjectsPage key={projectToOpen ?? "list"} initialOpenId={projectToOpen} />
        ) : section === "calendar" ? (
          <CalendarPage onOpenProject={openProject} />
        ) : section === "income" ? (
          <IncomePage />
        ) : section === "games" ? (
          <GamesPage key={gameToOpen ?? "list"} initialOpenId={gameToOpen} initialView={gameView} gameMode={gameMode} />
        ) : section === "live" ? (
          <LivePage />
        ) : section === "backups" ? (
          <BackupsPage />
        ) : (
          <ComingSoon title={es.sections[section]} />
        )}
      </main>
      {notice && (
        <div className={`toast${notice.error ? " toast-error" : ""}`} role="status">
          {notice.text}
        </div>
      )}
    </div>
  );
}

export default App;
