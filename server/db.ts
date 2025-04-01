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

// Initialize pool and db instances
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

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