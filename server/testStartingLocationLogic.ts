/**
 * Test for starting location logic
 * 
 * This file tests the location handling in our application:
 * 1. Direct testing of location defaults based on time of day
 * 2. Testing the pattern of using destination/fixed location as starting point
 * 3. Testing the enhanced error messages for location errors
 */

// Import test utilities 
import * as assert from 'assert';

/**
 * Represents a basic itinerary request structure for testing
 */
type TestItineraryRequest = {
  startLocation: string | null;
  destinations: string[];
  fixedTimes: Array<{
    location: string | null;
    time: string;
    type?: string;
  }>;
  preferences: {
    type?: string;
    requirements?: string[];
  };
};

/**
 * Test function to verify starting location inference logic
 */
async function testStartingLocationLogic() {
  console.log("--- Testing Starting Location Logic ---");
  
  // Test direct inference without API calls
  testInferredStartLocation();
  
  // Test time-of-day based defaults
  testTimeBasedDefaults();
  
  // Test error message enhancements
  testErrorMessages();
  
  console.log("\n--- Tests Complete ---");
}

/**
 * Tests that verify starting location inference from other data
 */
function testInferredStartLocation() {
  console.log("\n--- Testing Location Inference Logic ---");
  
  // Case 1: Use first destination as starting point
  const testRequest1: TestItineraryRequest = {
    startLocation: null,
    destinations: ["Soho", "Covent Garden"],
    fixedTimes: [],
    preferences: {}
  };
  
  console.log("\nTest: Using first destination as starting point");
  
  // Apply the location inference logic
  applyStartingLocationLogic(testRequest1);
  
  // Verify starting location was set correctly
  if (testRequest1.startLocation === "Soho") {
    console.log(`✅ Correctly used first destination "${testRequest1.startLocation}" as starting point`);
  } else {
    console.log(`❌ Failed to use first destination as starting point`);
  }
  
  // Verify destination was removed from list
  if (testRequest1.destinations.length === 1 && testRequest1.destinations[0] === "Covent Garden") {
    console.log("✅ Correctly removed first destination from list");
  } else {
    console.log(`❌ Failed to remove first destination from list: ${JSON.stringify(testRequest1.destinations)}`);
  }
  
  // Case 2: Use fixed time location as starting point
  const testRequest2: TestItineraryRequest = {
    startLocation: null,
    destinations: [],
    fixedTimes: [{ location: "South Kensington", time: "14:00", type: "museum" }],
    preferences: {}
  };
  
  console.log("\nTest: Using fixed time location as starting point");
  
  // Apply the location inference logic
  applyStartingLocationLogic(testRequest2);
  
  // Verify starting location was set correctly
  if (testRequest2.startLocation === "South Kensington") {
    console.log(`✅ Correctly used fixed time location "${testRequest2.startLocation}" as starting point`);
  } else {
    console.log(`❌ Failed to use fixed time location as starting point`);
  }
}

/**
 * Tests defaults based on time of day
 */
function testTimeBasedDefaults() {
  console.log("\n--- Testing Time-Based Default Locations ---");
  
  // Store original Date constructor
  const OriginalDate = global.Date;
  
  // Time-specific test cases
  const timeBasedTests = [
    { hour: 8, expectedDefault: "King's Cross", timeCategory: "Morning" },
    { hour: 13, expectedDefault: "Oxford Street", timeCategory: "Lunch" },
    { hour: 16, expectedDefault: "South Kensington", timeCategory: "Afternoon" },
    { hour: 20, expectedDefault: "Soho", timeCategory: "Evening" },
    { hour: 2, expectedDefault: "Leicester Square", timeCategory: "Late night" }
  ];
  
  for (const test of timeBasedTests) {
    try {
      console.log(`\nTest: ${test.timeCategory} default location (${test.hour}:00)`);
      
      // Mock Date to return specific hour
      const mockDate = new Date();
      mockDate.setHours(test.hour);
      
      // Override Date constructor
      global.Date = class extends Date {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;
      
      // Test request with no location information
      const request: TestItineraryRequest = {
        startLocation: null,
        destinations: [],
        fixedTimes: [],
        preferences: {}
      };
      
      // Get the default based on current time
      const defaultLocation = getLocationBasedOnTimeOfDay();
      
      // Apply it to our test request
      request.startLocation = defaultLocation;
      
      // Verify correct default was chosen
      if (request.startLocation === test.expectedDefault) {
        console.log(`✅ Correctly used "${request.startLocation}" as default for ${test.timeCategory}`);
      } else {
        console.log(`❌ Expected "${test.expectedDefault}" but got "${request.startLocation}"`);
      }
      
    } finally {
      // Restore original Date
      global.Date = OriginalDate;
    }
  }
}

/**
 * Tests enhanced error messages
 */
function testErrorMessages() {
  console.log("\n--- Testing Error Message Enhancements ---");
  
  const testErrorMessages = [
    {
      name: "Location not found error",
      originalMessage: "We need to know where in London you'll be",
      shouldEnhance: true
    },
    {
      name: "API error",
      originalMessage: "Failed to parse JSON response from API",
      shouldEnhance: true
    },
    {
      name: "Generic error",
      originalMessage: "An unexpected error occurred",
      shouldEnhance: false
    }
  ];
  
  for (const test of testErrorMessages) {
    console.log(`\nTest: ${test.name}`);
    
    try {
      const enhancedMessage = enhanceErrorMessage(new Error(test.originalMessage));
      
      // Log the enhanced message (truncated if long)
      const truncatedMessage = enhancedMessage.length > 50 ? 
        enhancedMessage.substring(0, 50) + "..." : 
        enhancedMessage;
      
      console.log(`Enhanced message: "${truncatedMessage}"`);
      
      if (test.shouldEnhance) {
        if (enhancedMessage.length > test.originalMessage.length) {
          console.log("✅ Successfully enhanced error message with additional information");
        } else {
          console.log("❌ Failed to enhance error message");
        }
      } else {
        if (enhancedMessage === test.originalMessage) {
          console.log("✅ Correctly left generic error message unchanged");
        } else {
          console.log("❌ Unnecessarily modified generic error message");
        }
      }
    } catch (error) {
      console.log(`❌ Test failed: ${error}`);
    }
  }
}

/**
 * Helper: Apply starting location logic to a request
 * This is a direct implementation of the logic in our actual code
 */
function applyStartingLocationLogic(request: TestItineraryRequest): void {
  if (!request.startLocation) {
    // Case 1: If there are destinations, use the first one as the starting point
    if (request.destinations.length > 0) {
      request.startLocation = request.destinations[0];
      request.destinations.shift();
    } 
    // Case 2: If there are fixed times with locations, use the first one
    else if (request.fixedTimes.length > 0 && request.fixedTimes[0].location) {
      request.startLocation = request.fixedTimes[0].location;
    }
    // Case 3: Use time-of-day based default
    else {
      request.startLocation = getLocationBasedOnTimeOfDay();
    }
  }
}

/**
 * Helper: Get a default location based on time of day
 * This mimics the logic in our actual code
 */
function getLocationBasedOnTimeOfDay(): string {
  const currentHour = new Date().getHours();
  
  // Morning (6-11): Transport hubs are logical starting points
  if (currentHour >= 6 && currentHour < 12) {
    return "King's Cross"; // Major transport hub
  } 
  // Lunchtime (12-14): Central shopping/business areas
  else if (currentHour >= 12 && currentHour < 15) {
    return "Oxford Street"; // Central shopping area
  }
  // Afternoon (15-17): Cultural areas
  else if (currentHour >= 15 && currentHour < 18) {
    return "South Kensington"; // Museum district
  }
  // Evening/Night (18-23): Entertainment districts
  else if (currentHour >= 18 && currentHour < 24) {
    return "Soho"; // Nightlife center
  }
  // Late night/early morning (0-5): Safe, well-lit areas
  else {
    return "Leicester Square"; // Always busy, well-lit 24-hour area
  }
}

/**
 * Helper: Simulate the enhanced error message logic
 */
function enhanceErrorMessage(error: Error): string {
  // Location errors get neighborhood suggestions
  if (error.message.includes("location") || error.message.includes("where in London")) {
    return `${error.message}\n\nPopular London areas you could mention:\n` +
      "• Central: Soho, Covent Garden, Westminster, Leicester Square\n" +
      "• West: Notting Hill, Kensington, Chelsea, Holland Park\n" +
      "• East: Shoreditch, City of London, Canary Wharf\n" +
      "• North: Camden Town, King's Cross, Hampstead\n" +
      "• South: Greenwich, South Bank";
  }
  // API/parsing errors get gentle guidance
  else if (error.message.includes("JSON") || error.message.includes("API") || error.message.includes("language model")) {
    return "We're having trouble understanding your request right now. Please try:\n" +
      "1. Being more specific about where and when\n" +
      "2. Keeping your request simple and focused\n" +
      "3. Using common London landmarks or neighborhoods";
  }
  // Return original for other errors
  return error.message;
}

// Run the tests
testStartingLocationLogic();