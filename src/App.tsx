import { useState } from "react";
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
import { es } from "./i18n/es";
import { Section } from "./sections";
import "./App.css";

function App() {
  const [section, setSection] = useState<Section>("dashboard");
  /** Proyecto que Proyectos debe abrir al entrar (por ejemplo, desde el calendario). */
  const [projectToOpen, setProjectToOpen] = useState<string | null>(null);

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
      <main className="content">
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
    </div>
  );
}

export default App;
