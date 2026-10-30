import type { Experience } from '../state/store'

// What each answer changes, shown before the player commits. Keep in sync
// with the coach (coach.ts), the market screen and where lessons start.
// `effects` is the Me tab's breakdown: what the coach, the explanations and
// the lessons each do at this level. It never changes rules, scoring or rank.
export type ExperienceEffects = { coach: string; explains: string; lessons: string }

export const EXPERIENCE: { id: Experience; icon: string; label: string; detail: string; changes: string; effects: ExperienceEffects }[] = [
  {
    id: 'new', icon: '🌱', label: 'Brand new', detail: "I've never really thought about stocks.",
    changes: 'The coach explains every idea as it comes up, with everyday examples.',
    effects: {
      coach: 'Explains every term the first time it comes up, with everyday examples, before asking you about it.',
      explains: 'Cards like "Why start here?" open already, so the reasons are in front of you.',
      lessons: 'Start with the warm-up example before the real company.',
    },
  },
  {
    id: 'some', icon: '📘', label: 'I know the basics', detail: 'I know what a stock is, and maybe I follow one or two.',
    changes: 'Shorter explanations, and lessons skip the warm-up example.',
    effects: {
      coach: 'Uses terms like P/E without stopping to define them, but asks the same questions.',
      explains: 'Explainer cards start folded. Tap + to open one.',
      lessons: 'Skip the warm-up example and go straight to the real company.',
    },
  },
  {
    id: 'lots', icon: '📈', label: "I've invested before", detail: "I've bought stocks, real or pretend, and I know what a P/E is.",
    changes: 'The coach skips the basics and asks harder questions. Lessons skip the warm-up example.',
    effects: {
      coach: "Skips the basics and asks harder questions, like the math behind what's already priced in.",
      explains: 'Explainer cards start folded. Tap + to open one.',
      lessons: 'Skip the warm-up example and go straight to the real company.',
    },
  },
]
