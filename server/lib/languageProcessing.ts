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
  venueType?: string;
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

  // Check for non-venue activities first
  const nonVenueActivities = [
    'meeting', 'arrive', 'depart', 'explore', 'walk', 
    'travel', 'relax', 'break', 'rest'
  ];
  
  const isNonVenueActivity = nonVenueActivities.some(activity => 
    lowered.includes(activity)
  );
  
  // Special handling for specific non-venue activities
  let activityType = 'activity';
  let suggestedVenueType = undefined;
  
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
    venueType: suggestedVenueType, // This will be string | undefined (no null)
    timeContext: {
      preferredTime: timeMatch?.[1].default,
      duration: durationMatch?.[1],
      constraints: timeMatch ? [`prefer_${timeMatch[0]}`] : undefined
    },
    requirements: requirements.length > 0 ? requirements : []
  };
}

// Function to handle relative time periods
export function expandRelativeTime(timeString: string): string {
  // Map of relative times to reasonable hour ranges 
  // Using the same TimePeriod type we defined earlier
  const timeMap: Record<TimePeriod | string, string> = {
    'morning': '10:00',
    'afternoon': '14:00',
    'evening': '18:00',
    'night': '20:00',
    'lunch': '12:30',
    'dinner': '19:00',
    'breakfast': '08:30'
  };
  
  // Try to match the timeString to our map
  const normalized = timeString.toLowerCase().trim();
  
  // Use safer property access with explicit check
  if (Object.prototype.hasOwnProperty.call(timeMap, normalized)) {
    return timeMap[normalized];
  }
  
  // If not found in our map, return the original string for further processing
  return timeString;
}

// Helper to parse natural time expressions
export function parseTimeExpression(expression: string): {
  time?: string;
  duration?: number;
  period?: string;
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

  // Check for time periods first
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

  // Try to extract specific time
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

  return {};
}

// Contextual time defaulting
export function getDefaultTime(activity: string, currentTime?: Date): string {
  const now = currentTime || new Date();
  const hour = now.getHours();
  
  // Map activities to logical default times
  if (activity.toLowerCase().includes('breakfast')) {
    return hour < 10 ? '09:00' : '10:00';
  }
  if (activity.toLowerCase().includes('lunch')) {
    return hour < 13 ? '12:30' : '13:30';
  }
  if (activity.toLowerCase().includes('dinner')) {
    return hour < 19 ? '19:00' : '20:00';
  }
  
  // Default based on current time
  if (hour < 11) return '10:00';
  if (hour < 14) return '13:00';
  if (hour < 17) return '15:00';
  if (hour < 20) return '19:00';
  return '20:00';
}
