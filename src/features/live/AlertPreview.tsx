import {useEffect,useRef,useState} from "react";
import html from "../../../src-tauri/overlay/alerts.html?raw";
import css from "../../../src-tauri/overlay/alerts.css?raw";
import font from "../../assets/alerts/inter-latin.woff2?inline";
import {alertAsset} from "./alertAssets";
import {AlertConfig,Platform} from "./alertTypes";
const document=html.replace('/*NEXUS_ALERT_STYLE*/',()=>css.replace('__NEXUS_ALERT_FONT__',()=>font)).replace('<script>','<script>window.NEXUS_ALERT_PREVIEW=true;</script><script>');
export function AlertPreview({platform,config}:{platform:Platform;config:AlertConfig}){
 const host=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null),[scale,setScale]=useState(1),[play,setPlay]=useState(1),[assets,setAssets]=useState<{key:string;art:string;figure:string}|null>(null),[error,setError]=useState("");
 const sentAssets=useRef<object|null>(null),signature=JSON.stringify(config);
 const design=config.design||'reference',assetKey=`${platform}/${design}`;
 useEffect(()=>{let cancelled=false;setError("");Promise.all([alertAsset(design==='reference'?`${platform}-v2.png`:`${platform}-frame-v3.png`),design==='reference'?Promise.resolve(''):alertAsset(`pose-${design}-v1.png`)]).then(([art,figure])=>{if(!cancelled)setAssets({key:assetKey,art,figure})}).catch(e=>{if(!cancelled)setError(String(e))});return()=>{cancelled=true}},[assetKey,platform,design]);
 const send=()=>{if(assets?.key===assetKey){const include=sentAssets.current!==assets;frame.current?.contentWindow?.postMessage({type:'nexus-alert-preview',platform,config,art:include?assets.art:undefined,figure:include?assets.figure:undefined,play},'*');sentAssets.current=assets;}};
 useEffect(()=>{send()},[platform,signature,play,assets,assetKey]);
 useEffect(()=>{const observer=new ResizeObserver(([entry])=>setScale(entry.contentRect.width/640));if(host.current)observer.observe(host.current);return()=>observer.disconnect()},[]);
 return <div><div ref={host} className="alert-preview-stage"><iframe ref={frame} title={`Vista previa de ${platform}`} sandbox="allow-scripts" srcDoc={document} onLoad={()=>{sentAssets.current=null;send()}} style={{width:640,height:300,transform:`scale(${scale})`}}/></div>{error&&<p className="error" role="alert">{error}</p>}{assets?.key!==assetKey&&!error&&<p className="muted small">Cargando ilustración…</p>}<button className="ghost small-button" disabled={assets?.key!==assetKey} onClick={()=>setPlay(n=>n+1)}>Reproducir vista previa de {platform}</button><p className="muted small">Vista previa sin sonido. No consume la cola de OBS. Guarda los cambios antes de probar la alerta en su fuente real.</p></div>
}
