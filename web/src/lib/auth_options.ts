import type { BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { sendSignInCode } from "./email";

export const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// Google sign-in turns on when both credentials are set.
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Decided 2026-11-08: Google or an email one-time code, no passwords, no phone.
// Shared by the app (src/lib/auth.ts) and the schema generator
// (scripts/auth.config.ts), which runs without a database.
export function authOptions(database: BetterAuthOptions["database"]) {
  return {
    baseURL,
    database,
    emailAndPassword: { enabled: false },
    // The experience answer (new / some / lots) lives on the person, not the
    // membership: it follows them across clubs. Set by our own actions only.
    user: { additionalFields: { experience: { type: "string" as const, required: false, input: false } } },
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account" as const,
          },
        }
      : {},
    // Someone who joined with an email code can later use Google for the same address.
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        async sendVerificationOTP({ email, otp, type }) {
          await sendSignInCode(email, otp, type);
        },
      }),
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}
