import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, mocks) {
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8').replaceAll('import.meta.env.DEV','true');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={exports:{},require:(name)=>{
    if(!(name in mocks)) throw new Error('Unexpected import: '+name);
    return mocks[name];
  },crypto:globalThis.crypto};
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
