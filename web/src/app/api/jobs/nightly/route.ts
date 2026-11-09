// Vercel Cron calls this after the close (vercel.ts). It also runs by hand:
// `curl -H "Authorization: Bearer $CRON_SECRET" .../api/jobs/nightly?step=prices`.
import { runNightly, STEP_NAMES, type StepName } from "@/jobs/nightly";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const stepParam = new URL(req.url).searchParams.get("step");
  const only = stepParam ? (stepParam.split(",").filter((s): s is StepName => (STEP_NAMES as readonly string[]).includes(s))) : undefined;
  if (stepParam && !only?.length) return Response.json({ error: `unknown step; one of ${STEP_NAMES.join(", ")}` }, { status: 400 });
  const result = await runNightly(only);
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
