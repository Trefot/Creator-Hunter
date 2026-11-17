import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
export function CloseGuard() {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const allowed = useRef(false), checking = useRef(false);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { let stopped = false; const window = getCurrentWindow(); const done = window.onCloseRequested(async (e) => { if (allowed.current)
        return; e.preventDefault(); if (checking.current)
        return; checking.current = true; try {
        const state = await invoke<{
            obs_busy: boolean;
            jobs: {
                state: string;
            }[];
        }>('media_jobs_status');
        const capture = await invoke<{
            pending: unknown;
        }>('auto_moments_activity');
        if (stopped)
            return;
        if (state.obs_busy || state.jobs.some(j => ['queued', 'running', 'finishing'].includes(j.state)) || capture?.pending)
            setOpen(true);
        else {
            allowed.current = true;
            await window.close();
        }
    }
    catch {
        if (!stopped) {
            setError('No se pudo comprobar el trabajo activo. Puedes continuar usando Nexus.');
            setOpen(true);
        }
    }
    finally {
        checking.current = false;
    } }); return () => { stopped = true; void done.then(fn => fn()).catch(() => { }); }; }, []);
    useEffect(() => { if (open && !dialog.current?.open)
        dialog.current?.showModal();
    else if (!open && dialog.current?.open)
        dialog.current.close(); }, [open]);
    return <dialog ref={dialog} aria-label="Cerrar Nexus con trabajo activo" onCancel={() => setOpen(false)}><h2>Hay actividad en curso</h2><p>OBS puede seguir grabando o emitiendo. Al cerrar Nexus se detienen sus servicios y capturas pendientes; OBS se mantiene independiente. Los trabajos de vídeo se cancelarán antes de salir.</p><button disabled={busy} onClick={() => setOpen(false)}>Seguir trabajando</button><button className="ghost" disabled={busy} onClick={async () => { setBusy(true); setError(''); try {
        await invoke('media_jobs_stop_for_exit');
        allowed.current = true;
        await getCurrentWindow().close();
    }
    catch (e) {
        setError(String(e));
        setBusy(false);
    } }}>{busy ? 'Terminando procesos…' : 'Cancelar trabajos de Nexus y cerrar'}</button>{error && <p className="error" role="alert">{error}</p>}</dialog>;
}
