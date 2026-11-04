import { PageTitle } from "../../components/PageTitle";
import { EmptyState } from "../../components/EmptyState";
import { Archive, ArchiveRestore, Check, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { coverFor } from "../../components/cover";
import { useEffect, useState } from "react";
import {
  approveIdea,
  createIdea,
  deleteIdea,
  Idea,
  IdeaInput,
  IDEA_STATUSES,
  IdeaStatus,
  listIdeas,
  setIdeaStatus,
  splitTags,
  updateIdea,
} from "../../db/ideas";
import { es } from "../../i18n/es";
import { formatDate } from "../../i18n/format";
import { IdeaForm } from "./IdeaForm";

const t = es.ideas;

/** Qué muestra el formulario: nada, una idea nueva o la edición de una existente. */
type Editing = null | "new" | Idea;

/** Fecha local 'AAAA-MM-DD' de un instante ISO. */
function localDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [filter, setFilter] = useState<IdeaStatus | "all">("new");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setIdeas(await listIdeas());
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSave(input: IdeaInput) {
    if (editing === "new") await createIdea(input);
    else if (editing) await updateIdea(editing.id, input);
    setEditing(null);
    await refresh();
  }

  /** Ejecuta una acción sobre una idea y refresca la lista. */
  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
    setConfirmingId(null);
    await refresh();
  }

  const count = (status: IdeaStatus) => ideas?.filter((i) => i.status === status).length ?? 0;
  const visible = (ideas ?? [])
    .filter((i) => filter === "all" || i.status === filter)
    .filter((i) => tagFilter === null || splitTags(i.tags).includes(tagFilter));

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="ideas" subtitle={t.subtitle} />
        {editing === null && <button onClick={() => setEditing("new")}><Plus size={16} />{t.add}</button>}
      </header>

      {editing !== null && (
        <IdeaForm
          key={editing === "new" ? "new" : editing.id}
          idea={editing === "new" ? undefined : editing}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="tabs">
        {IDEA_STATUSES.map((s) => (
          <button key={s} className={`tab${filter === s ? " active" : ""}`} onClick={() => setFilter(s)}>
            {t.statuses[s]} <span className="tab-count">{count(s)}</span>
          </button>
        ))}
        <button className={`tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
          {t.all} <span className="tab-count">{ideas?.length ?? 0}</span>
        </button>
        {tagFilter && (
          <button className="chip chip-active" onClick={() => setTagFilter(null)} title={t.clearTag}>
            #{tagFilter} ×
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {ideas === null ? (
        <p className="muted">{t.loading}</p>
      ) : visible.length === 0 ? (
        <EmptyState section="ideas" text={t.empty} />
      ) : (
        <ul className="gallery">
          {visible.map((idea) => (
            <li key={idea.id} className={`card gallery-card${idea.status === "discarded" ? " goal-abandoned" : ""}`}>
              <div className="gallery-cover" style={{ background: coverFor(splitTags(idea.tags)[0] ?? idea.title) }}>
                <Lightbulb size={30} />
                <span className={`gallery-status status-${idea.status}`}>{t.statusLabels[idea.status]}</span>
              </div>
              <div className="gallery-body">
                <strong className="gallery-title">{idea.title}</strong>
                {idea.description && <p className="muted gallery-description">{idea.description}</p>}
                <div className="chips">
                  {splitTags(idea.tags).map((tag) => (
                    <button key={tag} className="chip" onClick={() => setTagFilter(tag)}>
                      #{tag}
                    </button>
                  ))}
                </div>
                <span className="muted small">{formatDate(localDate(idea.created_at))}</span>
                {idea.status === "approved" && <p className="status-on small">{t.approvedNote}</p>}
              </div>
              <div className="gallery-actions">
                {confirmingId === idea.id ? (
                  <>
                    <button className="danger" onClick={() => run(() => deleteIdea(idea.id))}>
                      {t.confirmRemove}
                    </button>
                    <button className="ghost" onClick={() => setConfirmingId(null)}>
                      {t.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    {idea.status === "new" && (
                      <button onClick={() => run(() => approveIdea(idea.id))}>
                        <Check size={16} />
                        {t.approve}
                      </button>
                    )}
                    <button className="ghost icon-button" onClick={() => setEditing(idea)} title={t.edit}>
                      <Pencil size={16} />
                    </button>
                    {idea.status === "new" && (
                      <button className="ghost icon-button" onClick={() => run(() => setIdeaStatus(idea.id, "discarded"))} title={t.discard}>
                        <Archive size={16} />
                      </button>
                    )}
                    {idea.status === "discarded" && (
                      <button className="ghost" onClick={() => run(() => setIdeaStatus(idea.id, "new"))}>
                        <ArchiveRestore size={16} />
                        {t.restore}
                      </button>
                    )}
                    <button className="ghost icon-button" onClick={() => setConfirmingId(idea.id)} title={t.remove}>
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
