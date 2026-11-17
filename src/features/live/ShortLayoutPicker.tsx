import { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
export interface ShortLayout {
    focus: number;
    camera: {
        x: number;
        y: number;
        w: number;
        h: number;
    } | null;
}
export function ShortLayoutPicker({ kind, id, before, after, value, onChange }: {
    kind: string;
    id: string;
    before: number;
    after: number;
    value: ShortLayout;
    onChange: (v: ShortLayout) => void;
}) {
    const [image, setImage] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const anchor = useRef<{
        x: number;
        y: number;
    } | null>(null);
    const point = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
    return <details><summary>Encuadre y plantilla de cámara + juego</summary><label>Centro de la acción · izquierda a derecha<input type="range" min={0} max={100} value={value.focus * 100} onChange={e => onChange({ ...value, focus: Number(e.target.value) / 100 })}/></label><p className="small muted">El control desplaza el recorte vertical. La imagen completa con fondo no recorta la acción.</p><label><input type="checkbox" checked={!!value.camera} onChange={e => onChange({ ...value, camera: e.target.checked ? { x: 0, y: 0, w: .25, h: .3 } : null })}/>Cámara arriba y juego abajo (vertical)</label>{value.camera && <><p className="small">Carga la imagen y arrastra un rectángulo sobre tu cámara. La selección se conserva como plantilla en este equipo; compruébala si cambias tu escena de OBS.</p><button className="ghost small-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try {
        setImage(await invoke('shorts_preview', { kind, id, before, after, format: 'original', layout: null }));
    }
    catch (e) {
        setError(String(e));
    }
    finally {
        setBusy(false);
    } }}>Seleccionar cámara en la imagen</button>{image && <div style={{ position: 'relative', cursor: 'crosshair', touchAction: 'none' }} onPointerDown={e => { anchor.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if (!anchor.current)
        return; const start = anchor.current, end = point(e); anchor.current = null; const camera = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(start.x - end.x), h: Math.abs(start.y - end.y) }; if (camera.w >= .03 && camera.h >= .03)
        onChange({ ...value, camera });
    else
        setError('Selecciona un rectángulo más grande.'); }}><img draggable={false} src={image} alt="Selecciona la cámara sobre el fotograma original" style={{ width: '100%', display: 'block' }}/><div aria-hidden style={{ position: 'absolute', pointerEvents: 'none', border: '2px solid #e8bb6a', left: value.camera.x * 100 + '%', top: value.camera.y * 100 + '%', width: value.camera.w * 100 + '%', height: value.camera.h * 100 + '%' }}/></div>}<button type="button" className="ghost small-button" onClick={() => onChange({ ...value, camera: { x: 0, y: 0, w: .25, h: .3 } })}>Usar cámara en esquina superior izquierda</button></>}{error && <p role="alert" className="error">{error}</p>}</details>;
}
