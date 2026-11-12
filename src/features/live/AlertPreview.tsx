import {useEffect,useRef,useState} from "react";
import html from "../../../src-tauri/overlay/alerts.html?raw";
import css from "../../../src-tauri/overlay/alerts.css?raw";
import mascot from "../../assets/nexus-mark.png";
const document=html.replace('/*NEXUS_ALERT_STYLE*/',css).replace('<script>','<script>window.NEXUS_ALERT_PREVIEW=true;</script><script>');
export function AlertPreview({platform,config}:{platform:string;config:unknown}){
 const host=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null),[scale,setScale]=useState(1),[play,setPlay]=useState(1);
 const send=()=>frame.current?.contentWindow?.postMessage({type:'nexus-alert-preview',platform,config,mascot:new URL(mascot,location.href).href,play},'*');
 useEffect(()=>{send()},[platform,config,play]);
 useEffect(()=>{const observer=new ResizeObserver(([entry])=>setScale(entry.contentRect.width/640));if(host.current)observer.observe(host.current);return()=>observer.disconnect()},[]);
 return <div><div ref={host} className="alert-preview-stage"><iframe ref={frame} title={`Vista previa de ${platform}`} sandbox="allow-scripts" srcDoc={document} onLoad={send} style={{width:640,height:300,transform:`scale(${scale})`}}/></div><button className="ghost small-button" onClick={()=>setPlay(n=>n+1)}>Reproducir vista previa de {platform}</button><p className="muted small">Vista previa sin sonido. No consume la cola de OBS. Usa Probar para enviar una prueba a la fuente real.</p></div>
}
