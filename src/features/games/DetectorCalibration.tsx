import { useEffect,useRef,useState } from "react";
import { GameTarget,captureObs,obsSources,saveDetector,setDetectorMode,changeGameTarget,setDetectorThreshold } from "../../db/gameBroadcast";
import { detectorStatus,DETECTOR_EVENT,templateScore } from "./gameDetector";
export function DetectorCalibration({target,onChanged}:{target:GameTarget;onChanged:()=>Promise<void>}){
 const canvas=useRef<HTMLCanvasElement>(null),image=useRef<HTMLImageElement|null>(null),start=useRef<{x:number;y:number}|null>(null);
 const [sources,setSources]=useState<string[]>([]),[source,setSource]=useState(target.detector_source??"");
 const [frame,setFrame]=useState(""),[rect,setRect]=useState<{x:number;y:number;w:number;h:number}|null>(null);
 const [mode,setMode]=useState<GameTarget["detector_mode"]>(target.detector_mode),[threshold,setThreshold]=useState(target.detector_threshold);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState(detectorStatus());
 useEffect(()=>{const update=()=>setStatus(detectorStatus());window.addEventListener(DETECTOR_EVENT,update);return()=>window.removeEventListener(DETECTOR_EVENT,update);},[]);
 useEffect(()=>{if(!frame)return;const img=new Image();img.onload=()=>{image.current=img;const c=canvas.current;if(c){c.width=1280;c.height=720;c.getContext("2d")?.drawImage(img,0,0,1280,720);}};img.src=frame;},[frame]);
 async function run(fn:()=>Promise<void>){setBusy(true);setError("");try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}}
 function draw(next:typeof rect){const c=canvas.current,ctx=c?.getContext("2d");if(!c||!ctx||!image.current)return;ctx.drawImage(image.current,0,0,1280,720);if(next){ctx.strokeStyle="#ffd37a";ctx.lineWidth=3;ctx.strokeRect(next.x,next.y,next.w,next.h);}}
 async function save(){await run(async()=>{
  if(!rect||rect.w<16||rect.h<10||rect.w*rect.h>150000||!image.current)throw Error("Selecciona solo el nombre o icono único del objeto; región entre 16×10 y 150.000 píxeles.");
  const c=document.createElement("canvas");c.width=rect.w;c.height=rect.h;const ctx=c.getContext("2d");if(!ctx)throw Error("No se pudo leer la imagen.");ctx.drawImage(image.current,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data;if(templateScore(pixels,pixels)<.99)throw Error("La región no tiene suficiente contraste. Selecciona texto o un icono distinguible.");
  await saveDetector(target.id,{source,reference:c.toDataURL("image/png"),...rect,mode:"test",threshold});setMode("test");await onChanged();
 });}
 return <section className="game-calibration"><h3>Detección visual · experimental</h3><strong>{target.title}</strong><p className="muted small">No es OCR ni lee la memoria del juego. Compara un aviso concreto en una región fija de OBS. Calibra con el nombre o icono único del objeto visible, prueba primero y conserva el botón manual.</p>
 <button className="ghost small-button" disabled={busy} onClick={()=>run(async()=>{const data=await obsSources();setSources(data.inputs.filter(i=>!/audio|wasapi|pulse|jack/i.test(i.inputKind)).map(i=>i.inputName));})}>Leer fuentes de OBS</button>
 <label>Captura del juego en OBS<select aria-label="Captura del juego en OBS" value={source} onChange={e=>setSource(e.target.value)}><option value="">Selecciona la fuente</option>{[...new Set([...sources,...(source?[source]:[])])].map(s=><option key={s}>{s}</option>)}</select></label>
 <button disabled={busy||!source} onClick={()=>run(async()=>{setFrame(await captureObs(source));setRect(null);})}>Capturar aviso de referencia</button>
 {frame&&<><p className="small">Arrastra un rectángulo sobre el nombre del objeto. Evita el fondo y los avisos genéricos «Objeto conseguido».</p><canvas className="detector-canvas" ref={canvas} onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();const p={x:Math.max(0,Math.min(1279,Math.round((e.clientX-r.left)*1280/r.width))),y:Math.max(0,Math.min(719,Math.round((e.clientY-r.top)*720/r.height)))};start.current=p;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!start.current)return;const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1280,Math.round((e.clientX-r.left)*1280/r.width))),y=Math.max(0,Math.min(720,Math.round((e.clientY-r.top)*720/r.height)));const next={x:Math.min(start.current.x,x),y:Math.min(start.current.y,y),w:Math.abs(x-start.current.x),h:Math.abs(y-start.current.y)};setRect(next);draw(next);}} onPointerUp={()=>{start.current=null;}}/><button disabled={busy||!rect} onClick={save}>Guardar referencia y probar</button></>}
 <label>Coincidencia mínima<input aria-label="Coincidencia mínima" type="number" min={.9} max={1} step={.001} value={threshold} onChange={e=>setThreshold(Number(e.target.value))} onBlur={()=>run(async()=>{await setDetectorThreshold(target.id,threshold);await onChanged();})}/></label>
 {target.detector_reference&&<label>Modo<select aria-label="Modo de detección" value={mode} disabled={busy} onChange={e=>{const next=e.target.value as typeof mode;void run(async()=>{await setDetectorMode(target.id,next);setMode(next);await onChanged();});}}><option value="off">Apagado</option><option value="test">Prueba: solo sugerir</option><option value="auto">Marcar automáticamente</option></select></label>}
 <p className="muted small">El marcado automático exige dos coincidencias y que el aviso anterior haya desaparecido. Funciona con Nexus abierto; cambios de resolución, posición o idioma requieren calibrar de nuevo. No reconoce todos los objetos con una sola referencia.</p>
 {status.id===target.id&&<p role="status">{status.message}{status.score!==null?` · ${(status.score*100).toFixed(1)} %`:""}</p>}
 {status.id===target.id&&status.candidate&&mode==="test"&&<button disabled={busy} onClick={()=>run(async()=>{await changeGameTarget(target.id,true,true);await onChanged();})}>Confirmar objeto conseguido</button>}
 {error&&<p role="alert" className="error">{error}</p>}
 </section>;
}
