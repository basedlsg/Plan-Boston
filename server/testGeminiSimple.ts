/**
 * Simple test for Gemini processor 
 * Tests a single query to verify functionality
 */

import { config } from './config';
import processWithGemini from './lib/geminiProcessor';

async function testSimpleGeminiProcessor() {
  // Initialize config
  config.initialize();
  console.log('=== Testing Simple Gemini Processor ===\n');

  // Test a simple query
  const simpleQuery = "I want to have dinner in Soho at 8pm";
  console.log(`Testing simple query: "${simpleQuery}"`);
  
  const simpleResult = await processWithGemini(simpleQuery);
  console.log('Simple Result:', JSON.stringify(simpleResult, null, 2));
  
  // Test a complex query
  const complexQuery = "I'd like to start with breakfast in Covent Garden around 9am, then visit a museum in South Kensington, and finally have dinner somewhere nice in Mayfair, preferably Italian.";
  console.log(`\nTesting complex query: "${complexQuery}"`);
  
  const complexResult = await processWithGemini(complexQuery);
  console.log('Complex Result:', JSON.stringify(complexResult, null, 2));
  
  if (simpleResult && complexResult) {
    console.log('\n✅ Test passed - Successfully processed all queries');
    return true;
  } else {
    console.log('\n❌ Test failed - Could not process one or more queries');
    return false;
  }
}

// Run the test
testSimpleGeminiProcessor()
  .then(() => console.log('Test finished'))
  .catch(err => console.error('Test error:', err));