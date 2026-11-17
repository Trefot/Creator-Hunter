import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { contentAuto, setContentAuto, addSeries, classifyPost, contentHistory, contentPostHistory, contentLibrary, contentSeries, contentSyncStatus, ContentPost, Observation, Series, SyncStatus } from '../../db/contentPerformance';
import { listProjects, Project } from '../../db/projects';
import { syncContent } from './contentSync';
import { evaluate, seriesAdvice } from './analysis';
const networks = ['youtube', 'twitch', 'tiktok', 'instagram', 'facebook'];
const labels: Record<string, string> = { youtube: 'YouTube', twitch: 'Twitch', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' };
const number = (n: number | null) => n === null ? 'No disponible' : n.toLocaleString('es-CO');
const date = (s: string | number) => new Date(s).toLocaleString('es-CO');
export function PerformancePanel() {
    const [detailHistory,setDetailHistory]=useState<Observation[]>([]);
    const [automatic, setAutomatic] = useState(true);
    const [posts, setPosts] = useState<ContentPost[]>([]), [history, setHistory] = useState<Observation[]>([]), [series, setSeries] = useState<Series[]>([]), [projects, setProjects] = useState<Project[]>([]), [status, setStatus] = useState<Record<string, SyncStatus>>({}), [network, setNetwork] = useState('all'), [group, setGroup] = useState('all'), [hours, setHours] = useState(24), [limit, setLimit] = useState(30), [busy, setBusy] = useState(false), [error, setError] = useState(''), [newSeries, setNewSeries] = useState(''), [selected, setSelected] = useState<string | null>(null);
    useEffect(()=>{let stopped=false;setDetailHistory([]);if(selected)void contentPostHistory(selected).then(rows=>{if(!stopped)setDetailHistory(rows)}).catch(e=>{if(!stopped)setError(String(e))});return()=>{stopped=true}},[selected,posts]);
    async function refresh() { const [p, h, s, t, pr] = await Promise.all([contentLibrary(), contentHistory(), contentSeries(), contentSyncStatus(), listProjects()]); setPosts(p); setHistory(h); setSeries(s); setStatus(t); setProjects(pr); }
    useEffect(() => { void contentAuto().then(setAutomatic).catch(e => setError(String(e))); let dead = false; const load = () => { if (!dead)
        void refresh().catch(e => setError(String(e))); }; load(); window.addEventListener('nexus-content-changed', load); return () => { dead = true; window.removeEventListener('nexus-content-changed', load); }; }, []);
    async function update(p: ContentPost, patch: Partial<ContentPost>) { setError(''); try {
        await classifyPost(p.id, patch.format ?? p.format, patch.series_id === undefined ? p.series_id : patch.series_id, patch.project_id === undefined ? p.project_id : patch.project_id);
        await refresh();
    }
    catch (e) {
        setError(String(e));
    } }
    async function sync(platform: string) { setBusy(true); setError(''); try {
        await syncContent(platform);
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        await refresh().catch(e => setError(String(e)));
        setBusy(false);
    } }
    const filtered = posts.filter(p => (network === 'all' || p.platform === network) && (group === 'all' || p.series_id === group));
    return <section className="performance-panel"><header className="page-header"><div><h2>Qué contenido está funcionando</h2><p className="muted">Publicaciones detectadas automáticamente y evolución real. {automatic ? 'Nexus consulta cada 10 minutos mientras está abierto; las redes pueden entregar datos con retraso.' : 'Seguimiento automático pausado; puedes consultar cada red a mano.'}</p></div></header>
 <label><input type="checkbox" checked={automatic} onChange={async (e) => { const value = e.target.checked; try {
        await setContentAuto(value);
        setAutomatic(value);
    }
    catch (err) {
        setError(String(err));
    } }}/>Seguimiento automático de publicaciones mientras Nexus esté abierto</label>
 <details className="card"><summary>Conexiones, última consulta y límites de cada red</summary><p>El primer recorrido descubre las publicaciones recientes. No es una importación completa del archivo histórico. Los guiones significan dato no disponible, nunca cero.</p>{networks.map(n => <div key={n} className="status-item"><div><strong>{labels[n]}</strong><p className="small muted">{status[n]?.last_success_ms ? 'Última consulta correcta: ' + date(status[n].last_success_ms!) : 'Sin consulta correcta de publicaciones'}</p>{status[n]?.warning && <p className="small">{status[n].warning}</p>}{status[n]?.error && <p className="error" role="status">{status[n].error}</p>}</div><button className="ghost small-button" disabled={busy} onClick={() => void sync(n)}>Consultar {labels[n]}</button></div>)}</details>
 {error && <p role="alert" className="error">{error}</p>}
 <div className="tools-actions"><label>Red<select aria-label="Filtrar publicaciones por red" value={network} onChange={e => { setNetwork(e.target.value); setLimit(30); }}><option value="all">Todas</option>{networks.map(n => <option key={n} value={n}>{labels[n]}</option>)}</select></label><label>Serie<select aria-label="Filtrar publicaciones por serie" value={group} onChange={e => { setGroup(e.target.value); setLimit(30); }}><option value="all">Todas</option>{series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Comparar a la misma edad<select value={hours} onChange={e => setHours(Number(e.target.value))}><option value={24}>24 horas</option><option value={72}>72 horas</option><option value={168}>7 días</option></select></label></div>
 <form className="card tools-actions" onSubmit={async (e) => { e.preventDefault(); setError(''); try {
        await addSeries(newSeries);
        setNewSeries('');
        await refresh();
    }
    catch (err) {
        setError(String(err));
    } }}><label>Nueva serie o tipo de contenido<input value={newSeries} maxLength={120} onChange={e => setNewSeries(e.target.value)} placeholder="Ejemplo: jefes de Wukong" required/></label><button>Crear serie</button></form>
 {group !== 'all' && <div className="card"><h3>Cómo continuar esta serie</h3>{networks.filter(n => network === 'all' || network === n).map(n => { const advice = seriesAdvice(group, n, posts, history, hours); return <p key={n}><strong>{labels[n]} · {advice.label}</strong><br /><span className="small muted">{advice.detail}</span></p>; })}</div>}
 {!filtered.length && <div className="card"><h3>Tus próximas publicaciones aparecerán aquí</h3><p>Conecta tu cuenta y consulta su contenido. TikTok requiere video.list y las vistas de Instagram requieren permisos de estadísticas adicionales. No necesitas volver a registrar publicaciones a mano.</p></div>}
 <div className="performance-grid">{filtered.slice(0, limit).map(p => {
            const result = evaluate(p, posts, history, hours), measurements = (selected===p.id?detailHistory:[]).filter(h => h.views !== null), max = Math.max(1, ...measurements.map(h => h.views!));
            return <article className="card" key={p.id}><small className="muted">{labels[p.platform]} · {p.handle} · {date(p.published_at)}</small><h3>{p.title || 'Publicación sin título'}</h3>{p.thumbnail && <img loading="lazy" referrerPolicy="no-referrer" src={p.thumbnail} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} onError={e => e.currentTarget.hidden = true}/>}<dl className="performance-counts"><div><dt>Vistas</dt><dd>{number(p.views)}<small className="muted" style={{ display: 'block', fontSize: '.7rem' }}>{p.views_at && p.views_at !== p.observed_at ? 'Del ' + date(p.views_at) : ''}</small></dd></div><div><dt>Likes</dt><dd>{number(p.likes)}<small className="muted" style={{ display: 'block', fontSize: '.7rem' }}>{p.likes_at && p.likes_at !== p.observed_at ? 'Del ' + date(p.likes_at) : ''}</small></dd></div><div><dt>Comentarios</dt><dd>{number(p.comments)}<small className="muted" style={{ display: 'block', fontSize: '.7rem' }}>{p.comments_at && p.comments_at !== p.observed_at ? 'Del ' + date(p.comments_at) : ''}</small></dd></div><div><dt>Compartidos</dt><dd>{number(p.shares)}<small className="muted" style={{ display: 'block', fontSize: '.7rem' }}>{p.shares_at && p.shares_at !== p.observed_at ? 'Del ' + date(p.shares_at) : ''}</small></dd></div>{p.platform==='youtube'&&<div><dt>Horas de reproducción · Analytics</dt><dd>{number(p.watch_hours??null)}<small className="muted" style={{display:'block',fontSize:'.7rem'}}>{p.watch_hours_at?'Consulta: '+date(p.watch_hours_at):'Pendientes de Analytics'}</small></dd></div>}</dl><p className="small muted">Consulta: {p.observed_at ? date(p.observed_at) : 'Pendiente'}{p.observed_at && Date.now() - Date.parse(p.observed_at) > 3600000 ? ' · Datos pendientes de actualizar' : ''}</p><p><strong>{result.label}</strong><br /><span className="small muted">{result.detail}</span></p>
 <div className="tools-actions"><button className="ghost small-button" onClick={() => { try {
                const u = new URL(p.url);
                if (u.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.tiktok.com', 'tiktok.com', 'www.instagram.com', 'instagram.com', 'www.facebook.com', 'facebook.com', 'www.twitch.tv', 'twitch.tv', 'clips.twitch.tv'].includes(u.hostname))
                    void openUrl(p.url).catch(e => setError(String(e)));
                else
                    setError('El enlace no corresponde a una plataforma admitida.');
            }
            catch {
                setError('Enlace no válido.');
            } }}>Abrir publicación</button><button className="ghost small-button" onClick={() => setSelected(selected === p.id ? null : p.id)}>Clasificar y ver evolución</button></div>
 {selected === p.id && <div><label>Formato<select value={p.format} onChange={e => void update(p, { format: e.target.value })}>{Object.entries({ unknown: 'Por clasificar', video: 'Vídeo', short: 'Short / TikTok', reel: 'Reel', post: 'Publicación', live: 'Directo / repetición', clip: 'Clip de Twitch' }).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label><label>Serie<select value={p.series_id ?? ''} onChange={e => void update(p, { series_id: e.target.value || null })}><option value="">Sin serie</option>{series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Proyecto de origen<select value={p.project_id ?? ''} onChange={e => void update(p, { project_id: e.target.value || null })}><option value="">Sin proyecto</option>{projects.map(pr => <option key={pr.id} value={pr.id}>{pr.title}</option>)}</select></label><p className="small">Asignar el mismo proyecto o serie relaciona las versiones entre redes; no modifica las publicaciones.</p>{measurements.length > 1 && <svg viewBox="0 0 320 100" role="img" aria-label="Evolución de vistas en las consultas guardadas" style={{ width: '100%', height: 100 }}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={measurements.map(h => `${(Date.parse(h.observed_at)-Date.parse(measurements[0].observed_at))/Math.max(1,Date.parse(measurements[measurements.length-1].observed_at)-Date.parse(measurements[0].observed_at))*310+5},${95 - h.views! / max * 90}`).join(' ')}/></svg>}<details><summary>{measurements.length} mediciones de vistas guardadas</summary><ul>{measurements.slice(-20).map(h => <li key={h.observed_at}>{date(h.observed_at)} · {number(h.views)} vistas</li>)}</ul></details></div>}</article>;
        })}</div>
 {filtered.length > limit && <button className="ghost" onClick={() => setLimit(v => v + 30)}>Mostrar más publicaciones</button>}<p className="small muted">Las comparaciones se hacen dentro de cada cuenta y formato, con al menos cinco referencias y una medición cerca de la misma edad. Para orientar una serie hacen falta tres publicaciones comparables. No son pruebas de causalidad ni órdenes de abandonar contenido.</p>
 </section>;
}
