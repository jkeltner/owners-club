// Files ✎ notes from the hosted prototype as GitHub issues: one issue per
// tester per day, one comment per note. The token lives only in Vercel's
// environment (GITHUB_TOKEN, fine-grained, Issues: write on this repo).

declare const process: { env: Record<string, string | undefined> } // Node's, without needing @types/node here

const REPO = 'jkeltner/owners-club'
const LABEL = 'playtest-feedback'
const GH = `https://api.github.com/repos/${REPO}`

type Body = { tester?: unknown; issue?: unknown; note?: unknown; screen?: unknown; at?: unknown; context?: unknown }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

// Public issues: break @mentions so a note can't ping anyone, and keep the
// snapshot inside a code block.
const safe = (s: string) => s.replace(/@/g, '@​')
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)

export async function POST(req: Request): Promise<Response> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return json({ error: 'Feedback is not set up on this deployment.' }, 503)

  let b: Body
  try {
    b = (await req.json()) as Body
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const tester = typeof b.tester === 'string' && /^[a-z0-9]{4,12}$/.test(b.tester) ? b.tester : null
  const note = typeof b.note === 'string' ? b.note.trim() : ''
  if (!tester || !note) return json({ error: 'Bad request.' }, 400)
  const screen = typeof b.screen === 'string' ? clip(b.screen.replace(/[^\w-]/g, ''), 30) : 'unknown'
  const at = typeof b.at === 'number' ? new Date(b.at) : new Date()
  const context = Array.isArray(b.context)
    ? b.context.filter((c): c is string => typeof c === 'string').slice(0, 20).map((c) => clip(c, 300).replace(/`/g, "'"))
    : []

  const gh = (path: string, init?: RequestInit) =>
    fetch(`${GH}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    })

  // Reuse the tester's issue only if it's an open playtest issue.
  let issue: number | null = null
  if (typeof b.issue === 'number' && Number.isInteger(b.issue)) {
    const r = await gh(`/issues/${b.issue}`)
    if (r.ok) {
      const found = (await r.json()) as { state: string; labels: { name: string }[] }
      if (found.state === 'open' && found.labels.some((l) => l.name === LABEL)) issue = b.issue
    }
  }
  if (issue === null) {
    const day = at.toISOString().slice(0, 10)
    const r = await gh('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: `Playtest notes: tester ${tester}, ${day}`,
        body: `Notes from the ✎ button on the hosted prototype. Each comment is one note, with a snapshot of the game when it was written.\n\nTester \`${tester}\` is a random ID, not a name.`,
        labels: [LABEL],
      }),
    })
    if (!r.ok) return json({ error: 'Could not file the note.' }, 502)
    issue = ((await r.json()) as { number: number }).number
  }

  const time = at.toISOString().slice(11, 16)
  const comment = [
    `**${screen}** · ${time} UTC`,
    '',
    ...clip(safe(note), 4000).split('\n').map((l) => `> ${l}`),
    ...(context.length ? ['', '<details><summary>Game state</summary>', '', '```', ...context.map(safe), '```', '', '</details>'] : []),
  ].join('\n')
  const c = await gh(`/issues/${issue}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) })
  if (!c.ok) return json({ error: 'Could not file the note.' }, 502)
  return json({ issue })
}
