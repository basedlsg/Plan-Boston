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
  
  for (const expr of timeExpressions) {
    const result = parseTimeExpression(expr);
    console.log(`"${expr}" → ${JSON.stringify(result)}`);
  }
  
  console.log("\n==== All Nightlife Tests Complete ====");
}

// Run the tests
testNightlifeActivities();