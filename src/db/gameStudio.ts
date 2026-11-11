import { getDb, newId, WORKSPACE_ID } from "./database";
import type { ObsClip, ObsMarker } from "./obs";
import type { Idea } from "./ideas";
import type { Project } from "./projects";

export async function gameContent(gameId:string) {
  const db=await getDb();
  const [clips,markers,ideas,projects]=await Promise.all([
    db.select<ObsClip[]>("SELECT id,title,created_at,output_path,game_title,marker_id,record_ms,stream_ms FROM obs_clip WHERE workspace_id=$1 AND game_id=$2 ORDER BY created_at DESC,rowid DESC LIMIT 100",[WORKSPACE_ID,gameId]),
    db.select<ObsMarker[]>("SELECT m.id,m.title,m.created_at,m.record_ms,m.stream_ms,m.game_title,s.output_path,s.kind,s.observed_at,s.end_reason FROM obs_marker m JOIN obs_session s ON s.id=m.session_id WHERE m.workspace_id=$1 AND m.game_id=$2 ORDER BY m.created_at DESC,m.rowid DESC LIMIT 100",[WORKSPACE_ID,gameId]),
    db.select<Idea[]>(`SELECT i.id,i.title,i.description,i.tags,i.status,i.created_at FROM idea i WHERE i.workspace_id=$1 AND i.game_id=$2 ORDER BY i.created_at DESC`,[WORKSPACE_ID,gameId]),
    db.select<Project[]>(`SELECT p.id,p.idea_id,p.title,p.summary,p.created_at,(SELECT COUNT(*) FROM adaptation a WHERE a.project_id=p.id) AS adaptation_count FROM project p LEFT JOIN idea i ON i.id=p.idea_id WHERE p.workspace_id=$1 AND (p.game_id=$2 OR (p.game_id IS NULL AND i.game_id=$2)) ORDER BY p.created_at DESC`,[WORKSPACE_ID,gameId]),
  ]);
  return {clips,markers,ideas,projects};
}
export async function updateGameAppearance(id:string,cover:string|null,notes:string) {
  const db=await getDb();
  await db.execute("UPDATE game SET cover=$1,notes=$2,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$3 AND workspace_id=$4",[cover,notes.trim()||null,id,WORKSPACE_ID]);
}
/** Una clave de captura única evita repetir la idea al convertir el mismo clip o momento. */
export async function createGameIdea(gameId:string,title:string,description:string,source?:{kind:"clip"|"momento";id:string}) {
  if(!title.trim())throw new Error("Escribe el título de la idea.");
  const db=await getDb();
  await db.execute("INSERT INTO idea(id,workspace_id,title,description,game_id,capture_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(capture_key) DO NOTHING",[newId(),WORKSPACE_ID,title.trim(),description.trim()||null,gameId,source?`${source.kind}:${source.id}`:null]);
}
export async function linkGameProject(projectId:string,gameId:string) {
  const db=await getDb();
  const result=await db.execute("UPDATE project SET game_id=$1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$2 AND workspace_id=$3 AND game_id IS NULL",[gameId,projectId,WORKSPACE_ID]);
  if(!result.rowsAffected)throw new Error("El proyecto ya no está disponible para asociarlo.");
}
/** Crear el plan es idempotente; no borra objetivos que ya hubiese para ese día. */
export async function ensureGameDay(gameId:string,day:string):Promise<string> {
  const db=await getDb();
  await db.execute("INSERT OR IGNORE INTO play_session(id,workspace_id,game_id,played_on) VALUES($1,$2,$3,$4)",[newId(),WORKSPACE_ID,gameId,day]);
  const [row]=await db.select<{id:string}[]>("SELECT id FROM play_session WHERE game_id=$1 AND played_on=$2 AND workspace_id=$3",[gameId,day,WORKSPACE_ID]);
  if(!row)throw new Error("No se pudo preparar el plan de hoy.");
  return row.id;
}

export async function unassignedGameProjects():Promise<Project[]> {
  const db=await getDb();
  return db.select<Project[]>("SELECT p.id,p.idea_id,p.title,p.summary,p.created_at,0 AS adaptation_count FROM project p LEFT JOIN idea i ON i.id=p.idea_id WHERE p.workspace_id=$1 AND p.game_id IS NULL AND i.game_id IS NULL ORDER BY p.created_at DESC",[WORKSPACE_ID]);
}
