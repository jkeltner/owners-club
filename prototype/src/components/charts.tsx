// Calm SVG charts: one ink color for prices, no red/green, no live ticks.

type LineProps = {
  series: number[][]
  colors?: string[]
  height?: number
  markers?: number[] // x indexes to mark with a dot (checkpoints)
  visibleTo?: number // draw only up to this index (time machine)
  totalLength?: number
  labels?: string[]
}

export function LineChart({ series, colors = ['var(--ink)'], height = 140, markers = [], visibleTo, totalLength, labels }: LineProps) {
  const w = 340
  const h = height
  const pad = 8
  const n = totalLength ?? series[0].length
  const all = series.flatMap((s) => s)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const x = (i: number) => pad + (i / (n - 1)) * (w - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2)
  const end = visibleTo ?? n - 1
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Price chart">
      {series.map((s, si) => (
        <path
          key={si}
          d={s.slice(0, end + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}
          fill="none"
          stroke={colors[si % colors.length]}
          strokeWidth={si === 0 ? 3 : 2}
          strokeDasharray={si === 0 ? undefined : '5 4'}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {markers.filter((m) => m <= end).map((m) => (
        <circle key={m} cx={x(m)} cy={y(series[0][m])} r={5} fill="var(--card)" stroke="var(--primary)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      ))}
      {labels && (
        <g className="chart-labels">
          {labels.map((l, i) => (
            <text key={i} x={i === 0 ? pad : w - pad} y={h - 2} textAnchor={i === 0 ? 'start' : 'end'}>{l}</text>
          ))}
        </g>
      )}
    </svg>
  )
}

// A price chart with axes: a few price lines on the left and dates along the
// bottom, so the size of a move is readable. Optional dot for the buy day.
const TODAY = new Date(2026, 9, 20)
const dayLabel = (tradingDaysAgo: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - Math.round((tradingDaysAgo * 7) / 5))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function niceStep(range: number) {
  const raw = range / 3
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
}

export function PriceChart({ series, marker, format, height = 150 }: { series: number[]; marker?: number; format: (n: number) => string; height?: number }) {
  const w = 340
  const h = height
  const left = 50
  const right = 8
  const top = 8
  const bottom = 20
  const n = series.length
  const step = niceStep((Math.max(...series) - Math.min(...series)) || 1)
  const lo = Math.floor(Math.min(...series) / step) * step
  const hi = Math.ceil(Math.max(...series) / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v)
  const x = (i: number) => left + (i / (n - 1)) * (w - left - right)
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * (h - top - bottom)
  const xTicks = [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
  return (
    <svg className="chart price-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Price from ${format(series[0])} to ${format(series[n - 1])}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={w - right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={left - 6} y={y(v) + 4} textAnchor="end">{format(v)}</text>
        </g>
      ))}
      <line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} stroke="var(--ink-2)" strokeWidth={1} />
      {xTicks.map((i, k) => (
        <g key={i}>
          <line x1={x(i)} x2={x(i)} y1={h - bottom} y2={h - bottom + 4} stroke="var(--ink-2)" strokeWidth={1} />
          <text x={x(i)} y={h - 4} textAnchor={k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle'}>{i === n - 1 ? 'Today' : dayLabel(n - 1 - i)}</text>
        </g>
      ))}
      <path d={series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}
        fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {marker !== undefined && marker >= 0 && marker < n && (
        <circle cx={x(marker)} cy={y(series[marker])} r={5} fill="var(--card)" stroke="var(--primary)" strokeWidth={3} />
      )}
    </svg>
  )
}

type DriftProps = {
  weeks: { week: number; shares: Record<string, number>; weightedPE: number }[]
  order: string[]
  colors: Record<string, string>
}

// Each holding's share of the portfolio over time, stacked, with the
// portfolio's weighted P/E drawn on top.
export function DriftChart({ weeks, order, colors }: DriftProps) {
  const w = 340
  const h = 170
  const n = weeks.length
  const x = (i: number) => (i / (n - 1)) * w
  const peMin = 15
  const peMax = 45
  const yPE = (pe: number) => h - ((pe - peMin) / (peMax - peMin)) * h
  const layers = order.map((key, li) => {
    const lower = weeks.map((wk) => order.slice(0, li).reduce((a, k) => a + (wk.shares[k] ?? 0), 0))
    const upper = weeks.map((wk, i) => lower[i] + (wk.shares[key] ?? 0))
    const top = upper.map((v, i) => `${x(i)},${h - v * h}`)
    const bottom = lower.map((v, i) => `${x(i)},${h - v * h}`).reverse()
    return <polygon key={key} points={[...top, ...bottom].join(' ')} fill={colors[key]} />
  })
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Drift chart">
      {layers}
      <path
        d={weeks.map((wk, i) => `${i ? 'L' : 'M'}${x(i)},${yPE(wk.weightedPE)}`).join('')}
        fill="none" stroke="var(--ink)" strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// A single horizontal bar split by holding: the "shape of risk" at a glance.
export function MixBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  return (
    <div className="mixbar" role="img" aria-label="Portfolio mix">
      {parts.filter((p) => p.value > 0).map((p) => (
        <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
      ))}
    </div>
  )
}

// Where this company's P/E sits next to a typical S&P 500 company and its
// sector's usual range, so "45" means something to a first-timer.
export function PeScale({ pe, market, range, sector }: { pe: number; market: number; range?: [number, number]; sector: string }) {
  const max = Math.max(60, Math.ceil((pe + 10) / 10) * 10)
  const at = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="pe-scale" role="img" aria-label={`P/E ${pe.toFixed(0)}, typical company ${market}`}>
      <div className="pe-track">
        {range && <span className="pe-range" style={{ left: at(range[0]), width: `calc(${at(range[1])} - ${at(range[0])})` }} />}
        <span className="pe-mark market" style={{ left: at(market) }} />
        <span className="pe-dot" style={{ left: at(pe) }}>{pe.toFixed(0)}</span>
      </div>
      <div className="pe-legend">
        <span><i className="market" /> Typical S&P 500 company: {market}</span>
        {range && <span><i className="range" /> Usual for {sector}: {range[0]}–{range[1]}</span>}
      </div>
    </div>
  )
}
