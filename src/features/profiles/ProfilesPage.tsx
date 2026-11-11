import { PageTitle } from "../../components/PageTitle";
import { EmptyState } from "../../components/EmptyState";
import { AVATAR_SIZE } from "../../components/images";
import { ImagePicker } from "../../components/ImagePicker";
import { PlatformBadge, PlatformLogo } from "../../components/PlatformBadge";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AccountSnapshot, latestSnapshots } from "../../db/accountSnapshots";
import {
  createProfile,
  deleteProfile,
  listProfiles,
  Profile,
  ProfileInput,
  setProfileAvatar,
  updateProfile,
} from "../../db/profiles";
import { es } from "../../i18n/es";
import { formatDate, formatNumber } from "../../i18n/format";
import { ProfileForm } from "./ProfileForm";
import { SnapshotsPanel } from "./SnapshotsPanel";
import { YouTubeConnect } from "./YouTubeConnect";

const ts = es.snapshots;

/** Resumen del último registro, por ejemplo "850 seguidores · 1.200 h · 3 nov 2026". */
function latestSummary(s: AccountSnapshot | undefined): string {
  if (!s) return ts.noData;
  const parts: string[] = [];
  if (s.followers !== null) parts.push(`${formatNumber(s.followers)} ${ts.followersUnit}`);
  if (s.watch_hours !== null) parts.push(`${formatNumber(s.watch_hours)} ${ts.hoursUnit}`);
  parts.push(formatDate(s.recorded_on));
  return parts.join(" · ");
}

const t = es.profiles;

/** Qué muestra el formulario: nada, un perfil nuevo o la edición de uno existente. */
type Editing = null | "new" | Profile;

export function ProfilesPage({ dataVersion = 0 }: { dataVersion?: number }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [openSnapshotsId, setOpenSnapshotsId] = useState<string | null>(null);
  const [latest, setLatest] = useState<Map<string, AccountSnapshot>>(new Map());
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [list, last] = await Promise.all([listProfiles(), latestSnapshots()]);
      setProfiles(list);
      setLatest(last);
    } catch (err) {
      setError(`${t.errors.generic} ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, [dataVersion]);

  async function onSave(input: ProfileInput) {
    if (editing === "new") await createProfile(input);
    else if (editing) await updateProfile(editing.id, input);
    setEditing(null);
    await refresh();
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await deleteProfile(id);
    } catch (err) {
      setError(String(err).includes("FOREIGN KEY") ? t.errors.inUse : `${t.errors.generic} ${err}`);
    }
    setConfirmingId(null);
    await refresh();
  }

  const monetizedCount = profiles?.filter((p) => p.is_monetized).length ?? 0;

  return (
    <section className="page">
      <header className="page-header">
        <PageTitle section="profiles" subtitle={t.subtitle} />
        {editing === null && <button onClick={() => setEditing("new")}><Plus size={16} />{t.add}</button>}
      </header>

      {editing !== null && (
        <ProfileForm
          key={editing === "new" ? "new" : editing.id}
          profile={editing === "new" ? undefined : editing}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && <p className="error">{error}</p>}

      {profiles === null ? (
        <p className="muted">{t.loading}</p>
      ) : profiles.length === 0 ? (
        <EmptyState section="profiles" text={t.empty} />
      ) : (
        <>
          <p className="muted small">{t.summary(profiles.length, monetizedCount)}</p>
          <ul className="profile-list">
            {profiles.map((p) => (
              <li key={p.id} className="card profile-card">
                <div className="profile-row">
                  <div className="avatar-with-logo">
                    <ImagePicker
                      image={p.avatar}
                      size={AVATAR_SIZE}
                      round
                      className="avatar-lg"
                      placeholder={<PlatformLogo platform={p.platform} size={56} />}
                      onChange={async (img) => {
                        await setProfileAvatar(p.id, img);
                        await refresh();
                      }}
                    />
                    {p.avatar && (
                      <span className="avatar-logo">
                        <PlatformLogo platform={p.platform} size={22} />
                      </span>
                    )}
                  </div>

                  <div className="profile-main">
                    <PlatformBadge platform={p.platform} size={16} withName />
                    <strong>{p.display_name ?? p.handle}</strong>
                    {p.display_name && <span className="muted">{p.handle}</span>}
                    <span className="muted small">{latestSummary(latest.get(p.id))}</span>
                    {p.url && (
                      <button className="link" onClick={() => openUrl(p.url!)} title={p.url}>
                        {t.openLink}
                      </button>
                    )}
                  </div>

                  <span className={`status ${p.is_monetized ? "status-on" : ""}`}>
                    {p.is_monetized ? t.monetized : t.notMonetized}
                  </span>

                  <div className="profile-actions">
                    <button
                      className="ghost"
                      onClick={() => setOpenSnapshotsId(openSnapshotsId === p.id ? null : p.id)}
                    >
                      {openSnapshotsId === p.id ? ts.hide : ts.toggle}
                    </button>
                    {confirmingId === p.id ? (
                      <>
                        <button className="danger" onClick={() => onDelete(p.id)}>
                          {t.confirmRemove}
                        </button>
                        <button className="ghost" onClick={() => setConfirmingId(null)}>
                          {t.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="ghost" onClick={() => setEditing(p)}>
                          {t.edit}
                        </button>
                        <button className="ghost" onClick={() => setConfirmingId(p.id)}>
                          {t.remove}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {p.platform === "youtube" && <YouTubeConnect profileId={p.id} onChange={refresh} />}
                {openSnapshotsId === p.id && <SnapshotsPanel profileId={p.id} onChange={refresh} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
