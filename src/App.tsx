import { startGameDetector } from "./features/games/gameDetector";
import { UpdateLayer } from "./features/update/UpdateLayer";
import { StreamRecapLayer } from "./features/live/StreamRecap";
import { HabitLayer } from "./features/habit/HabitLayer";
import { invoke } from "@tauri-apps/api/core";
import { LivePage } from "./features/live/LivePage";
import { useEffect, useState } from "react";
import { ComingSoon } from "./components/ComingSoon";
import { Sidebar } from "./components/Sidebar";
import { BackupsPage } from "./features/backups/BackupsPage";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { GamesPage } from "./features/games/GamesPage";
import { useGameMode } from "./features/games/useGameMode";
import { selectManualGame } from "./features/games/gameMode";
import { applySkin } from "./features/games/gameSkin";
import { Gamepad2 } from "lucide-react";
import { GoalsPage } from "./features/goals/GoalsPage";

import { IncomePage } from "./features/income/IncomePage";

import { ProfilesPage } from "./features/profiles/ProfilesPage";
import { startYouTubeAutoSync } from "./features/profiles/youtubeSync";
import { es } from "./i18n/es";
import { Section } from "./sections";
import "./App.css";
import "./styles/hybrid.css";
import "./styles/nexus.css";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { ContentHub } from "./features/projects/ContentHub";

import {AutoMomentsIndicator} from "./features/live/AutoMoments";

function App() {
  const [focus,setFocus]=useState(()=>{try{return localStorage.getItem("nexus-focus")==="true"}catch{return false}});
  const [liveTab,setLiveTab]=useState({value:"cabina",revision:0});
  const [section, setSection] = useState<Section>("dashboard");
  /** Proyecto que Proyectos debe abrir al entrar (por ejemplo, desde el calendario). */
  const [projectToOpen, setProjectToOpen] = useState<string | null>(null);
  /** Cambia cuando llegan datos nuevos de fuera (sincronización) para refrescar las vistas de métricas sin reiniciar su estado. */
  const [dataVersion, setDataVersion] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  /** Juego que Juegos debe abrir al entrar (modo juego o banner). */
  const [gameToOpen, setGameToOpen] = useState<string | null>(null);
  const [gameView, setGameView] = useState<"today" | undefined>(undefined);

  // La detección actualiza el banner, sin desmontar formularios ni interrumpir capturas.
  const gameMode = useGameMode(() => {});
  useEffect(() => startGameDetector(), []);
  useEffect(() => { invoke("obs_initialize").catch(console.error); }, []);
  useEffect(() => {
    invoke("obs_context", { gameId: gameMode.playing?.id ?? null }).catch(console.error);
  }, [gameMode.playing?.id]);

  useEffect(() => {
    invoke("stream_game_context", { gameId: gameMode.playing?.id ?? null, ambiguous: !!gameMode.ambiguous || !!gameMode.error }).catch(console.error);
  }, [gameMode.checkedAt]);

  // La identidad visual se conserva; las portadas viven en las fichas de cada juego.
  useEffect(()=>{applySkin(null,null)},[]);

  // Actualiza datos sin desmontar formularios ni interrumpir la edición.
  useEffect(() => startYouTubeAutoSync(
    (data) => {
      setDataVersion((v) => v + 1);
      setNotice({
        text: data.warning ? es.youtube.syncedWithWarning : es.youtube.synced(data.videosSynced),
        error: !!data.warning,
      });
    },
    (err) => setNotice({ text: `${es.youtube.syncFailed} ${err}`, error: true }),
  ), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.error ? 9000 : 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function select(next: Section,tab?:string) {
    if(next==="live")setLiveTab(v=>({value:tab??"cabina",revision:v.revision+1}));
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
    <div className={`layout nexus-visual${focus?" focus-enabled":""}`} data-section={section}>
      <Sidebar current={section} onSelect={select} focus={focus} onFocus={()=>setFocus(value=>{try{localStorage.setItem("nexus-focus",String(!value))}catch{}return !value})} />
      <main className="content">
        <WorkspaceHeader section={section} onNavigate={select}/>
        <AutoMomentsIndicator/>
        {gameMode.playing && (
          <div className="now-playing">
            <Gamepad2 size={18} />
            <span>
              {es.games.nowPlaying} <strong>{gameMode.playing.title}</strong>
              {gameMode.source && <small className="muted"> · {es.games.activitySources[gameMode.source]}</small>}
            </span>
            {!(section === "games" && gameToOpen === gameMode.playing.id) && (
              <button className="small-button" onClick={() => openGame(gameMode.playing!.id, "today")}>
                {es.games.openToday}
              </button>
            )}
            {gameMode.source === "manual" && <button className="small-button" onClick={() => selectManualGame(null)}>{es.games.automaticGame}</button>}
          </div>
        )}
        {section === "dashboard" ? (
          <DashboardPage dataVersion={dataVersion} onNavigate={select} onOpenProject={openProject} />
        ) : section === "profiles" ? (
          <ProfilesPage dataVersion={dataVersion} />
        ) : section === "goals" ? (
          <GoalsPage dataVersion={dataVersion} />
        ) : section === "ideas" ? (
          <ContentHub initialTab="ideas" onOpenProject={openProject}/>
        ) : section === "projects" ? (
          <ContentHub key={projectToOpen ?? "list"} initialOpenId={projectToOpen} initialTab="projects" onOpenProject={openProject}/>
        ) : section === "calendar" ? (
          <CalendarPage onOpenProject={openProject} />
        ) : section === "income" ? (
          <IncomePage />
        ) : section === "games" ? (
          <GamesPage key={gameToOpen ?? "list"} initialOpenId={gameToOpen} initialView={gameView} gameMode={gameMode} onOpenProject={openProject} onOpenIdeas={()=>select("ideas")} />
        ) : section === "live" ? (
          <LivePage onOpenProject={openProject} initialTab={liveTab.value} navigationRevision={liveTab.revision}/>
        ) : section === "backups" ? (
          <BackupsPage />
        ) : (
          <ComingSoon title={es.sections[section]} />
        )}
      </main>
      <UpdateLayer />
      <StreamRecapLayer />
      <HabitLayer />
      {notice && (
        <div className={`toast${notice.error ? " toast-error" : ""}`} role="status">
          {notice.text}
        </div>
      )}
    </div>
  );
}

export default App;
