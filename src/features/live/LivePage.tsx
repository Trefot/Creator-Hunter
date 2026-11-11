import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Check, ChevronDown, Copy, ImagePlus, Minus, MonitorPlay, Music, Pencil, Play, Plus, RotateCcw, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { fitPng } from "../../components/images";
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
export const BG_COLORS = ["#0e0c14", "#000000", "#1e1b4b", "#3b0764", "#450a0a", "#052e16", "#ffffff"];

/** Fondo de la tarjeta (color + opacidad) como en el overlay de OBS. */
export function cardBackground(color: string, opacity: number): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity / 100})`;
}

/** El icono del contador: su PNG propio o el emoji. */
export function CounterIcon({ counter }: { counter: Pick<Counter, "icon" | "image"> }) {
  return <span className="counter-icon">{counter.image ? <img src={counter.image} alt="" /> : counter.icon}</span>;
}

/** Contadores rápidos para empezar con un clic. */
const STYLE = { image: null, bg_color: "#0e0c14", bg_opacity: 85, style: "gamer" as const, sound: null, sound_on: true, sound_volume: 70 };
/** Tamaño máximo del sonido propio (se guarda en la base de datos). */
const MAX_SOUND_BYTES = 1_500_000;
const TEMPLATES: CounterInput[] = [
  { name: "Muertes", icon: "💀", color: "#ef4444", step: 1, game_id: null, ...STYLE },
  { name: "Jefes vencidos", icon: "⚔️", color: "#8b5cf6", step: 1, game_id: null, ...STYLE },
  { name: "Cofres abiertos", icon: "📦", color: "#f59e0b", step: 1, game_id: null, ...STYLE },
  { name: "Victorias", icon: "👑", color: "#eab308", step: 1, game_id: null, ...STYLE },
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

/**
 * Vista previa real: el mismo overlay de OBS dentro de un iframe, alimentado con lo que se está
 * editando (sin guardar). "Probar" suma 1 para ver la animación y oír el sonido.
 */
function OverlayPreview({ base, form }: { base: string; form: CounterInput }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState(27);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => e.data?.overlayReady && setReady(true);
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const counter = {
      ...form,
      id: "preview",
      name: form.name || t.namePlaceholder,
      value,
      has_image: !!form.image,
      image_src: form.image,
      has_sound: !!form.sound,
      sound_src: form.sound,
    };
    frame.current?.contentWindow?.postMessage({ counters: [counter] }, "*");
  }, [ready, form, value]);

  return (
    <div className="counter-preview-stage">
      <div className="counter-preview-head">
        <span className="small muted">{t.preview}</span>
        <button type="button" className="small-button" onClick={() => setValue((v) => v + 1)}>
          <Play size={13} /> {t.testFx}
        </button>
      </div>
      <iframe ref={frame} className="counter-preview-frame" src={`${base}/overlay?preview=1`} title={t.preview} allow="autoplay" />
    </div>
  );
}

/** Formulario para crear o editar un contador. */
function CounterForm({
  initial,
  games,
  overlayBase,
  onSave,
  onCancel,
}: {
  initial: CounterInput;
  games: Game[];
  /** Dirección del servidor local (para la vista previa real); null si no está activo. */
  overlayBase: string | null;
  onSave: (input: CounterInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CounterInput>(initial);
  const [imageError, setImageError] = useState("");
  const [soundError, setSoundError] = useState("");
  const set = (patch: Partial<CounterInput>) => setForm((f) => ({ ...f, ...patch }));

  async function onImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImageError("");
      set({ image: await fitPng(file) });
    } catch {
      setImageError(es.images.error);
    }
  }

  function onSound(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SOUND_BYTES) return setSoundError(t.soundTooBig);
    setSoundError("");
    const reader = new FileReader();
    reader.onload = () => set({ sound: String(reader.result), sound_on: true });
    reader.onerror = () => setSoundError(t.soundError);
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onSave({ ...form, step: Math.max(1, Math.floor(form.step) || 1) });
  }

  return (
    <form className="card counter-form" onSubmit={onSubmit}>
      {/* Vista previa tal cual se verá en OBS (sobre un fondo de tablero para notar la transparencia) */}
      {overlayBase ? (
        <OverlayPreview base={overlayBase} form={form} />
      ) : (
        <div className="counter-preview-stage">
          <span className="small muted">{t.preview}</span>
          <div className="overlay-card" style={{ ["--c" as string]: form.color, background: cardBackground(form.bg_color, form.bg_opacity) }}>
            <span className="overlay-icon">{form.image ? <img src={form.image} alt="" /> : form.icon}</span>
            <span className="overlay-text">
              <span className="overlay-name">{form.name || t.namePlaceholder}</span>
              <span className="overlay-value">27</span>
            </span>
          </div>
        </div>
      )}
      <div className="counter-form-row">
        <span className="small muted">{t.style}</span>
        <div className="counter-styles">
          {(["gamer", "card"] as const).map((style) => (
            <button type="button" key={style} className={`counter-style${form.style === style ? " on" : ""}`} onClick={() => set({ style })}>
              <strong>{t.styles[style].name}</strong>
              <span className="small muted">{t.styles[style].hint}</span>
            </button>
          ))}
        </div>
      </div>
      <label>
        {t.name}
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t.namePlaceholder} autoFocus />
      </label>
      <div className="counter-form-row">
        <span className="small muted">{t.icon}</span>
        <div className="counter-picks">
          <label className={`counter-pick counter-upload${form.image ? " on" : ""}`} title={t.uploadPng}>
            {form.image ? <img src={form.image} alt="" /> : <ImagePlus size={18} />}
            <input type="file" accept="image/png,image/webp,image/gif,image/jpeg" onChange={onImage} hidden />
          </label>
          {COUNTER_ICONS.map((icon) => (
            <button
              type="button"
              key={icon}
              className={`counter-pick${!form.image && form.icon === icon ? " on" : ""}`}
              onClick={() => set({ icon, image: null })}
            >
              {icon}
            </button>
          ))}
        </div>
        <span className="muted small">
          {form.image ? (
            <button type="button" className="link-button small" onClick={() => set({ image: null })}>
              {t.removePng}
            </button>
          ) : (
            t.pngHint
          )}
        </span>
        {imageError && <span className="error small">{imageError}</span>}
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
      <div className="counter-form-row">
        <span className="small muted">{t.background}</span>
        <div className="counter-picks">
          {BG_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={`counter-swatch bg${form.bg_color === color ? " on" : ""}`}
              style={{ background: color }}
              onClick={() => set({ bg_color: color })}
              aria-label={color}
            />
          ))}
        </div>
        <label className="counter-opacity">
          <span className="small muted">{t.opacity(form.bg_opacity)}</span>
          <input type="range" min={0} max={100} step={5} value={form.bg_opacity} onChange={(e) => set({ bg_opacity: Number(e.target.value) })} />
        </label>
      </div>
      <div className="counter-form-row">
        <span className="small muted">{t.sound}</span>
        <div className="counter-sound">
          <button type="button" className={`small-button${form.sound_on ? "" : " ghost"}`} onClick={() => set({ sound_on: !form.sound_on })}>
            {form.sound_on ? <Volume2 size={14} /> : <VolumeX size={14} />} {form.sound_on ? t.soundOn : t.soundOff}
          </button>
          <label className="ghost small-button counter-sound-upload">
            <Music size={14} /> {form.sound ? t.soundChange : t.soundUpload}
            <input type="file" accept="audio/*" onChange={onSound} hidden />
          </label>
          {form.sound && (
            <button type="button" className="link-button small" onClick={() => set({ sound: null })}>
              {t.soundDefault}
            </button>
          )}
        </div>
        <span className="muted small">{form.sound ? t.soundCustom : t.soundHint}</span>
        {form.sound_on && (
          <label className="counter-opacity">
            <span className="small muted">{t.volume(form.sound_volume)}</span>
            <input type="range" min={0} max={100} step={5} value={form.sound_volume} onChange={(e) => set({ sound_volume: Number(e.target.value) })} />
          </label>
        )}
        {soundError && <span className="error small">{soundError}</span>}
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
      await invoke("live_notify"); // el overlay de OBS se entera al instante
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
          initial={{ name: "", icon: COUNTER_ICONS[0], color: COUNTER_COLORS[0], step: 1, game_id: null, ...STYLE }}
          games={games}
          overlayBase={info?.running ? base : null}
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
                  overlayBase={info?.running ? base : null}
                  onCancel={() => setEditing(null)}
                  onSave={async (input) => {
                    await act(() => updateCounter(c.id, input));
                    setEditing(null);
                  }}
                />
              ) : (
                <article key={c.id} className="card counter-card" style={{ ["--c" as string]: c.color }}>
                  <div className="counter-top">
                    <CounterIcon counter={c} />
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
