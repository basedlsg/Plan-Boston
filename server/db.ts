
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { runMigrations } from './migrations/aiLogging';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not found. Please add the DATABASE_URL secret in the Deployments tab.");
  process.exit(1);
}

let pool: Pool;
let db: PostgresJsDatabase<typeof schema>;

try {
  // Initialize pool and db instances
  pool = new Pool({ 
    connectionString: databaseUrl,
    max: 20,
    ssl: process.env.NODE_ENV === 'production'
  });
  db = drizzle(pool, { schema });
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  process.exit(1);
}

// Export the initialized variables
export { pool, db };

// Run migrations in an async IIFE
(async () => {
  try {
    console.log('Running database migrations...');
    await runMigrations(db);
    console.log('Database migrations complete.');
  } catch (error) {
    console.error('Error running database migrations or connecting to database:', error);
    process.exit(1);
  }
})();
