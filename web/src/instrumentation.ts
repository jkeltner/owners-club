import type { Instrumentation } from "next";

export async function register() {
  // Migrations run before the server starts (scripts/dev.ts locally,
  // `npm run db:migrate` in the Vercel build).
}

// Every uncaught server error (pages, route handlers, server actions) lands in
// app_events for the ops routine.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // This file is also built for the Edge runtime, which can't load the database.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { errorDetail, errorMessage, logEvent } = await import("@/lib/events");
  await logEvent({
    level: "error",
    kind: `server.${context.routeType}`,
    message: errorMessage(err),
    // Query strings can carry sign-in codes and OAuth state; keep the path only.
    path: request.path.split("?")[0],
    detail: { ...errorDetail(err), method: request.method, route: context.routePath },
  });
};
