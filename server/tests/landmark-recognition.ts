import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { searchPlace } from '../lib/googlePlaces';
import * as fs from 'fs';

// ES Module compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test a variety of London landmarks and locations
const testLocations = [
  'Green Park',
  'Tower Bridge',
  'Buckingham Palace',
  'Fitzrovia',
  'Shoreditch',
  'Notting Hill',
  'Borough Market',
  'Covent Garden',
  'Oxford Street',
  'Piccadilly Circus'
];

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = join(logsDir, 'location-tests.json');

async function runTests() {
  const results = [];

  for (const location of testLocations) {
    console.log(`Testing location: ${location}`);
    const startTime = Date.now();

    try {
      const result = await searchPlace(location, {});
      const endTime = Date.now();

      const testResult = {
        timestamp: new Date().toISOString(),
        query: location,
        success: !!result,
        executionTimeMs: endTime - startTime,
        errorMessage: null,
        placeDetails: result ? {
          name: result.name,
          formatted_address: result.formatted_address,
          location: result.geometry?.location,
          types: result.types
        } : null
      };

      results.push(testResult);
      console.log(`Result: ${testResult.success ? 'SUCCESS' : 'FAILED'}`);

    } catch (error: any) {
      const endTime = Date.now();
      const testResult = {
        timestamp: new Date().toISOString(),
        query: location,
        success: false,
        executionTimeMs: endTime - startTime,
        errorMessage: error.message,
        placeDetails: null
      };

      results.push(testResult);
      console.log(`Error testing ${location}: ${error.message}`);
    }
  }

  // Save results to log file
  let existingLogs = [];
  try {
    if (fs.existsSync(logFile)) {
      existingLogs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading existing logs:', error);
  }

  existingLogs.push({
    testRun: new Date().toISOString(),
    results
  });

  fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));
  console.log(`Test results saved to ${logFile}`);

  // Summary
  const successCount = results.filter(r => r.success).length;
  console.log(`\nSummary: ${successCount}/${results.length} locations successfully recognized`);
}

runTests().catch(console.error);