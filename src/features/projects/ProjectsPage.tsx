import { useEffect, useState } from "react";
import { listProjects, Project } from "../../db/projects";
import { es } from "../../i18n/es";
import { ProjectDetail } from "./ProjectDetail";

const t = es.projects;

/** Lista de proyectos; al abrir uno se muestra su detalle con las adaptaciones. */
export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const open = projects?.find((p) => p.id === openId);
  if (open) return <ProjectDetail key={open.id} project={open} onBack={() => setOpenId(null)} onChanged={refresh} />;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>{es.sections.projects}</h1>
          <p className="muted">{t.subtitle}</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {projects === null ? (
        <p className="muted">{t.loading}</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>{t.empty}</p>
        </div>
      ) : (
        <ul className="goal-list">
          {projects.map((p) => (
            <li key={p.id}>
              <button className="card project-row" onClick={() => setOpenId(p.id)}>
                <strong>{p.title}</strong>
                {p.summary && <span className="muted idea-description">{p.summary}</span>}
                <span className="muted small">
                  {t.adaptationCount(p.adaptation_count)}
                  {p.idea_id && ` · ${t.fromIdea}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
