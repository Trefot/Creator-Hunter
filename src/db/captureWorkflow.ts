import { getDb, WORKSPACE_ID } from './database';
export async function captureWorkflow() { const db = await getDb(); const rows = await db.select<{
    source_key: string;
    stage: number;
}[]>(`SELECT substr(p.id,17) AS source_key,MAX(CASE WHEN a.published_at IS NOT NULL THEN 4 WHEN a.scheduled_at IS NOT NULL THEN 3 ELSE 1 END) AS stage FROM project p LEFT JOIN adaptation a ON a.project_id=p.id WHERE p.workspace_id=$1 AND p.id LIKE 'capture-project-%' GROUP BY p.id`, [WORKSPACE_ID]); const result = new Map(rows.map(r => [r.source_key, r.stage])); const exports = await db.select<{
    source_kind: string;
    source_id: string;
}[]>('SELECT DISTINCT source_kind,source_id FROM clip_export WHERE workspace_id=$1', [WORKSPACE_ID]); for (const e of exports) {
    const key = e.source_kind + '-' + e.source_id;
    result.set(key, Math.max(2, result.get(key) ?? 0));
} return result; }
