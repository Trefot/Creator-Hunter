import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { obsClips, obsMarkers, obsTime } from '../../db/obs';
import { getDb } from '../../db/database';
import { captureWorkflow } from '../../db/captureWorkflow';
import { AutoMomentStatus, Candidate } from './AutoMoments';
import { ShortMaker } from './ShortsPanel';
interface Capture {
    id: string;
    kind: 'clip' | 'moment';
    title: string;
    created_at: string;
    game_title: string | null;
    output_path: string | null;
    record_ms: number | null;
    stream_ms: number | null;
    candidate?: Candidate;
    stage: number;
}
export function CaptureInbox({ onOpenProject, expanded = false, active = true }: {
    onOpenProject: (id: string) => void;
    expanded?: boolean;
    active?: boolean;
}) {
    const [items, setItems] = useState<Capture[]>([]), [filter, setFilter] = useState('all'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [limit, setLimit] = useState(30), [deleting, setDeleting] = useState<string | null>(null);
    async function refresh() { await getDb(); const [clips, markers, auto, stages] = await Promise.all([obsClips(), obsMarkers(), invoke<AutoMomentStatus>('auto_moments_status').catch(() => ({ items: [] })), captureWorkflow()]); const candidates = new Map(auto.items.map(c => [c.id, c])); const merged = clips.map(c => ({ ...c, kind: 'clip' as const, candidate: candidates.get(c.id), stage: stages.get('clip-' + c.id) ?? 0 })); const known = new Set(clips.map(c => c.id)); for (const c of auto.items)
        if (!known.has(c.id))
            merged.push({ id: c.id, title: c.reason, created_at: new Date(c.created_ms).toISOString(), output_path: c.output_path, game_title: null, game_id: null, marker_id: c.marker_id, record_ms: null, stream_ms: null, kind: 'clip', candidate: c, stage: stages.get('clip-' + c.id) ?? 0 } as typeof merged[number]); const linked = new Set(clips.map(c => c.marker_id)); setItems([...merged, ...markers.filter(m => !linked.has(m.id)).map(m => ({ ...m, kind: 'moment' as const, stage: stages.get('moment-' + m.id) ?? 0 }))].sort((a, b) => b.created_at.localeCompare(a.created_at))); }
    useEffect(() => { if (!active)
        return; let dead = false; const load = () => { if (!dead)
        void refresh().catch(e => setError(String(e))); }; load(); const a = listen('obs-markers-changed', load), b = listen('auto-moments-changed', load); window.addEventListener('nexus-capture-changed', load); return () => { dead = true; void a.then(f => f()); void b.then(f => f()); window.removeEventListener('nexus-capture-changed', load); }; }, [active]);
    async function run(fn: () => Promise<unknown>) { setBusy(true); setError(''); try {
        await fn();
        await refresh();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }
    const labels = ['Capturado', 'En proyecto', 'Short exportado', 'Programado', 'Publicado'];
    const visible = items.filter(c => filter === 'all' || filter === 'pending' && c.candidate?.state === 'pending' || filter === 'kept' && c.candidate?.state === 'kept' || filter === 'discarded' && c.candidate?.state === 'discarded' || filter === 'exported' && c.stage === 2 || filter === 'scheduled' && c.stage === 3 || filter === 'published' && c.stage === 4);
    return <details className="card studio-module" open={expanded || undefined}><summary>🎬 Mis capturas · {items.length}</summary><p className="small muted">Una bandeja para revisar, conservar, exportar y continuar en proyecto o calendario. Descartar de la lista no borra el vídeo.</p><label>Filtrar capturas<select value={filter} onChange={e => { setFilter(e.target.value); setLimit(30); }}>{Object.entries({ all: 'Todas', pending: 'Por revisar', kept: 'Conservadas', discarded: 'Descartadas', exported: 'Shorts exportados', scheduled: 'Programadas', published: 'Publicadas' }).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
 <ul className="studio-requests">{visible.slice(0, limit).map(c => <li key={`${c.kind}:${c.id}`}><strong>{c.title}</strong><p className="small muted">{c.game_title ?? 'Sin juego'} · {new Date(c.created_at).toLocaleString('es-CO')} · {labels[c.stage]}{c.candidate ? ' · ' + ({ pending: 'Por revisar', kept: 'Conservado', discarded: 'Descartado' })[c.candidate.state] : ''}</p><p className="small">{c.candidate?.reason ?? `Grabación: ${obsTime(c.record_ms)} · Directo: ${obsTime(c.stream_ms)}`}</p><p className="small studio-file">{c.output_path ?? 'Archivo aún no confirmado por OBS'}</p><div className="tools-actions">{c.output_path && <button className="ghost small-button" onClick={() => void revealItemInDir(c.output_path!).catch(e => setError(String(e)))}>Mostrar archivo original</button>}<button className="ghost small-button" disabled={busy} onClick={() => void run(async () => { const path = await invoke<string | null>('choose_video_file'); if (path)
        await invoke('media_relink', { kind: c.kind, id: c.id, path }); })}>Localizar vídeo movido</button><button disabled={busy || c.candidate?.state === 'discarded'} onClick={() => void run(async () => onOpenProject(await invoke('studio_capture_project', { kind: c.kind, id: c.id })))}>Crear o abrir proyecto</button>{c.candidate && <>{c.candidate.state !== 'kept' && <button disabled={busy} onClick={() => void run(() => invoke('auto_moments_review', { id: c.id, action: 'kept' }))}>Conservar candidato</button>}{c.candidate.state !== 'discarded' && <button className="ghost small-button" disabled={busy} onClick={() => void run(() => invoke('auto_moments_review', { id: c.id, action: 'discarded' }))}>Descartar de la lista</button>}{c.candidate.state === 'discarded' && <button className="ghost small-button" onClick={() => setDeleting(c.id)}>Liberar espacio del vídeo descartado</button>}</>}</div>{deleting === c.id && <div role="alert"><p>Se enviará este vídeo a la papelera de Windows. No podrás usarlo para nuevas exportaciones mientras siga allí. Los proyectos o Shorts vinculados bloquean esta acción.</p><button className="danger" disabled={busy} onClick={() => void run(async () => { await invoke('auto_moments_delete_file', { id: c.id, confirmed: true }); setDeleting(null); })}>Enviar este vídeo a la papelera</button><button className="ghost" onClick={() => setDeleting(null)}>Conservar archivo</button></div>}{!c.candidate || c.candidate.state === 'kept' ? <ShortMaker kind={c.kind} id={c.id} captureWindow={c.candidate ? { before: c.candidate.before, after: c.candidate.after } : undefined}/> : null}</li>)}</ul>
 {!visible.length && <p className="muted small">No hay capturas en este filtro. Usa Momento o Replay durante una grabación.</p>}{visible.length > limit && <button className="ghost" onClick={() => setLimit(n => n + 30)}>Mostrar más capturas</button>}{error && <p role="alert" className="error">{error}</p>}</details>;
}
