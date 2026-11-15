import {getDb,WORKSPACE_ID} from '../../db/database';
import {GameTarget,saveDetector} from '../../db/gameBroadcast';
type Reference=Parameters<typeof saveDetector>[1];
export interface DetectorProfile {id:string;name:string;targetId:string;gameId:string;data:Reference}
function prefix(target:GameTarget){return `detector-profile:${WORKSPACE_ID}:${target.id}:`}
export async function detectorProfiles(target:GameTarget):Promise<DetectorProfile[]>{
 const db=await getDb();const rows=await db.select<{content:string}[]>('SELECT content FROM alert_cursor WHERE id LIKE $1',[prefix(target)+'%']);
 return rows.flatMap(row=>{try{const p=JSON.parse(row.content) as DetectorProfile;return p.targetId===target.id&&p.gameId===target.game_id?[p]:[]}catch{return []}});
}
export async function saveDetectorProfile(target:GameTarget,name:string){
 if(!name.trim()||name.length>80)throw Error('Pon un nombre al perfil (hasta 80 caracteres), por ejemplo «1080p · español».');
 if(!target.detector_reference||!target.detector_source||target.detector_x===null||target.detector_y===null||!target.detector_w||!target.detector_h)throw Error('Guarda primero una referencia de este objeto.');
 const existing=await detectorProfiles(target);if(existing.length>=10&&!existing.some(p=>p.name===name.trim()))throw Error('Máximo 10 perfiles por objeto. Retira uno antes de añadir otro.');
 const id=prefix(target)+encodeURIComponent(name.trim());
 const profile:DetectorProfile={id,name:name.trim(),targetId:target.id,gameId:target.game_id,data:{source:target.detector_source,reference:target.detector_reference,x:target.detector_x,y:target.detector_y,w:target.detector_w,h:target.detector_h,threshold:target.detector_threshold,mode:'test'}};
 const db=await getDb();await db.execute('INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET content=excluded.content',[id,JSON.stringify(profile)]);
}
export async function applyDetectorProfile(target:GameTarget,profile:DetectorProfile){
 if(profile.targetId!==target.id||profile.gameId!==target.game_id)throw Error('Este perfil pertenece a otro objeto o juego.');
 await saveDetector(target.id,{...profile.data,mode:'test'});
}
export async function removeDetectorProfile(target:GameTarget,profile:DetectorProfile){if(!profile.id.startsWith(prefix(target)))throw Error('Perfil no válido.');const db=await getDb();await db.execute('DELETE FROM alert_cursor WHERE id=$1',[profile.id]);}
