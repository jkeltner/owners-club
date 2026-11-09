import { db } from "@/db";
import { appEvents, type EventLevel } from "@/db/schema";

export type AppEvent = {
  level: EventLevel;
  kind: string;
  message: string;
  path?: string;
  detail?: Record<string, unknown>;
};

/** Writes one monitoring event. Never throws: monitoring must not break the thing it watches. */
export async function logEvent(event: AppEvent) {
  try {
    await db.insert(appEvents).values(event);
  } catch (err) {
    console.error("[events] could not write event", event.kind, err);
  }
  if (event.level === "error") console.error(`[${event.kind}] ${event.message}`);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : JSON.stringify(err);
}

export function errorDetail(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return {};
  const detail: Record<string, unknown> = { name: err.name };
  if (err.stack) detail.stack = err.stack.split("\n").slice(0, 8).join("\n");
  if ("digest" in err) detail.digest = (err as { digest?: string }).digest;
  return detail;
}
