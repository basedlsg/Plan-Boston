import type { Itinerary } from "@shared/schema";
import { saveAs } from "file-saver";

export function generateICS(itinerary: Itinerary): void {
  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//London Day Planner//EN",
    "CALSCALE:GREGORIAN",
  ];

  itinerary.places.forEach((place) => {
    if (!place.scheduledTime) return;

    const startTime = new Date(place.scheduledTime);
    const endTime = new Date(startTime.getTime() + 90 * 60000); // 90 minutes default duration

    icsContent = icsContent.concat([
      "BEGIN:VEVENT",
      `DTSTART:${startTime.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTEND:${endTime.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `SUMMARY:${place.name}`,
      `LOCATION:${place.address}`,
      "END:VEVENT",
    ]);
  });

  icsContent.push("END:VCALENDAR");

  const blob = new Blob([icsContent.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });

  saveAs(blob, "london-itinerary.ics");
}