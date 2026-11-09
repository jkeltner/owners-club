import { revalidatePath } from "next/cache";
import { runNightly, STEP_NAMES, type StepName } from "@/jobs/nightly";
import { getSession, isAdminEmail } from "@/lib/session";

async function run(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!isAdminEmail(session?.user.email)) throw new Error("Admins only");
  const step = String(formData.get("step"));
  await runNightly(step === "all" ? undefined : [step as StepName]);
  revalidatePath("/admin");
}

export function RunStepForm() {
  return (
    <form action={run} className="inline">
      <label>
        Run{" "}
        <select name="step" defaultValue="sp500">
          {STEP_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="all">all steps</option>
        </select>
      </label>{" "}
      <button className="button">Run now</button>
    </form>
  );
}
