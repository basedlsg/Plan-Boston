/**
 * Boston Location Matching Test
 * 
 * This test verifies that the Boston location normalization and matching is working correctly
 * by testing various common and colloquial Boston location references.
 */

import { normalizeLocationName, verifyPlaceMatch, suggestSimilarLocations } from './lib/bostonLocationNormalizer';

async function testBostonLocationMatching() {
  console.log('Running Boston Location Matching Test');
  
  // Test basic normalization
  const basicTests = [
    { input: 'back bay', expected: 'Back Bay' },
    { input: 'BEACON HILL', expected: 'Beacon Hill' },
    { input: 'north end', expected: 'North End' },
    { input: 'Fenway', expected: 'Fenway' },
    { input: 'harvard square', expected: 'Harvard Square' },
    { input: 'seaport', expected: 'Seaport' },
    { input: 'downtown boston', expected: 'Downtown' },
    { input: 'south station', expected: 'South Station' }
  ];
  
  for (const test of basicTests) {
    const result = normalizeLocationName(test.input);
    console.log(`"${test.input}" -> "${result}"`);
    
    if (result !== test.expected) {
      console.error(`❌ Failed: "${test.input}" normalized to "${result}", expected "${test.expected}"`);
    }
  }
  
  console.log('Testing location matching for Boston neighborhoods...');
  
  // Test location matching
  const matchTests = [
    { 
      location: 'Back Bay', 
      returned: 'Back Bay Inn, Boston, MA', 
      types: ['lodging'], 
      expected: true 
    },
    { 
      location: 'north end', 
      returned: 'North End, Boston, MA', 
      types: ['sublocality_level_1', 'sublocality', 'political'], 
      expected: true 
    },
    { 
      location: 'Fenway', 
      returned: 'Fenway Park', 
      types: ['stadium'], 
      expected: true 
    },
    { 
      location: 'harvard square', 
      returned: 'Harvard Square, Cambridge, MA', 
      types: ['neighborhood'], 
      expected: true 
    },
    { 
      location: 'Boston Common', 
      returned: 'Boston Public Garden', 
      types: ['park'], 
      expected: false 
    }
  ];
  
  for (const test of matchTests) {
    const result = verifyPlaceMatch(test.location, test.returned, test.types);
    console.log(`Match "${test.location}" to "${test.returned}" (${test.types.join(', ')}) -> ${result}`);
    
    if (result !== test.expected) {
      console.error(`❌ Failed match test: "${test.location}" to "${test.returned}" returned ${result}, expected ${test.expected}`);
    }
  }
}

testBostonLocationMatching()
  .then(() => {
    console.log('Boston location matching test completed successfully');
  })
  .catch((error) => {
    console.error('Error in Boston location matching test:', error);
    process.exit(1);
  }); 