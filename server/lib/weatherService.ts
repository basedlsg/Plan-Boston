import { PlaceDetails } from '@shared/schema';
import { getApiKey, isFeatureEnabled } from '../config';

// API configuration
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/forecast';

// Set up a cache to avoid redundant API calls
interface CacheEntry {
  data: any;
  timestamp: number;
}

// Weather data cache with location key (rounded lat/lng) as key
const weatherCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Generate a cache key from coordinates (rounded to avoid excessive API calls for nearby locations)
 */
function getCacheKey(lat: number, lng: number): string {
  // Round to 2 decimal places to group nearby locations
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  return `${roundedLat},${roundedLng}`;
}

/**
 * Fetch weather forecast for a location
 * Uses caching to reduce API calls
 * 
 * @param latitude Location latitude
 * @param longitude Location longitude
 * @returns Weather forecast data
 */
export async function getWeatherForecast(latitude: number, longitude: number): Promise<any> {
  const cacheKey = getCacheKey(latitude, longitude);
  const cachedData = weatherCache.get(cacheKey);
  
  // Return cached data if it exists and is recent
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    console.log(`Using cached weather data for ${cacheKey}`);
    return cachedData.data;
  }
  
  // No valid cache entry, fetch from API
  console.log(`Fetching weather data for ${cacheKey}`);
  
  // Check if weather feature is enabled
  if (!isFeatureEnabled("WEATHER_AWARENESS")) {
    throw new Error('Weather API feature is disabled - missing API key');
  }
  
  // Construct API URL with params
  const url = new URL(WEATHER_API_URL);
  url.searchParams.append('lat', latitude.toString());
  url.searchParams.append('lon', longitude.toString());
  url.searchParams.append('units', 'metric'); // Use Celsius
  url.searchParams.append('cnt', '24'); // 24 forecasts (3-hour intervals for 3 days)
  url.searchParams.append('appid', getApiKey("WEATHER", true)); // Will throw if key missing
  
  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the result
    weatherCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
}

/**
 * Determine if a venue is primarily outdoors based on its place types
 * 
 * @param types Array of place types from Google Places API
 * @returns boolean indicating if the venue is outdoor
 */
export function isVenueOutdoor(types: string[]): boolean {
  const outdoorTypes = [
    'park',
    'campground',
    'natural_feature',
    'point_of_interest',
    'tourist_attraction',
    'zoo'
  ];
  
  // Consider strong indoor types that should override outdoor classification
  const strongIndoorTypes = [
    'museum',
    'restaurant',
    'cafe',
    'bar',
    'movie_theater',
    'shopping_mall',
    'department_store',
    'library'
  ];
  
  // Check for strong indoor types first (these override outdoor classification)
  if (types.some(type => strongIndoorTypes.includes(type))) {
    return false;
  }
  
  // Check if any type suggests an outdoor venue
  return types.some(type => outdoorTypes.includes(type));
}

/**
 * Check if the weather is suitable for outdoor activities at a given time
 * 
 * @param weatherData Weather forecast data
 * @param dateTime Date and time to check weather for
 * @returns boolean indicating if weather is suitable for outdoor activities
 */
export function isWeatherSuitableForOutdoor(weatherData: any, dateTime: Date): boolean {
  // Find the closest forecast to the given time
  const targetTimestamp = Math.floor(dateTime.getTime() / 1000);
  
  if (!weatherData.list || !Array.isArray(weatherData.list)) {
    console.warn('No forecast data available');
    return true; // Default to true if no data
  }
  
  // Find the closest forecast to the target time
  let closestForecast = weatherData.list[0];
  let minTimeDiff = Math.abs(targetTimestamp - closestForecast.dt);
  
  for (const forecast of weatherData.list) {
    const timeDiff = Math.abs(targetTimestamp - forecast.dt);
    if (timeDiff < minTimeDiff) {
      closestForecast = forecast;
      minTimeDiff = timeDiff;
    }
  }
  
  // Define conditions that make outdoor activities less enjoyable
  const badWeatherConditions = [
    'Rain', 'Thunderstorm', 'Snow', 'Drizzle'
  ];
  
  const weatherMain = closestForecast.weather[0].main;
  const temperature = closestForecast.main.temp;
  
  // Check if weather conditions are unfavorable
  const isBadWeather = badWeatherConditions.includes(weatherMain);
  const isTooHot = temperature > 30; // Too hot (above 30°C)
  const isTooCold = temperature < 5;  // Too cold (below 5°C)
  
  return !isBadWeather && !isTooHot && !isTooCold;
}

/**
 * Get a weather-aware venue recommendation
 * If the original venue is outdoor and weather is bad, it will
 * try to provide an indoor alternative
 * 
 * @param place Original place
 * @param alternatives Alternative places
 * @param latitude Location latitude
 * @param longitude Location longitude
 * @param visitTime Planned visit time
 */
export async function getWeatherAwareVenue(
  place: PlaceDetails,
  alternatives: PlaceDetails[],
  latitude: number,
  longitude: number,
  visitTime: Date
): Promise<{venue: PlaceDetails, weatherSuitable: boolean}> {
  // Default to the original place if anything fails
  let bestVenue = place;
  let isWeatherSuitable = true;
  
  try {
    // Skip weather check if there are no alternatives or weather feature is disabled
    if (!alternatives || alternatives.length === 0 || !isFeatureEnabled("WEATHER_AWARENESS")) {
      console.log("Skipping weather check - no alternatives or weather feature disabled");
      return { venue: place, weatherSuitable: true };
    }
    
    // Check if original place is outdoors
    if (place.types && isVenueOutdoor(place.types)) {
      // Try to fetch weather data
      try {
        const weatherData = await getWeatherForecast(latitude, longitude);
        
        // Check if weather is suitable for outdoor activities
        isWeatherSuitable = isWeatherSuitableForOutdoor(weatherData, visitTime);
        
        // If weather is bad for outdoor activities, recommend an indoor alternative
        if (!isWeatherSuitable) {
          // Find indoor alternatives
          const indoorAlternatives = alternatives.filter(alt => 
            alt.types && !isVenueOutdoor(alt.types)
          );
          
          // Use the first indoor alternative if available
          if (indoorAlternatives.length > 0) {
            bestVenue = indoorAlternatives[0];
            console.log(`Weather not suitable for outdoor venue. Recommending indoor alternative: ${bestVenue.name}`);
          } else {
            console.log("Weather not suitable for outdoor venue, but no indoor alternatives available");
          }
        } else {
          console.log(`Weather is suitable for outdoor venue: ${place.name}`);
        }
      } catch (weatherError) {
        // If we can't get weather data, use a simple fallback based on venue type
        console.warn("Could not fetch weather data:", weatherError);
        console.log("Using fallback venue selection based on venue types only");
        
        // Even without weather data, we can provide an indoor alternative
        // Just to give options if the primary venue is outdoor
        const indoorAlternatives = alternatives.filter(alt => 
          alt.types && !isVenueOutdoor(alt.types)
        );
        
        if (indoorAlternatives.length > 0) {
          // We don't switch automatically without weather data
          // But provide the information for the client to display
          console.log(`Outdoor venue has indoor alternatives: ${indoorAlternatives[0].name}`);
        }
      }
    } else {
      // Primary venue is already indoor, no need for weather check
      console.log(`Primary venue is indoor: ${place.name}`);
    }
    
    return { venue: bestVenue, weatherSuitable: isWeatherSuitable };
  } catch (error) {
    console.error('Error in weather-aware venue selection:', error);
    // On error, just return the original venue
    return { venue: place, weatherSuitable: true };
  }
}

async function testWeatherService() {
  // Test location (London)
  const londonLat = 51.5074;
  const londonLng = -0.1278;
  
  console.log("--- Testing Weather Service ---");
  
  // Test weather forecast fetch
  try {
    console.log("Fetching London weather forecast...");
    const forecast = await getWeatherForecast(londonLat, londonLng);
    
    console.log("✅ Successfully fetched weather data:");
    console.log(`  First forecast temp: ${forecast.list[0].main.temp}°C`);
    console.log(`  Conditions: ${forecast.list[0].weather[0].main}`);
    
    // Test cache by making a second request
    console.log("\nTesting cache (should be instant):");
    const startTime = Date.now();
    const cachedForecast = await getWeatherForecast(londonLat, londonLng);
    const duration = Date.now() - startTime;
    console.log(`  Second request took ${duration}ms`);
  } catch (error) {
    console.error("❌ Error fetching weather:", error);
  }
  
  // Test venue classification
  console.log("\n--- Testing Venue Classification ---");
  const testVenueTypes = [
    ["park"], 
    ["restaurant"], 
    ["museum"], 
    ["tourist_attraction", "park"]
  ];
  
  for (const types of testVenueTypes) {
    const isOutdoor = isVenueOutdoor(types);
    console.log(`Types [${types.join(', ')}] → ${isOutdoor ? "Outdoor" : "Indoor"}`);
  }
  
  // Test weather suitability with mock data
  console.log("\n--- Testing Weather Suitability ---");
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
}

// Comment this out after testing
// testWeatherService();