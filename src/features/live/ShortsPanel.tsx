import {ShortLayoutPicker,ShortLayout} from "./ShortLayoutPicker";
import {useDraftState} from "../../hooks/useDraftState";
import {invoke} from "@tauri-apps/api/core";
import {ExportNextSteps} from "./MediaTools";
import { useEffect, useState, useRef } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Download, FolderOpen, RefreshCw, Scissors } from "lucide-react";
import { ShortExport, ShortFormat, shortsInstallFfmpeg, shortsList, shortsRender, shortsStatus } from "../../db/streamTools";
import "./streamTools.css";

const FORMATS: { id: ShortFormat; label: string; hint: string }[] = [
  { id: "vertical_blur", label: "Vertical con fondo", hint: "9:16, imagen completa y fondo difuminado" },
  { id: "vertical_crop", label: "Vertical recortado", hint: "9:16, solo el centro de la imagen" },
  { id: "horizontal", label: "Horizontal", hint: "16:9, imagen completa con bandas si hacen falta" },
  { id: "original", label: "Original", hint: "Conserva la proporción y resolución de la grabación" },
];

interface ShortPlan {start:number;end:number;duration:number;has_window:boolean;warning:string|null;audio:{index:number;title:string|null;channels:number}[]}

/** MOMENTO se pulsa después de la jugada. Primero muestra lo necesario para recuperarla. */
export function ShortMaker({ kind, id, captureWindow }: { kind: "moment" | "clip"; id: string; captureWindow?:{before:number;after:number} }) {
 const [layout,setLayout]=useDraftState<ShortLayout>('short-layout',{focus:.5,camera:null});
 const [open,setOpen]=useState(false),[format,setFormat]=useState<ShortFormat>('vertical_blur');
 const [before,setBefore]=useState(captureWindow?.before??30),[after,setAfter]=useState(captureWindow?.after??5);
 const [plan,setPlan]=useState<ShortPlan|null>(null),[checking,setChecking]=useState(false),[planError,setPlanError]=useState('');
 const [busy,setBusy]=useState(false),[result,setResult]=useState<string|null>(null),[exportId,setExportId]=useState<string|undefined>();
 const [audio,setAudio]=useState<number[]|undefined>(),[encoder,setEncoder]=useState('cpu'),[preview,setPreview]=useState(''),[videoPreview,setVideoPreview]=useState(''),[previewBusy,setPreviewBusy]=useState(false);
 const previewRequest=useRef(0);
 const [error,setError]=useState(''),[warning,setWarning]=useState<string|null>(null);
 useEffect(()=>{if(!open)return;let cancelled=false;setChecking(true);setPlanError('');setPreview('');setVideoPreview('');previewRequest.current++;
  const timer=setTimeout(()=>{invoke<ShortPlan>('shorts_plan',{kind,id,before,after}).then(p=>{if(!cancelled){setPlan(p);setAudio(previous=>{if(previous)return previous;try{const saved=JSON.parse(localStorage.getItem('nexus-pref:short-audio')??'null');if(Array.isArray(saved)&&saved.every(n=>Number.isInteger(n)&&p.audio.some(t=>t.index===n)))return saved}catch{}return p.audio.length?[p.audio[0].index]:[]})}}).catch(e=>{if(!cancelled){setPlanError(String(e));setPlan(null)}}).finally(()=>{if(!cancelled)setChecking(false)})},200);
  return()=>{cancelled=true;clearTimeout(timer)};
 },[open,kind,id,before,after]);
 useEffect(()=>{setPreview('');setVideoPreview('');previewRequest.current++},[format,audio,layout]);
 useEffect(()=>{if(audio!==undefined)localStorage.setItem('nexus-pref:short-audio',JSON.stringify(audio))},[audio]);
 async function render(){setBusy(true);setError('');setResult(null);setWarning(null);try{const r=await shortsRender(kind,id,format,before,after,audio,encoder,layout);setResult(r.path);setExportId(r.id);setWarning(r.warning??null);window.dispatchEvent(new Event('nexus-capture-changed'))}catch(e){setError(String(e))}finally{setBusy(false)}}
 if(!open)return <button className="ghost small-button" onClick={()=>setOpen(true)}><Scissors size={14}/>Crear Short</button>;
 return <div className="short-maker">
  <h3>Recuperar la jugada</h3>
  <p>Pulsa MOMENTO después de que pase algo bueno. El Short recupera lo que ocurrió antes del botón.</p>
  {checking&&<p className="muted small" role="status">Buscando el tramo de la grabación…</p>}
  {planError?<p role="alert" className="error">{planError}</p>:plan&&<>
   {plan.has_window?<label>Recuperar segundos anteriores al botón<input aria-label="Recuperar segundos anteriores al botón" type="number" min={1} max={captureWindow?120:180} value={before} onChange={e=>setBefore(Math.max(1,Math.min(captureWindow?120:180,Number(e.target.value)||1)))}/></label>:<p>Este clip ya contiene lo que guardó OBS. Se conservará completo.</p>}
   <p className="small">{plan.has_window?`Incluye hasta ${before} segundos de la jugada anterior y ${after} segundos después. `:''}Duración del Short: {Math.round(plan.duration)} segundos.</p>
   {plan.warning&&<p role="status" className="small">{plan.warning}</p>}
   <p className="muted small">Formato: {FORMATS.find(f=>f.id===format)?.label}. Puedes cambiarlo en las opciones.</p>
   <button className="ghost small-button" disabled={previewBusy||checking} onClick={async()=>{const request=++previewRequest.current;setPreviewBusy(true);setError('');try{const image=await invoke<string>('shorts_preview',{kind,id,format,before,after,layout});if(request===previewRequest.current)setPreview(image)}catch(e){setError(String(e))}finally{setPreviewBusy(false)}}}>{previewBusy?'Preparando imagen…':'Ver cómo empieza'}</button>
   <button className="ghost small-button" disabled={previewBusy||checking||audio===undefined} onClick={async()=>{setPreviewBusy(true);setError('');try{const video=await invoke<string>('shorts_video_preview',{kind,id,format,before,after,audio,layout});setVideoPreview(video)}catch(e){setError(String(e))}finally{setPreviewBusy(false)}}}>Reproducir tramo y escuchar audio</button>
   {videoPreview&&<video controls preload="metadata" src={videoPreview} aria-label="Vista previa del Short con audio" style={{width:'100%',maxHeight:420}}/>}
   {preview&&<img src={preview} alt="Primer fotograma del Short" style={{maxWidth:'100%',maxHeight:300,objectFit:'contain',display:'block'}}/>}
   <ShortLayoutPicker kind={kind} id={id} before={before} after={after} value={layout} onChange={v=>{setLayout(v);if(v.camera)setFormat('vertical_crop')}}/>
   <details><summary>Opciones de imagen y audio</summary>
    <div className="short-formats">{FORMATS.map(f=><label key={f.id} className={`short-format${format===f.id?' on':''}`}><input type="radio" name={`fmt-${id}`} checked={format===f.id} onChange={()=>setFormat(f.id)}/><strong>{f.label}</strong><span className="muted small">{f.hint}</span></label>)}</div>
    {plan.has_window&&<label>Segundos después del botón<input type="number" min={0} max={captureWindow?30:180} value={after} onChange={e=>setAfter(Math.max(0,Math.min(captureWindow?30:180,Number(e.target.value)||0)))}/></label>}
    <fieldset><legend>Audio de la grabación</legend>{plan.audio.map(t=><label key={t.index} style={{display:'flex',gap:8}}><input type="checkbox" checked={audio?.includes(t.index)??false} onChange={e=>setAudio(e.target.checked?[...(audio??[]),t.index]:(audio??[]).filter(n=>n!==t.index))}/>{t.title||`Pista ${t.index+1}`} · {t.channels} canales</label>)}<p className="muted small">Se usa la primera pista por defecto. Elige varias solo si voz y juego están separados. Sin selección se guarda sin audio.</p></fieldset>
    <label>Procesamiento<select value={encoder} onChange={e=>setEncoder(e.target.value)}><option value="cpu">Normal</option><option value="nvenc">NVIDIA · requiere prueba de GPU</option></select></label>
    {encoder==='nvenc'&&<p className="muted small">Ejecuta primero la prueba en Procesamiento local. Si prefieres continuar directamente, elige Normal.</p>}
   </details>
   <div className="tools-actions"><button disabled={busy||checking||audio===undefined} onClick={render}><Scissors size={14}/>{busy?'Guardando… consulta Procesamiento local':'Guardar Short'}</button></div>
  </>}
  <button className="ghost small-button" onClick={()=>setOpen(false)}>Cerrar</button>
  {result&&<><p role="status" className="status-on small">Short guardado. <button className="link-button small" onClick={()=>revealItemInDir(result)}>Mostrar archivo</button></p><ExportNextSteps path={result} exportId={exportId}/></>}
  {warning&&warning!==plan?.warning&&<p role="status" className="small">{warning}</p>}
  {error&&<p role="alert" className="error small">{error}</p>}
 </div>;
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
    if(!active)return;void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);
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
                <div><ExportNextSteps path={s.path} exportId={s.id}/><button className="ghost small-button" onClick={() => revealItemInDir(s.path)}>
                  <FolderOpen size={13} /> Mostrar
                </button></div>
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
