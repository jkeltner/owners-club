// Calm SVG charts: one ink color for prices, no red/green, no live ticks.
// Ported from the prototype; the price chart now takes real dates.

function niceStep(range: number) {
  const raw = range / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
}

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// A price chart with axes: a few price lines on the left and dates along the
// bottom, so the size of a move is readable.
export function PriceChart({ series, height = 150 }: { series: { date: string; close: number }[]; height?: number }) {
  const w = 340;
  const h = height;
  const left = 50;
  const right = 8;
  const top = 8;
  const bottom = 20;
  const n = series.length;
  const closes = series.map((p) => p.close);
  const lowest = Math.min(...closes);
  const highest = Math.max(...closes);
  const step = niceStep(highest - lowest || Math.max(1, highest * 0.05));
  const lo = Math.floor(lowest / step) * step;
  const hi = Math.ceil(highest / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  const format = (v: number) => (step < 1 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
  const x = (i: number) => left + (n > 1 ? i / (n - 1) : 0) * (w - left - right);
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (h - top - bottom);
  const xTicks = n >= 4 ? [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1] : [0, n - 1];
  return (
    <svg className="chart price-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Price from ${format(closes[0])} to ${format(closes[n - 1])}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={w - right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={left - 6} y={y(v) + 4} textAnchor="end">
            {format(v)}
          </text>
        </g>
      ))}
      <line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} stroke="var(--ink-2)" strokeWidth={1} />
      {xTicks.map((i, k) => (
        <g key={i}>
          <line x1={x(i)} x2={x(i)} y1={h - bottom} y2={h - bottom + 4} stroke="var(--ink-2)" strokeWidth={1} />
          <text x={x(i)} y={h - 4} textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}>
            {dayLabel(series[i].date)}
          </text>
        </g>
      ))}
      <path
        d={closes.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A single horizontal bar split by holding: the "shape of risk" at a glance.
export function MixBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="mixbar" role="img" aria-label="Portfolio mix">
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
    </div>
  );
}

// Where this company's P/E sits next to a typical S&P 500 company and its
// kind's usual range, so "45" means something to a first-timer. A P/E above
// 100 is drawn at the end of the scale and labelled "100+".
export function PeScale({ pe, market, range, sector }: { pe: number; market: number | null; range?: [number, number]; sector?: string }) {
  const over = pe > 100;
  const max = over ? 100 : Math.max(60, Math.ceil((pe + 10) / 10) * 10);
  const at = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const label = over ? "100+" : pe.toFixed(0);
  return (
    <div className="pe-scale" role="img" aria-label={`P/E ${over ? "over 100" : label}${market != null ? `, typical company ${market}` : ""}`}>
      <div className="pe-track">
        {range && <span className="pe-range" style={{ left: at(range[0]), width: `calc(${at(range[1])} - ${at(range[0])})` }} />}
        {market != null && <span className="pe-mark market" style={{ left: at(market) }} />}
        <span className="pe-dot" style={{ left: at(pe) }}>
          {label}
        </span>
      </div>
      <div className="pe-legend">
        {market != null && (
          <span>
            <i className="market" /> Typical S&amp;P 500 company: {market}
          </span>
        )}
        {range && sector && (
          <span>
            <i className="range" /> Usual for {sector}: {range[0]}–{range[1]}
          </span>
        )}
      </div>
    </div>
  );
}

// How the mix changed: one stacked band per holding, each day's bands adding
// up to the whole portfolio. `order` is bottom to top.
export function DriftChart({ days, order, colors }: { days: { date: string; shares: Record<string, number> }[]; order: string[]; colors: Record<string, string> }) {
  const w = 340;
  const h = 150;
  const n = days.length;
  const x = (i: number) => (n === 1 ? w : (i / (n - 1)) * w);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="How much of your money was in each holding, day by day">
      {order.map((key, li) => {
        const lower = days.map((d) => order.slice(0, li).reduce((a, k) => a + (d.shares[k] ?? 0), 0));
        const upper = days.map((d, i) => lower[i] + (d.shares[key] ?? 0));
        const top = upper.map((v, i) => `${x(i)},${h - v * h}`);
        const bottom = lower.map((v, i) => `${x(i)},${h - v * h}`).reverse();
        return <polygon key={key} points={[...top, ...bottom].join(" ")} fill={colors[key]} />;
      })}
    </svg>
  );
}
