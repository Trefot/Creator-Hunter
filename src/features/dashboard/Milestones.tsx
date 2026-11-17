import type { AccountSnapshot } from '../../db/accountSnapshots';
import type { Goal } from '../../db/goals';
import type { Profile } from '../../db/profiles';
import { formatNumber, formatShortDate } from '../../i18n/format';
export function Milestones({ goals, history, profiles }: {
    goals: Goal[];
    history: AccountSnapshot[];
    profiles: Profile[];
}) {
    const rows = goals.flatMap(g => { if (!g.profile_id || (g.metric === 'income' || g.metric === 'views'))
        return []; const p = profiles.find(p => p.id === g.profile_id); const first = history.find(r => r.profile_id === g.profile_id && r.recorded_on >= g.created_at.slice(0, 10) && ((g.metric === 'followers' ? r.followers : g.metric === 'watch_hours' ? r.watch_hours : r.total_views) ?? -1) >= g.target_value); return first && p ? [{ g, p, first }] : []; }).sort((a, b) => b.first.recorded_on.localeCompare(a.first.recorded_on));
    return <details className="card"><summary>Mis hitos acreditados · {rows.length}</summary><p className="small muted">Hitos de seguidores y horas: primera cifra guardada que acredita cada meta desde su creación. No se inventa la fecha exacta en que la plataforma la alcanzó.</p>{rows.slice(0, 20).map(({ g, p, first }) => <p key={g.id}>🏆 {p.handle} · {formatNumber(g.target_value)} {g.metric === 'followers' ? 'seguidores' : g.metric === 'views' ? 'vistas' : 'horas registradas'} · {formatShortDate(first.recorded_on)}</p>)}{!rows.length && <p className="muted">Tus próximas metas alcanzadas aparecerán aquí con un registro que las respalde.</p>}</details>;
}
