import {useEffect,useId,useRef} from 'react';
export function SectionTabs<T extends string>({tabs,value,onChange,label}:{tabs:readonly {id:T;label:string}[];value:T;onChange:(value:T)=>void;label:string}){
 const id=useId();
 const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{const row=list.current,selected=row?.querySelector<HTMLElement>('[aria-selected="true"]');if(!row||!selected)return;const a=row.getBoundingClientRect(),b=selected.getBoundingClientRect();if(b.left<a.left)row.scrollLeft-=a.left-b.left+8;else if(b.right>a.right)row.scrollLeft+=b.right-a.right+8},[value]);
 return <div ref={list} className="tabs nexus-tabs" role="tablist" aria-label={label}>{tabs.map((tab,i)=><button id={`${id}-${tab.id}`} key={tab.id} type="button" role="tab" aria-selected={value===tab.id} tabIndex={value===tab.id?0:-1} className={`tab${value===tab.id?' active':''}`} onClick={()=>onChange(tab.id)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;onChange(tabs[next].id);(e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();}}>{tab.label}</button>)}</div>
}
