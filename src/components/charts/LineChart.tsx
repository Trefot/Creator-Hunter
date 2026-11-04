import { MouseEvent, useId, useRef, useState } from "react";
import { useWidth } from "./useWidth";

export interface LinePoint {
  /** Fecha 'AAAA-MM-DD'; define la posición horizontal (escala de tiempo real). */
  date: string;
  value: number;
}

interface Props {
  points: LinePoint[];
  height?: number;
  /** Mini gráfica sin ejes, para tarjetas. */
  compact?: boolean;
  formatValue: (v: number) => string;
  formatDate: (date: string) => string;
  /** Texto para lectores de pantalla. */
  label: string;
}

const PAD = { top: 12, right: 12, bottom: 24, left: 52 };
const PAD_COMPACT = { top: 6, right: 6, bottom: 6, left: 6 };

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Evolución de una sola serie: línea de 2px con área suave, cuadrícula discreta,
 * etiqueta directa del último valor y cruz con tooltip al pasar el ratón.
 */
export function LineChart({ points, height = 180, compact = false, formatValue, formatDate, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const pad = compact ? PAD_COMPACT : PAD;
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = height - pad.top - pad.bottom;

  const xs = sorted.map((p) => dayNumber(p.date));
  const ys = sorted.map((p) => p.value);
  const xMin = Math.min(...xs);
  const xSpan = Math.max(...xs) - xMin || 1;
  // Margen vertical para que la línea no toque los bordes; con un único valor, rango artificial.
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const margin = (rawMax - rawMin) * 0.12 || Math.max(Math.abs(rawMax) * 0.1, 1);
  const yMin = Math.max(rawMin - margin, rawMin >= 0 ? 0 : -Infinity);
  const yMax = rawMax + margin;

  const x = (i: number) => pad.left + (sorted.length === 1 ? innerW / 2 : ((xs[i] - xMin) / xSpan) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const line = sorted.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(sorted.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;
  const ticks = [0, 0.5, 1].map((f) => yMin + (yMax - yMin) * f);

  function onMove(e: MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left + pad.left;
    let best = 0;
    sorted.forEach((_, i) => {
      if (Math.abs(x(i) - mx) < Math.abs(x(best) - mx)) best = i;
    });
    setHover(best);
  }

  const last = sorted.length - 1;
  const active = hover ?? null;

  return (
    <div ref={ref} className={`chart${compact ? " chart-compact" : ""}`} style={{ height }}>
      {width > 0 && sorted.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {!compact &&
            ticks.map((v) => (
              <g key={v}>
                <line className="chart-grid" x1={pad.left} x2={pad.left + innerW} y1={y(v)} y2={y(v)} />
                <text className="chart-axis" x={pad.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
                  {formatValue(v)}
                </text>
              </g>
            ))}
          {!compact && (
            <>
              <text className="chart-axis" x={x(0)} y={height - 6} textAnchor={sorted.length === 1 ? "middle" : "start"}>
                {formatDate(sorted[0].date)}
              </text>
              {sorted.length > 1 && (
                <text className="chart-axis" x={x(last)} y={height - 6} textAnchor="end">
                  {formatDate(sorted[last].date)}
                </text>
              )}
            </>
          )}

          {sorted.length > 1 && <path d={area} fill={`url(#${gradientId})`} />}
          {sorted.length > 1 && <path d={line} className="chart-line" />}

          {active !== null && (
            <line className="chart-crosshair" x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} />
          )}
          {/* Marcador del último valor (o del señalado), con anillo del color de la superficie. */}
          <circle className="chart-dot" cx={x(active ?? last)} cy={y(sorted[active ?? last].value)} r={4.5} />
          {!compact && active === null && (
            <text className="chart-label" x={x(last) - 8} y={y(sorted[last].value) - 10} textAnchor="end">
              {formatValue(sorted[last].value)}
            </text>
          )}

          <rect
            x={pad.left}
            y={0}
            width={innerW}
            height={height}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {active !== null && width > 0 && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(x(active), 60), width - 60), top: Math.max(y(sorted[active].value) - 52, 0) }}
        >
          <span className="muted">{formatDate(sorted[active].date)}</span>
          <strong>{formatValue(sorted[active].value)}</strong>
        </div>
      )}
    </div>
  );
}
