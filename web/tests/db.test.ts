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
