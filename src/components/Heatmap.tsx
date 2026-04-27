import { useMemo } from 'react';

interface Props {
  matrix: number[][];
  labels: string[];
  onCellClick?: (i: number, j: number) => void;
}

// Color ramp from cream (low similarity) to deep terracotta (high similarity).
function color(v: number): string {
  // v in [-1, 1]; we map [0,1] → ramp, treat negatives as ~0
  const t = Math.max(0, Math.min(1, v));
  const lerp = (a: number, b: number, x: number) => Math.round(a + (b - a) * x);
  // Cream: 247,245,240  →  Terracotta: 124,45,18
  const r = lerp(247, 124, t);
  const g = lerp(245, 45, t);
  const b = lerp(240, 18, t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function Heatmap({ matrix, labels, onCellClick }: Props) {
  const n = matrix.length;
  const cellSize = useMemo(() => {
    if (n <= 6) return 56;
    if (n <= 12) return 40;
    if (n <= 20) return 28;
    return 20;
  }, [n]);
  const labelWidth = 110;

  return (
    <div className="overflow-auto">
      <div className="inline-block">
        <div className="flex">
          <div style={{ width: labelWidth }} />
          <div className="flex">
            {labels.map((l, i) => (
              <div
                key={i}
                className="text-[11px] text-ink-500 mono whitespace-nowrap"
                style={{
                  width: cellSize,
                  height: 60,
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  textAlign: 'left',
                  paddingTop: 6,
                }}
                title={l}
              >
                {l.length > 22 ? l.slice(0, 22) + '…' : l}
              </div>
            ))}
          </div>
        </div>
        {matrix.map((row, i) => (
          <div key={i} className="flex items-center">
            <div
              className="text-[11px] text-ink-700 truncate pr-2 text-right"
              style={{ width: labelWidth }}
              title={labels[i]}
            >
              {labels[i]}
            </div>
            <div className="flex">
              {row.map((v, j) => (
                <div
                  key={j}
                  className="heatmap-cell"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: color(v),
                    cursor: onCellClick ? 'pointer' : 'default',
                  }}
                  title={`${labels[i]} ↔ ${labels[j]}: ${v.toFixed(3)}`}
                  onClick={() => onCellClick?.(i, j)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-500">
        <span>Low similarity</span>
        <div
          className="h-2 w-40 rounded-full"
          style={{
            background: 'linear-gradient(to right, rgb(247,245,240), rgb(124,45,18))',
          }}
        />
        <span>High similarity</span>
      </div>
    </div>
  );
}
