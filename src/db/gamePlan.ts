import { getDb } from './database';
export interface GamePlan {
    priority: number;
    hours: string;
    difficulty: string;
    next: string;
    spoilerFree: boolean;
}
export const defaultPlan: GamePlan = { priority: 0, hours: '', difficulty: '', next: '', spoilerFree: true };
export async function gamePlans() { const rows = await (await getDb()).select<{
    id: string;
    content: string;
}[]>("SELECT id,content FROM alert_cursor WHERE id LIKE 'game-plan-%'"); return Object.fromEntries(rows.map(r => { try {
    return [r.id.slice(10), { ...defaultPlan, ...JSON.parse(r.content) } as GamePlan];
}
catch {
    return [r.id.slice(10), defaultPlan];
} })); }
export async function saveGamePlan(id: string, value: GamePlan) { await (await getDb()).execute("INSERT INTO alert_cursor(id,content) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET content=excluded.content", ['game-plan-' + id, JSON.stringify(value)]); window.dispatchEvent(new Event('nexus-game-plans-changed')); }
