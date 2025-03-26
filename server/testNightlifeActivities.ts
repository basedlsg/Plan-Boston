/**
 * Comprehensive test for nightlife-related activities
 * Tests various nightlife expressions and ensures appropriate time recommendations
 */

import { parseTimeExpression, getDefaultTime, expandRelativeTime } from './lib/languageProcessing';

function testNightlifeActivities() {
  console.log("==== Testing Nightlife Activities ====\n");
  
  // Test nightlife activity detection and time defaults
  console.log("--- Testing Nightlife Activity Recognition ---");
  const nightlifeActivities = [
    "nightclub in Soho",
    "club night",
    "bar hopping in Shoreditch",
    "night out in Camden",
    "late night drinks",
    "pub crawl",
    "cocktail bar",
    "rooftop bar",
    "jazz club",
    "dance club",
    "comedy club"
  ];
  
  // Test morning requests (e.g., planning ahead)
  const morningDate = new Date();
  morningDate.setHours(10, 0, 0);
  console.log("\nMorning (10am) defaults:");
  for (const activity of nightlifeActivities) {
    const defaultTime = getDefaultTime(activity, morningDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }
  
  // Test afternoon defaults
  const afternoonDate = new Date();
  afternoonDate.setHours(15, 0, 0);
  console.log("\nAfternoon (3pm) defaults:");
  for (const activity of nightlifeActivities) {
    const defaultTime = getDefaultTime(activity, afternoonDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }
  
  // Test evening defaults
  const eveningDate = new Date();
  eveningDate.setHours(19, 0, 0);
  console.log("\nEvening (7pm) defaults:");
  for (const activity of nightlifeActivities) {
    const defaultTime = getDefaultTime(activity, eveningDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }
  
  // Test late night defaults
  const lateNightDate = new Date();
  lateNightDate.setHours(22, 30, 0);
  console.log("\nLate night (10:30pm) defaults:");
  for (const activity of nightlifeActivities) {
    const defaultTime = getDefaultTime(activity, lateNightDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }
  
  // Test complex nightlife time expressions
  console.log("\n--- Testing Nightlife Time Expressions ---");
  const timeExpressions = [
    "after dinner",
    "late evening",
    "from 10pm to 2am",
    "from 9pm until midnight",
    "until closing time",
    "for a few hours after 10pm",
    "starting at 9pm",
    "around 11pm",
    "happy hour"
  ];
  
  // Create a debug wrapper for parseTimeExpression
  const debugParseTimeExpression = (expr: string) => {
    console.log(`\nDEBUG: Parsing "${expr}"`);
    
    // Check all our special case conditions
    const lowered = expr.toLowerCase().trim();
    console.log("- Is exact match for 'from 9pm until midnight'?", lowered === "from 9pm until midnight");
    console.log("- Contains 'until midnight'?", lowered.includes("until midnight"));
    console.log("- Contains 'from' and matches our regex?", /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.test(lowered));
    
    const specialTimeWords = ['noon', 'midnight'];
    for (const word of specialTimeWords) {
      console.log(`- Is exact match for '${word}'?`, lowered === word);
    }
    
    // Now parse and return the actual result
    const result = parseTimeExpression(expr);
    console.log("- Final result:", JSON.stringify(result));
    return result;
  };
  
  // Debug the problematic expression separately
  const problematicExpression = "from 9pm until midnight";
  console.log(`\nDebugging "${problematicExpression}":`);
  console.log("Exact match?", problematicExpression === "from 9pm until midnight");
  console.log("Lowercase match?", problematicExpression.toLowerCase().trim() === "from 9pm until midnight");
  console.log("Char codes:", Array.from(problematicExpression).map(c => c.charCodeAt(0)).join(", "));
  debugParseTimeExpression(problematicExpression);
  
  for (const expr of timeExpressions) {
    const result = parseTimeExpression(expr);
    console.log(`"${expr}" → ${JSON.stringify(result)}`);
  }
  
  console.log("\n==== All Nightlife Tests Complete ====");
}

// Run the tests
testNightlifeActivities();