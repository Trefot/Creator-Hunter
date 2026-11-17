import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { contentAuto } from '../../db/contentPerformance';
import { getDb } from '../../db/database';
const requests = new Map<string, Promise<unknown>>();
export function syncContent(platform: string) { let p = requests.get(platform); if (!p) {
    p = invoke('content_sync', { platform }).then(v => { window.dispatchEvent(new Event('nexus-content-changed')); return v; }).finally(() => requests.delete(platform));
    requests.set(platform, p);
} return p; }
export function startContentSync(onChanged: () => void) {
    let stopped = false, busy = false;
    async function tick() { if (stopped || busy || !navigator.onLine)
        return; busy = true; try {
        await getDb();
        if (!await contentAuto())
            return;
        const [yt, s] = await Promise.all([invoke<{
                connected: boolean;
            }>('youtube_status').catch(() => null), invoke<Record<string, {
                configured: boolean;
                instagram_profile?: string;
            }>>('metrics_status').catch(() => null)]);
        const networks = [...(yt?.connected ? ['youtube'] : []), ...(s?.twitch?.configured ? ['twitch'] : []), ...(s?.meta?.configured ? ['facebook', ...(s.meta.instagram_profile ? ['instagram'] : [])] : []), ...(s?.tiktok?.configured ? ['tiktok'] : [])];
        for (const platform of networks) {
            if (stopped)
                break;
            try {
                await syncContent(platform);
            }
            catch { /* Per-network status persisted by native command; other networks continue. */ }
        }
    }
    finally {
        busy = false;
    } }
    const initial = setTimeout(() => void tick(), 8000), timer = setInterval(() => void tick(), 10 * 60000);
    const update = () => { if (!stopped)
        onChanged(); };
    const cleanup = listen('content-changed', update);
    window.addEventListener('nexus-content-changed', update);
    const online = () => void tick();
    window.addEventListener('online', online);
    window.addEventListener('nexus-content-auto', online);
    return () => { stopped = true; clearTimeout(initial); clearInterval(timer); window.removeEventListener('nexus-content-changed', update); window.removeEventListener('online', online); window.removeEventListener('nexus-content-auto', online); void cleanup.then(fn => fn()); };
}
