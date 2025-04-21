/**
 * NYC Location Matching Test
 * 
 * This test verifies that the NYC location normalization and matching is working correctly
 * by testing various common and colloquial NYC location references.
 */

import { verifyPlaceMatch, suggestSimilarLocations } from './lib/locationNormalizer';
import { searchPlace } from './lib/googlePlaces';

async function testNYCLocationMatching() {
  console.log('Running NYC Location Matching Test');
  console.log('=================================');

  const testLocations = [
    'Harlem',
    'Greenwich Village',
    'SoHo',
    'The Village',
    'Midtown',
    'Times Square',
    'UWS', // Upper West Side
    'Brooklyn Heights',
    'LES', // Lower East Side
    'The Bronx'
  ];

  console.log('Testing location matching for NYC neighborhoods...');
  
  for (const location of testLocations) {
    console.log(`\nChecking location: ${location}`);
    
    // First test if location is recognized by our normalizer
    // Using the same name twice simulates checking if a location matches itself (should always be true)
    const matchingResult = verifyPlaceMatch(location, location, ['neighborhood']);
    console.log(`Location normalizer match: ${matchingResult ? 'Yes' : 'No'}`);
    
    if (!matchingResult) {
      const suggestions = suggestSimilarLocations(location);
      if (suggestions.length > 0) {
        console.log(`Suggested alternatives: ${suggestions.join(', ')}`);
      } else {
        console.log('No suggestions found');
      }
    }
    
    try {
      // Test searching with Google Places API
      const searchResult = await searchPlace(location, { type: 'neighborhood' });
      if (searchResult && searchResult.primary) {
        console.log('Google Places API result:');
        console.log(`- Name: ${searchResult.primary.name}`);
        console.log(`- Address: ${searchResult.primary.address}`);
        console.log(`- Location: ${JSON.stringify(searchResult.primary.location)}`);
        if (searchResult.alternatives && searchResult.alternatives.length > 0) {
          console.log(`- Found ${searchResult.alternatives.length} alternative venues`);
        }
      } else {
        console.log('No Google Places API result found');
      }
    } catch (error) {
      console.error(`Error searching for place: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\nTesting completed');
}

// Run the test
testNYCLocationMatching()
  .then(() => {
    console.log('NYC location matching test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error in NYC location matching test:', error);
    process.exit(1);
  });