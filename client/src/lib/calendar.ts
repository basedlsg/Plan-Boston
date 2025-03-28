import { saveAs } from 'file-saver';

export function exportToCalendar(venues: any[]) {
  if (!venues || venues.length === 0) {
    console.error('No venues to export to calendar');
    return;
  }

  // Generate iCal content
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//London Day Planner//EN',
    'CALSCALE:GREGORIAN',
  ];

  // Add events for each venue
  venues.forEach(venue => {
    // Parse time from the venue data
    let startTime;
    try {
      // Expecting time in "HH:MM" or "X PM/AM" format
      const timeParts = venue.time.match(/(\d+):(\d+)|(\d+)(?:\s*)(am|pm)/i);
      if (timeParts) {
        startTime = new Date();
        
        if (timeParts[1] && timeParts[2]) {
          // HH:MM format
          startTime.setHours(parseInt(timeParts[1], 10));
          startTime.setMinutes(parseInt(timeParts[2], 10));
        } else if (timeParts[3]) {
          // X AM/PM format
          let hours = parseInt(timeParts[3], 10);
          const isPM = timeParts[4]?.toLowerCase() === 'pm';
          
          if (isPM && hours < 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          
          startTime.setHours(hours);
          startTime.setMinutes(0);
        }
      } else {
        // Fallback - use current time
        startTime = new Date();
      }
    } catch (error) {
      console.error('Error parsing time:', error);
      startTime = new Date();
    }
    
    // Event duration - default 1.5 hours (90 minutes)
    const endTime = new Date(startTime.getTime() + 90 * 60000);
    
    // Format dates for iCal
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    icalContent = icalContent.concat([
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startTime)}`,
      `DTEND:${formatDate(endTime)}`,
      `SUMMARY:${venue.name}`,
      `LOCATION:${venue.address || 'London, UK'}`,
      `DESCRIPTION:${venue.categories?.join(', ') || 'London Day Planner event'}`,
      'END:VEVENT'
    ]);
  });
  
  icalContent.push('END:VCALENDAR');
  
  // Create and download the file
  const blob = new Blob([icalContent.join('\r\n')], { 
    type: 'text/calendar;charset=utf-8' 
  });
  
  saveAs(blob, 'london-day-planner.ics');
}