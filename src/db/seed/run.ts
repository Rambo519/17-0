import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const { createDatabase } = await import("@/db/client");
const { seedDevelopmentData } = await import("./seed");

const db = createDatabase();
const summary = await seedDevelopmentData(db);

console.log("Seeded development data:", summary);
process.exit(0);
