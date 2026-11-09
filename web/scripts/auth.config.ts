// Config for `npm run auth:generate`, which writes src/db/auth_schema.ts from
// Better Auth's options. Runs without a database.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authOptions } from "../src/lib/auth_options";

export const auth = betterAuth(authOptions(drizzleAdapter({}, { provider: "pg" })));
