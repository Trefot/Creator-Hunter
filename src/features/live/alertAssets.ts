import {invoke} from "@tauri-apps/api/core";
const cache=new Map<string,Promise<string>>();
export function alertAsset(name:string):Promise<string>{
 let value=cache.get(name);
 if(!value){value=invoke<string>("alerts_asset",{name}).catch(error=>{cache.delete(name);throw error});cache.set(name,value)}
 return value;
}
