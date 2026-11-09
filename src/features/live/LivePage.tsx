import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, ChevronDown, Copy, Minus, MonitorPlay, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageTitle } from "../../components/PageTitle";
import {
  bumpCounter,
  Counter,
  CounterInput,
  createCounter,
  deleteCounter,
  listCounters,
  setCounterValue,
  updateCounter,
} from "../../db/counters";
import { Game, listGames } from "../../db/games";
import { es } from "../../i18n/es";

const t = es.live;

export const COUNTER_ICONS = ["💀", "⚔️", "📦", "🏆", "👑", "❤️", "⭐", "🎯", "🔥", "💎", "👥", "🎮"];
export const COUNTER_COLORS = ["#8b5cf6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#ec4899", "#f97316", "#eab308"];

/** Contadores rápidos para empezar con un clic. */
const TEMPLATES: CounterInput[] = [
  { name: "Muertes", icon: "💀", color: "#ef4444", step: 1, game_id: null },
  { name: "Jefes vencidos", icon: "⚔️", color: "#8b5cf6", step: 1, game_id: null },
  { name: "Cofres abiertos", icon: "📦", color: "#f59e0b", step: 1, game_id: null },
  { name: "Victorias", icon: "👑", color: "#eab308", step: 1, game_id: null },
];

interface LiveInfo {
  running: boolean;
  port: number;
  key: string;
  error: string | null;
}

/** Botón que copia un texto y confirma con "¡Copiado!". */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ghost small-button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? t.copied : label}
    </button>
  );
}

/** Formulario para crear o editar un contador. */
function CounterForm({
  initial,
  games,
  onSave,
  onCancel,
}: {
  initial: CounterInput;
  games: Game[];
  onSave: (input: CounterInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CounterInput>(initial);
  const set = (patch: Partial<CounterInput>) => setForm((f) => ({ ...f, ...patch }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onSave({ ...form, step: Math.max(1, Math.floor(form.step) || 1) });
  }

  return (
    <form className="card counter-form" onSubmit={onSubmit}>
      <div className="counter-form-preview" style={{ ["--c" as string]: form.color }}>
        <span className="counter-icon">{form.icon}</span>
        <strong>{form.name || t.namePlaceholder}</strong>
      </div>
      <label>
        {t.name}
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t.namePlaceholder} autoFocus />
      </label>
      <div className="counter-form-row">
        <span className="small muted">{t.icon}</span>
        <div className="counter-picks">
          {COUNTER_ICONS.map((icon) => (
            <button type="button" key={icon} className={`counter-pick${form.icon === icon ? " on" : ""}`} onClick={() => set({ icon })}>
              {icon}
            </button>
          ))}
        </div>
      </div>
      <div className="counter-form-row">
        <span className="small muted">{t.color}</span>
        <div className="counter-picks">
          {COUNTER_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={`counter-swatch${form.color === color ? " on" : ""}`}
              style={{ background: color }}
              onClick={() => set({ color })}
              aria-label={color}
            />
          ))}
        </div>
      </div>
      <div className="counter-form-grid">
        <label>
          {t.step}
          <input type="number" min={1} value={form.step} onChange={(e) => set({ step: Number(e.target.value) })} />
        </label>
        <label>
          {t.game}
          <select value={form.game_id ?? ""} onChange={(e) => set({ game_id: e.target.value || null })}>
            <option value="">{t.noGame}</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" disabled={!form.name.trim()}>
          <Check size={16} /> {t.save}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

/** Live Studio · fase 1: contadores para el stream, con overlay de OBS y botones del Stream Deck. */
export function LivePage() {
  const [counters, setCounters] = useState<Counter[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [info, setInfo] = useState<LiveInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deckOpen, setDeckOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "reset" | "delete" } | null>(null);
  const [howTo, setHowTo] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setCounters(await listCounters());
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    refresh();
    listGames().then(setGames).catch(() => {});
    invoke<LiveInfo>("live_status").then(setInfo).catch((e) => setError(String(e)));
    // El Stream Deck cambia los contadores a través del servidor local: la app se entera por este evento.
    const unlisten = listen("counters-changed", () => refresh());
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const base = info ? `http://127.0.0.1:${info.port}` : "";
  const overlayAll = `${base}/overlay`;
  const deckUrl = (id: string, action: "inc" | "dec" | "reset") => `${base}/api/counters/${id}/${action}?key=${info?.key ?? ""}`;
  const gameName = (id: string | null) => games.find((g) => g.id === id)?.title;

  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <section className="page page-wide">
      <header className="page-header">
        <PageTitle section="live" subtitle={t.subtitle} />
        {!creating && (
          <button onClick={() => setCreating(true)}>
            <Plus size={16} /> {t.new}
          </button>
        )}
      </header>

      {/* Conexión con OBS y el Stream Deck */}
      <section className={`card live-connect${info?.running ? " on" : ""}`}>
        <div className="live-connect-head">
          <MonitorPlay size={22} />
          <div>
            <strong>{info?.running ? t.serverOn(info.port) : info?.error ? t.serverError : t.serverStarting}</strong>
            <p className="muted small">{info?.error ?? t.serverHint}</p>
          </div>
          {info?.running && <CopyButton text={overlayAll} label={t.copyOverlayAll} />}
          <button className="ghost small-button" onClick={() => setHowTo(!howTo)}>
            {t.howTo} <ChevronDown size={14} className={howTo ? "flip" : ""} />
          </button>
        </div>
        {howTo && (
          <div className="live-howto">
            <div>
              <h3>{t.obsTitle}</h3>
              <ol className="small">
                {t.obsSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <div>
              <h3>{t.deckTitle}</h3>
              <ol className="small">
                {t.deckSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="muted small">{t.deckKeyNote}</p>
            </div>
          </div>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      {creating && (
        <CounterForm
          initial={{ name: "", icon: COUNTER_ICONS[0], color: COUNTER_COLORS[0], step: 1, game_id: null }}
          games={games}
          onCancel={() => setCreating(false)}
          onSave={async (input) => {
            await act(() => createCounter(input));
            setCreating(false);
          }}
        />
      )}

      {counters === null ? (
        <p className="muted">{t.loading}</p>
      ) : counters.length === 0 && !creating ? (
        <EmptyState section="live" text={t.empty}>
          <div className="live-templates">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.name} className="ghost" onClick={() => act(() => createCounter(tpl))}>
                {tpl.icon} {tpl.name}
              </button>
            ))}
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="counter-grid">
            {counters.map((c) =>
              editing === c.id ? (
                <CounterForm
                  key={c.id}
                  initial={c}
                  games={games}
                  onCancel={() => setEditing(null)}
                  onSave={async (input) => {
                    await act(() => updateCounter(c.id, input));
                    setEditing(null);
                  }}
                />
              ) : (
                <article key={c.id} className="card counter-card" style={{ ["--c" as string]: c.color }}>
                  <div className="counter-top">
                    <span className="counter-icon">{c.icon}</span>
                    <span className="counter-name">
                      <strong>{c.name}</strong>
                      {gameName(c.game_id) && <span className="muted small">{gameName(c.game_id)}</span>}
                    </span>
                    <button className="ghost small-button icon-button" title={t.edit} onClick={() => setEditing(c.id)}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="counter-main">
                    <button className="counter-btn" title={t.minus} onClick={() => act(() => bumpCounter(c.id, -1))} disabled={c.value === 0}>
                      <Minus size={22} />
                    </button>
                    <span key={c.value} className="counter-value">
                      {c.value.toLocaleString(es.locale)}
                    </span>
                    <button className="counter-btn plus" title={t.plus(c.step)} onClick={() => act(() => bumpCounter(c.id, 1))}>
                      <Plus size={22} />
                    </button>
                  </div>
                  {c.step > 1 && <p className="muted small counter-step">{t.stepOf(c.step)}</p>}

                  {confirm?.id === c.id ? (
                    <div className="counter-confirm">
                      <span className="small">{confirm.kind === "reset" ? t.confirmReset : t.confirmDelete}</span>
                      <button
                        className="danger small-button"
                        onClick={() =>
                          act(async () => {
                            if (confirm.kind === "reset") await setCounterValue(c.id, 0);
                            else await deleteCounter(c.id);
                            setConfirm(null);
                          })
                        }
                      >
                        {confirm.kind === "reset" ? t.reset : t.delete}
                      </button>
                      <button className="ghost small-button icon-button" onClick={() => setConfirm(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="counter-actions">
                      {info?.running && <CopyButton text={`${overlayAll}?c=${c.id}`} label={t.copyOverlay} />}
                      <button className="ghost small-button" onClick={() => setDeckOpen(deckOpen === c.id ? null : c.id)}>
                        {t.deck} <ChevronDown size={13} className={deckOpen === c.id ? "flip" : ""} />
                      </button>
                      <button className="ghost small-button icon-button" title={t.reset} onClick={() => setConfirm({ id: c.id, kind: "reset" })}>
                        <RotateCcw size={14} />
                      </button>
                      <button className="ghost small-button icon-button" title={t.delete} onClick={() => setConfirm({ id: c.id, kind: "delete" })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {deckOpen === c.id && info?.running && (
                    <div className="counter-deck">
                      {(["inc", "dec", "reset"] as const).map((a) => (
                        <div key={a} className="counter-deck-row">
                          <span className="small">{t.deckActions[a]}</span>
                          <CopyButton text={deckUrl(c.id, a)} label={t.copyUrl} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
          <div className="live-templates">
            <span className="muted small">{t.quickAdd}</span>
            {TEMPLATES.filter((tpl) => !counters.some((c) => c.name === tpl.name)).map((tpl) => (
              <button key={tpl.name} className="ghost small-button" onClick={() => act(() => createCounter(tpl))}>
                {tpl.icon} {tpl.name}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
