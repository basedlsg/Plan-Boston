import React from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Share } from 'lucide-react';
import { exportToCalendar } from '../lib/calendar';

// Interface for a venue/place in the itinerary
interface Venue {
  name: string;
  time: string;
  address: string;
  rating?: number;
  categories?: string[];
}

// Interface for travel information between venues
interface TravelInfo {
  duration: string;
  destination: string;
}

// Interface for the complete itinerary data
interface ItineraryData {
  id: number;
  query: string;
  places: Venue[];
  travelTimes: TravelInfo[];
  created_at: string;
}

const ItineraryPage = () => {
  const { id } = useParams<{ id: string }>();
  
  // Fetch the itinerary data
  const { data: itinerary, isLoading, error } = useQuery<ItineraryData>({
    queryKey: [`/api/itineraries/${id}`],
    enabled: !!id,
  });

  // Format the time string for display
  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timeString; // Return the original string if parsing fails
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'Unknown date'; // Fallback
    }
  };

  // Handle exporting the itinerary to calendar
  const handleExport = () => {
    if (itinerary?.places) {
      exportToCalendar(itinerary.places);
    }
  };

  // Handle sharing the itinerary
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `London Itinerary #${id}`,
        text: 'Check out my London day plan!',
        url: window.location.href,
      })
      .catch((error) => console.log('Error sharing:', error));
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copied to clipboard!'))
        .catch(() => alert('Failed to copy link'));
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {isLoading ? <Skeleton className="h-9 w-64" /> : `London Itinerary #${id}`}
          </h1>
          {itinerary && (
            <p className="text-muted-foreground mt-1">
              {formatDate(itinerary.created_at)}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button onClick={handleExport} disabled={isLoading || !itinerary}>
            Export to Calendar
          </Button>
          <Button variant="outline" onClick={handleShare} disabled={isLoading || !itinerary}>
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Link href="/">
            <Button variant="secondary">New Plan</Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        // Loading state
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-[150px] w-full" />
            <Skeleton className="h-[150px] w-full" />
          </div>
        </div>
      ) : error ? (
        // Error state
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <h3 className="text-xl font-semibold text-destructive mb-2">Failed to load itinerary</h3>
              <p className="text-muted-foreground">
                We couldn't retrieve the requested itinerary. It may have been deleted or you may not have permission to view it.
              </p>
              <Link href="/">
                <Button className="mt-4">Return to Planner</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : itinerary ? (
        // Loaded state with data
        <div className="space-y-6">
          {/* Query Card */}
          <Card>
            <CardHeader>
              <CardTitle>Original Request</CardTitle>
              <CardDescription>Your request for planning this day in London</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="italic">"{itinerary.query}"</p>
            </CardContent>
          </Card>

          {/* Itinerary Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle>Your Day in London</CardTitle>
              <CardDescription>A personalized itinerary for your perfect day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {itinerary.places && itinerary.places.map((place, index) => (
                  <div key={index} className="relative pl-6 pb-8 border-l border-muted last:border-l-transparent">
                    {/* Time indicator dot */}
                    <div className="absolute top-0 left-0 -translate-x-1/2 w-4 h-4 rounded-full bg-primary"></div>
                    
                    <div className="mb-1 font-medium">{formatTime(place.time)}</div>
                    <div className="font-bold text-lg">{place.name}</div>
                    <div className="text-muted-foreground text-sm mb-2">{place.address}</div>
                    
                    {/* Display categories if available */}
                    {place.categories && place.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {place.categories.map((category, idx) => (
                          <span key={idx} className="text-xs bg-muted px-2 py-1 rounded-md">
                            {category}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Show travel info if not the last place */}
                    {index < (itinerary.places.length - 1) && itinerary.travelTimes && itinerary.travelTimes[index] && (
                      <div className="mt-3 text-sm text-muted-foreground italic">
                        <span className="font-medium">Next:</span> {itinerary.travelTimes[index].duration} travel to {itinerary.travelTimes[index].destination}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Empty state (should never happen if isLoading is false and there's no error)
        <div className="text-center py-10">
          <p>No itinerary data available.</p>
          <Link href="/">
            <Button className="mt-4">Return to Planner</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default ItineraryPage;