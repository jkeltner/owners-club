// Loads .env.local for scripts. Imported first, because ES module imports are
// hoisted and the database module reads DATABASE_URL when it loads.
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
