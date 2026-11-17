import { invoke } from '@tauri-apps/api/core';
import { saveLocalPreferences } from '../../db/localPreferences';
import { todayIso } from '../../i18n/format';
export function startAutomaticBackup() { let stopped = false, busy = false; async function check() { if (stopped || busy || localStorage.getItem('nexus-auto-backup') === 'false')
    return; busy = true; try {
    await saveLocalPreferences();
    const path = await invoke<string>('automatic_backup', { day: todayIso().replace(/-/g, '') });
    if (!stopped)
        localStorage.setItem('nexus-last-auto-backup', path);
}
catch {
    if (!stopped)
        window.dispatchEvent(new CustomEvent('nexus-sync-error', { detail: 'No se pudo crear la copia automática. Revisa Copias de seguridad.' }));
}
finally {
    busy = false;
} } const first = setTimeout(() => void check(), 20000), timer = setInterval(() => void check(), 3600000); return () => { stopped = true; clearTimeout(first); clearInterval(timer); }; }
