export interface ChartPoint {
  label: string;
  value: number;
}

interface Props {
  points: ChartPoint[];
  unit: string;
  max?: number;
}

const W = 640;
const H = 240;
const PAD = { top: 16, right: 20, bottom: 30, left: 40 };

function niceMax(value: number) {
  if (value <= 5) return 5;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

// A small dependency-free line chart. Hover or focus a dot to read its value.
export default function LineChart({ points, unit, max }: Props) {
  const top = max ?? niceMax(Math.max(...points.map((p) => p.value), 1));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${PAD.top + innerH} L${x(0).toFixed(1)} ${PAD.top + innerH} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(top * t));

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Progress chart of ${unit}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
          <text x={PAD.left - 8} y={y(t) + 4} className="tick" textAnchor="end">
            {t}
          </text>
        </g>
      ))}

      {points.length > 1 && <path d={area} className="area" />}
      {points.length > 1 && <path d={line} className="line" />}

      {points.map((p, i) => (
        <g key={i} tabIndex={0} className="dot-group">
          <circle cx={x(i)} cy={y(p.value)} r="14" className="hit" />
          <circle cx={x(i)} cy={y(p.value)} r="5" className="dot" />
          <text x={x(i)} y={y(p.value) - 12} textAnchor="middle" className="dot-value">
            {p.value}
          </text>
          <title>
            {p.label}: {p.value} {unit}
          </title>
        </g>
      ))}

      <text x={PAD.left} y={H - 8} className="tick">
        {points[0]?.label}
      </text>
      {points.length > 1 && (
        <text x={W - PAD.right} y={H - 8} className="tick" textAnchor="end">
          {points[points.length - 1].label}
        </text>
      )}
    </svg>
  );
}
