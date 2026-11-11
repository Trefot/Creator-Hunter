import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (base, file) => fs.readFileSync(path.join(base, file), 'utf8').replaceAll('\r\n', '\n');
const json = (base, file) => JSON.parse(read(base, file));
export function versionParts(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versión no válida: se necesita X.Y.Z.');
  const numbers = version.split('.').map(Number);
  if (!numbers.every(Number.isSafeInteger)) throw new Error('Versión fuera de rango.');
  return numbers;
}
export function compareVersions(a, b) {
  const x = versionParts(a), y = versionParts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
export function releaseNotes(text, version) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => line.startsWith(`## [${version}]`));
  if (start < 0) throw new Error(`Falta la sección ${version} en CHANGELOG.md.`);
  const section = lines.slice(start + 1);
  const end = section.findIndex(line => line.startsWith('## '));
  const notes = section.slice(0, end < 0 ? undefined : end).filter(line => line.startsWith('- ')).map(line => line.slice(2).trim());
  if (!notes.length) throw new Error('La versión no tiene novedades.');
  return notes;
}
export function checkRelease(base = root) {
  const pkg = json(base, 'package.json');
  versionParts(pkg.version);
  const config = json(base, 'src-tauri/tauri.conf.json');
  const lock = json(base, 'package-lock.json');
  const cargo = read(base, 'src-tauri/Cargo.toml').match(/^\[package\][\s\S]*?^version = "([^"]+)"/m)?.[1];
  const cargoLock = read(base, 'src-tauri/Cargo.lock').match(/\[\[package\]\]\nname = "studio"\nversion = "([^"]+)"/)?.[1];
  const visible = read(base, 'src/i18n/es.ts').match(/version: "[^"]*v([\d.]+)"/)?.[1];
  for (const [file, value] of Object.entries({tauri:config.version, npmLock:lock.version, npmPackageLock:lock.packages?.['']?.version, cargo, cargoLock, visible})) {
    if (value !== pkg.version) throw new Error(`Versión distinta en ${file}: ${value}; se esperaba ${pkg.version}.`);
  }
  if (config.identifier !== 'com.trefotg.studio' || config.productName !== 'TrophyHunter' || pkg.name !== 'studio') {
    throw new Error('El identificador o nombre técnico cambió: revisar compatibilidad con la app instalada antes de publicar.');
  }
  return {version:pkg.version, notes:releaseNotes(read(base,'CHANGELOG.md'),pkg.version)};
}
export function assertWindowsInstaller(bytes) {
  if (bytes.length < 160 || bytes.toString('ascii',0,2) !== 'MZ') throw new Error('El archivo no es un ejecutable de Windows.');
  const offset = bytes.readUInt32LE(0x3c);
  if (offset < 64 || offset + 24 > bytes.length || bytes.toString('ascii',offset,offset+4) !== 'PE\0\0') {
    throw new Error('El instalador no tiene una cabecera PE válida.');
  }
}
export function checkChannel(incoming, previous) {
  const comparison = compareVersions(incoming.version, previous.version);
  if (comparison < 0) throw new Error('Se intentó publicar una versión anterior a la del canal.');
  if (comparison === 0 && (incoming.sha256 !== previous.sha256 || incoming.source_commit !== previous.source_commit)) {
    throw new Error('Esa versión ya existe con otro contenido; no se sobrescribe.');
  }
}
export function sourceCommit(base = root) {
  if (fs.existsSync(path.join(base,'.git'))) {
    const dirty = execFileSync('git',['status','--porcelain'],{cwd:base,encoding:'utf8'}).trim();
    if (dirty) throw new Error('Guarda los cambios en un commit antes de preparar el instalador para registrar su origen.');
    return execFileSync('git',['rev-parse','HEAD'],{cwd:base,encoding:'utf8'}).trim();
  }
  const commit = json(base,'.release-source.json').commit;
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) throw new Error('Usa el ZIP exportado de la actualización o un checkout Git con sus cambios guardados.');
  return commit;
}
export function prepareRelease(base = root) {
  const info = checkRelease(base);
  const commit = sourceCommit(base);
  const source = path.join(base,'src-tauri/target/release/bundle/nsis',`TrophyHunter_${info.version}_x64-setup.exe`);
  const bytes = fs.readFileSync(source);
  assertWindowsInstaller(bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const manifest = {...info, date:new Date().toISOString().slice(0,10), installer:'TrophyHunter-setup.exe', source_commit:commit, sha256, size:bytes.length};
  const out = path.join(base,'.release');
  fs.mkdirSync(out,{recursive:true});
  const branded = `Nexus-Studio_${info.version}_x64-setup.exe`;
  fs.writeFileSync(path.join(out,branded),bytes);
  fs.writeFileSync(path.join(out,manifest.installer),bytes);
  fs.writeFileSync(path.join(out,'latest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(out,'NOVEDADES.md'),`# Nexus Studio ${info.version}\n\n`+info.notes.map(note=>`- ${note}`).join('\n')+'\n');
  fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),`${sha256}  ${branded}\n${sha256}  ${manifest.installer}\n`);
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const action = process.argv[2];
    if (action === 'check') console.log(`Versión ${checkRelease().version}: configuración y novedades correctas.`);
    else if (action === 'prepare') console.log(`Instalador ${prepareRelease().version} preparado en .release.`);
    else if (action === 'check-channel') {
      checkChannel(json(root,'.release/latest.json'),JSON.parse(fs.readFileSync(process.argv[3],'utf8')));
      console.log('Canal compatible: no se retrocede ni se sobrescribe otra compilación de la misma versión.');
    } else throw new Error('Usa check, prepare o check-channel <latest.json anterior>.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
