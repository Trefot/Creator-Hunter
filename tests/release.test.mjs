import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {assertWindowsInstaller,checkChannel,checkRelease,releaseNotes,compareVersions,sourceCommit} from '../scripts/release.mjs';

test('release versions, stable installation identity and notes are consistent',()=>{
  const info=checkRelease();assert.ok(info.notes.length>0);
});
test('notes include only the selected version and preserve Spanish and CRLF',()=>{
  const text='## [Sin publicar]\r\n- Otro trabajo\r\n## [0.2.10] · Nexus Studio\r\n- Preparación y conexión.\r\n## [0.2.9]\r\n- Antigua\r\n';
  assert.deepEqual(releaseNotes(text,'0.2.10'),['Preparación y conexión.']);
  assert.throws(()=>releaseNotes(text,'9.0.0'),/Falta/);
  assert.throws(()=>releaseNotes('## [0.2.10]\nSin notas','0.2.10'),/novedades/);
});
test('version ordering uses numbers and rejects malformed versions',()=>{
  assert.equal(compareVersions('0.2.10','0.2.9'),1);
  assert.equal(compareVersions('0.2.9','0.2.10'),-1);
  for(const v of ['0.2','0.2.10-extra','../1.0','1.0.0\n'])assert.throws(()=>compareVersions(v,'0.2.9'));
});
test('channel refuses downgrades and replacement builds with the same version',()=>{
  const prior={version:'0.2.10',sha256:'old',source_commit:'a'};
  assert.throws(()=>checkChannel({version:'0.2.9'},prior),/anterior/);
  assert.throws(()=>checkChannel({...prior,sha256:'different'},prior),/otro contenido/);
  assert.doesNotThrow(()=>checkChannel({...prior},prior));
  assert.doesNotThrow(()=>checkChannel({version:'0.2.11'},prior));
});
test('ZIP or incomplete executable cannot be presented as a Windows installer',()=>{
  assert.throws(()=>assertWindowsInstaller(Buffer.from('PK source archive')),/ejecutable/);
  const broken=Buffer.alloc(160);broken.write('MZ');broken.writeUInt32LE(9999,0x3c);
  assert.throws(()=>assertWindowsInstaller(broken),/PE/);
  const valid=Buffer.alloc(160);valid.write('MZ');valid.writeUInt32LE(128,0x3c);valid.write('PE\0\0',128);
  assert.doesNotThrow(()=>assertWindowsInstaller(valid));
});

test('exported ZIP retains its source commit without requiring a .git folder',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-release-'));
  try {
    fs.writeFileSync(path.join(temp,'.release-source.json'),JSON.stringify({commit:'a'.repeat(40)}));
    assert.equal(sourceCommit(temp),'a'.repeat(40));
    fs.writeFileSync(path.join(temp,'.release-source.json'),JSON.stringify({commit:'$Format:%H$'}));
    assert.throws(()=>sourceCommit(temp),/ZIP exportado/);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});
