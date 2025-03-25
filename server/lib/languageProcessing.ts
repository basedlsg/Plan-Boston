import { z } from "zod";
import Fuse from 'fuse.js';
import { londonAreas, LondonArea } from "../data/london-areas";
import { ACTIVITY_TYPE_MAPPINGS } from "./locationNormalizer";

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
const locationSearcher = new Fuse(londonAreas, {
  keys: ['name', 'characteristics', 'neighbors'],
  includeScore: true,
  threshold: 0.4
});

// Time period mappings with flexible ranges
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night' | 'lunch' | 'dinner' | 'breakfast';
type TimeRange = { start: string; end: string; default: string };

const TIME_PERIODS: Record<TimePeriod, TimeRange> = {
  morning: { start: '08:00', end: '11:59', default: '10:00' },
  afternoon: { start: '12:00', end: '16:59', default: '14:00' },
  evening: { start: '17:00', end: '20:59', default: '18:00' },
  night: { start: '21:00', end: '23:59', default: '21:00' },
  lunch: { start: '12:00', end: '14:30', default: '12:30' },
  dinner: { start: '18:00', end: '21:00', default: '19:00' },
  breakfast: { start: '07:00', end: '10:30', default: '09:00' }
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
    const exactMatch = londonAreas.find(area => 
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
      return {
        name: bestMatch.item.name,
        type: 'neighborhood',
        confidence: 1 - (bestMatch.score || 0),
        alternatives: fuzzyResults.slice(1, 4).map(r => r.item.name),
        context: {
          nearbyAreas: bestMatch.item.neighbors,
          borough: bestMatch.item.borough,
          characteristics: bestMatch.item.characteristics
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

  // Check for non-venue activities
  const nonVenueActivities = [
    'meeting', 'arrive', 'depart', 'explore', 'walk', 
    'travel', 'relax', 'break', 'rest'
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

// Function to handle relative time periods with fuzzy matching
export function expandRelativeTime(timeString: string): string {
  if (!timeString) return timeString;
  
  // Enhanced map of relative times to reasonable hour ranges
  // Including more variations and time-of-day terminology
  const timeMap: Record<string, string> = {
    // Time periods
    'morning': '10:00',
    'early morning': '08:00',
    'late morning': '11:30',
    'noon': '12:00',
    'midday': '12:00',
    'afternoon': '14:00',
    'early afternoon': '13:00',
    'late afternoon': '16:00',
    'evening': '18:00',
    'early evening': '17:30',
    'late evening': '20:00',
    'night': '20:00',
    'late night': '22:00',
    'midnight': '00:00',
    
    // Meal times
    'breakfast': '08:30',
    'early breakfast': '07:30',
    'late breakfast': '10:00',
    'brunch': '11:00',
    'lunch': '12:30',
    'early lunch': '12:00',
    'late lunch': '14:00',
    'tea time': '16:00',
    'dinner': '19:00',
    'early dinner': '18:00',
    'late dinner': '20:30',
    'supper': '19:30',
    
    // Other expressions
    'first thing': '08:00',
    'start of day': '09:00',
    'end of day': '17:00',
    'business hours': '10:00',
    'opening time': '09:00',
    'closing time': '18:00',
    'rush hour': '17:30',
    'happy hour': '17:00',
    'after work': '18:00'
  };
  
  // Normalize the input
  const normalized = timeString.toLowerCase().trim();
  
  // Check for exact matches first
  if (Object.prototype.hasOwnProperty.call(timeMap, normalized)) {
    return timeMap[normalized];
  }
  
  // For phrases like "in the morning" or "during the evening"
  for (const [timePeriod, timeValue] of Object.entries(timeMap)) {
    const pattern = new RegExp(`\\b${timePeriod}\\b`, 'i');
    if (pattern.test(normalized)) {
      return timeValue;
    }
    
    // Check for possessive forms (e.g., "morning's")
    if (normalized.includes(`${timePeriod}'s`)) {
      return timeValue;
    }
    
    // Fuzzy match for prepositions (in the morning, during afternoon, etc.)
    const prepositions = ['in', 'during', 'at', 'around', 'about', 'by', 'before', 'after'];
    for (const preposition of prepositions) {
      if (normalized.includes(`${preposition} ${timePeriod}`)) {
        return timeValue;
      }
    }
  }
  
  // Special handling for hour-based expressions
  if (normalized.includes('o\'clock')) {
    // Extract the hour number
    const match = normalized.match(/(\d+)\s*o'clock/i);
    if (match && match[1]) {
      const hour = parseInt(match[1]);
      
      // Handle ambiguous times (assume pm for 1-11, am for 12)
      if (hour >= 1 && hour <= 11) {
        // Default to PM for o'clock expressions (more common in conversation)
        return `${(hour + 12).toString().padStart(2, '0')}:00`;
      } else if (hour === 12) {
        return '12:00';
      } else if (hour >= 0 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:00`;
      }
    }
  }
  
  // If no match found, return the original string for further processing
  return timeString;
}

// Helper to parse natural time expressions
export function parseTimeExpression(expression: string): {
  time?: string;
  endTime?: string;
  duration?: number;
  period?: string;
  isRange?: boolean;
} {
  // First handle relative time expressions
  const expandedTime = expandRelativeTime(expression);
  if (expandedTime !== expression) {
    return {
      time: expandedTime,
      period: expression.toLowerCase().trim()
    };
  }

  const lowered = expression.toLowerCase().trim();

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
  
  // Pattern 2: "from X to Y" with special handling for noon/midnight
  // First check if contains "noon" or "midnight"
  if (lowered.includes("from") && lowered.includes("to")) {
    // Special case for "from X to noon"
    if (lowered.includes("to noon")) {
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
    
    // Special case for "from X to midnight"
    else if (lowered.includes("to midnight")) {
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
  const rangePattern = /(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const rangeMatch = lowered.match(rangePattern);
  
  if (rangeMatch) {
    const [_, startHours, startMinutes = "00", endHours, endMinutes = "00", meridian] = rangeMatch;
    
    let startHour = parseInt(startHours);
    let endHour = parseInt(endHours);
    
    // In the X-Y format, if there's a single meridian, it applies to both times
    if (meridian?.toLowerCase() === "pm") {
      if (startHour < 12) startHour += 12;
      if (endHour < 12) endHour += 12;
    } else if (meridian?.toLowerCase() === "am") {
      if (startHour === 12) startHour = 0;
      if (endHour === 12) endHour = 0;
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
