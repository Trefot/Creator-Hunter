import { useEffect, useState } from "react";
import { ComingSoon } from "./components/ComingSoon";
import { Sidebar } from "./components/Sidebar";
import { BackupsPage } from "./features/backups/BackupsPage";
import { CalendarPage } from "./features/calendar/CalendarPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
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
    setSection(next);
  }

  function openProject(projectId: string) {
    setProjectToOpen(projectId);
    setSection("projects");
  }

  return (
    <div className="layout">
      <Sidebar current={section} onSelect={select} />
      <main className="content" key={dataVersion}>
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
