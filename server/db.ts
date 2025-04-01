import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { runMigrations } from './migrations/aiLogging';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const MAX_RETRIES = 10;
const RETRY_DELAY = 5000; // 5 seconds

async function connectToDatabase() {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      return { pool, db: drizzle({ client: pool, schema }) };
    } catch (error) {
      console.error(`Failed to connect to database (attempt ${retries + 1}/${MAX_RETRIES}): ${error.message}`);
      retries++;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  throw new Error(`Failed to connect to database after ${MAX_RETRIES} attempts.`);
}


(async () => {
  try {
    const { pool, db } = await connectToDatabase();
    console.log('Running database migrations...');
    await runMigrations(db);
    console.log('Database migrations complete.');
    // Export the connected pool and db instances
    export { pool, db };

  } catch (error) {
    console.error('Error running database migrations or connecting to database:', error);
    process.exit(1); // Exit with an error code
  }
})();