// Seeded random numbers so fake price series look the same on every load.
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const seedFrom = (text: string) =>
  [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261)

// A daily series that passes through each anchor [dayIndex, price], with
// wiggle between anchors. Used for 1-year charts and the time machine.
export function pathThrough(anchors: [number, number][], seed: number, wiggle = 0.012): number[] {
  const rand = seeded(seed)
  const out: number[] = []
  for (let a = 0; a < anchors.length - 1; a++) {
    const [d0, p0] = anchors[a]
    const [d1, p1] = anchors[a + 1]
    const n = d1 - d0
    let noise = 0
    const noises: number[] = []
    for (let i = 0; i <= n; i++) {
      noise += (rand() - 0.5) * 2 * wiggle
      noises.push(noise)
    }
    for (let i = a === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n
      const base = p0 * Math.pow(p1 / p0, t)
      // Pull noise back to zero at both anchors so the path hits them exactly.
      const drift = noises[i] - t * noises[n]
      out.push(base * Math.exp(drift))
    }
  }
  return out
}
