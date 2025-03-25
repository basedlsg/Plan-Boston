import { getWeatherForecast, isVenueOutdoor, isWeatherSuitableForOutdoor, getWeatherAwareVenue } from './lib/weatherService';
import { PlaceDetails } from '@shared/schema';

async function testWeatherService() {
  // Test location (London)
  const londonLat = 51.5074;
  const londonLng = -0.1278;
  
  console.log("===== TESTING WEATHER SERVICE =====");
  
  // Test weather forecast fetch
  try {
    console.log("\n🌤️ Fetching London weather forecast...");
    const forecast = await getWeatherForecast(londonLat, londonLng);
    
    console.log("✅ Successfully fetched weather data:");
    console.log(`  First forecast temp: ${forecast.list[0].main.temp}°C`);
    console.log(`  Conditions: ${forecast.list[0].weather[0].main}`);
    
    // Test cache by making a second request
    console.log("\n🔄 Testing cache (should be instant):");
    const startTime = Date.now();
    const cachedForecast = await getWeatherForecast(londonLat, londonLng);
    const duration = Date.now() - startTime;
    console.log(`  Second request took ${duration}ms`);
  } catch (error) {
    console.error("❌ Error fetching weather:", error);
    console.error("Please ensure WEATHER_API_KEY is set in environment variables");
  }
  
  // Test venue classification
  console.log("\n🏛️ Testing Venue Classification");
  console.log("--------------------------------");
  const testVenueTypes = [
    ["park"], 
    ["restaurant"], 
    ["museum"], 
    ["tourist_attraction", "park"],
    ["tourist_attraction", "museum"]
  ];
  
  for (const types of testVenueTypes) {
    const isOutdoor = isVenueOutdoor(types);
    console.log(`Types [${types.join(', ')}] → ${isOutdoor ? "Outdoor" : "Indoor"}`);
  }
  
  // Test weather suitability with mock data
  console.log("\n☔ Testing Weather Suitability");
  console.log("-----------------------------");
  const mockWeatherData = {
    list: [
      {
        dt: Math.floor(Date.now() / 1000),
        main: { temp: 20 },
        weather: [{ id: 800, main: "Clear", description: "clear sky" }]
      },
      {
        dt: Math.floor(Date.now() / 1000) + 3600,
        main: { temp: 18 },
        weather: [{ id: 500, main: "Rain", description: "light rain" }]
      }
    ]
  };
  
  const testTimes = [
    new Date(),
    new Date(Date.now() + 3600 * 1000)
  ];
  
  for (const time of testTimes) {
    const suitable = isWeatherSuitableForOutdoor(mockWeatherData, time);
    console.log(`Time ${time.toLocaleTimeString()} → ${suitable ? "Suitable" : "Not suitable"} for outdoor activities`);
  }
  
  // Test weather-aware venue recommendation
  console.log("\n🔄 Testing Weather-Aware Venue Selection");
  console.log("-------------------------------------");
  
  // Sample venues
  const outdoorVenue: PlaceDetails = {
    name: "Hyde Park",
    formatted_address: "Hyde Park, London",
    place_id: "ChIJhz8mAOUEdkgRnfK79dOVH9U",
    geometry: {
      location: {
        lat: 51.5073,
        lng: -0.1657
      }
    },
    types: ["park", "tourist_attraction"]
  };
  
  const indoorVenue: PlaceDetails = {
    name: "British Museum",
    formatted_address: "Great Russell St, London WC1B 3DG",
    place_id: "ChIJB9OTMDIbdkgRp0JWbQGZsS8",
    geometry: {
      location: {
        lat: 51.5194,
        lng: -0.1269
      }
    },
    types: ["museum", "tourist_attraction"]
  };
  
  try {
    // Mock bad weather data
    const badWeatherData = {
      list: [
        {
          dt: Math.floor(Date.now() / 1000),
          main: { temp: 12 },
          weather: [{ id: 500, main: "Rain", description: "light rain" }]
        }
      ]
    };
    
    // Mock getWeatherForecast to return our mock data
    const originalFn = getWeatherForecast;
    (global as any).getWeatherForecast = async () => badWeatherData;
    
    console.log("Testing with outdoor primary venue and indoor alternative in bad weather:");
    console.log(`Primary venue: ${outdoorVenue.name} (${outdoorVenue.types?.join(', ')})`);
    console.log(`Alternative: ${indoorVenue.name} (${indoorVenue.types?.join(', ')})`);
    
    // Test getWeatherAwareVenue
    const result = await getWeatherAwareVenue(
      outdoorVenue,
      [indoorVenue],
      51.5073,
      -0.1657,
      new Date()
    );
    
    console.log(`\nResult: ${result.venue.name}`);
    console.log(`Weather suitable for outdoor: ${result.weatherSuitable ? "Yes" : "No"}`);
    console.log(`Recommendation correct: ${result.venue.name === indoorVenue.name ? "✅" : "❌"}`);
    
    // Restore the original function
    (global as any).getWeatherForecast = originalFn;
  } catch (error) {
    console.error("❌ Error in weather-aware venue test:", error);
  }
}

// Run the tests
testWeatherService();