
import { format, formatDistanceStrict } from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';

export const formatLocalTime = (date: string | Date) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(date, timeZone, 'h:mm a');
};

export const formatLocalDate = (date: string | Date) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(date, timeZone, 'MMMM d, yyyy');
};

export const formatDuration = (start: Date, end: Date) => {
  return formatDistanceStrict(end, start);
};
