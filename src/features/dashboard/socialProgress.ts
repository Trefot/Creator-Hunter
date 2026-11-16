import type {AccountSnapshot} from '../../db/accountSnapshots';
/** Compare the latest known value with a real record at/before the requested boundary.
 * No baseline means unknown growth, not +0. Rolling watch-hour totals are never subtracted.
 */
export function socialProgress(rows:AccountSnapshot[],profileId:string,today:string,days:number){
 const utc=(iso:string)=>Date.parse(iso+'T00:00:00Z');
 const end=utc(today),boundary=end-days*86400000;
 const valid=rows.filter(r=>r.profile_id===profileId&&r.followers!==null&&r.followers>=0&&utc(r.recorded_on)<=end).sort((a,b)=>a.recorded_on.localeCompare(b.recorded_on));
 const latest=valid[valid.length-1];
 const base=[...valid].reverse().find(r=>utc(r.recorded_on)<=boundary);
 return {latest:latest??null,baseline:base??null,delta:latest&&base&&latest.id!==base.id?latest.followers!-base.followers!:null};
}
