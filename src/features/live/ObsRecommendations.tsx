import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
export function ObsRecommendations() {
    const [upload, setUpload] = useState(''), [limit, setLimit] = useState(6000), [gpu, setGpu] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const speed = Number(upload), budget = Number.isFinite(speed) && speed > 0 ? Math.min(limit, Math.floor(speed * 1000 * .7)) : null;
    return <details className="card"><summary>Preparar encoder y presupuesto de bitrate</summary><p className="small muted">Usa una medición real de tu subida disponible mientras juegas. El margen del 30 % es una orientación personal; no garantiza estabilidad ni sustituye los límites de tu plataforma. No se cambian encoder ni bitrate automáticamente.</p><label>Subida estable medida (Mbps)<input type="number" min={0.1} max={10000} step={0.1} value={upload} onChange={e => setUpload(e.target.value)}/></label><label>Límite de vídeo que usarás en tu plataforma (kbps)<input type="number" min={500} max={50000} step={100} value={limit} onChange={e => setLimit(Math.max(500, Math.min(50000, Number(e.target.value) || 500)))}/></label>{budget !== null && <p role="status">Presupuesto orientativo: <strong>{budget} kbps</strong>. {budget < 4500 ? 'Considera una salida más ligera y mide de nuevo.' : 'Comprueba fotogramas de red, renderizado y codificación durante una prueba antes de mantener 1080p60.'}</p>}<button className="ghost" disabled={busy} onClick={async () => { setBusy(true); setError(''); try {
        const r = await invoke<{
            available: boolean;
        }>('media_gpu_test');
        setGpu(r.available);
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}>Comprobar disponibilidad real de NVIDIA</button>{gpu !== null && <p>{gpu ? 'La prueba de codificación NVIDIA funcionó: puedes valorar NVENC H.264 en OBS para liberar CPU.' : 'No se confirmó NVIDIA. Conserva un encoder que funcione y usa el diagnóstico antes de aumentar carga.'}</p>}{error && <p role="alert" className="error">{error}</p>}</details>;
}
