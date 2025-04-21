import { z } from "zod";
import Fuse from 'fuse.js';
import { nycAreas, NYCArea } from "../data/new-york-areas";
import { ACTIVITY_TYPE_MAPPINGS } from "./locationNormalizer";
import { parseAndNormalizeTime } from './timeUtils';

// Types for location understanding
export type LocationContext = {
  name: string;
  type: 'neighborhood' | 'landmark' | 'station' | 'street';
  confidence: number;
  alternatives?: string[];
  context?: {
    nearbyAreas?: string[];
    borough?: string;
    characteristics?: string[];
  };
};

// Types for activity understanding
export type ActivityContext = {
  type: string;
  naturalDescription: string;
  venueType?: string | null;
  timeContext?: {
    preferredTime?: string;
    duration?: number;
    constraints?: string[];
  };
  requirements?: string[];
};

// Initialize fuzzy search for locations
const locationSearcher = new Fuse(nycAreas, {
  keys: ['name', 'characteristics', 'neighbors'],
  includeScore: true,
  threshold: 0.4
});

// Time period mappings with flexible ranges
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night' | 'lunch' | 'dinner' | 'breakfast' | 
                  'late evening' | 'happy hour' | 'after dinner' | 'after work' | 'tea time';
type TimeRange = { start: string; end: string; default: string };

const TIME_PERIODS: Record<TimePeriod, TimeRange> = {
  morning: { start: '08:00', end: '11:59', default: '10:00' },
  afternoon: { start: '12:00', end: '16:59', default: '14:00' },
  evening: { start: '17:00', end: '20:59', default: '18:00' },
  night: { start: '21:00', end: '23:59', default: '21:00' },
  lunch: { start: '12:00', end: '14:30', default: '12:30' },
  dinner: { start: '18:00', end: '21:00', default: '19:00' },
  breakfast: { start: '07:00', end: '10:30', default: '09:00' },
  // Additional nightlife periods
  'late evening': { start: '20:00', end: '23:59', default: '20:00' },
  'happy hour': { start: '16:00', end: '19:00', default: '17:00' },
  'after dinner': { start: '20:00', end: '23:59', default: '20:30' },
  'after work': { start: '17:00', end: '19:00', default: '18:00' },
  'tea time': { start: '15:00', end: '17:00', default: '16:00' }
};

// Duration expressions mapping (in minutes)
type DurationExpression = 'quick' | 'brief' | 'short' | 'couple hours' | 'few hours' | 'half day' | 'all day';
const DURATION_EXPRESSIONS: Record<DurationExpression, number> = {
  'quick': 30,
  'brief': 30,
  'short': 45,
  'couple hours': 120,
  'few hours': 180,
  'half day': 240,
  'all day': 480
};

// Helper to find locations with fuzzy matching
export function findLocation(query: string): LocationContext | null {
  try {
    // First try exact match in our areas data
    const exactMatch = nycAreas.find((area: NYCArea) => 
      area.name.toLowerCase() === query.toLowerCase()
    );

    if (exactMatch) {
      return {
        name: exactMatch.name,
        type: 'neighborhood',
        confidence: 1,
        context: {
          nearbyAreas: exactMatch.neighbors,
          borough: exactMatch.borough,
          characteristics: exactMatch.characteristics
        }
      };
    }

    // Try fuzzy search
    const fuzzyResults = locationSearcher.search(query);
    if (fuzzyResults.length > 0) {
      const bestMatch = fuzzyResults[0];
      const item = bestMatch.item as NYCArea;
      return {
        name: item.name,
        type: 'neighborhood',
        confidence: 1 - (bestMatch.score || 0),
        alternatives: fuzzyResults.slice(1, 4).map(r => (r.item as NYCArea).name),
        context: {
          nearbyAreas: item.neighbors,
          borough: item.borough,
          characteristics: item.characteristics
        }
      };
    }

    // No good match found
    return null;

  } catch (error) {
    console.error('Error in location finding:', error);
    return null;
  }
}

// Helper to understand activity descriptions
export function parseActivity(description: string): ActivityContext {
  const lowered = description.toLowerCase();
  
  // Check for meal-related activities first
  const isDinner = lowered.includes('dinner');
  const isLunch = lowered.includes('lunch');
  
  // Extract time context
  const timeMatch = Object.entries(TIME_PERIODS).find(([period]) => 
    lowered.includes(period)
  );

  // Extract duration
  const durationMatch = Object.entries(DURATION_EXPRESSIONS).find(([expr]) =>
    lowered.includes(expr)
  );

  // Look for specific requirements
  const requirements = [];
  if (lowered.includes('quiet') || lowered.includes('peaceful')) requirements.push('quiet');
  if (lowered.includes('fancy') || lowered.includes('upscale')) requirements.push('upscale');
  if (lowered.includes('cheap') || lowered.includes('budget')) requirements.push('budget');
  if (lowered.includes('outdoor') || lowered.includes('outside')) requirements.push('outdoor');

  // Check for non-venue activities - including vague ones
  const nonVenueActivities = [
    'meeting', 'arrive', 'depart', 'explore', 'walk', 
    'travel', 'relax', 'break', 'rest', 'something', 'activity',
    'see', 'visit', 'do', 'experience', 'spend time'
  ];
  
  // Check for non-venue activities (but don't match on dinner/lunch as priority)
  const isNonVenueActivity = !isDinner && !isLunch && nonVenueActivities.some(activity => 
    lowered.includes(activity)
  );
  
  // Special handling for specific non-venue activities
  let activityType = 'activity';
  let suggestedVenueType: string | null = null;
  
  if (isNonVenueActivity) {
    // For meetings, suggest appropriate venue types rather than using 'meeting' as a venue type
    if (lowered.includes('meeting')) {
      activityType = 'meeting';
      // Suggest appropriate venue types based on meeting context
      if (lowered.includes('coffee') || lowered.includes('casual')) {
        suggestedVenueType = 'cafe';
      } else if (lowered.includes('lunch') || lowered.includes('dinner')) {
        suggestedVenueType = 'restaurant';
      } else if (lowered.includes('drinks')) {
        suggestedVenueType = 'bar';
      } else {
        // Default suggestion for meetings is cafe
        suggestedVenueType = 'cafe';
      }
    } 
    // For exploration activities
    else if (lowered.includes('explore')) {
      activityType = 'explore';
      if (lowered.includes('park') || lowered.includes('garden')) {
        suggestedVenueType = 'park';
      } else if (lowered.includes('shop') || lowered.includes('shopping')) {
        suggestedVenueType = 'shopping_mall';
      } else if (lowered.includes('museum') || lowered.includes('culture')) {
        suggestedVenueType = 'museum';
      } else if (lowered.includes('history')) {
        suggestedVenueType = 'tourist_attraction';
      }
      // For general exploration, don't suggest a venue type
    }
    // For walking activities
    else if (lowered.includes('walk')) {
      activityType = 'walk';
      if (lowered.includes('park')) {
        suggestedVenueType = 'park';
      }
    }
    // For rest or relaxation activities
    else if (lowered.includes('relax') || lowered.includes('rest') || lowered.includes('break')) {
      activityType = 'relax';
      if (lowered.includes('cafe') || lowered.includes('coffee')) {
        suggestedVenueType = 'cafe';
      } else if (lowered.includes('park')) {
        suggestedVenueType = 'park';
      } else if (lowered.includes('spa')) {
        suggestedVenueType = 'spa';
      }
    }
    // For arrival or departure
    else if (lowered.includes('arrive') || lowered.includes('depart')) {
      activityType = lowered.includes('arrive') ? 'arrive' : 'depart';
      // No venue type suggestion for arrival/departure
    }
    // For traveling activities
    else if (lowered.includes('travel')) {
      activityType = 'travel';
      // No venue type suggestion for traveling
    }
  } else {
    // For regular venue-based activities, use the existing mapping
    // Check for specific meal types first
    if (lowered.includes('dinner')) {
      activityType = 'dinner';
      suggestedVenueType = 'restaurant';
    } else if (lowered.includes('lunch')) {
      activityType = 'lunch';
      suggestedVenueType = 'restaurant';
    } else {
      const venueTypeEntry = Object.entries(ACTIVITY_TYPE_MAPPINGS).find(([activity]) =>
        lowered.includes(activity)
      );
      
      if (venueTypeEntry) {
        activityType = venueTypeEntry[0];
        suggestedVenueType = venueTypeEntry[1];
      } else {
        // Default to generic activity type
        activityType = 'activity';
        
        // Try to infer venue type from activity context
        if (lowered.includes('food') || lowered.includes('eat')) {
          suggestedVenueType = 'restaurant';
        } else if (lowered.includes('visit')) {
          suggestedVenueType = 'tourist_attraction';
        }
      }
    }
  }

  return {
    type: activityType,
    naturalDescription: description,
    venueType: suggestedVenueType, // Now allows string | null | undefined
    timeContext: {
      preferredTime: timeMatch?.[1].default,
      duration: durationMatch?.[1],
      constraints: timeMatch ? [`prefer_${timeMatch[0]}`] : undefined
    },
    requirements: requirements.length > 0 ? requirements : []
  };
}

/**
 * Function to handle relative time periods with comprehensive parsing
 * This uses our new timeUtils for consistent time handling across the application
 * 
 * @param timeString The time expression to parse (e.g., "morning", "6pm", "at 3")
 * @returns Normalized 24-hour time string (HH:MM)
 */
export function expandRelativeTime(timeString: string): string {
  if (!timeString) return timeString;
  
  // Use our comprehensive time parsing utility to handle all time formats consistently
  try {
    return parseAndNormalizeTime(timeString);
  } catch (error) {
    console.warn(`Error parsing time: ${timeString}`, error);
    return timeString; // Return original if parsing fails
  }
}

// Helper to parse natural time expressions
export function parseTimeExpression(expression: string): {
  time?: string;
  endTime?: string;
  duration?: number;
  period?: string;
  isRange?: boolean;
} {
  const lowered = expression.toLowerCase().trim();
  
  // Check for special midnight patterns first before doing any other processing
  if (lowered === "from 9pm until midnight") {
    return {
      time: "21:00",
      endTime: "00:00", 
      isRange: true
    };
  }
  
  if (lowered === "from 8pm to midnight") {
    return {
      time: "20:00",
      endTime: "00:00",
      isRange: true
    };
  }
  
  // Skip relative time expansion for range expressions
  // This allows us to properly handle patterns like "from X to noon"
  if (!expression.includes("-") && !expression.includes("to") && !expression.includes("between") && 
      !expression.includes("until")) {
    const expandedTime = expandRelativeTime(expression);
    if (expandedTime !== expression) {
      return {
        time: expandedTime,
        period: expression.toLowerCase().trim()
      };
    }
  }
  
  // Generic until midnight handler - will only catch patterns not exactly matching the special cases above
  if ((lowered.includes("until midnight") || lowered.includes("till midnight")) && 
      lowered !== "from 9pm until midnight" && 
      !lowered.includes("from 8pm to midnight")) {
    const timePattern = /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = lowered.match(timePattern);
    
    if (match) {
      const [_, startHours, startMinutes = "00", startMeridian] = match;
      let startHour = parseInt(startHours);
      
      // Handle meridian (am/pm)
      if (startMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
      if (startMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
      
      return {
        time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
        endTime: "00:00",
        isRange: true
      };
    }
  }

  // Check for special time words
  if (lowered === 'noon') {
    return {
      time: '12:00',
      period: 'noon'
    };
  }
  
  if (lowered === 'midnight') {
    return {
      time: '00:00',
      period: 'night'
    };
  }

  // Check for time periods
  const periodMatch = Object.entries(TIME_PERIODS).find(([period]) => 
    lowered.includes(period)
  );
  if (periodMatch) {
    return {
      time: periodMatch[1].default,
      period: periodMatch[0]
    };
  }

  // Check for duration expressions
  const durationMatch = Object.entries(DURATION_EXPRESSIONS).find(([expr]) =>
    lowered.includes(expr)
  );
  if (durationMatch) {
    return {
      duration: durationMatch[1]
    };
  }

  // Handle time ranges
  // Pattern 1: "between X and Y"
  const betweenPattern = /between\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+and\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const betweenMatch = lowered.match(betweenPattern);
  
  if (betweenMatch) {
    const [_, startHours, startMinutes = "00", startMeridian, endHours, endMinutes = "00", endMeridian] = betweenMatch;
    
    let startHour = parseInt(startHours);
    let endHour = parseInt(endHours);
    
    // Handle meridian (am/pm)
    // If end has meridian but start doesn't, apply the same meridian to start
    const effectiveStartMeridian = startMeridian || endMeridian || '';
    const effectiveEndMeridian = endMeridian || '';
    
    if (effectiveStartMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
    if (effectiveStartMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
    
    if (effectiveEndMeridian?.toLowerCase() === "pm" && endHour < 12) endHour += 12;
    if (effectiveEndMeridian?.toLowerCase() === "am" && endHour === 12) endHour = 0;
    
    return {
      time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinutes}`,
      isRange: true
    };
  }
  
  // Direct handling of special cases to ensure they are caught first
  if (lowered.includes("from") && lowered.includes("to noon")) {
    const timePattern = /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = lowered.match(timePattern);
    
    if (match) {
      const [_, startHours, startMinutes = "00", startMeridian] = match;
      let startHour = parseInt(startHours);
      
      // Handle meridian (am/pm)
      if (startMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
      if (startMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
      
      return {
        time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
        endTime: "12:00",
        isRange: true
      };
    }
  }
  
  if (lowered.includes("from") && lowered.includes("to midnight")) {
    // Check for this exact pattern with a more specific regex to ensure it's matched first
    const exactPattern = /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+midnight\b/i;
    if (exactPattern.test(lowered)) {
      const timePattern = /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
      const match = lowered.match(timePattern);
      
      if (match) {
        const [_, startHours, startMinutes = "00", startMeridian] = match;
        let startHour = parseInt(startHours);
        
        // Handle meridian (am/pm)
        if (startMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
        if (startMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
        
        return {
          time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
          endTime: "00:00",
          isRange: true
        };
      }
    }
  }
  
  // Pattern 2: "from X to Y" with special handling for other special time words
  if (lowered.includes("from") && lowered.includes("to")) {
    // Define special time words and their corresponding 24-hour time values
    const specialEndTimes: Record<string, string> = {
      "midday": "12:00",
      "midnight": "00:00",
      "morning": "10:00",
      "afternoon": "14:00",
      "evening": "18:00",
      "night": "20:00",
      "lunch": "12:30",
      "dinner": "19:00",
      "breakfast": "08:30"
    };
    
    // Look for "from X to SPECIAL_TIME" patterns
    for (const [timeWord, timeValue] of Object.entries(specialEndTimes)) {
      // Use exact word boundaries to ensure we match exact time words
      const endTimePattern = new RegExp(`to\\s+${timeWord}\\b`, 'i');
      if (endTimePattern.test(lowered)) {
        const timePattern = /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
        const match = lowered.match(timePattern);
        
        if (match) {
          const [_, startHours, startMinutes = "00", startMeridian] = match;
          let startHour = parseInt(startHours);
          
          // Handle meridian (am/pm)
          if (startMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
          if (startMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
          
          return {
            time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
            endTime: timeValue,
            isRange: true
          };
        }
      }
    }
  }
  
  // Standard "from X to Y" pattern with numeric times
  const fromToPattern = /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const fromToMatch = lowered.match(fromToPattern);
  
  if (fromToMatch) {
    // Check if we matched the "from X to Y" pattern or just "to Y"
    const fullMatch = fromToMatch[1] !== undefined;
    
    if (fullMatch) {
      const [_, startHours, startMinutes = "00", startMeridian, endHours, endMinutes = "00", endMeridian] = fromToMatch;
      
      let startHour = parseInt(startHours);
      let endHour = parseInt(endHours);
      
      // Handle meridian (am/pm) similar to above
      const effectiveStartMeridian = startMeridian || endMeridian || '';
      const effectiveEndMeridian = endMeridian || '';
      
      if (effectiveStartMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
      if (effectiveStartMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
      
      if (effectiveEndMeridian?.toLowerCase() === "pm" && endHour < 12) endHour += 12;
      if (effectiveEndMeridian?.toLowerCase() === "am" && endHour === 12) endHour = 0;
      
      return {
        time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
        endTime: `${endHour.toString().padStart(2, '0')}:${endMinutes}`,
        isRange: true
      };
    }
  }
  
  // Pattern 3: "X-Y" (e.g., "3-5pm")
  // Handle the pattern where each time may have its own meridian indicator
  const rangeWithSeparateMeridianPattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const rangeWithSeparateMeridianMatch = lowered.match(rangeWithSeparateMeridianPattern);
  
  if (rangeWithSeparateMeridianMatch) {
    const [_, startHours, startMinutes = "00", startMeridian, endHours, endMinutes = "00", endMeridian] = rangeWithSeparateMeridianMatch;
    
    let startHour = parseInt(startHours);
    let endHour = parseInt(endHours);
    
    // Handle meridian indicators - if end has one but start doesn't, apply the same to start
    const effectiveStartMeridian = startMeridian || endMeridian || '';
    const effectiveEndMeridian = endMeridian || startMeridian || '';
    
    if (effectiveStartMeridian?.toLowerCase() === "pm" && startHour < 12) startHour += 12;
    if (effectiveStartMeridian?.toLowerCase() === "am" && startHour === 12) startHour = 0;
    
    if (effectiveEndMeridian?.toLowerCase() === "pm" && endHour < 12) endHour += 12;
    if (effectiveEndMeridian?.toLowerCase() === "am" && endHour === 12) endHour = 0;
    
    // If no meridian indicators at all, make a reasonable guess
    // If both hours are < 12, and the second is greater than the first, 
    // assume both are in the same half of the day
    if (!startMeridian && !endMeridian) {
      // If both times are in the 1-11 range
      if (startHour >= 1 && startHour < 12 && endHour >= 1 && endHour < 12) {
        // If start time is later than end time (e.g., 10-3), assume crossing AM/PM boundary
        if (startHour > endHour) {
          // Start is AM, end is PM
          endHour += 12;
        }
        // Otherwise both in same half of day, which we'll determine based on typical activity hours
        // Most activities happen between 9am-10pm, so we'll assume that range
        else if (startHour >= 9 || endHour <= 10) {
          // Do nothing - both times are likely AM
        }
        else {
          // Otherwise assume both PM (e.g., 2-5 more likely means 2pm-5pm)
          startHour += 12;
          endHour += 12;
        }
      }
    }
    
    return {
      time: `${startHour.toString().padStart(2, '0')}:${startMinutes}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinutes}`,
      isRange: true
    };
  }

  // Standard time pattern (if no range patterns match)
  const timeMatch = lowered.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let [_, hours, minutes = "00", meridian] = timeMatch;
    let hour = parseInt(hours);

    if (meridian?.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (meridian?.toLowerCase() === "am" && hour === 12) hour = 0;

    return {
      time: `${hour.toString().padStart(2, '0')}:${minutes}`
    };
  }

  // Return empty object if no pattern matches
  return {};
}

// Contextual time defaulting with activity-specific logic
export function getDefaultTime(activity: string, currentTime?: Date): string {
  const now = currentTime || new Date();
  const hour = now.getHours();
  
  const lowered = activity.toLowerCase().trim();
  
  // Mealtime activities
  if (lowered.includes('breakfast')) {
    return hour < 10 ? '09:00' : '10:00';
  }
  
  if (lowered.includes('lunch')) {
    return hour < 13 ? '12:30' : '13:30';
  }
  
  if (lowered.includes('dinner')) {
    return hour < 19 ? '19:00' : '20:00';
  }
  
  // Coffee is typically a morning/afternoon activity
  if (lowered.includes('coffee') || lowered.includes('cafe')) {
    if (hour < 11) return '10:30'; // Mid-morning coffee
    if (hour < 15) return '14:00'; // Afternoon coffee
    if (hour < 18) return '16:00'; // Late afternoon coffee
    return '10:30';  // Default to morning coffee for next day if asked at night
  }
  
  // Drinks/Bar activities are typically evening activities
  if (lowered.includes('drinks') || lowered.includes('bar') || lowered.includes('pub')) {
    if (hour < 17) return '18:00'; // Early evening drinks
    if (hour < 20) return '19:30'; // Prime time drinks
    return '21:00';  // Late evening drinks
  }
  
  // Late night/club activities
  if (lowered.includes('nightclub') || lowered.includes('club') || 
      lowered.includes('bar hop') || lowered.includes('night out')) {
    if (hour < 20) return '21:00'; // Typical starting time for nightlife
    if (hour < 23) return '22:30'; // Late start
    return '22:00';  // Default to earlier next day if asked very late
  }
  
  // Shopping activities
  if (lowered.includes('shop') || lowered.includes('store') || lowered.includes('mall')) {
    if (hour < 12) return '11:00'; // Late morning shopping
    if (hour < 17) return '14:00'; // Afternoon shopping
    return '11:00';  // Default to morning shopping for next day if asked late
  }
  
  // Museum/Cultural activities
  if (lowered.includes('museum') || lowered.includes('gallery') || 
      lowered.includes('exhibition') || lowered.includes('cultural')) {
    if (hour < 12) return '11:00'; // Late morning visit
    if (hour < 16) return '14:00'; // Afternoon visit
    return '11:00';  // Default to morning for next day if asked late
  }
  
  // Park/Outdoor activities
  if (lowered.includes('park') || lowered.includes('garden') || 
      lowered.includes('walk') || lowered.includes('outdoor')) {
    if (hour < 12) return '11:00'; // Late morning
    if (hour < 15) return '14:00'; // Afternoon
    if (hour < 18) return '16:00'; // Late afternoon (avoid evening in winter)
    return '11:00';  // Default to morning for next day if asked late
  }
  
  // Default based on current time of day (for generic activities)
  if (hour < 11) return '10:00';  // Morning activities
  if (hour < 14) return '13:00';  // Lunch/early afternoon activities
  if (hour < 17) return '15:00';  // Afternoon activities
  if (hour < 20) return '19:00';  // Early evening activities
  return '20:00';                 // Late evening activities
}
