/**
 * Gemini Natural Language Processing
 * 
 * This module implements a robust, error-tolerant processing system using
 * Google's Gemini AI models to understand and structure itinerary requests.
 */

import { z } from 'zod';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logAiInteraction, generateSessionId } from './aiLogging';
import { getApiKey, isFeatureEnabled } from '../config';

// Define the structured data schema that Gemini should return
const FixedTimeEntrySchema = z.object({
  time: z.string().describe("The time for this activity (e.g., '9:00', '15:30')"),
  activity: z.string().describe("The activity description"),
  location: z.string().describe("The specific location or area in London"),
  venue: z.string().optional().describe("A specific venue name if mentioned"),
  searchParameters: z.object({
    cuisine: z.string().optional().describe("Type of cuisine if food-related"),
    priceLevel: z.enum(["budget", "moderate", "expensive"]).optional().describe("Price level preference"),
    ambience: z.string().optional().describe("Preferred ambience/vibe"),
    venueType: z.string().optional().describe("Type of venue (pub, restaurant, etc.)"),
    specificRequirements: z.array(z.string()).optional().describe("Any specific requirements"),
  }).optional()
});

// Define flexible time entry schema - this is for less specific time periods
const FlexibleTimeEntrySchema = z.object({
  time: z.string().describe("The time period for this activity (e.g., 'morning', 'afternoon')"),
  activity: z.string().describe("The activity description"),
  location: z.string().describe("The specific location or area in London"),
  venue: z.string().optional().describe("A specific venue name if mentioned"),
  day: z.string().optional().describe("The day for this activity if different from the main date"),
  searchParameters: z.object({
    cuisine: z.string().optional().describe("Type of cuisine if food-related"),
    priceLevel: z.enum(["budget", "moderate", "expensive"]).optional().describe("Price level preference"),
    venueType: z.string().optional().describe("Type of venue (pub, restaurant, etc.)"),
    specificRequirements: z.array(z.string()).optional().describe("Any specific requirements"),
  }).optional()
});

const StructuredRequestSchema = z.object({
  date: z.string().optional().describe("The date for the itinerary"),
  startLocation: z.string().optional().describe("Where the day starts"),
  endLocation: z.string().optional().describe("Where the day ends"),
  fixedTimeEntries: z.array(FixedTimeEntrySchema).describe("Activities with specific times"),
  flexibleTimeEntries: z.array(FlexibleTimeEntrySchema).optional().describe("Activities with flexible time periods"),
  preferences: z.object({
    cuisine: z.array(z.string()).optional().describe("Preferred cuisines"),
    budget: z.enum(["budget", "moderate", "expensive"]).optional().describe("Overall budget level"),
    pace: z.enum(["relaxed", "moderate", "busy"]).optional().describe("Preferred pace of the day"),
    interests: z.array(z.string()).optional().describe("General interests"),
    accessibility: z.array(z.string()).optional().describe("Accessibility requirements"),
    transportMode: z.array(z.enum(["walking", "tube", "bus", "taxi"])).optional().describe("Preferred transport modes"),
  }).optional(),
  travelGroup: z.object({
    adults: z.number().optional().describe("Number of adults"),
    children: z.number().optional().describe("Number of children"),
    seniors: z.number().optional().describe("Number of seniors"),
  }).optional(),
  specialRequests: z.array(z.string()).optional().describe("Any special requests or considerations"),
});

export type FixedTimeEntry = z.infer<typeof FixedTimeEntrySchema>;
export type FlexibleTimeEntry = z.infer<typeof FlexibleTimeEntrySchema>;
export type StructuredRequest = z.infer<typeof StructuredRequestSchema>;

/**
 * Process a user query using Gemini's natural language understanding
 */
export async function processWithGemini(query: string): Promise<StructuredRequest | null> {
  // Generate session ID for tracking all attempts in this processing chain
  const sessionId = generateSessionId();
  
  // Check if Gemini feature is enabled
  if (!isFeatureEnabled('USE_GEMINI')) {
    await logAiInteraction({
      sessionId,
      userQuery: query,
      modelName: 'gemini-1.5-pro',
      status: 'warning',
      errorDetails: 'Gemini processing disabled by feature flag'
    });
    return null;
  }
  
  // Check API key
  const apiKey = getApiKey('GEMINI_API_KEY');
  if (!apiKey) {
    await logAiInteraction({
      sessionId,
      userQuery: query,
      modelName: 'gemini-1.5-pro',
      status: 'error',
      errorDetails: 'Missing Gemini API key'
    });
    throw new Error('Missing Gemini API key');
  }
  
  // Try multiple attempts with increasing temperatures for more flexibility
  const temperatures = [0.2, 0.4, 0.7];
  let lastError = null;
  
  for (const temperature of temperatures) {
    try {
      const result = await attemptGeminiProcessing(query, temperature, sessionId);
      if (result) return result;
    } catch (error) {
      lastError = error;
      console.error(`Gemini processing attempt failed at temperature ${temperature}:`, error);
      // Continue to next temperature
    }
  }
  
  // All attempts failed
  await logAiInteraction({
    sessionId,
    userQuery: query,
    modelName: 'gemini-1.5-pro',
    status: 'error',
    errorDetails: lastError ? String(lastError) : 'All processing attempts failed'
  });
  
  return null;
}

/**
 * Single attempt at processing with Gemini at a specific temperature
 */
async function attemptGeminiProcessing(query: string, temperature: number, sessionId?: string): Promise<StructuredRequest | null> {
  const startTime = Date.now();
  const apiKey = getApiKey('GEMINI_API_KEY');
  
  if (!apiKey) {
    throw new Error('Missing Gemini API key');
  }
  
  const sessionIdForLogging = sessionId || generateSessionId();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  try {
    // Prepare the prompt with schema details and examples
    const prompt = `
    You are a travel planning assistant for London. Extract structured information from this itinerary request. 
    
    IMPORTANT RULES:
    1. Return ONLY valid JSON that matches the schema - no extra text or markdown
    2. For time values, use 24-hour format (e.g., "09:00", "15:30") when possible
    3. If a time is mentioned without AM/PM (e.g., "at 6"), default to PM for evening activities like dinner
    4. Include all explicitly mentioned fixed times in fixedTimeEntries
    5. Put activities with vague times (morning, afternoon, evening) in flexibleTimeEntries
    6. Keep location names authentic to London (don't change neighborhood names)
    7. If the user mentions specific venue requirements, include them in searchParameters
    8. If the user doesn't specify a budget level, default to "moderate"
    9. Extract as much detail as possible while staying true to the user's request
    10. For incomplete information, make reasonable assumptions based on context
    11. Keep activity descriptions concise but clear
    
    SCHEMA GUIDANCE:
    - Use fixedTimeEntries for activities with specific clock times (9:00, 14:30, etc.)
    - Use flexibleTimeEntries for activities with time periods (morning, afternoon, etc.)
    - Both entry types should include: time, activity, location

    Here's the request to analyze:
    ${query}
    `;
    
    // Send to Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 1024,
      },
    });
    
    const response = result.response;
    const responseText = response.text();
    
    // Extract the JSON from the response
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                   responseText.match(/```\n([\s\S]*?)\n```/) ||
                   responseText.match(/\{[\s\S]*\}/);
                   
    let jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
    
    // Clean up any trailing commas which can break JSON parsing
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
    
    try {
      const parsedData = JSON.parse(jsonText);
      
      // Validate against our schema
      const validationResult = StructuredRequestSchema.safeParse(parsedData);
      
      if (validationResult.success) {
        // Successfully validated
        const structuredData = validationResult.data;
        
        // Log the successful interaction
        await logAiInteraction({
          sessionId: sessionIdForLogging,
          userQuery: query,
          modelName: 'gemini-1.5-pro',
          rawRequest: { prompt, temperature },
          rawResponse: responseText,
          parsedResponse: structuredData,
          processingTimeMs: Date.now() - startTime,
          status: 'success'
        });
        
        // Apply additional processing and return the structured data
        return processGeminiResponse(query, structuredData, responseText);
      } else {
        // Validation failed
        await logAiInteraction({
          sessionId: sessionIdForLogging,
          userQuery: query,
          modelName: 'gemini-1.5-pro',
          rawRequest: { prompt, temperature },
          rawResponse: responseText,
          status: 'error',
          processingTimeMs: Date.now() - startTime,
          errorDetails: `Schema validation error: ${JSON.stringify(validationResult.error)}`,
          parsedResponse: parsedData  // Include the invalid parsed data for debugging
        });
        
        throw new Error(`Schema validation error: ${validationResult.error.message}`);
      }
    } catch (parseError) {
      // JSON parsing failed
      await logAiInteraction({
        sessionId: sessionIdForLogging,
        userQuery: query,
        modelName: 'gemini-1.5-pro',
        rawRequest: { prompt, temperature },
        rawResponse: responseText,
        status: 'error',
        processingTimeMs: Date.now() - startTime,
        errorDetails: `JSON parsing error: ${parseError}`
      });
      
      throw new Error(`Failed to parse Gemini response as JSON: ${parseError}`);
    }
  } catch (error) {
    // API or processing error
    await logAiInteraction({
      sessionId: sessionIdForLogging,
      userQuery: query,
      modelName: 'gemini-1.5-pro',
      rawRequest: { temperature },
      status: 'error',
      processingTimeMs: Date.now() - startTime,
      errorDetails: `API or processing error: ${error}`
    });
    
    throw error;
  }
}

/**
 * Process the validated Gemini response into a StructuredRequest
 */
function processGeminiResponse(
  query: string,
  validatedData: StructuredRequest,
  rawResponse: string
): StructuredRequest {
  // Make a copy to avoid modifying the original
  const structuredData: StructuredRequest = {
    ...validatedData,
    fixedTimeEntries: [...(validatedData.fixedTimeEntries || [])],
    flexibleTimeEntries: [...(validatedData.flexibleTimeEntries || [])],
    preferences: validatedData.preferences ? { ...validatedData.preferences } : undefined,
    travelGroup: validatedData.travelGroup ? { ...validatedData.travelGroup } : undefined,
    specialRequests: validatedData.specialRequests ? [...validatedData.specialRequests] : undefined
  };

  console.log("Processing Gemini response with raw data:", JSON.stringify(validatedData, null, 2));

  // Set default start location if not provided
  if (!structuredData.startLocation) {
    structuredData.startLocation = "Central London";
  }
  
  // Process flexible time entries and convert them to fixed time entries
  if (structuredData.flexibleTimeEntries && structuredData.flexibleTimeEntries.length > 0) {
    console.log(`Found ${structuredData.flexibleTimeEntries.length} flexible time entries to process`);
    
    // Convert flexible time entries to fixed times with appropriate time values
    const convertedFlexibleEntries = structuredData.flexibleTimeEntries.map(entry => {
      // Convert time period names to specific times
      const convertedTime = convertTo24Hour(entry.time);
      
      // Default to Central London if location is missing
      const location = entry.location || "Central London";
      
      // Use the flexible time entry data but with the converted time and ensured location
      return {
        ...entry,
        time: convertedTime,
        location: location
      };
    });
    
    // Add the converted flexible entries to the fixed time entries array
    structuredData.fixedTimeEntries = [...structuredData.fixedTimeEntries, ...convertedFlexibleEntries];
    console.log(`Added ${convertedFlexibleEntries.length} converted flexible entries to fixed time entries`);
  }
  
  // Sort fixed time entries chronologically
  if (structuredData.fixedTimeEntries && structuredData.fixedTimeEntries.length > 0) {
    structuredData.fixedTimeEntries.sort((a, b) => {
      // Convert times to 24-hour format for comparison
      const timeA = convertTo24Hour(a.time);
      const timeB = convertTo24Hour(b.time);
      return timeA.localeCompare(timeB);
    });
  }
  
  // Ensure each fixed time entry has search parameters and valid locations
  structuredData.fixedTimeEntries = structuredData.fixedTimeEntries.map(entry => {
    // Ensure location is never undefined/null - default to Central London
    if (!entry.location) {
      entry.location = "Central London";
    }
    
    // Handle vague locations by replacing them with Central London
    const vagueLocations = ['somewhere', 'anywhere', 'london', 'nearby'];
    if (vagueLocations.includes(entry.location.toLowerCase())) {
      entry.location = "Central London";
    }
    
    // Ensure search parameters object exists
    if (!entry.searchParameters) {
      entry.searchParameters = {};
    }
    
    // Apply global preferences to individual entries when appropriate
    if (structuredData.preferences) {
      if (structuredData.preferences.budget && !entry.searchParameters.priceLevel) {
        entry.searchParameters.priceLevel = structuredData.preferences.budget;
      }
      
      // Apply cuisine preferences for food-related activities
      const foodKeywords = ['lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'eat', 'dining', 'restaurant', 'cafe', 'food'];
      const hasCuisinePreferences = structuredData.preferences.cuisine && 
                                  Array.isArray(structuredData.preferences.cuisine) && 
                                  structuredData.preferences.cuisine.length > 0;
      
      if (
        hasCuisinePreferences && 
        foodKeywords.some(keyword => entry.activity.toLowerCase().includes(keyword)) &&
        !entry.searchParameters.cuisine
      ) {
        // Safe to access at index 0 since we've checked array length above
        entry.searchParameters.cuisine = structuredData.preferences.cuisine![0];
      }
    }
    
    return entry;
  });
  
  console.log("Final processed result:", JSON.stringify(structuredData, null, 2));
  return structuredData;
}

/**
 * Convert time strings to 24-hour format for consistent comparison
 */
function convertTo24Hour(timeStr: string): string {
  // If already in 24-hour format (e.g., "14:30"), return as is
  if (/^\d{1,2}:\d{2}$/.test(timeStr) && !timeStr.includes('am') && !timeStr.includes('pm')) {
    // Add leading zero if needed
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  // Handle "3pm", "3 pm", "3PM", etc.
  const pmMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(?:pm|PM|p\.m\.|P\.M\.)/);
  if (pmMatch) {
    const hours = parseInt(pmMatch[1]);
    const minutes = pmMatch[2] ? parseInt(pmMatch[2]) : 0;
    const adjustedHours = hours === 12 ? 12 : hours + 12;
    return `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Handle "3am", "3 am", "3AM", etc.
  const amMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(?:am|AM|a\.m\.|A\.M\.)/);
  if (amMatch) {
    const hours = parseInt(amMatch[1]);
    const minutes = amMatch[2] ? parseInt(amMatch[2]) : 0;
    const adjustedHours = hours === 12 ? 0 : hours;
    return `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // For vague times like "morning", "afternoon", etc., assign reasonable defaults
  const timeMapping: Record<string, string> = {
    'morning': '09:00',
    'early morning': '07:00',
    'late morning': '11:00',
    'noon': '12:00',
    'midday': '12:00',
    'afternoon': '14:00',
    'early afternoon': '13:00',
    'late afternoon': '16:00',
    'evening': '18:00',
    'early evening': '17:00',
    'late evening': '21:00',
    'night': '20:00',
    'midnight': '00:00'
  };
  
  const lowerTimeStr = timeStr.toLowerCase();
  for (const [key, value] of Object.entries(timeMapping)) {
    if (lowerTimeStr.includes(key)) {
      return value;
    }
  }
  
  // For numeric times without am/pm, make educated guesses
  const numericMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (numericMatch) {
    const hours = parseInt(numericMatch[1]);
    const minutes = numericMatch[2] ? parseInt(numericMatch[2]) : 0;
    
    // Assume times 0-6 are early morning (in 24h format)
    // Assume times 7-11 are morning (in 12h format, so 7AM-11AM)
    // Assume times 12 is noon (12PM)
    // Assume times 1-6 are afternoon/evening (in 12h format, so 1PM-6PM)
    let adjustedHours = hours;
    if (hours >= 1 && hours <= 6) {
      adjustedHours = hours + 12; // Convert to PM
    }
    
    return `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // If all else fails, return a default time
  return '12:00';
}