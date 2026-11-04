interface Props {
  /** Progreso entre 0 y 1. */
  ratio: number;
  size?: number;
  /** Texto para lectores de pantalla. */
  label: string;
}

/** Anillo de progreso con el porcentaje en el centro; verde al completarse. */
export function ProgressRing({ ratio, size = 76, label }: Props) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const done = clamped >= 1;

  return (
    <div className={`ring${done ? " ring-done" : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-text">{Math.floor(clamped * 100)}%</span>
    </div>
  );
}
