import { EmptyState } from "../../components/EmptyState";
import { Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  Adaptation,
  AdaptationInput,
  createAdaptation,
  deleteAdaptation,
  listAdaptations,
  Step,
  updateAdaptation,
} from "../../db/adaptations";
import { listProfiles, Profile } from "../../db/profiles";
import { deleteProject, Project, updateProject } from "../../db/projects";
import { es } from "../../i18n/es";
import { AdaptationCard } from "./AdaptationCard";
import { AdaptationForm } from "./AdaptationForm";

const t = es.projects;

/** Qué muestra el formulario de adaptación: nada, una nueva o la edición de una existente. */
type Editing = null | "new" | Adaptation;

interface Props {
  project: Project;
  onBack: () => void;
  /** Avisa a la lista de proyectos de que algo cambió. */
  onChanged: () => Promise<void>;
}

export function ProjectDetail({ project, onBack, onChanged }: Props) {
  const [adaptations, setAdaptations] = useState<Adaptation[] | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [a, p] = await Promise.all([listAdaptations(project.id), listProfiles()]);
      setAdaptations(a);
      setProfiles(p);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, [project.id]);

  async function onSaveAdaptation(input: AdaptationInput, disabled: Step[]) {
    if (editing === "new") await createAdaptation(project.id, input, disabled);
    else if (editing) await updateAdaptation(editing.id, input);
    setEditing(null);
    await refresh();
    await onChanged();
  }

  async function onSaveProject(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(t.errors.title);
    setError("");
    try {
      await updateProject(project.id, { title, summary });
      setEditingProject(false);
      await onChanged();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  async function onDeleteProject() {
    try {
      await deleteProject(project.id);
      await onChanged();
      onBack();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  return (
    <section className="page">
      <button className="link back-link" onClick={onBack}>
        {t.back}
      </button>

      {editingProject ? (
        <form className="card form" onSubmit={onSaveProject}>
          <h2>{t.editProject}</h2>
          <label>
            {t.title}
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="full-width">
            {t.summary}
            <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </label>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={() => setEditingProject(false)}>
              {t.cancel}
            </button>
            <button type="submit">{t.save}</button>
          </div>
        </form>
      ) : (
        <header className="page-header">
          <div>
            <h1>{project.title}</h1>
            {project.summary && <p className="muted idea-description">{project.summary}</p>}
          </div>
          <div className="profile-actions">
            {confirmingDelete ? (
              <>
                <button className="danger" onClick={onDeleteProject}>
                  {t.confirmRemoveProject}
                </button>
                <button className="ghost" onClick={() => setConfirmingDelete(false)}>
                  {t.cancel}
                </button>
              </>
            ) : (
              <>
                <button className="ghost" onClick={() => setEditingProject(true)}>
                  {t.edit}
                </button>
                <button className="ghost" onClick={() => setConfirmingDelete(true)}>
                  {t.remove}
                </button>
                {editing === null && profiles.length > 0 && (
                  <button onClick={() => setEditing("new")}><Plus size={16} />{t.addAdaptation}</button>
                )}
              </>
            )}
          </div>
        </header>
      )}

      {editing !== null && (
        <AdaptationForm
          key={editing === "new" ? "new" : editing.id}
          adaptation={editing === "new" ? undefined : editing}
          profiles={profiles}
          defaultTitle={project.title}
          onSave={onSaveAdaptation}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && <p className="error">{error}</p>}

      {adaptations === null ? (
        <p className="muted">{t.loading}</p>
      ) : profiles.length === 0 ? (
        <EmptyState section="projects" text={t.needProfiles} />
      ) : adaptations.length === 0 ? (
        <EmptyState section="projects" text={t.noAdaptations} />
      ) : (
        <ul className="goal-list">
          {adaptations.map((a) => (
            <AdaptationCard
              key={a.id}
              adaptation={a}
              profile={profiles.find((p) => p.id === a.profile_id)}
              onEdit={() => setEditing(a)}
              onDelete={async () => {
                await deleteAdaptation(a.id);
                await refresh();
                await onChanged();
              }}
              onChange={refresh}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
