/**
 * Test file for Gemini processor with enhanced logging
 * Tests processing and logging functionality
 */

import { processWithGemini } from './lib/geminiProcessor';
import { db } from './db';
import { aiInteractions } from './lib/aiLogging';
import { config } from './config';
import { sql } from 'drizzle-orm';

// Initialize config
config.initialize();

async function testGeminiLogger() {
  console.log('Starting Gemini Logger test...');
  
  try {
    // Test with a simple query
    const query = "I want to spend a day in London. Start at 9am in Soho, have lunch in Shoreditch, and end with dinner in Covent Garden around 8pm.";

    console.log(`Testing Gemini processing with query: "${query}"`);
    
    // Process with Gemini
    const result = await processWithGemini(query);
    
    console.log('\n--- Gemini Processing Result ---');
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Processing failed or returned null');
    }
    
    // Fetch logs from database
    console.log('\n--- AI Interaction Logs ---');
    const logs = await db.select()
      .from(aiInteractions)
      .limit(5)
      .orderBy(sql`timestamp DESC`);
    
    console.log(`Found ${logs.length} log entries:`);
    for (const log of logs) {
      console.log(`\nLog ID: ${log.id}`);
      console.log(`Session: ${log.sessionId}`);
      console.log(`Timestamp: ${log.timestamp}`);
      console.log(`Status: ${log.status}`);
      console.log(`Query: ${log.userQuery}`);
      console.log(`Processing Time: ${log.processingTimeMs}ms`);
      
      if (log.errorDetails) {
        console.log(`Error: ${log.errorDetails}`);
      }
    }
    
  } catch (error) {
    console.error('Error in Gemini Logger test:', error);
  }
}

testGeminiLogger().then(() => {
  console.log('Test completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});