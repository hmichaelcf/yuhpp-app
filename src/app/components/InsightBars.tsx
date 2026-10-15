// A single-series column chart for the Insights page, drawn on the server as
// SVG. One measure per chart (never two scales on one axis). Hovering a column
// shows its label and value; the same numbers are in the table beside it.

export type Bar = { label: string; value: number; tip?: string };

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * pow >= max) return step * pow;
  }
  return 10 * pow;
}

export default function InsightBars({
  title,
  bars,
  format = (n) => String(n),
}: {
  title: string;
  bars: Bar[];
  format?: (n: number) => string;
}) {
  const W = 300;
  const H = 150;
  const padL = 34;
  const padB = 22;
  const padT = 10;
  const max = niceMax(Math.max(0, ...bars.map((b) => b.value)));
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.max(3, Math.min(24, slot - 4));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const last = bars.length - 1;

  return (
    <figure className="ins-chart">
      <figcaption className="ins-chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="ins-grid" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text className="ins-axis" x={padL - 6} y={y(t) + 3} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(b.value));
          const showLabel = bars.length <= 6 || i === 0 || i === last || i === Math.floor(last / 2);
          return (
            <g key={b.label} className="ins-col">
              <title>{b.tip ?? `${b.label}: ${format(b.value)}`}</title>
              <rect className="ins-hit" x={padL + i * slot} y={padT} width={slot} height={plotH} />
              {h > 0 ? (
                <path
                  className="ins-bar"
                  d={`M${x},${y(0)} V${y(b.value) + Math.min(3, h)} q0,-${Math.min(3, h)} ${Math.min(3, h)},-${Math.min(3, h)} H${x + barW - Math.min(3, h)} q${Math.min(3, h)},0 ${Math.min(3, h)},${Math.min(3, h)} V${y(0)} Z`}
                />
              ) : null}
              {showLabel ? (
                <text className="ins-axis" x={x + barW / 2} y={H - 6} textAnchor="middle">
                  {b.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <line className="ins-base" x1={padL} x2={W} y1={y(0)} y2={y(0)} />
      </svg>
    </figure>
  );
}
