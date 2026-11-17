import {SubtitleEditor} from "./SubtitleEditor";
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
export function SubtitleActions({ sessionId, hasSrt, onChanged, srtPath }: {
    sessionId: string;
    hasSrt: boolean;
    srtPath?:string|null;
    onChanged: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false), [size, setSize] = useState(24), [path, setPath] = useState(''), [result, setResult] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
    async function choose(relink = false) { setError(''); try {
        const file = await invoke<string | null>('choose_video_file');
        if (file) {
            setPath(file);
            if (relink) {
                await invoke('subtitles_relink', { sessionId, path: file });
                await onChanged();
                setNotice('Ruta reparada. Comprueba que elegiste la misma grabación; Nexus no puede identificar su contenido.');
            }
        }
    }
    catch (e) {
        setError(String(e));
    } }
    return <details><summary>Reparar archivo y crear copia con subtítulos</summary><p className="small muted">Si moviste el vídeo, vuelve a localizar la misma grabación. Incorporar subtítulos crea una copia nueva; conserva el original y el SRT.</p><button className="ghost small-button" disabled={busy} onClick={() => void choose(true)}>Localizar grabación movida</button><label>O introduce su nueva ruta<input value={path} onChange={e => setPath(e.target.value)}/></label><button className="ghost small-button" disabled={busy || !path} onClick={async () => { setBusy(true); setError(''); try {
        await invoke('subtitles_relink', { sessionId, path });
        await onChanged();
        setNotice('Ruta actualizada.');
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}>Guardar nueva ruta</button>{hasSrt && <><SubtitleEditor key={srtPath??sessionId} draftScope={srtPath??sessionId} sessionId={sessionId} onSaved={onChanged}/><label>Tamaño de subtítulos<select value={size} onChange={e => setSize(Number(e.target.value))}><option value={20}>Discreto</option><option value={24}>Normal</option><option value={32}>Grande</option><option value={40}>Muy grande</option></select></label><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try {
        setResult(await invoke('subtitles_burn', { sessionId, fontSize: size }));
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}>{busy ? 'Procesando…' : 'Crear vídeo con subtítulos incorporados'}</button></>}{result && <button className="ghost" onClick={() => void revealItemInDir(result)}>Mostrar vídeo subtitulado</button>}{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="error">{error}</p>}</details>;
}
