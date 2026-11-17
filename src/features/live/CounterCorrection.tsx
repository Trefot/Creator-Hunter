import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getDb } from '../../db/database';
interface Entry {
    delta: number;
    reason: string;
    at: number;
    value: number;
}
export function CounterCorrection({ counterId, onChanged }: {
    counterId: string;
    onChanged: () => Promise<void>;
}) {
    const [delta, setDelta] = useState(0), [reason, setReason] = useState(''), [rows, setRows] = useState<Entry[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
    async function refresh() { const db = await getDb(); const entries = await db.select<{
        content: string;
    }[]>("SELECT content FROM alert_cursor WHERE id LIKE 'counter-adjust:%' AND json_extract(content,'$.counter_id')=$1", [counterId]); setRows(entries.map(e => JSON.parse(e.content) as Entry).sort((a, b) => b.at - a.at).slice(0, 20)); }
    useEffect(() => { void refresh().catch(e => setError(String(e))); }, [counterId]);
    return <details><summary>Corregir total y ver ajustes manuales</summary><p className="small muted">El ajuste queda separado de las partidas detectadas. No vuelve a contar una repetición ni cambia qué cofres atribuyó el lector.</p><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
        await invoke('counter_correct', { counterId, delta, reason });
        setDelta(0);
        setReason('');
        await refresh();
        await onChanged();
    }
    catch (err) {
        setError(String(err));
    }
    finally {
        setBusy(false);
    } }}><label>Añadir o restar cofres<input type="number" min={-1000} max={1000} value={delta} onChange={e => setDelta(Number(e.target.value))}/></label><label>Motivo del ajuste<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></label><button disabled={busy || !delta}>Guardar ajuste con motivo</button></form><ul>{rows.map((r, i) => <li key={i}>{new Date(r.at).toLocaleString('es-CO')} · {r.delta > 0 ? '+' : ''}{r.delta} · {r.reason} · Total: {r.value}</li>)}</ul>{error && <p className="error" role="alert">{error}</p>}</details>;
}
