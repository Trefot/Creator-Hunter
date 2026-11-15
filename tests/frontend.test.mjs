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

function gameModeFixture({pc=[], library=[], psn=[], connected=false,autoAdd=false,psnPlatform="PS5",online=true}={}) {
  const storage=new Map([["game-auto-add",String(autoAdd)]]),events=new Map(),timers=new Map(),starts=[];
  let state,dispose,next=0,pcCalls=0,psnCalls=0;
  const globals={
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    window:{addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k),dispatchEvent:e=>events.get(e.type)?.()},
    Event:class {constructor(type){this.type=type;}},
    setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),
  };
  const mode=load('src/features/games/gameMode.ts',{},globals);
  const hook=load('src/features/games/useGameMode.ts',{
    react:{useState:initial=>{state=initial;return [initial,v=>{state=typeof v==='function'?v(state):v;}];},useRef:v=>({current:v}),useEffect:fn=>{dispose=fn();}},
    '../../db/games':{listGames:async()=>library,createGame:async(title,platform)=>{const old=library.find(g=>g.title===title&&g.platform===platform);if(old)return old.id;const id='new-'+library.length;library.push({id,title,platform});return id;}},
    '../../db/pcGames':{pcNowPlaying:async()=>{pcCalls++;return typeof pc==='function'?pc():pc;}},
    '../../db/psn':{psnStatus:async()=>connected,psnNowPlaying:async()=>{psnCalls++;return {games:psn,platform:psnPlatform,online};}},
    './gameMode':mode,
  },globals);
  hook.useGameMode(game=>starts.push(game.id));
  return {mode,starts,storage,timers,get state(){return state;},get pcCalls(){return pcCalls;},get psnCalls(){return psnCalls;},dispose:()=>dispose()};
}
const pcFortnite={id:'pc',title:'Fortnite',platform:'pc'};
const psFortnite={id:'ps5',title:'Fortnite',platform:'ps5'};

test('PC Fortnite works without PSN and never matches the console edition',async()=>{
  const f=gameModeFixture({pc:[{name:'Fortnite'}],library:[psFortnite,pcFortnite]});
  await settle();assert.equal(f.state.playing.id,'pc');assert.equal(f.state.source,'pc');assert.equal(f.psnCalls,0);assert.deepEqual(f.starts,['pc']);f.dispose();
  const missing=gameModeFixture({pc:[{name:'Fortnite'}],library:[psFortnite],connected:true,psn:[{name:'Fortnite'}]});
  await settle();assert.equal(missing.state.playing,null);assert.equal(missing.state.detectedPc.name,'Fortnite');assert.equal(missing.psnCalls,0);missing.dispose();
});

test('manual game overrides detection immediately and releasing it resumes PC',async()=>{
  const f=gameModeFixture({pc:[{name:'Fortnite'}],library:[pcFortnite,psFortnite]});
  await settle();f.mode.selectManualGame('ps5');await settle();assert.equal(f.state.source,'manual');assert.equal(f.state.playing.id,'ps5');
  f.mode.selectManualGame(null);await settle();assert.equal(f.state.source,'pc');assert.equal(f.state.playing.id,'pc');f.dispose();
});

test('disabled game mode clears activity and manual selection remains usable',async()=>{
  const f=gameModeFixture({pc:[{name:'Fortnite'}],library:[pcFortnite]});
  await settle();f.mode.setGameModeEnabled(false);await settle();assert.equal(f.state.playing,null);
  f.mode.selectManualGame('pc');await settle();assert.equal(f.state.source,'manual');assert.equal(f.state.playing.id,'pc');f.dispose();
});

test('PC detection errors do not block PSN and stop showing a stale PC game',async()=>{
  let fail=false;
  const f=gameModeFixture({pc:()=>{if(fail)throw Error('tasklist falló');return [{name:'Fortnite'}];},library:[pcFortnite,psFortnite],connected:true,psn:[{name:'Fortnite'}]});
  await settle();assert.equal(f.state.source,'pc');fail=true;
  f.mode.selectManualGame(null);await settle();assert.equal(f.state.source,'psn');assert.equal(f.state.playing.id,'ps5');assert.match(f.state.error,/tasklist/);f.dispose();
});

test('activity requests never overlap and cleanup suppresses navigation and timers',async()=>{
  let finish;
  const f=gameModeFixture({pc:()=>new Promise(r=>finish=r),library:[pcFortnite]});
  await settle();f.mode.selectManualGame(null);await settle();assert.equal(f.pcCalls,1);
  f.dispose();finish([{name:'Fortnite'}]);await settle();assert.equal(f.starts.length,0);assert.equal(f.timers.size,0);
});

test('OBS moments keep separate recording and stream times and never invent a file',()=>{
  const {obsTime,momentsText}=load('src/db/obs.ts',{'@tauri-apps/api/core':{}});
  assert.equal(obsTime(123450),'00:02:03');assert.equal(obsTime(3661000),'01:01:01');
  for(const bad of [null,NaN,-1,Infinity])assert.equal(obsTime(bad),'—');
  const text=momentsText([{created_at:'2026-11-11',game_title:'Fortnite',title:'Jugada',record_ms:123450,stream_ms:45000,output_path:null}]);
  assert.match(text,/Grabación: 00:02:03/);assert.match(text,/Directo: 00:00:45/);assert.match(text,/No confirmado por OBS/);
});

test('visual detector rejects blank references and matches distinctive luminance patterns',()=>{
  const {templateScore}=load('src/features/games/gameDetector.ts',{'../../db/database':{},'../../db/gameBroadcast':{}});
  const pixels=values=>values.flatMap(x=>[x,x,x,255]);
  const a=pixels([0,240,20,160,45,255,80,130]);
  assert.equal(templateScore(a,a),1);
  assert.equal(templateScore(pixels([20,20,20,20]),pixels([20,20,20,20])),0);
  assert.ok(templateScore(a,pixels([255,0,235,80,210,0,175,110]))<.9);
  assert.equal(templateScore(a,[]),0);
});


test('bound PC processes select the correct edition even when the title differs',async()=>{
 const f=gameModeFixture({pc:[{name:'7DS',game_id:'chosen'}],library:[{id:'console',title:'7DS',platform:'ps5'},{id:'chosen',title:'The Seven Deadly Sins',platform:'pc'}]});
 await settle();assert.equal(f.state.playing.id,'chosen');assert.equal(f.state.source,'pc');f.dispose();
});
test('optional auto-add creates one PC profile and opens it, without inventing trophies',async()=>{
 const library=[];const f=gameModeFixture({pc:[{name:'7DS',process:'7ds.exe'}],library,autoAdd:true});await settle();
 assert.equal(library.length,1);assert.equal(f.state.playing.title,'7DS');assert.equal(f.state.playing.platform,'pc');assert.equal(f.starts.length,1);
 f.mode.setAutoAddEnabled(true);await settle();assert.equal(library.length,1);assert.equal(f.starts.length,1);f.dispose();
});
test('PSN discovery respects PS4/PS5 editions, shows missing titles, and ignores offline activity',async()=>{
 const psn=[{name:'Mi juego PSN',title_id:'title',icon_url:null}];
 const f=gameModeFixture({psn,connected:true,library:[],autoAdd:false});await settle();assert.equal(f.state.detectedPsn.name,'Mi juego PSN');assert.equal(f.state.playing,null);f.dispose();
 const library=[{id:'ps4',title:'Mi juego PSN',platform:'ps4'}];
 const auto=gameModeFixture({psn,connected:true,library,autoAdd:true,psnPlatform:'PS5'});await settle();assert.equal(library.length,2);assert.equal(auto.state.playing.platform,'ps5');auto.dispose();
 const offline=gameModeFixture({psn,connected:true,online:false,autoAdd:true});await settle();assert.equal(offline.state.playing,null);assert.equal(offline.state.detectedPsn,null);offline.dispose();
});


test('multiple PC games pause category automation until a manual selection resolves ambiguity',async()=>{
 const f=gameModeFixture({pc:[{name:'Fortnite'},{name:'7DS'}],library:[pcFortnite,{id:'seven',title:'7DS',platform:'pc'}]});
 await settle();assert.equal(f.state.ambiguous,true);
 f.mode.selectManualGame('seven');await settle();assert.equal(f.state.ambiguous,false);assert.equal(f.state.source,'manual');assert.equal(f.state.playing.id,'seven');f.dispose();
});

test('project board requires every unpublished version to be ready',()=>{
 const {projectStage,nextProjectStep}=load('src/features/projects/projectBoard.ts',{});
 const version=(steps,published_at=null)=>({steps,published_at});
 const step=(step,done=false,enabled=true)=>({step,enabled,completed_at:done?'2026-11-14':null});
 assert.equal(projectStage([]),'prepare');
 assert.equal(projectStage([version([])]),'prepare');
 assert.equal(nextProjectStep([version([])]),'Configurar los pasos');
 assert.equal(projectStage([version([step('script')])]),'prepare');
 assert.equal(projectStage([version([step('script',true),step('editing')])]),'production');
 assert.equal(projectStage([version([step('editing',true)]),version([step('script')])]),'production');
 assert.equal(projectStage([version([step('editing',true)]),version([])]),'production');
 assert.equal(projectStage([version([step('editing',true)])]),'ready');
 assert.equal(projectStage([version([step('script',false,false)])]),'ready');
 assert.equal(projectStage([version([], '2026-11-14')]),'published');
 assert.equal(projectStage([version([], '2026-11-14'),version([step('script')])]),'prepare');
});

test('Bulk ideas: one per line, optional fields, no duplicates',()=>{
  const mod=load('src/db/ideas.ts',{'./database':{getDb:async()=>null,newId:()=>'id',WORKSPACE_ID:'w'}});
  const items=mod.parseBulkIdeas(`# comentario\n\n- Ep. 1 | Mundo nuevo | minecraft, serie\n2) Solo título\nep. 1 | repetida\n | sin título`);
  assert.equal(items.length,2);
  assert.deepEqual({...items[0]},{title:'Ep. 1',description:'Mundo nuevo',tags:'minecraft, serie'});
  assert.deepEqual({...items[1]},{title:'Solo título',description:'',tags:''});
});

test('Habit plan: routine, user-picked candidates, buffer and week progress',()=>{
  const p=load('src/features/habit/plan.ts',{});
  assert.equal(p.weekdayIndex('2026-11-16'),0); assert.equal(p.weekdayIndex('2026-11-22'),6);
  assert.deepEqual([...p.routineFrom([{weekday:6,kind:'rest'},{weekday:1,kind:'bogus'}])],['record','record','edit','stream','edit','record','rest']);
  const step=(s,done,enabled=true)=>({id:s,step:s,enabled,completed_at:done?'x':null});
  const v=(id,format,doneSteps,extra={})=>({id,project_id:'p-'+id,project_title:'P '+id,title:'P '+id,format,published_at:null,
    steps:['script','recording','editing','scheduling','publishing'].map(s=>step(s,doneSteps.includes(s))),...extra});
  const versions=[v('a','long_video',[]),v('b','long_video',['script','recording']),v('c','short',['script','recording','editing']),
    v('d','short',['script','recording','editing','scheduling','publishing']),v('e','long_video',['script','recording','editing'],{published_at:'2026-11-01'}),v('f','live',[])];
  const projects=[{id:'p-a',title:'P a',adaptation_count:1},{id:'new',title:'Idea aprobada',adaptation_count:0}];
  assert.deepEqual(p.candidates('record',projects,versions).map(c=>c.adaptationId),['a',null]);
  assert.deepEqual(p.candidates('edit',projects,versions).map(c=>c.adaptationId),['b']);
  assert.deepEqual(p.candidates('schedule',projects,versions).map(c=>c.adaptationId),['c']);
  assert.equal(p.stepToComplete('edit'),'editing');
  assert.deepEqual({...p.bufferStatus(versions)},{long:0,short:2,level:'low'});
  assert.equal(p.bufferStatus([]).level,'empty');
  const days=['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22'];
  const w=p.weekProgress(p.DEFAULT_ROUTINE,[{day:'2026-11-16',done_at:'x'},{day:'2026-11-16',done_at:'y'},{day:'2026-11-18',done_at:null}],days);
  assert.deepEqual({...w},{done:1,planned:6});
});
