import { count } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, withVerifiedSsl } from "@/db";
import { appEvents } from "@/db/schema";
import { logEvent } from "@/lib/events";

describe("database", () => {
  beforeAll(() => dbReady);

  it("applies the migrations and accepts an event", async () => {
    await logEvent({ level: "warn", kind: "test.event", message: "hello", detail: { n: 1 } });
    const [row] = await db.select({ n: count() }).from(appEvents);
    expect(row.n).toBe(1);
    const [event] = await db.select().from(appEvents);
    expect(event.kind).toBe("test.event");
    expect(event.detail).toEqual({ n: 1 });
  });

  it("has Better Auth's tables", async () => {
    const schema = await import("@/db/schema");
    expect(schema.user).toBeDefined();
    expect(schema.session).toBeDefined();
    expect(schema.verification).toBeDefined();
  });

  it("upgrades Neon's sslmode to verify-full and leaves local URLs alone", () => {
    expect(withVerifiedSsl("postgres://u:p@h/db?sslmode=require")).toBe("postgres://u:p@h/db?sslmode=verify-full");
    expect(withVerifiedSsl("postgres://u:p@h/db?sslmode=disable")).toBe("postgres://u:p@h/db?sslmode=disable");
    expect(withVerifiedSsl(undefined)).toBeUndefined();
  });
});

describe("financials upsert", () => {
  beforeAll(() => dbReady);

  it("keeps earlier numbers when a later run has none for that column", async () => {
    const { upsertFinancials } = await import("@/jobs/nightly");
    const { financials } = await import("@/db/schema");
    await upsertFinancials([{ cik: 1, period: "CY2026Q3", periodEnd: "2026-09-30", revenue: 100, netIncome: 10 }]);
    await upsertFinancials([{ cik: 1, period: "CY2026Q3", netIncome: 12, cash: 5 }]);
    const [row] = await db.select().from(financials);
    expect(row.revenue).toBe(100);
    expect(row.netIncome).toBe(12);
    expect(row.cash).toBe(5);
    expect(row.periodEnd).toBe("2026-09-30");
  });
});
