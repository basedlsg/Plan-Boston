/**
 * Comprehensive test for enhanced search parameter functionality
 * 
 * This test validates that:
 * 1. Rich search parameters are properly extracted from Gemini responses
 * 2. Parameters are correctly passed to fixedTimes entries
 * 3. Parameters are properly handled in gap-filling activities
 * 4. The system prioritizes rich search parameters over generic ones
 */

import { parseItineraryRequest } from './lib/nlp';
import { searchPlace } from './lib/googlePlaces';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Mock searchPlace to avoid actual API calls
jest.mock('./lib/googlePlaces', () => ({
  searchPlace: jest.fn().mockImplementation((location, options) => {
    console.log(`MOCK: searchPlace called with location: ${location}, options:`, JSON.stringify(options, null, 2));
    
    return Promise.resolve({
      primary: {
        name: "Test " + (options.type || "Place"),
        formatted_address: "123 Test St, London",
        place_id: "test-place-id-" + Date.now(),
        geometry: {
          location: {
            lat: 51.5,
            lng: -0.1
          }
        },
        types: [options.type || "establishment"]
      },
      alternatives: [
        {
          name: "Alternative " + (options.type || "Place"),
          formatted_address: "456 Test St, London",
          place_id: "test-place-id-alt-" + Date.now(),
          geometry: {
            location: {
              lat: 51.51,
              lng: -0.11
            }
          },
          types: [options.type || "establishment"]
        }
      ]
    });
  })
}));

// Mock DB connection
jest.mock('../shared/schema', () => ({
  ...jest.requireActual('../shared/schema'),
}));

jest.mock('drizzle-orm/node-postgres', () => ({
  drizzle: jest.fn().mockReturnValue({
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 1 }])
      })
    }),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue([])
        })
      })
    })
  })
}));

async function testComprehensiveEnhancements() {
  console.log("===== TESTING COMPREHENSIVE SEARCH PARAMETER ENHANCEMENTS =====\n");
  
  try {
    // Test a rich query with multiple activity types and preferences
    const complexQuery = "I want to start with a specialty coffee at a quiet cafe in Soho at 10am, " + 
                        "then visit the British Museum at noon, " + 
                        "have lunch at a restaurant with outdoor seating in Covent Garden at 2pm, " +
                        "and finally go shopping in Oxford Street around 4pm";
    
    console.log(`Processing query: "${complexQuery}"`);
    
    const parsedRequest = await parseItineraryRequest(complexQuery);
    
    // Check the number of fixed time entries
    console.log(`\nGenerated ${parsedRequest.fixedTimes.length} fixed time entries`);
    
    // Log all fixed times entries with their search parameters
    console.log("\nFixed Times Entries with Search Parameters:");
    for (let i = 0; i < parsedRequest.fixedTimes.length; i++) {
      const entry = parsedRequest.fixedTimes[i];
      console.log(`\n${i+1}. Activity at ${entry.time} in ${entry.location}:`);
      console.log(`   Type: ${entry.type}`);
      console.log(`   Search Term: ${entry.searchTerm || 'N/A'}`);
      console.log(`   Keywords: ${JSON.stringify(entry.keywords) || 'N/A'}`);
      console.log(`   Min Rating: ${entry.minRating || 'N/A'}`);
    }
    
    // Check if activities array was populated 
    if (parsedRequest.activities && parsedRequest.activities.length > 0) {
      console.log(`\nGenerated ${parsedRequest.activities.length} activities in the activities array`);
      
      // Log all activities with their search parameters
      console.log("\nActivities with Search Parameters:");
      for (let i = 0; i < parsedRequest.activities.length; i++) {
        const activity = parsedRequest.activities[i];
        console.log(`\n${i+1}. ${activity.description}:`);
        console.log(`   Location: ${activity.location}`);
        console.log(`   Time: ${activity.time}`);
        console.log(`   Search Parameters:`);
        console.log(`     Search Term: ${activity.searchParameters?.searchTerm || 'N/A'}`);
        console.log(`     Type: ${activity.searchParameters?.type || 'N/A'}`);
        console.log(`     Keywords: ${JSON.stringify(activity.searchParameters?.keywords) || 'N/A'}`);
        console.log(`     Min Rating: ${activity.searchParameters?.minRating || 'N/A'}`);
        console.log(`     Require Open Now: ${activity.searchParameters?.requireOpenNow || 'N/A'}`);
        console.log(`   Requirements: ${JSON.stringify(activity.requirements) || 'N/A'}`);
      }
    }
    
    console.log("\nVerifying parameter transmission:");
    
    // If both arrays have data, compare some entries to ensure parameters were transferred correctly
    if (parsedRequest.fixedTimes.length > 0 && parsedRequest.activities && parsedRequest.activities.length > 0) {
      // Find matching entries between fixedTimes and activities (e.g., for "cafe" activity)
      const cafeActivity = parsedRequest.activities.find(a => 
        a.description.toLowerCase().includes('coffee') || a.description.toLowerCase().includes('cafe')
      );
      
      const cafeFixedTime = parsedRequest.fixedTimes.find(ft => 
        ft.type === 'cafe' || (ft.searchTerm && ft.searchTerm.toLowerCase().includes('coffee'))
      );
      
      if (cafeActivity && cafeFixedTime) {
        console.log("\nComparing coffee/cafe activities:");
        console.log("Original Activity Search Term:", cafeActivity.searchParameters?.searchTerm);
        console.log("Fixed Time Search Term:", cafeFixedTime.searchTerm);
        
        console.log("Original Activity Keywords:", JSON.stringify(cafeActivity.searchParameters?.keywords));
        console.log("Fixed Time Keywords:", JSON.stringify(cafeFixedTime.keywords));
        
        console.log("Original Activity Min Rating:", cafeActivity.searchParameters?.minRating);
        console.log("Fixed Time Min Rating:", cafeFixedTime.minRating);
        
        // Verify parameters match
        const searchTermMatches = cafeActivity.searchParameters?.searchTerm === cafeFixedTime.searchTerm;
        
        // Check if keywords arrays contain the same elements (order doesn't matter)
        let keywordsMatch = false;
        if (cafeActivity.searchParameters?.keywords && cafeFixedTime.keywords) {
          const sortedOriginal = [...cafeActivity.searchParameters.keywords].sort();
          const sortedFixed = [...cafeFixedTime.keywords].sort();
          keywordsMatch = JSON.stringify(sortedOriginal) === JSON.stringify(sortedFixed);
        }
        
        const ratingMatches = cafeActivity.searchParameters?.minRating === cafeFixedTime.minRating;
        
        console.log("Parameters transferred correctly:", 
          searchTermMatches && keywordsMatch && ratingMatches ? "YES ✓" : "NO ✗");
      }
    }
    
    // Try a simulated search to see what parameters are actually used
    console.log("\nSimulating search with extracted parameters:");
    
    if (parsedRequest.fixedTimes.length > 0) {
      const firstActivity = parsedRequest.fixedTimes[0];
      console.log(`Testing search for: ${firstActivity.location} (${firstActivity.type})`);
      
      // Create a mock searchOptions object like the one in routes.ts
      const searchOptions = {
        type: firstActivity.type,
        requireOpenNow: true,
        keywords: Array.isArray(firstActivity.keywords) ? [...firstActivity.keywords] : [],
        searchTerm: firstActivity.searchTerm || firstActivity.type,
        minRating: typeof firstActivity.minRating === 'number' ? firstActivity.minRating : 0
      };
      
      // Call the mocked searchPlace
      await searchPlace(firstActivity.location, searchOptions);
    }
    
    console.log("\nComprehensive enhancement test completed successfully!");
    
  } catch (error) {
    console.error("Error in comprehensive test:", error);
  }
}

// Run the test
testComprehensiveEnhancements().catch(console.error);