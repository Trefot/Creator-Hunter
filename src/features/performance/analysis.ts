import type {ContentPost,Observation} from '../../db/contentPerformance';
const median=(values:number[])=>{const n=[...values].sort((a,b)=>a-b),i=Math.floor(n.length/2);return n.length%2?n[i]:(n[i-1]+n[i])/2};
/** Compare observations near the SAME age. Current lifetime totals never stand in for a missing checkpoint. */
export function checkpoint(post:Pick<ContentPost,'id'|'published_at'>,history:Observation[],hours:number):number|null{
 const target=hours*3600000,published=Date.parse(post.published_at);if(!Number.isFinite(published))return null;
 const rows=history.filter(o=>o.post_id===post.id&&o.views!==null&&o.views>=0).map(o=>({o,age:Date.parse(o.observed_at)-published})).filter(r=>r.age>=target*.8&&r.age<=target*1.2).sort((a,b)=>Math.abs(a.age-target)-Math.abs(b.age-target));return rows[0]?.o.views??null;
}
export function evaluate(post:ContentPost,posts:ContentPost[],history:Observation[],hours:number){
 const value=checkpoint(post,history,hours);
 if(post.format==='unknown')return{label:'Clasifica el formato',detail:'Indica vídeo, Short o publicación para comparar contenido parecido.',ratio:null,sample:0};
 const comparisons=posts.filter(p=>p.id!==post.id&&p.profile_id===post.profile_id&&p.format===post.format).map(p=>checkpoint(p,history,hours)).filter((v):v is number=>v!==null);
 if(value===null)return{label:'Esperando medición comparable',detail:`Necesitamos una consulta cerca de las ${hours} horas desde la publicación. Los vídeos antiguos no inventan ese historial.`,ratio:null,sample:comparisons.length};
 if(comparisons.length<5)return{label:'Seguir reuniendo datos',detail:`${comparisons.length}/5 publicaciones comparables del mismo perfil y formato a ${hours} h. Un vídeo aislado no decide una serie.`,ratio:null,sample:comparisons.length};
 const base=median(comparisons);if(base<=0)return{label:'Base insuficiente',detail:'La mediana comparable es cero; no se calcula un porcentaje engañoso.',ratio:null,sample:comparisons.length};
 const ratio=value/base;
 return{label:ratio>=1.25?'Por encima de tu media habitual':ratio<=.75?'Por debajo de tu media habitual':'Dentro de tu rango habitual',detail:`${value.toLocaleString('es-CO')} vistas a ${hours} h; mediana de referencia ${base.toLocaleString('es-CO')} (${comparisons.length} publicaciones). Es una asociación, no demuestra una causa.`,ratio,sample:comparisons.length};
}
export function seriesAdvice(series:string,platform:string,posts:ContentPost[],history:Observation[],hours:number){
 const results=posts.filter(p=>p.series_id===series&&p.platform===platform).map(p=>evaluate(p,posts,history,hours)).filter(r=>r.ratio!==null);
 if(results.length<3)return{label:'Seguir probando',detail:`${results.length}/3 publicaciones de la serie con comparación suficiente en esta red.`};
 const ratio=median(results.map(r=>r.ratio!));return{label:ratio>=1.25?'Repetir el enfoque':ratio<=.75?'Adaptar y revisar antes de continuar':'Mantener y experimentar',detail:`Basado en ${results.length} publicaciones comparadas por cuenta, formato y antigüedad. Nexus no pausa ni publica nada por ti.`};
}
