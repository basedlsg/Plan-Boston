/**
 * AI logging migrations
 * 
 * This file contains the database migrations for AI logging.
 */

import { db } from '../db';
import { aiInteractions } from '../lib/aiLogging';
import { sql } from 'drizzle-orm';

/**
 * Create a new table for AI interaction logs
 */
async function createAiInteractionsTable() {
  try {
    console.log("Creating AI interactions table...");
    
    // Execute the create table query
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_query TEXT NOT NULL,
        model_name TEXT NOT NULL,
        raw_request JSONB,
        raw_response TEXT,
        parsed_response JSONB,
        processing_time_ms INTEGER,
        status TEXT NOT NULL,
        error_details TEXT,
        parameters JSONB,
        meta_data JSONB
      )
    `);
    
    console.log("AI interactions table created successfully");
    return true;
  } catch (error) {
    console.error("Failed to create AI interactions table:", error);
    return false;
  }
}

async function runMigrations() {
  console.log("Running AI logging migrations...");
  
  try {
    // Create the table
    const success = await createAiInteractionsTable();
    
    if (success) {
      console.log("AI logging migrations completed successfully");
    } else {
      console.error("AI logging migrations failed");
    }
    
    return success;
  } catch (error) {
    console.error("Error in AI logging migrations:", error);
    return false;
  }
}

// Run migrations from the main application rather than directly
// This ensures compatibility with ESM modules

export { runMigrations, createAiInteractionsTable };