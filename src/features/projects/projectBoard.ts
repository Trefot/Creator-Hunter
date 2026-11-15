import type {Adaptation} from '../../db/adaptations';
/** Una pieza lista terminó la producción; publicación y análisis son fases posteriores. */
export function productionReady(v:Adaptation):boolean {
 return !v.published_at && v.steps.length>0 && !v.steps.some(s=>s.enabled&&['script','recording','editing'].includes(s.step)&&!s.completed_at);
}
export type BoardStage='prepare'|'production'|'ready'|'published';
export function projectStage(versions:Adaptation[]):BoardStage{
 if(!versions.length)return 'prepare';
 const pending=versions.filter(v=>!v.published_at);
 if(!pending.length)return 'published';
 if(pending.every(productionReady))return 'ready';
 if(pending.some(v=>v.steps.some(s=>s.enabled&&s.completed_at)||v.steps.find(s=>s.enabled&&!s.completed_at)?.step!==undefined&&v.steps.find(s=>s.enabled&&!s.completed_at)?.step!=='script'))return 'production';
 return 'prepare';
}
export function nextProjectStep(versions:Adaptation[]):string{
 if(!versions.length)return 'Crear la primera versión';
 if(versions.every(v=>!!v.published_at))return 'Revisar los resultados';
 const pending=versions.find(v=>!v.published_at&&(v.steps.some(s=>s.enabled&&!s.completed_at)||!v.steps.length));
 if(!pending)return 'Programar o publicar';
 if(!pending.steps.length)return 'Configurar los pasos';
 if(productionReady(pending))return pending.scheduled_at?'Publicar la versión':'Programar la publicación';
 const step=pending.steps.find(s=>s.enabled&&!s.completed_at)?.step;
 return ({script:'Definir el guion',recording:'Preparar la grabación',editing:'Continuar la edición',scheduling:'Programar la publicación',publishing:'Publicar la versión',analysis:'Revisar resultados'})[step??'script']??'Revisar los pasos';
}
