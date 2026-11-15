import type { Adaptation } from "../../db/adaptations";

/** Subida reciente de YouTube (src-tauri/src/youtube.rs, D-033). */
export interface Upload {
  id: string;
  title: string;
  published_at: string | null;
  privacy: string | null;
  publish_at: string | null;
}

export interface UploadMatch {
  upload: Upload;
  version: Adaptation;
  /** Público = se marca publicado; privado con fecha = se marca programado. */
  action: "publish" | "schedule";
  url: string;
  /** Fecha local 'AAAA-MM-DDTHH:MM' de la publicación o de la programación. */
  at: string;
}

const STOP = new Set(["como", "para", "con", "los", "las", "del", "una", "que", "por", "mis", "est", "este", "esta"]);

function words(title: string): Set<string> {
  const plain = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ");
  return new Set(plain.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)));
}

/** Parecido entre dos títulos de 0 a 1: palabras en común frente a las del título más corto. */
export function titleScore(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.max(wa.size, wb.size);
}

/** Instante ISO (UTC) a fecha local 'AAAA-MM-DDTHH:MM', el formato de Nexus (D-009). */
export function toLocalMinute(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Propone qué versión corresponde a cada subida, para que el usuario lo confirme con un clic.
 * Ignora subidas ya enlazadas, versiones publicadas o en directo, y lo que el usuario descartó.
 * Cada versión se propone una sola vez, con su subida más parecida (mínimo 0,6).
 */
export function videoId(url:string|null):string|null {
 if(!url)return null;
 try{const u=new URL(url);if(u.hostname==='youtu.be')return u.pathname.split('/')[1]||null;
 if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))return u.searchParams.get('v')??u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?]+)/)?.[1]??null;
 }catch{}return null;
}
export function matchUploads(uploads: Upload[], versions: Adaptation[], dismissed: Set<string>, youtubeProfileId?:string): UploadMatch[] {
  if(!youtubeProfileId)return [];
  const open=versions.filter(v=>v.profile_id===youtubeProfileId&&!v.published_at&&(v.format==='long_video'||v.format==='short'));
  const used=new Set<string>();const out:UploadMatch[]=[];
  for(const upload of uploads){
    const isPublic=upload.privacy==='public'||upload.privacy==='unlisted';
    const scheduled=upload.privacy==='private'&&!!upload.publish_at;
    if(!isPublic&&!scheduled)continue;
    const stamp=(isPublic?upload.published_at:upload.publish_at);if(!stamp||!Number.isFinite(Date.parse(stamp)))continue;
    const at=toLocalMinute(stamp);
    const linked=versions.filter(v=>videoId(v.published_url)===upload.id);
    const scored=open.filter(v=>!used.has(v.id)&&!dismissed.has(`${upload.id}:${v.id}`))
      .filter(v=>linked.length?linked.some(x=>x.id===v.id):!v.published_url)
      .filter(v=>!scheduled||v.scheduled_at!==at||!v.steps.find(s=>s.step==='scheduling')?.completed_at)
      .map(v=>({v,score:linked.length?1:titleScore(upload.title,v.title)})).sort((a,b)=>b.score-a.score);
    const best=scored[0];
    // Un título genérico compartido no permite elegir silenciosamente entre versiones.
    if(!best||best.score<0.7||(!linked.length&&scored[1]&&best.score-scored[1].score<0.15))continue;
    used.add(best.v.id);out.push({upload,version:best.v,action:isPublic?'publish':'schedule',url:v_url(upload.id,best.v.format),at});
  }
  return out;
}
function v_url(id:string,format:string):string{return format==='short'?`https://youtube.com/shorts/${id}`:`https://youtu.be/${id}`;}
