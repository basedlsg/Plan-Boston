import { format, parseISO, formatDistanceToNow } from 'date-fns';

// Time format preferences
export type TimeFormat = '12h' | '24h';

export function formatTime(date: string | Date, timeFormat: TimeFormat = '12h'): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, timeFormat === '12h' ? 'h:mm a' : 'HH:mm');
}

export function formatDateTime(date: string | Date, timeFormat: TimeFormat = '12h'): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, timeFormat === '12h' ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy HH:mm');
}

export function getLocalTimeNow(): Date {
  return new Date();
}

export function isValidTime(timeString: string): boolean {
  // Support both 12h and 24h formats
  const time24hRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const time12hRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/;
  
  return time24hRegex.test(timeString) || time12hRegex.test(timeString);
}

export function convertTo24Hour(timeString: string): string {
  if (time24hRegex.test(timeString)) return timeString;
  
  const [time, period] = timeString.split(/\s+/);
  const [hours, minutes] = time.split(':').map(Number);
  
  let hour24 = hours;
  if (period?.toLowerCase() === 'pm' && hours !== 12) {
    hour24 = hours + 12;
  } else if (period?.toLowerCase() === 'am' && hours === 12) {
    hour24 = 0;
  }
  
  return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function getTimeFromNow(date: string | Date): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(parsedDate, { addSuffix: true });
}

const time24hRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;