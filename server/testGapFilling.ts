/**
 * Test file for the enhanced gap-filling logic
 * This tests the findInterestingActivities function with different parameters
 */

import { findInterestingActivities } from './routes';

function testGapFilling() {
  // Test cases with different parameters
  const testCases = [
    {
      location: "Covent Garden",
      duration: 1.5,
      timeOfDay: "10:30",
      preferences: { type: "cultural", requirements: ["indoor"] }
    },
    {
      location: "South Bank",
      duration: 2,
      timeOfDay: "14:00",
      preferences: { type: "relaxing", requirements: ["outdoor"] }
    },
    {
      location: "Soho",
      duration: 3,
      timeOfDay: "19:00",
      preferences: { type: "dining", requirements: ["lively"] }
    }
  ];
  
  console.log("--- Testing Gap Filling Logic ---");
  
  for (const test of testCases) {
    console.log(`\nScenario: ${test.duration} hours in ${test.location} at ${test.timeOfDay}`);
    console.log(`Preferences: ${test.preferences.type}, Requirements: [${test.preferences.requirements.join(', ')}]`);
    
    const suggestions = findInterestingActivities(
      test.location,
      test.duration,
      test.timeOfDay,
      test.preferences
    );
    
    if (suggestions.length === 0) {
      console.log(`❌ No activities suggested`);
    } else {
      console.log(`✅ Suggested activities (${suggestions.length}):`);
      suggestions.forEach((activity: string, i: number) => {
        console.log(`  ${i+1}. ${activity}`);
      });
    }
  }
  
  // Test time appropriateness
  console.log("\n--- Testing Time Appropriateness ---");
  const timeTests = [
    { time: "08:00", location: "King's Cross" },
    { time: "13:00", location: "Soho" },
    { time: "19:00", location: "Shoreditch" },
    { time: "22:00", location: "Soho" }
  ];
  
  for (const test of timeTests) {
    console.log(`\nAt ${test.time} in ${test.location}:`);
    const suggestions = findInterestingActivities(test.location, 1.5, test.time, {});
    if (suggestions.length > 0) {
      suggestions.forEach((suggestion: string, i: number) => {
        console.log(`  ${i+1}. ${suggestion}`);
      });
    } else {
      console.log(`❌ No activities suggested`);
    }
  }
  
  // Test meal-specific suggestions
  console.log("\n--- Testing Meal-Specific Suggestions ---");
  const mealTests = [
    { time: "09:00", location: "Chelsea", type: "breakfast" },
    { time: "13:00", location: "Covent Garden", type: "lunch" },
    { time: "19:30", location: "Mayfair", type: "dinner" }
  ];
  
  for (const test of mealTests) {
    console.log(`\n${test.type.charAt(0).toUpperCase() + test.type.slice(1)} at ${test.time} in ${test.location}:`);
    const suggestions = findInterestingActivities(
      test.location, 
      1.5, 
      test.time, 
      { type: test.type }
    );
    
    if (suggestions.length > 0) {
      suggestions.forEach((suggestion: string, i: number) => {
        console.log(`  ${i+1}. ${suggestion}`);
      });
    } else {
      console.log(`❌ No suggestions for ${test.type}`);
    }
  }
  
  // Test different durations
  console.log("\n--- Testing Duration-Based Suggestions ---");
  const durationTests = [
    { duration: 0.5, location: "Leicester Square", time: "15:00" },
    { duration: 1.5, location: "South Kensington", time: "11:00" },
    { duration: 3, location: "Camden", time: "14:00" }
  ];
  
  for (const test of durationTests) {
    console.log(`\nWith ${test.duration} hours available at ${test.time} in ${test.location}:`);
    const suggestions = findInterestingActivities(
      test.location, 
      test.duration, 
      test.time, 
      {}
    );
    
    if (suggestions.length > 0) {
      suggestions.forEach((suggestion: string, i: number) => {
        console.log(`  ${i+1}. ${suggestion}`);
      });
    } else {
      console.log(`❌ No suggestions for ${test.duration} hour duration`);
    }
  }
}

// Run the tests
testGapFilling();