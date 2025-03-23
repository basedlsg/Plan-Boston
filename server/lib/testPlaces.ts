
import { searchPlace } from './googlePlaces';

async function testLandmarks() {
  const landmarks = [
    'Green Park',
    'Green Park, London',
    'Green Park, London, UK',
    'Tower Bridge',
    'Tower Bridge, London',
    'Big Ben', // Control case that usually works well
  ];

  console.log('Testing landmark queries...\n');

  for (const landmark of landmarks) {
    console.log(`Testing query: "${landmark}"`);
    const result = await searchPlace(landmark, {});
    console.log('Success:', !!result);
    console.log('Details:', result ? {
      name: result.name,
      address: result.formatted_address,
      types: result.types
    } : 'No results\n');
  }
}

testLandmarks().catch(console.error);
