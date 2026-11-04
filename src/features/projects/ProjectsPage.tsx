import { PageTitle } from "../../components/PageTitle";
import { EmptyState } from "../../components/EmptyState";
import { FolderKanban } from "lucide-react";
import { useEffect, useState } from "react";
import { coverFor } from "../../components/cover";
import { PlatformLogo } from "../../components/PlatformBadge";
import { Adaptation, listAllAdaptations } from "../../db/adaptations";
import { listProfiles, Platform, Profile } from "../../db/profiles";
import { listProjects, Project } from "../../db/projects";
import { es } from "../../i18n/es";
import { ProjectDetail } from "./ProjectDetail";

const t = es.projects;

/** Lista de proyectos; al abrir uno se muestra su detalle con las adaptaciones. */
export function ProjectsPage({ initialOpenId = null }: { initialOpenId?: string | null }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [pr, ad, pf] = await Promise.all([listProjects(), listAllAdaptations(), listProfiles()]);
      setAdaptations(ad);
      setProfiles(pf);
      setProjects(pr);
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
        <PageTitle section="projects" subtitle={t.subtitle} />
      </header>

      {error && <p className="error">{error}</p>}

      {projects === null ? (
        <p className="muted">{t.loading}</p>
      ) : projects.length === 0 ? (
        <EmptyState section="projects" text={t.empty} />
      ) : (
        <ul className="gallery">
          {projects.map((p) => {
            const own = adaptations.filter((a) => a.project_id === p.id);
            const cover = own.find((a) => a.thumbnail)?.thumbnail;
            const platforms = [...new Set(own.map((a) => profiles.find((x) => x.id === a.profile_id)?.platform))].filter(
              (x): x is Platform => !!x,
            );
            const published = own.filter((a) => a.published_at !== null).length;
            return (
              <li key={p.id}>
                <button className="card gallery-card gallery-button" onClick={() => setOpenId(p.id)}>
                  <div className="gallery-cover" style={cover ? undefined : { background: coverFor(p.title) }}>
                    {cover ? <img src={cover} alt="" /> : <FolderKanban size={30} />}
                  </div>
                  <div className="gallery-body">
                    <strong className="gallery-title">{p.title}</strong>
                    {p.summary && <span className="muted gallery-description">{p.summary}</span>}
                    <span className="chips">
                      {platforms.map((pl) => (
                        <PlatformLogo key={pl} platform={pl} size={20} />
                      ))}
                    </span>
                    <span className="muted small">
                      {t.adaptationCount(p.adaptation_count)} · {t.publishedCount(published)}
                      {p.idea_id && ` · ${t.fromIdea}`}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
