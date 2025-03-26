import { useState, ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Clock, Calendar } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateICS } from "@/lib/ics";
import type { Itinerary, Place, PlaceDetails } from "@shared/schema";
import { format } from "date-fns";
import { TimeInput } from "@/components/TimeInput";
import { formatDateTime, formatTime, getLocalTimeNow } from "@/lib/dateUtils";
import { Link } from "wouter";
import VenueSwiper from "@/components/VenueSwiper";

const formSchema = z.object({
  query: z.string().min(10, "Please provide more details about your plans"),
  date: z.string().optional(),
  startTime: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState<string>("");
  // State to track if user has seen the swipe hint
  const [shownSwipeHint, setShownSwipeHint] = useState<boolean>(false);

  useState(() => {
    fetch("/api/time")
      .then(res => res.json())
      .then(data => {
        const localDate = new Date(data.currentTime);
        setCurrentTime(format(localDate, "yyyy-MM-dd'T'HH:mm"));
      })
      .catch(console.error);
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: format(new Date(), "HH:mm"),
    },
  });

  const planMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/plan", data);
      return res.json();
    },
    onSuccess: (data: Itinerary) => {
      setItinerary(data);
      // Show the swipe hint when first creating an itinerary
      if (!shownSwipeHint) {
        toast({
          title: "Itinerary created!",
          description: "For each venue, you can swipe to see alternatives.",
        });
        setShownSwipeHint(true);
      } else {
        toast({
          title: "Itinerary created!",
          description: "Your day plan is ready.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating itinerary",
        description: error.message || "Please ensure you've specified a starting location and any fixed appointments.",
        variant: "destructive",
      });
    },
  });
  
  // Handler for when a user selects a different venue from the VenueSwiper
  const handleVenueSelection = (index: number, selectedVenue: PlaceDetails) => {
    if (!itinerary) return;
    
    // Make a copy of the places array
    const updatedPlaces = [...itinerary.places as Place[]];
    
    // Create a new place object with the selected venue data
    const updatedPlace: Place = {
      ...updatedPlaces[index],
      placeId: selectedVenue.place_id,
      name: selectedVenue.name,
      address: selectedVenue.formatted_address,
      location: selectedVenue.geometry.location,
      details: selectedVenue
    };
    
    // Replace the place at the specified index
    updatedPlaces[index] = updatedPlace;
    
    // Update the itinerary state
    setItinerary({
      ...itinerary,
      places: updatedPlaces
    });
    
    toast({
      title: "Venue updated",
      description: `Changed to ${selectedVenue.name}`,
    });
  };

  return (
    <div className="min-h-screen py-4 sm:py-8 px-3 sm:px-4 relative">
      {/* Fixed position glass effect container */}
      <div className="main-glass-effect"></div>
      <div className="container mx-auto max-w-5xl">
        {/* Logo Section */}
        <div className="logo-container">
          <h1 
            className="logo font-logo text-3xl sm:text-4xl font-bold text-brand-black tracking-wide"
            style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.2))" }}
          >
            PLAN
          </h1>
        </div>
        
        {/* Tagline with helper text */}
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-white text-lg sm:text-xl font-semibold drop-shadow-md">
            Plan Your Perfect Day In Seconds
          </p>
          <p className="text-white text-xs sm:text-sm mt-2 font-medium bg-white/10 inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full backdrop-blur-sm">
            Enter your activities, locations and times below
          </p>
        </div>

        {/* Main Content */}
        <div className="mb-12">
          {/* Form Container - With blue tint */}
          <div className="form-container mb-8 sm:mb-10">
            <div className="p-4 sm:p-8">
              <h2 className="text-2xl font-bold text-brand-black mb-6 text-center">What's The Plan?</h2>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => planMutation.mutate(data))}
                  className="space-y-6"
                >
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="datetime-card p-3">
                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-brand-black">Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                className="placeholder-opacity-50"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="datetime-card p-3">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-brand-black">Start Time</FormLabel>
                            <FormControl>
                              <TimeInput
                                value={field.value || ""}
                                onChange={field.onChange}
                                className="w-full placeholder-opacity-50"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="datetime-card p-3">
                    <FormField
                      control={form.control}
                      name="query"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-brand-black">Your Plans</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={window.innerWidth < 640 ? 
                                "e.g. Kings Cross 9am, brunch in Covent Garden, British Museum, dinner at The Ivy 7pm" : 
                                "e.g. Start at Kings Cross at 9am, café near Covent Garden for brunch, then British Museum until dinner at The Ivy at 7pm."
                              }
                              className="min-h-[100px] resize-y"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full create-plan-btn text-white"
                    disabled={planMutation.isPending}
                  >
                    {planMutation.isPending ? "Creating plan..." : "Create Plan"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>

          {/* Itinerary Display */}
          {itinerary && (
            <div className="glass-card">
              <div className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
                  <h2 className="text-2xl font-bold text-brand-black">Your Itinerary</h2>
                  <Button
                    variant="outline"
                    className="text-brand-black border-brand-blue hover:text-brand-blue bg-white/20 backdrop-blur-sm w-full sm:w-auto"
                    onClick={() => generateICS(itinerary)}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Export to Calendar
                  </Button>
                </div>
                <div className="space-y-6">
                  {(itinerary.places as Place[]).map((place, index) => (
                    <div key={`${place.placeId}-${index}`} className="relative">
                      {/* Timeline connector */}
                      {index > 0 && (
                        <div className="absolute top-0 left-7 h-full w-px bg-white/40 -translate-x-1/2" />
                      )}

                      {/* Activity card */}
                      <div className="venue-glass p-4 sm:p-5">
                        <div className="flex items-start gap-3 sm:gap-4 mb-3">
                          <div className="flex-shrink-0 p-1.5 sm:p-2 bg-brand-blue/20 text-brand-blue rounded-full relative z-10">
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-2">
                              <h3 className="font-semibold text-brand-black text-base sm:text-lg truncate">{place.name}</h3>
                              {place.scheduledTime && (
                                <span className="text-xs sm:text-sm text-brand-black/80 font-mono">
                                  {formatTime(place.scheduledTime)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-brand-black/70 mt-1 truncate">
                              {place.address}
                            </p>
                          </div>
                        </div>
                        
                        {/* VenueSwiper - only show for places with alternatives */}
                        {(() => {
                          // Ensure proper type handling inside this isolated IIFE
                          if (place.alternatives && 
                              Array.isArray(place.alternatives) && 
                              place.details && 
                              (place.alternatives as PlaceDetails[]).length > 0) {
                            return (
                              <div className="mt-3 venue-container">
                                <VenueSwiper 
                                  primary={place.details as PlaceDetails}
                                  alternatives={place.alternatives as PlaceDetails[]}
                                  onSelect={(venue) => handleVenueSelection(index, venue)}
                                  className="w-full"
                                />
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Travel time indicator */}
                      {Array.isArray(itinerary.travelTimes) && 
                       index < (itinerary.travelTimes as Array<{
                        from: string;
                        to: string;
                        duration: number;
                        arrivalTime: string;
                      }>).length && (
                        <div className="ml-6 sm:ml-7 my-3 sm:my-4 p-2 flex items-center gap-2 text-xs sm:text-sm text-white bg-white/20 backdrop-blur-sm rounded-md">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="truncate">
                            {(itinerary.travelTimes as Array<any>)[index].duration} minutes to{" "}
                            {(itinerary.travelTimes as Array<any>)[index].to}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}