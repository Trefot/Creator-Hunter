import {useId} from 'react';
export function SectionTabs<T extends string>({tabs,value,onChange,label}:{tabs:readonly {id:T;label:string}[];value:T;onChange:(value:T)=>void;label:string}){
 const id=useId();
 return <div className="tabs nexus-tabs" role="tablist" aria-label={label}>{tabs.map((tab,i)=><button id={`${id}-${tab.id}`} key={tab.id} type="button" role="tab" aria-selected={value===tab.id} tabIndex={value===tab.id?0:-1} className={`tab${value===tab.id?' active':''}`} onClick={()=>onChange(tab.id)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;onChange(tabs[next].id);(e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();}}>{tab.label}</button>)}</div>
}
