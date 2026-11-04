import { useEffect, useState } from "react";
import { listProjects, Project } from "../../db/projects";
import { es } from "../../i18n/es";

const t = es.projects;

/** Lista básica de proyectos; las adaptaciones y la producción llegan en la siguiente sesión. */
export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError(String(err)));
  }, []);

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
            <li key={p.id} className="card idea-card">
              <strong>{p.title}</strong>
              {p.summary && <p className="muted idea-description">{p.summary}</p>}
              {p.idea_id && <p className="muted small">{t.fromIdea}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
