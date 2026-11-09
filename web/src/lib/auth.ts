import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { authOptions } from "./auth_options";

export { baseURL } from "./auth_options";

export const auth = betterAuth(authOptions(drizzleAdapter(db, { provider: "pg", schema })));
