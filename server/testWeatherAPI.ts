/**
 * Test weather API connection
 * This simple script runs the weather service test function to verify the API key works
 */

import {
  getWeatherForecast,
  isVenueOutdoor,
  isWeatherSuitableForOutdoor
} from './lib/weatherService';

async function testWeatherAPI() {
  // Test location (London)
  const londonLat = 51.5074;
  const londonLng = -0.1278;
  
  console.log("=== TESTING WEATHER API CONNECTION ===");
  console.log("API Key availability:", process.env.WEATHER_API_KEY ? "✅ Present" : "❌ Missing");
  
  // Test weather forecast fetch
  try {
    console.log("\nFetching London weather forecast...");
    const forecast = await getWeatherForecast(londonLat, londonLng);
    
    console.log("✅ Successfully fetched weather data!");
    console.log("--------------------------------");
    console.log(`City: ${forecast.city.name}`);
    console.log(`Current temp: ${forecast.list[0].main.temp}°C`);
    console.log(`Conditions: ${forecast.list[0].weather[0].main} (${forecast.list[0].weather[0].description})`);
    console.log(`Wind: ${forecast.list[0].wind.speed} m/s`);
    console.log(`Humidity: ${forecast.list[0].main.humidity}%`);
    console.log("--------------------------------");
    
    // Test cache by making a second request
    console.log("\nTesting cache (should use cached data):");
    console.time("Second request");
    await getWeatherForecast(londonLat, londonLng);
    console.timeEnd("Second request");
    
    // Verify weather suitability checks
    const now = new Date();
    const suitability = isWeatherSuitableForOutdoor(forecast, now);
    console.log(`\nWeather suitability for outdoor activities: ${suitability ? "✅ Suitable" : "❌ Not suitable"}`);
    
    // Return success
    return true;
  } catch (error) {
    console.error("❌ ERROR fetching weather data:", error);
    return false;
  }
}

// Run the test
testWeatherAPI().then(success => {
  if (success) {
    console.log("\n✅ Weather API connection test completed successfully!");
  } else {
    console.log("\n❌ Weather API connection test failed!");
  }
});