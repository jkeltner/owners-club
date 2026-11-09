// The app's tables. Game tables land phase by phase (docs/build_plan.md, "Data
// model"); phase 0 has only sign-in and monitoring. Better Auth's tables are
// generated into auth_schema.ts by `npm run auth:generate`.
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export * from "./auth_schema";

export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export type EventLevel = "info" | "warn" | "error";

// Monitoring: server errors, failed jobs, model errors, rejected trades. Read by
// the daily ops routine. Messages and metadata only, never a player's words.
export const appEvents = pgTable(
  "app_events",
  {
    id: id(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    level: text("level").$type<EventLevel>().notNull(),
    // "server.render", "job.nightly", "coach.model", "trade.rejected", ...
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    path: text("path"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (t) => [index("app_events_at_idx").on(t.at), index("app_events_kind_idx").on(t.kind, t.at)],
);
