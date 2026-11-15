import { useEffect, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Download, FolderOpen, RefreshCw, Scissors } from "lucide-react";
import { ShortExport, ShortFormat, shortsInstallFfmpeg, shortsList, shortsRender, shortsStatus } from "../../db/streamTools";
import "./streamTools.css";

const FORMATS: { id: ShortFormat; label: string; hint: string }[] = [
  { id: "vertical_blur", label: "Vertical con fondo", hint: "9:16, imagen completa y fondo difuminado" },
  { id: "vertical_crop", label: "Vertical recortado", hint: "9:16, solo el centro de la imagen" },
  { id: "horizontal", label: "Horizontal", hint: "16:9, como la grabación" },
];

/** Botón «✂️ Short» de cada momento o clip de la bandeja. */
export function ShortMaker({ kind, id, captureWindow }: { kind: "moment" | "clip"; id: string; captureWindow?:{before:number;after:number} }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShortFormat>("vertical_blur");
  const [before, setBefore] = useState(captureWindow?.before??20);
  const [after, setAfter] = useState(captureWindow?.after??10);
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [warning,setWarning]=useState<string|null>(null);

  async function render() {
    setState("busy");
    setError("");
    setResult(null);
    setWarning(null);
    try {
      const result=await shortsRender(kind,id,format,before,after);setResult(result.path);setWarning(result.warning??null);
    } catch (e) {
      setError(String(e));
    } finally {
      setState("idle");
    }
  }

  if (!open)
    return (
      <button className="ghost small-button" onClick={() => setOpen(true)}>
        <Scissors size={14} /> Crear Short
      </button>
    );
  return (
    <div className="short-maker">
      <div className="short-formats">
        {FORMATS.map((f) => (
          <label key={f.id} className={`short-format${format === f.id ? " on" : ""}`}>
            <input type="radio" name={`fmt-${id}`} checked={format === f.id} onChange={() => setFormat(f.id)} />
            <strong>{f.label}</strong>
            <span className="muted small">{f.hint}</span>
          </label>
        ))}
      </div>
      {kind === "moment" || captureWindow ? (
        <div className="short-window small">
          <label>
            Segundos antes <input type="number" min={0} max={captureWindow?120:180} value={before} onChange={(e) => setBefore(Number(e.target.value))} />
          </label>
          <label>
            Segundos después <input type="number" min={0} max={captureWindow?30:180} value={after} onChange={(e) => setAfter(Number(e.target.value))} />
          </label>
        </div>
      ) : (
        <p className="muted small">El clip del Replay Buffer se convierte entero al formato elegido.</p>
      )}
      <div className="tools-actions">
        <button className="small-button" disabled={state === "busy"} onClick={render}>
          {state === "busy" ? <RefreshCw size={14} className="spin" /> : <Scissors size={14} />} {state === "busy" ? "Creando… (puede tardar)" : "Crear"}
        </button>
        <button className="ghost small-button" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>
      {result && (
        <p className="status-on small">
          ✓ Listo: {result}{" "}
          <button className="link-button small" onClick={() => revealItemInDir(result)}>
            Mostrar en la carpeta
          </button>
        </p>
      )}
      {warning&&<p role="status" className="small">{warning}</p>}
      {error && <p role="alert" className="error small">{error}</p>}
    </div>
  );
}

/** Estado de ffmpeg y los últimos Shorts creados (En directo → Momentos). */
export function ShortsPanel({ active }: { active: boolean }) {
  const [ffmpeg, setFfmpeg] = useState<string | null | undefined>(undefined);
  const [list, setList] = useState<ShortExport[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [s, l] = await Promise.all([shortsStatus(), shortsList()]);
      setFfmpeg(s.ffmpeg);
      setList(l);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    if (active) void refresh();
  }, [active]);

  return (
    <section className="card tools-panel">
      <header className="tools-head">
        <div>
          <h2>
            <Scissors size={18} /> Clips para Shorts
          </h2>
          <p className="muted small">
            Usa «Crear Short» en cualquier momento o clip de abajo: Nexus recorta la grabación alrededor de la marca y la deja en vertical, lista para TikTok, Shorts o Reels. Se guardan en Vídeos → Nexus Shorts.
          </p>
        </div>
        <button className="ghost small-button" onClick={refresh}>
          <RefreshCw size={14} /> Comprobar de nuevo
        </button>
      </header>
      {ffmpeg === null && (
        <div className="tools-warn small">
          Para crear Shorts hace falta <strong>ffmpeg</strong> (gratuito). Se instala una vez con winget, el instalador de Windows.
          <button className="small-button" onClick={() => shortsInstallFfmpeg().catch((e) => setError(String(e)))}>
            <Download size={14} /> Instalar ffmpeg
          </button>
          <span className="muted">Se abrirá una ventana con el progreso. Al terminar, pulsa «Comprobar de nuevo».</span>
        </div>
      )}
      {ffmpeg && <p className="muted small">🟢 ffmpeg listo.</p>}
      {list.length > 0 && (
        <ul className="shorts-list small">
          {list.map((s) => (
            <li key={s.id}>
              <span>
                <strong>{s.title}</strong> · {FORMATS.find((f) => f.id === s.format)?.label} · {new Date(s.created_at).toLocaleString("es")}
              </span>
              {s.exists ? (
                <button className="ghost small-button" onClick={() => revealItemInDir(s.path)}>
                  <FolderOpen size={13} /> Mostrar
                </button>
              ) : (
                <span className="muted">archivo movido o borrado</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="error small">{error}</p>}
    </section>
  );
}
