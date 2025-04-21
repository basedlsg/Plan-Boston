/**
 * Time Utilities Module
 * 
 * This module provides functions for parsing and handling time-related operations
 * for the itinerary planning application.
 */

/**
 * Parse and normalize a time string into 24-hour format (HH:MM)
 * 
 * This function handles various time formats including:
 * - 12-hour format (e.g. "6pm", "3 PM", "10:30am")
 * - 24-hour format (e.g. "14:00", "18:00")
 * - Relative time expressions (e.g. "morning", "afternoon", "evening")
 * 
 * @param timeStr String representation of time to parse
 * @returns Normalized time string in 24-hour format (HH:MM)
 */
export function parseAndNormalizeTime(timeStr: string): string {
  if (!timeStr) return "12:00"; // Default to noon if no time provided
  
  // First, check if it's already in HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Ensure hours are within valid range
    const validHours = Math.min(Math.max(hours, 0), 23);
    const validMinutes = Math.min(Math.max(minutes, 0), 59);
    
    return `${validHours.toString().padStart(2, '0')}:${validMinutes.toString().padStart(2, '0')}`;
  }
  
  // Handle relative time periods (morning, afternoon, evening, night)
  const timeOfDay = timeStr.toLowerCase().trim();
  
  // Extract time from "around X" phrases first
  const aroundTimeMatch = timeOfDay.match(/around\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (aroundTimeMatch) {
    // This matches phrases like "around 3" or "around 3pm" or "around 3:30 PM"
    let [_, hours, minutes, meridian] = aroundTimeMatch;
    let hoursNum = parseInt(hours);
    
    // Handle meridian (AM/PM) if provided
    if (meridian) {
      const isPM = meridian.toLowerCase().startsWith('p');
      // Handle 12 AM -> 00:00, 12 PM -> 12:00
      if (hoursNum === 12) {
        hoursNum = isPM ? 12 : 0;
      } else if (isPM) {
        hoursNum += 12;
      }
    } else {
      // If no AM/PM provided, assume PM for 1-11 during the day
      if (hoursNum >= 1 && hoursNum <= 11) {
        hoursNum += 12;
      }
    }
    
    const minutesNum = minutes ? parseInt(minutes) : 0;
    return `${hoursNum.toString().padStart(2, '0')}:${minutesNum.toString().padStart(2, '0')}`;
  }
  
  // Standard time periods
  if (['morning', 'breakfast', 'dawn', 'early'].some(term => timeOfDay.includes(term))) {
    return "09:00"; // 9 AM for morning
  }
  if (['noon', 'midday', 'lunch'].some(term => timeOfDay.includes(term))) {
    return "12:00"; // 12 PM for noon
  }
  if (['afternoon', 'tea', 'post-lunch'].some(term => timeOfDay.includes(term))) {
    return "15:00"; // 3 PM for afternoon
  }
  if (['evening', 'dinner', 'sunset'].some(term => timeOfDay.includes(term))) {
    return "18:00"; // 6 PM for evening
  }
  if (['night', 'late', 'drinks', 'pub', 'bar', 'club'].some(term => timeOfDay.includes(term))) {
    return "21:00"; // 9 PM for night/nightlife
  }
  
  // Parse 12-hour format with meridian (am/pm)
  const meridianMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
  if (meridianMatch) {
    let [_, hours, minutes, meridian] = meridianMatch;
    const isPM = meridian.toLowerCase().startsWith('p');
    
    let hoursNum = parseInt(hours);
    // Handle 12 AM -> 00:00, 12 PM -> 12:00
    if (hoursNum === 12) {
      hoursNum = isPM ? 12 : 0;
    } else if (isPM) {
      hoursNum += 12;
    }
    
    const minutesNum = minutes ? parseInt(minutes) : 0;
    
    return `${hoursNum.toString().padStart(2, '0')}:${minutesNum.toString().padStart(2, '0')}`;
  }
  
  // Handle simple hour mentions like "at 6" (assume PM for 1-11, AM for 12)
  const simpleHourMatch = timeStr.match(/\b(?:at|around|by|from)\s+(\d{1,2})\b/i);
  if (simpleHourMatch) {
    const hourNum = parseInt(simpleHourMatch[1]);
    const fullText = timeStr.toLowerCase();
    
    // Context-aware time parsing
    // For dinner, steak, evening activities, assume evening/night hours
    const isEveningContext = fullText.includes('dinner') || 
                            fullText.includes('steak') || 
                            fullText.includes('evening') || 
                            fullText.includes('night') ||
                            fullText.includes('drinks');
                            
    // For breakfast, coffee, morning activities, assume morning hours
    const isMorningContext = fullText.includes('breakfast') || 
                            fullText.includes('coffee') ||
                            fullText.includes('morning') ||
                            fullText.includes('early');
    
    // For lunch, afternoon activities, assume afternoon hours
    const isAfternoonContext = fullText.includes('lunch') || 
                              fullText.includes('afternoon');
    
    // Make time adjustments based on context
    let adjusted = hourNum;
    
    if (hourNum >= 1 && hourNum <= 11) {
      if (isEveningContext && hourNum >= 5) {
        // Evening context - use PM time (5-11 PM)
        adjusted = hourNum + 12;
        console.log(`Evening context detected in "${timeStr}", adjusted ${hourNum} to ${adjusted}:00`);
      } else if (isMorningContext) {
        // Morning context - keep as AM time
        adjusted = hourNum;
        console.log(`Morning context detected in "${timeStr}", keeping as ${adjusted}:00 AM`);
      } else if (isAfternoonContext) {
        // Afternoon context - use PM time for 1-5
        adjusted = hourNum + 12;
        console.log(`Afternoon context detected in "${timeStr}", adjusted ${hourNum} to ${adjusted}:00`);
      } else {
        // Default behavior - assume PM for 1-11 in absence of specific context
        adjusted = hourNum + 12;
        console.log(`No specific context in "${timeStr}", assuming PM, adjusted ${hourNum} to ${adjusted}:00`);
      }
    }
    
    return `${adjusted.toString().padStart(2, '0')}:00`;
  }
  
  // If we can't parse it, return a reasonable default (noon)
  console.warn(`Could not parse time string: "${timeStr}", defaulting to noon`);
  return "12:00";
}

/**
 * Determines if a time is in the morning (before noon)
 */
export function isMorning(timeStr: string): boolean {
  const normalized = parseAndNormalizeTime(timeStr);
  const [hours] = normalized.split(':').map(Number);
  return hours >= 5 && hours < 12;
}

/**
 * Determines if a time is in the afternoon (12pm-5pm)
 */
export function isAfternoon(timeStr: string): boolean {
  const normalized = parseAndNormalizeTime(timeStr);
  const [hours] = normalized.split(':').map(Number);
  return hours >= 12 && hours < 17;
}

/**
 * Determines if a time is in the evening (5pm-9pm)
 */
export function isEvening(timeStr: string): boolean {
  const normalized = parseAndNormalizeTime(timeStr);
  const [hours] = normalized.split(':').map(Number);
  return hours >= 17 && hours < 21;
}

/**
 * Determines if a time is at night (9pm-5am)
 */
export function isNight(timeStr: string): boolean {
  const normalized = parseAndNormalizeTime(timeStr);
  const [hours] = normalized.split(':').map(Number);
  return hours >= 21 || hours < 5;
}

/**
 * Format a time string for display (e.g. "14:30" to "2:30 PM")
 */
export function formatTimeForDisplay(timeStr: string): string {
  const normalized = parseAndNormalizeTime(timeStr);
  const [hoursStr, minutesStr] = normalized.split(':');
  
  const hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${displayHours}:${minutesStr} ${period}`;
}

/**
 * Add minutes to a time string and return the new time
 */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const normalized = parseAndNormalizeTime(timeStr);
  const [hours, minutes] = normalized.split(':').map(Number);
  
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setMinutes(date.getMinutes() + minutesToAdd);
  
  const newHours = date.getHours().toString().padStart(2, '0');
  const newMinutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${newHours}:${newMinutes}`;
}

/**
 * Calculate the time difference in minutes between two time strings
 */
export function getMinutesBetweenTimes(startTimeStr: string, endTimeStr: string): number {
  const start = parseAndNormalizeTime(startTimeStr);
  const end = parseAndNormalizeTime(endTimeStr);
  
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  
  const startDate = new Date();
  startDate.setHours(startHours, startMinutes, 0, 0);
  
  const endDate = new Date();
  endDate.setHours(endHours, endMinutes, 0, 0);
  
  // Handle times that cross midnight
  if (endDate < startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }
  
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}