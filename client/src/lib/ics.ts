import type { Itinerary } from "@shared/schema";
import { saveAs } from "file-saver";

export function generateICS(itinerary: Itinerary): void {
  const places = itinerary.places;
  const travelTimes = itinerary.travelTimes;

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//London Day Planner//EN",
    "CALSCALE:GREGORIAN",
  ];

  // Use today's date for the itinerary
  const date = new Date();
  date.setHours(9, 0, 0); // Start at 9 AM

  places.forEach((place, index) => {
    const startTime = new Date(date);
    const duration = index < travelTimes.length ? travelTimes[index].duration : 60;
    const endTime = new Date(date.getTime() + duration * 60000);

    icsContent = icsContent.concat([
      "BEGIN:VEVENT",
      `DTSTART:${startTime.toISOString().replace(/[-:]/g, "").split(".")[0]}`,
      `DTEND:${endTime.toISOString().replace(/[-:]/g, "").split(".")[0]}`,
      `SUMMARY:${place.name}`,
      `LOCATION:${place.address}`,
      "END:VEVENT",
    ]);

    date.setTime(endTime.getTime() + 30 * 60000); // Add 30 min buffer
  });

  icsContent.push("END:VCALENDAR");

  const blob = new Blob([icsContent.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });

  saveAs(blob, "london-itinerary.ics");
}
