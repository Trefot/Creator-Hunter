import { useRef, useState } from "react";
import { useWidth } from "./useWidth";

export interface Bar {
  key: string;
  label: string;
  value: number;
}

interface Props {
  bars: Bar[];
  height?: number;
  formatValue: (v: number) => string;
  /** Texto para lectores de pantalla. */
  label: string;
}

const PAD = { top: 16, right: 8, bottom: 26, left: 84 };
const GAP = 2; // separación de superficie entre barras

/** Barra con las esquinas superiores redondeadas (4px) y apoyada recta en la base. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Una serie de barras (por ejemplo, ingresos por mes) con tooltip por barra. */
export function BarChart({ bars, height = 200, formatValue, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);

  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = height - PAD.top - PAD.bottom;
  const max = Math.max(...bars.map((b) => b.value), 0) || 1;
  const slot = innerW / Math.max(bars.length, 1);
  const barW = Math.min(Math.max(slot - GAP - slot * 0.3, 2), 48);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => max * f);
  // Con muchas barras, solo se etiqueta una de cada dos en el eje.
  const labelEvery = bars.length > 8 ? 2 : 1;

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((v) => (
            <g key={v}>
              <line className="chart-grid" x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} />
              <text className="chart-axis" x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
                {formatValue(v)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = Math.max(y(0) - y(b.value), b.value > 0 ? 2 : 0);
            return (
              <g key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* Zona de acierto más grande que la barra. */}
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                {h > 0 && (
                  <path
                    className={`chart-bar${hover === i ? " chart-bar-hover" : ""}`}
                    d={barPath(cx - barW / 2, y(0) - h, barW, h)}
                  />
                )}
                {i % labelEvery === (bars.length - 1) % labelEvery && (
                  <text className="chart-axis" x={cx} y={height - 8} textAnchor="middle">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(PAD.left + slot * hover + slot / 2, 60), width - 60),
            top: Math.max(y(bars[hover].value) - 52, 0),
          }}
        >
          <span className="muted">{bars[hover].label}</span>
          <strong>{formatValue(bars[hover].value)}</strong>
        </div>
      )}
    </div>
  );
}
