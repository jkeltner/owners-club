import type { Experience } from '../state/store'

// What each answer changes, shown before the player commits. Keep in sync
// with the coach (coach.ts), the market screen and where lessons start.
export const EXPERIENCE: { id: Experience; icon: string; label: string; detail: string; changes: string }[] = [
  {
    id: 'new', icon: '🌱', label: 'Brand new', detail: "I've never really thought about stocks.",
    changes: 'The coach explains every idea as it comes up, with everyday examples.',
  },
  {
    id: 'some', icon: '📘', label: 'I know the basics', detail: 'I know what a stock is, and maybe I follow one or two.',
    changes: 'Shorter explanations, and lessons skip the warm-up example.',
  },
  {
    id: 'lots', icon: '📈', label: "I've invested before", detail: "I've bought stocks, real or pretend, and I know what a P/E is.",
    changes: 'The coach skips the basics and asks harder questions. Lessons skip the warm-up example.',
  },
]
