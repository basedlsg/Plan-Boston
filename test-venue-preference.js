// A simple test script to verify venue preference extraction

// Test queries with venue preferences
const testQueries = [
  "I want breakfast at a traditional Jewish deli in Midtown",
  "I'd like to visit a hipster art gallery in Chelsea in the afternoon",
  "Take me to an authentic Italian restaurant in Little Italy for dinner",
  "I want to grab coffee at a specialty coffee shop in Greenwich Village",
  "Find me a trendy rooftop bar in the East Village for drinks tonight"
];

// Function to run the tests
async function runTests() {
  console.log("=== VENUE PREFERENCE EXTRACTION TEST ===");
  console.log("Testing with the following queries:");
  testQueries.forEach((q, i) => console.log(`${i+1}. ${q}`));
  console.log("\nResults:");

  // Run each test query
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n--- Test ${i+1}: "${query}" ---`);
    
    try {
      const response = await fetch('http://localhost:5000/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      if (!response.ok) {
        console.error(`Error response: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Display the results for each test
      if (data && data.places && data.places.length > 0) {
        console.log(`✅ Found ${data.places.length} places in response`);
        
        data.places.forEach(place => {
          console.log(`Place: ${place.name} (${place.address})`);
          console.log(`Types: ${place.details.types.join(', ')}`);
          console.log(`Rating: ${place.details.rating}`)
          
          // Show alternative venues
          if (place.alternatives && place.alternatives.length > 0) {
            console.log(`Alternatives: ${place.alternatives.map(a => a.name).join(', ')}`);
          }
        });
      } else {
        console.log("❌ No places found in response");
      }
    } catch (error) {
      console.error(`Error testing query "${query}": ${error.message}`);
    }
  }
}

// Run the tests
runTests().catch(console.error);