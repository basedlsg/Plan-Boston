import { parseTimeExpression, expandRelativeTime, getDefaultTime } from './lib/languageProcessing';

/**
 * Comprehensive test for time parsing functions
 * Tests all the different time expression patterns we support
 */
function testTimeParsing() {
  // Basic time expressions
  const basicExpressions = [
    "morning",
    "afternoon",
    "evening",
    "9am",
    "10:30am",
    "2pm",
    "14:30",
    "noon",
    "midnight"
  ];
  
  // Time range expressions
  const rangeExpressions = [
    "between 2 and 4pm",
    "between 10am and 2pm",
    "from 10am to noon",
    "from 8pm to midnight",
    "from 9:30am to 12:00pm",
    "3-5pm",
    "9am-11am",
    "10:00-15:30"
  ];
  
  // Complex relative time expressions
  const complexRelativeExpressions = [
    "in the morning",
    "during the afternoon",
    "late evening",
    "early morning",
    "around noon",
    "at night",
    "after lunch",
    "before dinner",
    "midday",
    "at 3 o'clock",
    "tea time",
    "happy hour",
    "after work"
  ];
  
  console.log("--- Testing Basic Time Expression Parsing ---");
  for (const expr of basicExpressions) {
    const result = parseTimeExpression(expr);
    console.log(`"${expr}" → ${JSON.stringify(result)}`);
  }
  
  console.log("\n--- Testing Time Range Expression Parsing ---");
  for (const expr of rangeExpressions) {
    const result = parseTimeExpression(expr);
    console.log(`"${expr}" → ${JSON.stringify(result)}`);
  }
  
  console.log("\n--- Testing Complex Relative Time Expressions ---");
  for (const expr of complexRelativeExpressions) {
    const result = parseTimeExpression(expr);
    console.log(`"${expr}" → ${JSON.stringify(result)}`);
  }
  
  console.log("\n--- Testing Activity-Specific Default Times ---");
  const activities = [
    "breakfast",
    "lunch",
    "dinner",
    "coffee",
    "drinks",
    "shopping",
    "museum visit",
    "park walk",
    "gallery exhibition",
    "pub crawl",
    "nightclub",
    "bar hopping"
  ];
  
  for (const activity of activities) {
    const defaultTime = getDefaultTime(activity);
    console.log(`"${activity}" → "${defaultTime}"`);
  }

  console.log("\n--- Testing Time-of-Day Context Sensitivity ---");
  
  // Test morning defaults (8am)
  const morningDate = new Date();
  morningDate.setHours(8, 0, 0);
  console.log("Morning (8am) defaults:");
  for (const activity of activities.slice(0, 5)) { // Just test a subset
    const defaultTime = getDefaultTime(activity, morningDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }

  // Test afternoon defaults (2pm)
  const afternoonDate = new Date();
  afternoonDate.setHours(14, 0, 0);
  console.log("\nAfternoon (2pm) defaults:");
  for (const activity of activities.slice(0, 5)) {
    const defaultTime = getDefaultTime(activity, afternoonDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }

  // Test evening defaults (7pm)
  const eveningDate = new Date();
  eveningDate.setHours(19, 0, 0);
  console.log("\nEvening (7pm) defaults:");
  for (const activity of activities.slice(0, 5)) {
    const defaultTime = getDefaultTime(activity, eveningDate);
    console.log(`"${activity}" → "${defaultTime}"`);
  }
  
  // Test specific edge cases
  console.log("\n--- Testing Edge Cases ---");
  const edgeCases = [
    "at 12pm", // noon in 12-hour format
    "12am",    // midnight in 12-hour format
    "00:00",   // midnight in 24-hour format
    "24:00",   // invalid but possible user input
    "from 11pm to 1am", // crossing midnight
    "11:59pm"  // just before midnight
  ];
  
  for (const expr of edgeCases) {
    const result = parseTimeExpression(expr);
    console.log(`"${expr}" → ${JSON.stringify(result)}`);
  }
}

testTimeParsing();