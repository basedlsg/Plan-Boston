
import { searchPlace } from './googlePlaces';

async function testLandmarks() {
  const testCases = [
    {
      name: 'Basic landmark query',
      query: 'Green Park',
      options: {}
    },
    {
      name: 'Full address query',
      query: 'Green Park, London, UK',
      options: {}
    },
    {
      name: 'Landmark with type',
      query: 'Green Park',
      options: { type: 'park' }
    },
    {
      name: 'Landmark with rating filter',
      query: 'Green Park',
      options: { minRating: 4.0 }
    },
    {
      name: 'Alternative landmark names',
      query: 'The Green Park',
      options: {}
    }
  ];

  console.log('Starting landmark recognition tests...\n');

  for (const test of testCases) {
    console.log(`\n=== Test Case: ${test.name} ===`);
    console.log(`Query: "${test.query}"`);
    console.log('Options:', test.options);
    
    try {
      const result = await searchPlace(test.query, test.options);
      console.log('Success:', !!result);
      console.log('Response:', result ? {
        name: result.name,
        formattedAddress: result.formatted_address,
        types: result.types,
        placeId: result.place_id,
        rating: result.rating,
        location: result.geometry?.location
      } : 'No results');
    } catch (error) {
      console.error('Error:', error.message);
    }
    console.log('===============================\n');
  }
}

testLandmarks().catch(console.error);
