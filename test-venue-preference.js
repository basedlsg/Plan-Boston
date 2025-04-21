// A simple test script to verify venue preference extraction

// Test queries with venue preferences
const testQueries = [
  // Test 1: Traditional Jewish deli (specific cuisine + venue type)
  "I want breakfast at a traditional Jewish deli in Midtown",
  
  // Test 2: Hipster art gallery (ambiance + venue type)
  "I'd like to visit a hipster art gallery in Chelsea in the afternoon",
  
  // Test 3: Authentic Italian restaurant (authenticity + cuisine)
  "Take me to an authentic Italian restaurant in Little Italy for dinner",
  
  // Test 4: Specialty coffee shop (quality descriptor + venue type)
  "I want to grab coffee at a specialty coffee shop in Greenwich Village",
  
  // Test 5: Trendy rooftop bar (ambiance + specific venue subtype)
  "Find me a trendy rooftop bar in the East Village for drinks tonight",
  
  // Test 6: Famous bagel shop (reputation + specific food item + venue type)
  "I want to get a famous NY bagel from an authentic Jewish deli in Lower East Side",
  
  // Test 7: Multiple venue preferences
  "I want breakfast at a famous Jewish deli in Lower East Side and then visit a hipster coffee shop in Williamsburg"
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
        
        data.places.forEach((place, idx) => {
          // Add numbering for multiple places
          const placePrefix = data.places.length > 1 ? `[${idx+1}] ` : '';
          console.log(`${placePrefix}Place: ${place.name} (${place.address})`);
          console.log(`${placePrefix}Types: ${place.details.types.join(', ')}`);
          console.log(`${placePrefix}Rating: ${place.details.rating}`);
          
          // Show alternative venues - these demonstrate that the venue preference is working
          if (place.alternatives && place.alternatives.length > 0) {
            console.log(`${placePrefix}Alternatives: ${place.alternatives.map(a => a.name).join(', ')}`);
          } else {
            console.log(`${placePrefix}Alternatives: None found`);
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