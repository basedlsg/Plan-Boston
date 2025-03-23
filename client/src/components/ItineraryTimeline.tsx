
import { Card } from "./ui/card";
import { formatLocalTime, formatDuration } from "../lib/dateUtils";

export function ItineraryTimeline({ itinerary }) {
  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:w-0.5 before:-translate-x-1/2 before:bg-gradient-to-b before:from-primary/50 before:to-primary/20">
      {itinerary?.places.map((place, index) => (
        <div key={place.id} className="relative pl-8">
          <div className="absolute left-0 top-3 w-4 h-4 bg-primary/10 border-2 border-primary rounded-full" />
          <Card className="p-4 hover:shadow-lg transition-shadow">
            <h3 className="font-semibold">{place.name}</h3>
            <p className="text-sm text-muted-foreground">
              {formatLocalTime(place.scheduledTime)}
            </p>
            {itinerary.travelTimes[index] && (
              <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
                <span className="inline-block px-2 py-1 bg-secondary rounded-md">
                  {formatDuration(
                    new Date(itinerary.travelTimes[index].from),
                    new Date(itinerary.travelTimes[index].to)
                  )}
                </span>
                {" travel time"}
              </div>
            )}
          </Card>
        </div>
      ))}
    </div>
  );
}
