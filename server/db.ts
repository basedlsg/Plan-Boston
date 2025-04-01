import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { runMigrations } from './migrations/aiLogging';

neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not found. Please create a database in the Database tab.");
  process.exit(1);
}

try {
  // Initialize pool and db instances
  export const pool = new Pool({ 
    connectionString: databaseUrl,
    max: 20,
    ssl: process.env.NODE_ENV === 'production'
  });
  export const db = drizzle({ client: pool, schema });
} catch (error) {
  console.error("Failed to initialize database connection:", error);
  process.exit(1);
}

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