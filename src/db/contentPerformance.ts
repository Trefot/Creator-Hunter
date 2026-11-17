import { getDb, newId, WORKSPACE_ID } from './database';
export interface ContentPost {
    id: string;
    profile_id: string;
    remote_id: string;
    platform: string;
    title: string;
    url: string;
    thumbnail: string | null;
    published_at: string;
    format: string;
    series_id: string | null;
    series_title: string | null;
    project_id: string | null;
    last_seen_at: string;
    handle: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    observed_at: string | null;
    views_at?: string | null;
    likes_at?: string | null;
    comments_at?: string | null;
    shares_at?: string | null;
    watch_hours?:number|null;watch_hours_at?:string|null;
}
export interface Observation {
    post_id: string;
    observed_at: string;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
}
export interface Series {
    id: string;
    title: string;
}
export interface SyncStatus {
    last_success_ms?: number;
    last_attempt_ms?: number;
    count?: number;
    warning?: string;
    error?: string;
}
export async function contentLibrary() {
    const db = await getDb();
    return db.select<ContentPost[]>(`SELECT p.*,r.handle,s.title AS series_title,
(SELECT views FROM content_observation WHERE post_id=p.id AND views IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS views,
(SELECT observed_at FROM content_observation WHERE post_id=p.id AND views IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS views_at,
(SELECT likes FROM content_observation WHERE post_id=p.id AND likes IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS likes,
(SELECT observed_at FROM content_observation WHERE post_id=p.id AND likes IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS likes_at,
(SELECT comments FROM content_observation WHERE post_id=p.id AND comments IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS comments,
(SELECT observed_at FROM content_observation WHERE post_id=p.id AND comments IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS comments_at,
(SELECT shares FROM content_observation WHERE post_id=p.id AND shares IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS shares,
(SELECT observed_at FROM content_observation WHERE post_id=p.id AND shares IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS shares_at,(SELECT watch_hours FROM content_observation WHERE post_id=p.id AND watch_hours IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS watch_hours,(SELECT observed_at FROM content_observation WHERE post_id=p.id AND watch_hours IS NOT NULL ORDER BY observed_at DESC LIMIT 1) AS watch_hours_at,o.observed_at FROM content_post p JOIN profile r ON r.id=p.profile_id LEFT JOIN content_series s ON s.id=p.series_id LEFT JOIN content_observation o ON o.id=(SELECT id FROM content_observation WHERE post_id=p.id ORDER BY observed_at DESC LIMIT 1) WHERE p.workspace_id=$1 ORDER BY p.published_at DESC LIMIT 1000`, [WORKSPACE_ID]);
}
/** At most one genuine reading near each comparison checkpoint; the index bounds every per-post lookup. */
export async function contentHistory() {
    const db=await getDb();
    return db.select<Observation[]>(`WITH checkpoints(hours) AS (VALUES(24),(72),(168)), candidates AS (
      SELECT o.post_id,o.observed_at,o.views,o.likes,o.comments,o.shares,
      ROW_NUMBER() OVER(PARTITION BY o.post_id,c.hours ORDER BY ABS(julianday(o.observed_at)-julianday(p.published_at)-c.hours/24.0),o.observed_at DESC) AS rn
      FROM content_post p CROSS JOIN checkpoints c JOIN content_observation o ON o.post_id=p.id
      AND o.observed_at >= strftime('%Y-%m-%dT%H:%M:%fZ',p.published_at,'+'||(c.hours*0.8)||' hours')
      AND o.observed_at <= strftime('%Y-%m-%dT%H:%M:%fZ',p.published_at,'+'||(c.hours*1.2)||' hours')
      WHERE p.workspace_id=$1 AND o.views IS NOT NULL)
      SELECT post_id,observed_at,views,likes,comments,shares FROM candidates WHERE rn=1 ORDER BY observed_at`,[WORKSPACE_ID]);
}
export async function contentPostHistory(id:string){const rows=await(await getDb()).select<Observation[]>(`SELECT o.post_id,o.observed_at,o.views,o.likes,o.comments,o.shares FROM content_observation o JOIN content_post p ON p.id=o.post_id WHERE p.id=$1 AND p.workspace_id=$2 ORDER BY o.observed_at DESC LIMIT 180`,[id,WORKSPACE_ID]);return rows.reverse()}
export async function contentSeries() { return (await getDb()).select<Series[]>('SELECT id,title FROM content_series WHERE workspace_id=$1 ORDER BY title', [WORKSPACE_ID]); }
export async function addSeries(title: string) { const text = title.trim(); if (!text || text.length > 120)
    throw Error('Escribe un nombre de serie de hasta 120 caracteres.'); const result = await (await getDb()).execute('INSERT INTO content_series(id,workspace_id,title) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM content_series WHERE workspace_id=$2 AND lower(title)=lower($3))', [newId(), WORKSPACE_ID, text]); if (result.rowsAffected === 0)
    throw Error('Ya existe una serie con ese nombre.'); }
export async function classifyPost(id: string, format: string, series: string | null, project: string | null) { if (!['unknown', 'video', 'short', 'reel', 'post', 'live', 'clip'].includes(format))
    throw Error('Formato no válido.'); await (await getDb()).execute('UPDATE content_post SET format=$1,series_id=$2,project_id=$3 WHERE id=$4 AND workspace_id=$5', [format, series, project, id, WORKSPACE_ID]); }
export async function contentSyncStatus() { const rows = await (await getDb()).select<{
    id: string;
    content: string;
}[]>("SELECT id,content FROM alert_cursor WHERE id LIKE 'content-sync-%'"); return Object.fromEntries(rows.map(r => { try {
    return [r.id.replace('content-sync-', ''), JSON.parse(r.content) as SyncStatus];
}
catch {
    return [r.id, {}];
} })) as Record<string, SyncStatus>; }
export async function contentAuto() { const rows = await (await getDb()).select<{
    content: string;
}[]>("SELECT content FROM alert_cursor WHERE id='content-auto'"); return rows[0]?.content !== 'false'; }
export async function setContentAuto(enabled: boolean) { await (await getDb()).execute("INSERT INTO alert_cursor(id,content) VALUES('content-auto',$1) ON CONFLICT(id) DO UPDATE SET content=excluded.content", [JSON.stringify(enabled)]); window.dispatchEvent(new Event('nexus-content-auto')); }
