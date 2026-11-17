import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
const actions = [{ name: 'Marcar momento', path: '/api/moments/mark', command: 'obs_mark', args: { title: '' }, effect: 'Guarda una marca de tiempo. Por sí sola no crea un vídeo.' }, { name: 'Capturar jugada anterior', path: '/api/moments/capture', command: 'auto_moments_control', args: { action: 'capture' }, effect: 'Con captura activada, espera el tramo posterior y guarda un candidato para revisar.' }, { name: 'Guardar Replay Buffer', path: '/api/clips/save', command: 'obs_save_replay', args: { title: '' }, effect: 'Pide a OBS guardar el búfer completo y espera su confirmación.' }];
export function StreamDeckGuide({ base, keyValue }: {
    base: string;
    keyValue: string;
}) {
    const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    return <details className="card"><summary>Mis botones de Stream Deck · qué hace cada acción</summary><p className="small muted">Configura una acción Sitio web que se ejecute en segundo plano. Los enlaces de control son privados; no los uses como fuente de navegador de OBS.</p>{actions.map(a => <div className="status-item" key={a.path}><div><strong>{a.name}</strong><p className="small muted">{a.effect}</p></div><button className="ghost small-button" disabled={!base || !keyValue || busy} onClick={async () => { try {
        await navigator.clipboard.writeText(base + a.path + '?key=' + encodeURIComponent(keyValue));
        setMessage('Enlace privado copiado: ' + a.name);
    }
    catch {
        setMessage('No se pudo copiar. Revisa el permiso del portapapeles.');
    } }}>Copiar acción</button><button className="ghost small-button" disabled={busy} onClick={async () => { setBusy(true); try {
        await invoke(a.command, a.args);
        setMessage('Acción solicitada: ' + a.name + '. Revisa su resultado en Capturas.');
    }
    catch (e) {
        setMessage(String(e));
    }
    finally {
        setBusy(false);
    } }}>Probar esta acción</button></div>)}{message && <p role="status">{message}</p>}</details>;
}
