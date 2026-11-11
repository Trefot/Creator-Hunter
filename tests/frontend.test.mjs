import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, mocks, globals = {}) {
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replaceAll('import.meta.env.DEV','true');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={exports:{},require:(name)=>{
    if(!(name in mocks)) throw new Error('Unexpected import: '+name);
    return mocks[name];
  },crypto:globalThis.crypto,...globals};
  vm.runInNewContext(js,context,{filename:file});
  return context.exports;
}

test('SQLite opens once, only after native preparation completes',async()=>{
  const calls=[]; let prepare;
  const db={id:'test'};
  const mod=load('src/db/database.ts',{
    '@tauri-apps/api/core':{invoke:(command)=>{calls.push(command); return new Promise(r=>prepare=r);}},
    '@tauri-apps/plugin-sql':{__esModule:true,default:{load:async(url)=>{calls.push(url);return db;}}},
  });
  const a=mod.getDb(),b=mod.getDb(); assert.equal(a,b);
  assert.deepEqual(calls,['prepare_database']);
  prepare(); assert.equal(await a,db); assert.equal(await b,db);
  assert.deepEqual(calls,['prepare_database','sqlite:studio-dev.db']);
});

test('failed safety copy prevents opening SQLite and allows retry',async()=>{
  let attempts=0,opens=0;
  const mod=load('src/db/database.ts',{
    '@tauri-apps/api/core':{invoke:async()=>{if(++attempts===1)throw new Error('Copia bloqueada');}},
    '@tauri-apps/plugin-sql':{__esModule:true,default:{load:async()=>{opens++;return {};}}},
  });
  await assert.rejects(mod.getDb(),/Copia bloqueada/); assert.equal(opens,0);
  await mod.getDb(); assert.equal(attempts,2); assert.equal(opens,1);
});

test('SQLite loading failure also permits retry',async()=>{
  let loads=0;
  const mod=load('src/db/database.ts',{
    '@tauri-apps/api/core':{invoke:async()=>{}},
    '@tauri-apps/plugin-sql':{__esModule:true,default:{load:async()=>{if(++loads===1)throw new Error('locked');return {};}}},
  });
  await assert.rejects(mod.getDb(),/locked/); await mod.getDb(); assert.equal(loads,2);
});

test('backup preview rejects malformed documents instead of showing zero rows',()=>{
  const {previewBackup}=load('src/db/backup.ts',{'@tauri-apps/api/core':{},'./database':{}});
  const valid={format:'trophyhunter-studio-backup',format_version:1,schema_version:15,exported_at:'stamp',tables:{workspace:[{id:'00000000-0000-4000-8000-000000000001'}],idea:[]}};
  assert.equal(previewBackup(JSON.stringify(valid)).counts.length,2);
  for(const tables of [null,[],{}, {workspace:null},{workspace:{}},'bad']){
    assert.equal(previewBackup(JSON.stringify({...valid,tables})),null);
  }
  assert.equal(previewBackup(JSON.stringify({...valid,format_version:99})),null);
  assert.equal(previewBackup('invalid json'),null);
});

function youtubeFixture(options={}) {
  let now=Date.UTC(2026,10,11,12);
  const storage=new Map(options.last?[['youtube-last-sync',options.last]]:[]);
  const scheduled=new Map(); let nextTimer=0;
  const calls={status:0,sync:0,snapshots:0,results:[],requestedIds:[]};
  class Clock extends Date {
    constructor(value){super(arguments.length?value:now);}
    static now(){return now;}
  }
  const api={
    youtubeStatus:async()=>{calls.status++;return {connected:options.connected!==false,connection:{profile_id:'profile'}};},
    syncYouTubeData:async()=>{
      calls.sync++;
      if(options.sync)await options.sync();
      return {profile_id:'profile',channel:{subscribers:10,views:100},watch_hours:2,warning:null};
    },
    fetchVideoStats:async(ids)=>{
      calls.requestedIds.push(Array.from(ids));
      return {videos:ids.map(id=>({id,views:12})),warning:null};
    },
  };
  const mod=load('src/features/profiles/youtubeSync.ts',{
    '../../db/accountSnapshots':{upsertApiSnapshot:async()=>{calls.snapshots++;}},
    '../../db/adaptations':{listAllAdaptations:async()=>options.adaptations??[]},
    '../../db/results':{upsertApiResult:async(id)=>{calls.results.push(id);}},
    '../../db/youtube':api,
    '../../i18n/format':{todayIso:()=> '2026-11-11'},
    '../calendar/week':{addDays:()=> '2025-11-12'},
    './youtubeVideo':{extractVideoId:url=>url??null},
  },{
    Date:Clock,
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    setTimeout:(fn,delay)=>{const id=++nextTimer;scheduled.set(id,{fn,delay});return id;},
    clearTimeout:id=>scheduled.delete(id),
  });
  return {mod,calls,storage,scheduled,advance:ms=>now+=ms};
}
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};

test('manual and automatic YouTube sync share one request and one save',async()=>{
  let finish;const gate=new Promise(r=>finish=r);
  const f=youtubeFixture({sync:()=>gate});
  const first=f.mod.runYouTubeSync(),second=f.mod.runYouTubeSync();
  assert.equal(first,second);
  const auto=f.mod.autoSyncYouTube();
  finish(); const [a,b]=await Promise.all([first,auto]);
  assert.equal(a,b);assert.equal(f.calls.sync,1);assert.equal(f.calls.snapshots,1);
  assert.equal(f.storage.get('youtube-last-sync'),'2026-11-11T12:00:00.000Z');
});

test('automatic sync skips recent data and refreshes when three hours expire',async()=>{
  const f=youtubeFixture({last:'2026-11-11T11:00:00.000Z'});
  assert.equal(await f.mod.autoSyncYouTube(),null);assert.equal(f.calls.status,0);
  f.advance(2*60*60*1000);
  await f.mod.autoSyncYouTube();assert.equal(f.calls.sync,1);
});

test('simultaneous automatic checks share the connection check',async()=>{
  const f=youtubeFixture();
  const a=f.mod.autoSyncYouTube(),b=f.mod.autoSyncYouTube();assert.equal(a,b);
  await Promise.all([a,b]);assert.equal(f.calls.status,1);assert.equal(f.calls.sync,1);
});

test('failed sync is retryable and never records success',async()=>{
  let attempts=0;
  const f=youtubeFixture({sync:async()=>{if(++attempts===1)throw new Error('offline');}});
  await assert.rejects(f.mod.runYouTubeSync(),/offline/);
  assert.equal(f.storage.has('youtube-last-sync'),false);
  await f.mod.runYouTubeSync();assert.equal(f.calls.snapshots,1);
});

test('automatic loop retries failures without repeating the same notification and stops cleanly',async()=>{
  let offline=true;const errors=[],success=[];
  const f=youtubeFixture({sync:async()=>{if(offline)throw new Error('offline');}});
  const stop=f.mod.startYouTubeAutoSync(d=>success.push(d),e=>errors.push(String(e)));
  await settle();assert.equal(errors.length,1);
  let [id,timer]=f.scheduled.entries().next().value;
  assert.equal(timer.delay,10*60*1000);f.scheduled.delete(id);await timer.fn();
  assert.equal(errors.length,1);assert.equal(f.calls.sync,2);
  offline=false;[id,timer]=f.scheduled.entries().next().value;
  f.scheduled.delete(id);await timer.fn();assert.equal(success.length,1);
  stop();assert.equal(f.scheduled.size,0);
});

test('cleanup during a request suppresses notifications and further timers',async()=>{
  let finish;const gate=new Promise(r=>finish=r);let notifications=0;
  const f=youtubeFixture({sync:()=>gate});
  const stop=f.mod.startYouTubeAutoSync(()=>notifications++,()=>notifications++);
  stop();finish();await settle();
  assert.equal(notifications,0);assert.equal(f.scheduled.size,0);
});

test('invalid or future local timestamps do not block automation',async()=>{
  for(const last of ['not-a-date','2027-01-01T00:00:00.000Z']){
    const f=youtubeFixture({last});await f.mod.autoSyncYouTube();assert.equal(f.calls.sync,1);
  }
});

test('disconnected YouTube does not trigger a data request',async()=>{
  const f=youtubeFixture({connected:false});assert.equal(await f.mod.autoSyncYouTube(),null);
  assert.equal(f.calls.sync,0);
});

test('same YouTube video is fetched once but updates every linked adaptation',async()=>{
  const f=youtubeFixture({adaptations:[
    {id:'a',published_url:'video-id',published_at:'2026-11-01'},
    {id:'b',published_url:'video-id',published_at:'2026-11-02'},
  ]});
  const result=await f.mod.syncPublishedVideos();
  assert.equal(result.synced,2);
  assert.deepEqual(f.calls.requestedIds,[['video-id']]);assert.deepEqual(f.calls.results,['a','b']);
});
