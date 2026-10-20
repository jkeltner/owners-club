export const usd = (n: number, cents = false) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })

// $4.4T, $187B, $850M
export function bigUsd(billions: number): string {
  const sign = billions < 0 ? '−' : ''
  const b = Math.abs(billions)
  if (b >= 1000) return `${sign}$${(b / 1000).toFixed(1)}T`
  if (b >= 1) return `${sign}$${b >= 100 ? b.toFixed(0) : b.toFixed(1)}B`
  return `${sign}$${(b * 1000).toFixed(0)}M`
}

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`

// Signed, using a real minus sign. Same color either way: no red/green.
export const signedPct = (n: number, digits = 1) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}%`

export const signedUsd = (n: number) => `${n >= 0 ? '+' : '−'}${usd(Math.abs(n))}`
