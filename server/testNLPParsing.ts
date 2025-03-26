import { parseItineraryRequest } from './lib/nlp';

async function testVagueActivityParsing() {
  // Test scenarios with vague activities
  const testQueries = [
    // Clear test case with 3 distinct activities including vague one
    "I want brunch in Soho at 10am, then coffee in Covent Garden at 1pm, and afterwards do something nice in the area",
    
    // Test with explicit times but vague activities
    "Visit Green Park at 9am, then around 12 I need to do something in Mayfair, and at 3pm visit a museum",
    
    // Test with relative time references
    "Start in Camden in the morning, then in the afternoon explore Shoreditch, and in the evening do something fun in Soho",
    
    // Test with mixing specific and vague activities
    "Breakfast at The Wolseley at 9am, then spend the afternoon exploring the area, finally dinner at 7pm in Mayfair"
  ];
  
  console.log("=== TESTING VAGUE ACTIVITY PARSING ===\n");
  
  for (const query of testQueries) {
    try {
      console.log(`\nTesting query: "${query}"`);
      const result = await parseItineraryRequest(query);
      
      console.log(`Found ${result.fixedTimes.length} activities:`);
      result.fixedTimes.forEach((activity, i) => {
        console.log(`  ${i+1}. [${activity.time}] ${activity.type || 'activity'} in ${activity.location}`);
      });
      
      // Check if we have at least 3 activities for queries with 3 distinct time references
      if (query.split(/then|afterwards|finally|and/).length >= 3 && result.fixedTimes.length < 3) {
        console.error(`❌ FAILED: Expected at least 3 activities, but only found ${result.fixedTimes.length}`);
      } else {
        console.log(`✅ PASSED: Found correct number of activities`);
      }
      
      console.log("\nFull result:", JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error(`❌ ERROR: ${error.message}`);
    }
  }
}

async function testSpecificExample() {
  const query = "I would like to go to Mayfair for brunch with a friend around 12:30 -- please find a nice place. Then around 3 l will go to Islington and would like to have a coffee. Afterwards around 5, I would like to do something nice in the area";
  
  console.log("=== TESTING SPECIFIC EXAMPLE ===");
  console.log(`Query: "${query}"`);
  
  try {
    const result = await parseItineraryRequest(query);
    console.log(`Found ${result.fixedTimes.length} activities:`);
    result.fixedTimes.forEach((activity, i) => {
      console.log(`  ${i+1}. [${activity.time}] ${activity.type || 'activity'} in ${activity.location}`);
    });
    
    // Verify we captured all three activities
    if (result.fixedTimes.length < 3) {
      console.error(`❌ FAILED: Expected 3 activities, but only found ${result.fixedTimes.length}`);
    } else {
      console.log(`✅ PASSED: Found all 3 activities`);
    }
    
    // Verify specific times
    const times = result.fixedTimes.map(ft => ft.time);
    const expectedTimes = ["12:30", "15:00", "17:00"];
    
    const missingTimes = expectedTimes.filter(time => !times.includes(time));
    if (missingTimes.length > 0) {
      console.error(`❌ FAILED: Missing activities at times: ${missingTimes.join(', ')}`);
    } else {
      console.log(`✅ PASSED: Found activities for all expected times`);
    }
    
    console.log("\nFull result:", JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error(`❌ ERROR: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  // For brevity, just run the specific example first 
  await testSpecificExample();
  console.log("\n" + "=".repeat(80) + "\n");
  await testVagueActivityParsing();
}

// Execute tests
runTests().catch(console.error);