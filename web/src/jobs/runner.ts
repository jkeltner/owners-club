// Runs a named job, records it in job_runs and logs a failure to app_events.
// Steps are idempotent, so a failed night is re-run by hand from the data page.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobRuns } from "@/db/schema";
import { errorMessage, logEvent } from "@/lib/events";

export type StepResult = Record<string, unknown>;
export type Step = { name: string; run: () => Promise<StepResult> };

export async function runJob(job: string, steps: Step[]) {
  const [run] = await db.insert(jobRuns).values({ job }).returning({ id: jobRuns.id });
  const summary: Record<string, StepResult | { error: string }> = {};
  let failed: string | null = null;
  for (const step of steps) {
    const started = Date.now();
    try {
      summary[step.name] = { ...(await step.run()), ms: Date.now() - started };
    } catch (err) {
      const message = errorMessage(err);
      summary[step.name] = { error: message, ms: Date.now() - started };
      failed = failed ? `${failed}; ${step.name}: ${message}` : `${step.name}: ${message}`;
      await logEvent({ level: "error", kind: `job.${job}.${step.name}`, message, detail: { runId: run.id } });
    }
  }
  await db.update(jobRuns).set({ finishedAt: new Date(), ok: !failed, summary, error: failed }).where(eq(jobRuns.id, run.id));
  return { id: run.id, ok: !failed, summary, error: failed };
}
