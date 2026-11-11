import { getDb,WORKSPACE_ID } from "../../db/database";
import { captureObs,changeGameTarget,GameTarget } from "../../db/gameBroadcast";
export const DETECTOR_EVENT="nexus-game-detector";
export interface DetectorStatus {id:string|null;score:number|null;message:string;candidate:boolean}
let status:DetectorStatus={id:null,score:null,message:"Detección apagada",candidate:false};
export function detectorStatus(){return status;}
function update(next:DetectorStatus){status=next;window.dispatchEvent(new Event(DETECTOR_EVENT));}
/** Correlación de luminancia: una referencia sin contraste nunca es una coincidencia. */
export function templateScore(a:ArrayLike<number>,b:ArrayLike<number>):number{
 if(a.length!==b.length||a.length<16)return 0;
 const stride=4*Math.max(1,Math.ceil(a.length/(4*12000)));let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;
 for(let i=0;i<a.length;i+=stride){const x=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2],y=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2];n++;sa+=x;sb+=y;saa+=x*x;sbb+=y*y;sab+=x*y;}
 const va=saa-sa*sa/n,vb=sbb-sb*sb/n;if(va/n<9||vb/n<9)return 0;
 return Math.max(0,Math.min(1,(sab-sa*sb/n)/Math.sqrt(va*vb)));
}
async function bitmap(url:string){return createImageBitmap(await(await fetch(url)).blob());}
export function startGameDetector(){
 let cancelled=false,timer:ReturnType<typeof setTimeout>,lastId="",lastReference="",reference:Uint8ClampedArray|null=null,streak=0,armed=false;
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
 async function tick(){try{
  const db=await getDb();const rows=await db.select<(GameTarget&{collection_key:string|null;done_with_trophy:number|null})[]>("SELECT t.* FROM game_target t JOIN game_overlay o ON o.target_id=t.id AND o.game_id=t.game_id WHERE t.workspace_id=$1 AND t.detector_mode!='off' AND t.done=0 AND NOT EXISTS(SELECT 1 FROM collection_item c WHERE c.game_id=t.game_id AND c.item_key=t.collection_key) AND NOT EXISTS(SELECT 1 FROM trophy p WHERE p.game_id=t.game_id AND p.psn_trophy_id=t.done_with_trophy AND p.earned_at IS NOT NULL)",[WORKSPACE_ID]);
  if(cancelled)return;const t=rows[0];
  if(!t||!t.detector_source||!t.detector_reference){lastId="";reference=null;update({id:null,score:null,message:"Detección apagada o sin objetivo pendiente",candidate:false});return;}
  if(!ctx||!t.detector_w||!t.detector_h||t.detector_x===null||t.detector_y===null)throw Error("Guarda una región de referencia válida.");
  if(t.id!==lastId||t.detector_reference!==lastReference){lastId=t.id;lastReference=t.detector_reference;streak=0;armed=false;const image=await bitmap(t.detector_reference);canvas.width=image.width;canvas.height=image.height;ctx.drawImage(image,0,0);reference=ctx.getImageData(0,0,image.width,image.height).data;image.close();}
  const source=await captureObs(t.detector_source);if(cancelled)return;const frame=await bitmap(source);
  if(frame.width!==1280||frame.height!==720){frame.close();throw Error("Cambió el tamaño de la captura. Vuelve a calibrar.");}
  canvas.width=t.detector_w;canvas.height=t.detector_h;ctx.drawImage(frame,t.detector_x,t.detector_y,t.detector_w,t.detector_h,0,0,t.detector_w,t.detector_h);frame.close();
  const score=reference?templateScore(reference,ctx.getImageData(0,0,canvas.width,canvas.height).data):0;
  const matches=score>=t.detector_threshold;if(!matches){armed=true;streak=0;}else streak++;
  update({id:t.id,score,message:t.detector_mode==="test"?"Prueba visual: no marca objetos":!armed?"Esperando que desaparezca el aviso de referencia":"Comparando el aviso del objeto",candidate:matches&&streak>=2});
  if(t.detector_mode==="auto"&&armed&&streak>=2){
   const latest=await db.select<{detector_reference:string;detector_mode:string}[]>("SELECT t.detector_reference,t.detector_mode FROM game_target t JOIN game_overlay o ON o.target_id=t.id WHERE t.id=$1 AND t.workspace_id=$2",[t.id,WORKSPACE_ID]);
   if(!cancelled&&latest[0]?.detector_reference===t.detector_reference&&latest[0]?.detector_mode==="auto"){await changeGameTarget(t.id,true,true);update({id:t.id,score,message:"Objetivo marcado por coincidencia visual; puedes deshacerlo",candidate:false});}
   streak=0;armed=false;
  }
 }catch(e){if(!cancelled)update({id:lastId||null,score:null,message:String(e),candidate:false});streak=0;}finally{if(!cancelled)timer=setTimeout(tick,1200);}}
 void tick();return()=>{cancelled=true;clearTimeout(timer);};
}
