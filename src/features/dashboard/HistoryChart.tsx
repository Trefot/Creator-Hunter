import type { AccountSnapshot } from '../../db/accountSnapshots';
import { formatNumber, formatShortDate } from '../../i18n/format';
export function HistoryChart({ rows }: {
    rows: AccountSnapshot[];
}) {
    const points = rows.filter(r => r.followers !== null && r.followers >= 0).slice(-180), dates = points.map(r => Date.parse(r.recorded_on + 'T00:00:00Z')), values = points.map(r => r.followers!), min = Math.min(...values), max = Math.max(...values), start = Math.min(...dates), end = Math.max(...dates);
    if (points.length < 2)
        return <p className="small muted">La gráfica aparecerá con dos registros. Tu historial empieza con la primera cifra guardada.</p>;
    return <figure style={{ margin: '18px 0' }}><svg viewBox="0 0 520 120" role="img" aria-label={`Seguidores registrados: de ${formatNumber(values[0])} a ${formatNumber(values[values.length - 1])}`} style={{ width: '100%', height: 140 }}><polyline fill="none" stroke="var(--gold,#e8bb6a)" strokeWidth="3" points={points.map((r, i) => `${10 + (dates[i] - start) / Math.max(86400000, end - start) * 500},${100 - (r.followers! - min) / Math.max(1, max - min) * 85}`).join(' ')}/></svg><figcaption className="small muted">{formatShortDate(points[0].recorded_on)} — {formatShortDate(points[points.length - 1].recorded_on)} · Rango {formatNumber(min)}–{formatNumber(max)} · Solo registros reales</figcaption></figure>;
}
