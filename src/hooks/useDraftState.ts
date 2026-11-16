import {Dispatch,SetStateAction,useState} from 'react';
const prefix='nexus-draft:';
export function clearDraft(key:string){try{for(const k of Object.keys(localStorage))if(k===prefix+key||k.startsWith(prefix+key+':'))localStorage.removeItem(k)}catch{/* Saved data remains in SQLite. */}}
/** Write synchronously on editing; navigation/closing does not have to wait for an effect. Never use for secrets. */
export function useDraftState<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const [value,setValue]=useState<T>(()=>{try{const raw=localStorage.getItem(prefix+key);if(raw!==null)return JSON.parse(raw) as T}catch{}return typeof initial==='function'?(initial as ()=>T)():initial});
 const update:Dispatch<SetStateAction<T>>=next=>setValue(previous=>{const v=typeof next==='function'?(next as (old:T)=>T)(previous):next;try{localStorage.setItem(prefix+key,JSON.stringify(v))}catch{window.dispatchEvent(new CustomEvent('nexus-sync-error',{detail:'No se pudo conservar el borrador en este equipo. Guarda antes de salir.'}))}return v});
 return[value,update];
}
