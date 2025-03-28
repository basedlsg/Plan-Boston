import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { z } from "zod";
import { config, getApiKey, isFeatureEnabled } from "../config";
import { StructuredRequest } from "@shared/types";

// Schema for validating Gemini's response
const ActivitySchema = z.object({
  description: z.string(),
  location: z.string(),
  // For time, if null or undefined, we'll use a default value in transform
  time: z.string().nullish().transform(val => val || "12:00"),
  searchParameters: z.object({
    searchTerm: z.string(),
    type: z.string(),
    keywords: z.array(z.string()).nullish().default([]),
    minRating: z.number().min(1).max(5).nullish().default(4.0),
    requireOpenNow: z.boolean().nullish().default(false)
  }),
  requirements: z.array(z.string()).nullish().default([]),
  confidence: z.number().optional().default(0.8)
});

const GeminiResponseSchema = z.object({
  activities: z.array(ActivitySchema),
  startLocation: z.string().nullable(),
  interpretationNotes: z.string().nullish().default("") // Allow null/undefined with default empty string
});

// Initialize Gemini API
const initializeGemini = () => {
  const apiKey = getApiKey('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required but not provided');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Process a user query using Gemini's natural language understanding
 */
export async function processWithGemini(query: string): Promise<StructuredRequest | null> {
  if (!isFeatureEnabled('AI_PROCESSING')) {
    console.log('AI processing disabled via feature flag');
    return null;
  }
  
  // Multi-tiered approach with different temperatures
  const temperatures = [0.2, 0.4, 0.7]; // Start conservative, get more creative if needed
  let lastError: any = null;
  
  for (const temperature of temperatures) {
    try {
      console.log(`Attempting Gemini processing with temperature: ${temperature}`);
      const result = await attemptGeminiProcessing(query, temperature);
      if (result) return result;
    } catch (error) {
      console.warn(`Gemini processing failed with temperature ${temperature}:`, error);
      lastError = error;
      // Continue to next temperature
    }
  }
  
  // All attempts failed
  console.error('All Gemini processing attempts failed:', lastError);
  return null;
}

/**
 * Single attempt at processing with Gemini at a specific temperature
 */
async function attemptGeminiProcessing(query: string, temperature: number): Promise<StructuredRequest | null> {
  try {
    const genAI = initializeGemini();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig: {
        temperature: temperature,
        topK: 40,
        topP: 0.95,
      }
    });

    // System prompt with contextual understanding guidance
    const systemPrompt = `
You are a London travel planning expert who understands the nuances and context of travel requests. Your task is to interpret requests for London itineraries, extracting structured information while understanding implied intent and contextual clues.

IMPORTANT: Rather than taking every word literally, understand the user's underlying intent. Use your knowledge of London to interpret requests contextually.

Consider these interpretation guidelines:

1. CONTEXTUAL LOCATION UNDERSTANDING:
   - When a user mentions "in X", interpret X as a specific London neighborhood
   - If they mention a specific venue, identify the neighborhood it's in
   - Handle misspellings and colloquial names (e.g., "Westend" → "West End")
   - Infer locations from activity types when appropriate (e.g., "financial district" → "City of London")

2. ACTIVITY & TIME CONTEXTUAL ANALYSIS:
   - Understand that "coffee" typically means a cafe, not just the beverage
   - Interpret time references in context ("dinner at 7" means 7 PM, not 7 AM)
   - Recognize implied activities (e.g., "romantic evening" implies dining or entertainment)
   - Handle vague requests like "somewhere nice for lunch" with appropriate parameters

3. FLEXIBLE INTERPRETATION EXAMPLES:
   - "Coffee in Shoreditch" → Cafe in Shoreditch around current time
   - "Dinner at 7 in Soho" → Restaurant in Soho at 19:00
   - "Show me good Italian places in Mayfair" → Italian restaurants in Mayfair
   - "Romantic evening in Covent Garden" → Upscale restaurant or entertainment in Covent Garden in evening
   - "Something to do near London Bridge at 3" → Activity or attraction near London Bridge at 15:00

Analyze this request: ${query}

Based on your contextual understanding, return a JSON structure with:
{
  "activities": [
    {
      "description": string, // Original or clarified description of the activity
      "location": string, // Specific London neighborhood or area
      "time": string, // Time in 24-hour format (HH:MM) - ALWAYS include this field, using defaults like "12:00" if uncertain
      "searchParameters": {
        "searchTerm": string, // Optimized search term for Google Places API
        "type": string, // Venue type (restaurant, cafe, museum, etc.)
        "keywords": string[], // Additional search keywords
        "minRating": number, // Minimum venue rating (1.0-5.0)
        "requireOpenNow": boolean // Whether venue should be open at specified time
      },
      "requirements": string[], // Special requirements or preferences
      "confidence": number // Your confidence in this interpretation (0.0-1.0)
    }
  ],
  "startLocation": string | null, // Starting location if specified
  "interpretationNotes": string // Optional explanation of how you interpreted ambiguous aspects
}

Return ONLY valid JSON without any additional explanation. Never use "London" when a more specific neighborhood is mentioned or could be inferred. ALWAYS include ALL fields in the JSON structure, using sensible defaults if necessary (e.g., empty arrays for requirements, 4.0 for minRating if unsure).
`;

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Gemini response:", responseText);
      return null;
    }
    
    const jsonResponse = jsonMatch[0];
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(jsonResponse);
    } catch (error) {
      console.error("Failed to parse JSON from Gemini response:", error);
      console.error("Raw response:", jsonResponse);
      return null;
    }
    
    // Validate response structure
    const validationResult = GeminiResponseSchema.safeParse(parsedResponse);
    if (!validationResult.success) {
      console.error("Gemini response failed validation:", validationResult.error);
      return null;
    }
    
    // Process validated response
    return processGeminiResponse(validationResult.data, query);
  } catch (error) {
    console.error("Error in Gemini processing:", error);
    throw error;
  }
}

/**
 * Process the validated Gemini response into a StructuredRequest
 */
function processGeminiResponse(
  geminiResponse: z.infer<typeof GeminiResponseSchema>,
  originalQuery: string
): StructuredRequest {
  // Extract the structured data with explicit typing to avoid type issues
  const structuredData: StructuredRequest = {
    startLocation: geminiResponse.startLocation,
    destinations: [],
    fixedTimes: [],
    preferences: {
      type: undefined,
      requirements: []
    },
    // Process activities to ensure type compatibility
    activities: geminiResponse.activities.map(activity => ({
      ...activity,
      // Ensure requirements is always an array
      requirements: activity.requirements ?? [],
      searchParameters: {
        ...activity.searchParameters,
        // Ensure keywords is always an array
        keywords: activity.searchParameters.keywords ?? [],
        // Ensure minRating is always a number, default to 4.0 if null
        minRating: activity.searchParameters.minRating === null ? 4.0 : activity.searchParameters.minRating,
        // Ensure requireOpenNow is always a boolean, default to false if null
        requireOpenNow: activity.searchParameters.requireOpenNow === null ? false : activity.searchParameters.requireOpenNow
      }
    }))
  };
  
  // Add destinations from activities
  const locations = new Set<string>();
  geminiResponse.activities.forEach(activity => {
    if (activity.location && activity.location !== "London") {
      locations.add(activity.location);
    }
  });
  structuredData.destinations = Array.from(locations);
  
  // Extract requirements from activities
  const allRequirements = new Set<string>();
  geminiResponse.activities.forEach(activity => {
    // Safe access to requirements with null check
    (activity.requirements || []).forEach(req => allRequirements.add(req));
  });
  structuredData.preferences.requirements = Array.from(allRequirements);
  
  // Add type from first activity if available
  if (geminiResponse.activities.length > 0) {
    structuredData.preferences.type = geminiResponse.activities[0].searchParameters.type;
  }
  
  // Create fixed times from activities with correct type handling
  // Use an explicit loop to handle the typing correctly
  structuredData.fixedTimes = [];
  for (const activity of geminiResponse.activities) {
    const fixedTimeEntry = {
      location: activity.location,
      time: activity.time,
      type: activity.searchParameters.type,
      searchTerm: activity.searchParameters.searchTerm
    };
    
    // Only add optional fields if they are not null
    if (activity.searchParameters.keywords !== null) {
      fixedTimeEntry['keywords'] = activity.searchParameters.keywords;
    }
    
    if (activity.searchParameters.minRating !== null) {
      fixedTimeEntry['minRating'] = activity.searchParameters.minRating;
    }
    
    structuredData.fixedTimes.push(fixedTimeEntry);
  }
  
  return structuredData;
}

export default processWithGemini;