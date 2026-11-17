import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { addExpectedIncome, expectedIncome, ExpectedIncome as Row } from '../../db/expectedIncome';
import { parseMoney } from './money';
import { todayIso, formatMoney } from '../../i18n/format';
export function ExpectedIncome({ onReceived }: {
    onReceived: () => Promise<void>;
}) {
    const [rows, setRows] = useState<Row[]>([]), [description, setDescription] = useState(''), [amount, setAmount] = useState(''), [currency, setCurrency] = useState('USD'), [due, setDue] = useState(todayIso), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const refresh = async () => setRows(await expectedIncome());
    useEffect(() => { void refresh().catch(e => setError(String(e))); }, []);
    return <details className="card"><summary>Ingresos previstos y pendientes de cobrar</summary><p className="small muted">Registro personal separado del dinero recibido. No consulta ni certifica el saldo de las plataformas. Cada moneda se mantiene separada y una previsión solo se convierte en ingreso al confirmar su cobro.</p><form className="form" onSubmit={async (e) => { e.preventDefault(); const n = parseMoney(amount); if (n === null || !/^[A-Z]{3}$/.test(currency)) {
        setError('Revisa importe y moneda.');
        return;
    } setBusy(true); setError(''); try {
        await addExpectedIncome({ description: description.trim(), amount_minor: n, currency, expected_on: due });
        setDescription('');
        setAmount('');
        await refresh();
    }
    catch (err) {
        setError(String(err));
    }
    finally {
        setBusy(false);
    } }}><label>Concepto<input required maxLength={200} value={description} onChange={e => setDescription(e.target.value)}/></label><label>Importe previsto<input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1.200,50"/></label><label>Moneda<input required maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())}/></label><label>Fecha estimada de cobro<input type="date" required value={due} onChange={e => setDue(e.target.value)}/></label><button disabled={busy}>Añadir previsión</button></form>{rows.map(r => <div className="status-item" key={r.id}><p><strong>{r.description}</strong> · {formatMoney(r.amount_minor, r.currency)}<br /><span className="small muted">{r.received ? 'Cobro registrado' : 'Previsto para ' + r.expected_on}</span></p>{!r.received && <button disabled={busy} className="ghost" onClick={async () => { setBusy(true); setError(''); try {
        await invoke('income_receive_expected', { id: r.id, date: todayIso() });
        await refresh();
        await onReceived();
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}>Confirmar cobro recibido hoy</button>}</div>)}{error && <p className="error" role="alert">{error}</p>}</details>;
}
