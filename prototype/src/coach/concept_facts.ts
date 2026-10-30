// One concept applied to one company, for the coach's scouting walk-through:
// the company's number with something to compare it to, a question, tap
// replies, and the follow-up after the player answers. Later the live coach
// does this from the concept record and the company's data; this is the
// scripted stand-in, so every line only points at numbers the player can see.
import { MARKET_PE, concept, lens, sectorPlural } from '../content'
import { SP500 } from '../data/club'
import { fcfB, marketCapB, netMargin, peRatio, yearReturn, type Company } from '../data/companies'
import { lensValues } from '../data/lens_metrics'
import { bigUsd, signedPct, usd } from '../lib/format'
import { DEFAULT_SETTINGS } from '../lib/rules'

export type ConceptFact = {
  line: string // the company's number, with a comparison
  ask: string // the question to the player
  chips: string[]
  followup: string // the coach's take after the player answers
}

const cents = (c: Company) => `${Math.round(netMargin(c))}¢`

export function conceptFact(slug: string, c: Company): ConceptFact {
  const pe = peRatio(c)
  const peText = pe === null ? null : pe.toFixed(0)
  const l = lens(c.lens)
  const sector = sectorPlural(c.lens)
  const range = l?.typical_pe
  const yr = yearReturn(c)
  const beat = yr > SP500.ret12m

  switch (slug) {
    case 'market-cap-vs-share-price':
      return {
        line: `One share of ${c.name} costs ${usd(c.price, true)}. The whole company is worth about ${bigUsd(marketCapB(c))}: that's the market cap, the share price times every share there is.`,
        ask: 'Which of those two numbers tells you how big the business is?',
        chips: ['The share price', 'The market cap', "They're the same thing"],
        followup: `The market cap. A ${usd(c.price, true)} share price says nothing on its own: a company with fewer shares can have a higher price and be a much smaller business. ${c.name} is worth ${bigUsd(marketCapB(c))} in total, and that's the number to compare with other companies.`,
      }
    case 'revenue-vs-earnings':
      return {
        line: `${c.name} took in ${bigUsd(c.revenueB)} from customers last year. That's revenue. ${c.earningsB > 0 ? `After paying for everything, it kept ${bigUsd(c.earningsB)} as profit, about ${cents(c)} of each $1.` : `After paying for everything, it lost ${bigUsd(-c.earningsB)}. No profit at all.`}`,
        ask: 'If sales grow next year, does profit have to grow too?',
        chips: ['Yes, always', 'Not necessarily', "What's the difference?"],
        followup: `Not necessarily. Costs can grow faster than sales, so a company can sell more and keep less. Revenue tells you how much people buy; earnings tells you what's left over. Watch both.`,
      }
    case 'pe-ratio':
      if (pe === null) {
        return {
          line: `${c.name} lost ${bigUsd(-c.earningsB)} last year, so it has no P/E: there's no profit to divide the price by. Buyers still pay ${bigUsd(marketCapB(c))} for the whole company.`,
          ask: 'What are buyers expecting, if there\'s no profit today?',
          chips: ['Profits later', 'Nothing, it\'s a mistake', 'Not sure'],
          followup: `Profits later. With no P/E, the whole price is a bet that losses turn into profit. The things to watch are whether sales grow and whether the losses shrink each quarter.`,
        }
      }
      return {
        line: `${c.name}'s P/E is ${peText}: the stock costs ${peText} times last year's profit. A typical S&P 500 company is about ${MARKET_PE}${range ? `, and ${sector} are usually ${range[0]} to ${range[1]}` : ''}.`,
        ask: `What does a P/E of ${peText} say buyers expect?`,
        chips: ['Fast growth', 'Slow growth', "Nothing, it's just a number"],
        followup: pe > MARKET_PE * 1.3
          ? `Fast growth. Buyers only pay ${peText} times profit if they think profit will grow a lot. If it doesn't, the P/E usually falls, and the stock falls with it even if the business is fine.`
          : pe < MARKET_PE * 0.8
            ? `Slow growth, or a risk buyers see. A low P/E isn't automatically cheap: the question is why buyers won't pay more. Sometimes they're wrong, and that's a real opportunity.`
            : `About average growth. Nothing special is priced in either way, so for the stock to beat the market the business has to do a bit better than people expect.`,
      }
    case 'index-as-benchmark':
      return {
        line: `Over the past year ${c.name}'s stock went ${signedPct(yr)}. The S&P 500 went ${signedPct(SP500.ret12m)}. So it ${beat ? 'beat' : 'trailed'} the index by ${Math.abs(yr - SP500.ret12m).toFixed(0)} points.`,
        ask: `If you'd owned ${c.name} instead of the index last year, did you do well?`,
        chips: beat ? ['Yes, it beat the index', 'Only if it went up', 'Not sure'] : ['No, the index did better', 'Yes, if it went up', 'Not sure'],
        followup: beat
          ? `Yes. It beat the index, which is the actual test. Going up isn't enough: the index was up too, and you could have had that for free.`
          : `No. ${yr > 0 ? "It went up, but the index went up more, so doing nothing would have beaten it." : 'The index went up and this went down.'} The score is always against the index, never against zero.`,
      }
    case 'already-priced-in':
      return {
        line: pe === null
          ? `${c.name} has no profit yet, and buyers still pay ${bigUsd(marketCapB(c))} for it. Revenue grew ${c.revenueGrowth}% last year. That price already assumes the growth continues and turns into profit.`
          : `${c.name} costs ${peText} times profit, and revenue grew ${c.revenueGrowth}% last year. Everyone can see both numbers, so the price already counts on a lot of that growth continuing.`,
        ask: 'For the stock to beat the market from here, what has to happen?',
        chips: ['Do even better than expected', 'Just keep growing', 'Not sure'],
        followup: `Do better than expected. Growth that everyone already expects is in the price; you don't get paid for it. The question for your report is what buyers are missing, good or bad.`,
      }
    case 'diversification-concentration-risk': {
      const cap = DEFAULT_SETTINGS.capAtPurchase * 100
      return {
        line: `The club caps any pick at ${cap}% of your money when you buy it. If you put the maximum into ${c.name} and the stock fell 40%, you'd lose ${cap * 0.4}% of everything you have.`,
        ask: 'Why would a club cap a single pick?',
        chips: ["So one surprise can't sink you", 'To make it boring', 'Not sure'],
        followup: `So one surprise can't sink you. Every company, even a great one, can have a bad year nobody saw coming. Four or more picks means one of those is a bruise, not a knockout.`,
      }
    }
    case 'correlation':
      return {
        line: `${c.name} is one of the ${sector} in the game. Companies in the same business tend to move together: when one has a bad day, the others often do too.`,
        ask: `What else in your portfolio would probably drop on the same day as ${c.name}?`,
        chips: ['Others in the same business', 'Nothing, each stock is separate', 'Not sure'],
        followup: `Others in the same business. Four tech stocks look like four picks, but they're closer to one big bet. Real diversification means picks that don't all depend on the same thing going right.`,
      }
    case 'profit-margins':
      return {
        line: `${c.name} keeps ${cents(c)} of each $1 of sales as profit. A typical S&P 500 company keeps about 12¢. Grocery stores keep 2 to 4¢; software companies often keep 20 to 35¢.`,
        ask: `Is ${cents(c)} high or low for ${sector}?`,
        chips: ['High', 'Low', 'About normal'],
        followup: `${netMargin(c) > 20 ? `High, even for ${sector}. The question is whether it can keep that margin if costs rise or a rival cuts prices.` : netMargin(c) < 8 ? `Low. Thin margins mean small cost changes matter a lot: a 2¢ rise in costs could wipe out a big share of the profit.` : `Close to normal. For a company like this, growth in sales matters more than squeezing out another cent of margin.`} Margins vary hugely by business type, so always compare with the same kind of company.`,
      }
    case 'free-cash-flow':
      return {
        line: `Last year ${c.name} turned about ${c.fcfMargin}¢ of each $1 of sales into free cash flow: ${bigUsd(fcfB(c))} of actual cash left after paying for everything, including new buildings and equipment.`,
        ask: 'Why might cash matter more than the reported profit?',
        chips: ['Profit can be a number on paper', "It doesn't, profit is profit", 'Not sure'],
        followup: `Profit can be a number on paper; cash is what's in the bank. Companies can report a profit while spending more cash than they bring in. Cash is what pays for dividends, buybacks and new ideas.`,
      }
    case 'dividends':
      return {
        line: `A dividend is cash a company pays to shareholders, usually every 3 months. Fast growers like ${c.ai ? c.name : 'Nvidia'} pay little or nothing and reinvest instead; slow, steady businesses often pay 2 to 4% of the share price a year.`,
        ask: `Would you want ${c.name} to pay you cash now, or spend it on growing?`,
        chips: ['Pay me now', 'Spend it on growing', 'Depends on the business'],
        followup: `It depends on the business. A company growing ${c.revenueGrowth}% a year can usually earn more by reinvesting. A company that's stopped growing should hand the cash back. The prototype doesn't show dividends yet, so note that in your report as a question to check.`,
      }
    case 'debt-balance-sheet-risk':
      return {
        line: `The prototype doesn't show ${c.name}'s debt yet. In the real game you'd see how much it owes next to how much it earns in a year. Owing less than a year or two of profit is comfortable; owing many years of profit is risky.`,
        ask: 'What happens to a company with lots of debt when business slows down?',
        chips: ['It still owes the payments', 'Nothing, debt is normal', 'Not sure'],
        followup: `It still owes the payments. Sales can fall, but debt payments don't, so a slow year can turn into a crisis. For your report, write down that debt is the number you'd check first.`,
      }
    case 'costs-and-taxes': {
      const fee = 1000 * DEFAULT_SETTINGS.feeRate
      const short = Math.round(100 * (1 - DEFAULT_SETTINGS.shortTermTaxRate))
      const long = Math.round(100 * (1 - DEFAULT_SETTINGS.longTermTaxRate))
      return {
        line: `Buying $1,000 of ${c.name} costs a ${usd(fee, true)} fee (${DEFAULT_SETTINGS.feeRate * 100}%). Sell within 6 months and ${DEFAULT_SETTINGS.shortTermTaxRate * 100}% of any gain goes to tax; after 6 months it's ${DEFAULT_SETTINGS.longTermTaxRate * 100}%.`,
        ask: 'Say you made $100 on it in 4 months and sold. What do you keep?',
        chips: [`$${short}`, `$${long}`, '$100'],
        followup: `$${short}, minus the fee. Waiting past 6 months would keep $${long}. Costs are the one part of investing you control completely, which is why the leaderboard counts them.`,
      }
    }
    case 'luck-vs-skill':
      return {
        line: `If ${c.name} goes up next month, that says almost nothing about whether your reason was good. Single stocks swing 20 to 40% in a normal year on news nobody predicted.`,
        ask: 'How would you know your reason was right, and not just lucky?',
        chips: ['Check my prediction at earnings', 'If the stock goes up', 'Not sure'],
        followup: `Check the prediction at earnings. You wrote down a number about the business. If the business did what you said, your reasoning worked, whatever the stock did. That's why the game scores the prediction, not just the price.`,
      }
    case 'sector-yardsticks': {
      const v = lensValues(c)[0]
      return {
        line: l
          ? `For ${sector}, investors look at ${l.look_first.toLowerCase()} first${l.then[0] ? `, then ${l.then[0].toLowerCase()}` : ''}. ${c.name}'s ${l.look_first.toLowerCase()}: ${v ? `${v.value}${v.sub ? ` (${v.sub})` : ''}` : 'is on the company page'}.`
          : `Different businesses are judged by different numbers. ${c.name}'s company page shows which ones matter for its kind of business.`,
        ask: "Why not just use P/E for every company?",
        chips: ['Different businesses make money differently', 'P/E works for everything', 'Not sure'],
        followup: `Different businesses make money differently. A P/E tells you little about a bank or a money-losing startup, and nothing about whether a retailer's existing stores are growing. Use the yardstick that fits the business.`,
      }
    }
    case 'peg-ratio': {
      if (pe === null || c.revenueGrowth <= 0) {
        return {
          line: pe === null ? `${c.name} has no P/E (no profit yet), so there's no PEG either. PEG needs both a P/E and a growth rate.` : `${c.name}'s sales shrank ${Math.abs(c.revenueGrowth)}% last year, so a PEG doesn't work: you can't divide by negative growth.`,
          ask: 'What would you look at instead?',
          chips: ['Whether sales start growing', 'Just the P/E', 'Not sure'],
          followup: `Whether sales start growing, and whether losses shrink. PEG is for companies that are both profitable and growing. When one of those is missing, say so in your report.`,
        }
      }
      const peg = pe / c.revenueGrowth
      return {
        line: `${c.name}'s P/E is ${peText} and revenue grew ${c.revenueGrowth}% last year. Divide them and you get a PEG of about ${peg.toFixed(1)}. Around 1 means you pay about one point of P/E for each point of growth; over 2 is paying a lot for the growth.`,
        ask: `Is ${c.name}'s price fair for how fast it's growing?`,
        chips: peg < 1.2 ? ['Fair, or even cheap', 'Expensive', 'Not sure'] : ['Expensive', 'Fair', 'Not sure'],
        followup: peg < 1.2
          ? `By this yardstick it looks fair or cheap: the growth covers the price. The catch is that last year's growth has to continue. Say in your report what keeps it going.`
          : `By this yardstick it's expensive: buyers are paying more than the growth alone explains. That can be fine if growth speeds up or margins rise. Say which one you expect.`,
      }
    }
    case 'price-to-book':
      return {
        line: `Price-to-book compares a company's market cap with what it owns minus what it owes. It's the yardstick for banks and insurers, because their earnings jump around. ${c.name} isn't one, so P/E and growth tell you more here.`,
        ask: 'Why use a different yardstick for a bank?',
        chips: ['Its profits swing a lot', "Banks don't have profits", 'Not sure'],
        followup: `Its profits swing a lot, so a single year's P/E can mislead. What a bank owns is steadier. For ${c.name}, note in your report which yardsticks you used and why.`,
      }
    case 'return-on-equity-roic':
      return {
        line: `Return on equity asks how much profit a company earns each year for every $1 shareholders have put in. The prototype doesn't show it yet; ${c.name}'s margin (${cents(c)} of each $1 of sales) is the nearest clue to how efficient it is.`,
        ask: 'Two companies earn $1B. One needed $5B to do it, the other $20B. Which is the better business?',
        chips: ['The one that needed $5B', 'The one that needed $20B', "Same, they both earn $1B"],
        followup: `The one that needed $5B. It earns the same profit from a quarter of the money, so it can grow with less. That's return on equity, and it's why two companies with the same profit can deserve very different prices.`,
      }
    case 'rule-of-40': {
      const sum = c.revenueGrowth + c.fcfMargin
      return {
        line: `Rule of 40 is a quick test for software companies: add the growth rate to the profit (free cash flow) margin. ${c.name}: ${c.revenueGrowth}% growth + ${c.fcfMargin}% margin = ${sum}. Over 40 is strong.`,
        ask: `Is ${c.name} above the line?`,
        chips: sum >= 40 ? ['Yes, comfortably', 'No', 'What does it mean?'] : ['No, below it', 'Yes', 'What does it mean?'],
        followup: sum >= 40
          ? `Yes, ${sum} is above 40. It can grow fast and still make real cash, which is rare. The question for your report: can it keep both numbers up as it gets bigger?`
          : `No, ${sum} is below 40. It's trading off growth and profit without excelling at either right now. ${c.lens !== 'Software' ? `And ${c.name} isn't software, so this test fits it loosely anyway.` : 'Say in your report which of the two you think improves.'}`,
      }
    }
    case 'earnings-growth-vs-multiple-expansion':
      return {
        line: `${c.name}'s stock went ${signedPct(yr)} over the past year, while revenue grew ${c.revenueGrowth}%. ${yr > c.revenueGrowth + 5 ? "The gap is mostly buyers paying a higher P/E for each $1 of profit, not the business growing. That's called multiple expansion." : yr < c.revenueGrowth - 5 ? 'The business grew faster than the stock, so buyers are paying a lower P/E than a year ago.' : 'The stock roughly tracked the business, so buyers are paying about the same P/E as a year ago.'}`,
        ask: 'Which part can keep repeating year after year: profit growth, or people paying more for each $1 of profit?',
        chips: ['Profit growth', 'Paying more per $1', 'Both forever'],
        followup: `Profit growth. A P/E can't rise forever; eventually buyers stop paying more, and the P/E can fall right back. Gains from the business growing are the ones that last. In your report, say which one you expect.`,
      }
    case 'peak-cycle-earnings':
      return {
        line: `${c.name}'s P/E is ${peText ?? 'not available'}. For companies whose profits swing with the economy (chips, airlines, oil, homebuilders), a low P/E can be a trap: profits are at a peak, so the stock looks cheap right before profits fall.`,
        ask: `Is ${c.name}'s profit at a high point right now, or a normal year?`,
        chips: ['A high point', 'A normal year', 'Not sure'],
        followup: `There's no sure answer, which is the point. Ask: did profits jump recently because of something temporary, like a shortage or a boom? If so, "cheap" can be an illusion. Say in your report what a normal year's profit would look like.`,
      }
    default: {
      const k = concept(slug)
      return {
        line: k.kid_explanation,
        ask: k.coach_questions[0] ?? `How does ${k.name.toLowerCase()} apply to ${c.name}?`,
        chips: ['Tell me more', 'Not sure'],
        followup: k.whats_normal ?? k.example ?? `Look at ${c.name}'s company page and find the number that fits.`,
      }
    }
  }
}
