import { useState, ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Clock, Calendar, Loader2, Sparkles } from "lucide-react";
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

/**
 * Validates query for better user experience and clearer error messages
 * Checks for minimal length and location information
 */
const validateQuery = (query: string): { isValid: boolean; message?: string } => {
  if (!query || query.trim().length < 10) {
    return {
      isValid: false,
      message: "Please provide more details about what you'd like to do in Boston."
    };
  }

  // Check if query mentions a Boston location
  const commonBostonLocations = [
    "back bay", "beacon hill", "north end", "fenway",
    "seaport", "downtown", "south end", "cambridge",
    "somerville", "harvard square", "faneuil hall", "boston"
  ];

  const hasLocation = commonBostonLocations.some(location =>
    query.toLowerCase().includes(location)
  );

  if (!hasLocation) {
    return {
      isValid: false,
      message: "Please specify at least one Boston location (e.g., Back Bay, Fenway, or North End)."
    };
  }

  return { isValid: true };
};

/**
 * Enhances vague queries by adding location and time information
 * Helps users by providing more context for better itinerary planning
 */
function enhanceVagueQuery(query: string): string {
  // Extract the key request from a very vague query
  const lowercaseQuery = query.toLowerCase().trim();
  
  // Simple extraction patterns for common activities
  if (lowercaseQuery.length < 20) {
    // Very short query - likely just mentions an activity
    
    // Food-related queries
    if (
      lowercaseQuery.includes("food") || 
      lowercaseQuery.includes("eat") ||
      lowercaseQuery.includes("restaurant") ||
      lowercaseQuery.includes("lunch") ||
      lowercaseQuery.includes("dinner") ||
      lowercaseQuery.includes("sandwich") ||
      lowercaseQuery.includes("breakfast")
    ) {
      return `${query} in Greenwich Village around ${new Date().getHours() < 15 ? '13:00' : '19:00'}`;
    }
    
    // Coffee/cafe queries
    if (
      lowercaseQuery.includes("coffee") ||
      lowercaseQuery.includes("cafe") ||
      lowercaseQuery.includes("tea")
    ) {
      return `${query} in SoHo around ${new Date().getHours() < 12 ? '10:30' : '15:00'}`;
    }
    
    // Shopping queries
    if (
      lowercaseQuery.includes("shop") ||
      lowercaseQuery.includes("store") ||
      lowercaseQuery.includes("buy")
    ) {
      return `${query} in Midtown in the afternoon`;
    }
    
    // Attraction/sightseeing queries
    if (
      lowercaseQuery.includes("see") ||
      lowercaseQuery.includes("visit") ||
      lowercaseQuery.includes("attraction")
    ) {
      return `${query} near Times Square in the afternoon`;
    }
    
    // Spa/relaxation queries
    if (
      lowercaseQuery.includes("spa") ||
      lowercaseQuery.includes("massage") ||
      lowercaseQuery.includes("relax")
    ) {
      return `${query} in Upper East Side in the afternoon`;
    }
    
    // Nightlife queries
    if (
      lowercaseQuery.includes("bar") ||
      lowercaseQuery.includes("pub") ||
      lowercaseQuery.includes("drink") ||
      lowercaseQuery.includes("club")
    ) {
      return `${query} in East Village around 20:00`;
    }
    
    // For any other very short queries, make a generic enhancement
    if (lowercaseQuery.length < 10) {
      return `${query} in Manhattan in the ${new Date().getHours() < 12 ? 'afternoon' : 'evening'}`;
    }
  }
  
  // Return original if no enhancement was needed
  return query;
}

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
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

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
      setIsFormSubmitting(true);
      const res = await apiRequest("POST", "/api/plan", data);
      return res.json();
    },
    onSuccess: (data: Itinerary) => {
      setItinerary(data);
      setIsFormSubmitting(false);
      toast({
        title: "Itinerary created!",
        description: "Your day plan is ready.",
      });
    },
    onError: (error: Error) => {
      setIsFormSubmitting(false);
      toast({
        title: "Error creating itinerary",
        description: error.message || "Please ensure you've specified a starting location and any fixed appointments.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen py-4 sm:py-8 px-3 sm:px-4 relative">
      {/* Fixed position glass effect container */}
      <div className="main-glass-effect"></div>
      <div className="container mx-auto max-w-5xl">
        {/* Logo Section */}
        <div className="logo-container">
          <h1 
            className="logo font-logo text-3xl sm:text-4xl font-bold text-brand-black"
            style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.2))", letterSpacing: "normal" }}
          >
            PLAN
          </h1>
        </div>
        
        {/* Tagline with helper text */}
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-brand-black text-lg sm:text-xl font-semibold">
            Plan Your Perfect Day In Seconds
          </p>
          <p className="text-brand-black text-xs sm:text-sm mt-2 font-medium bg-white/30 inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full backdrop-blur-sm border border-brand-blue/10">
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
                  onSubmit={form.handleSubmit((data) => {
                    // Add validation before form submission
                    const validation = validateQuery(data.query);
                    if (!validation.isValid) {
                      toast({
                        title: "Please enhance your request",
                        description: validation.message,
                        variant: "destructive",
                      });
                      return;
                    }
                    planMutation.mutate(data);
                  })}
                  className={`space-y-6 ${isFormSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
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
                                disabled={isFormSubmitting}
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
                                disabled={isFormSubmitting}
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
                                "e.g. Times Square 9am, brunch in SoHo, Metropolitan Museum, dinner at Carbone 7pm" : 
                                "e.g. Start at Grand Central at 9am, café near SoHo for brunch, then Met Museum until dinner at Carbone at 7pm."
                              }
                              className="min-h-[100px] resize-y"
                              {...field}
                              disabled={isFormSubmitting}
                            />
                          </FormControl>
                          <div className="flex items-center mt-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentQuery = form.getValues().query;
                                const enhanced = enhanceVagueQuery(currentQuery);
                                if (enhanced !== currentQuery) {
                                  form.setValue("query", enhanced);
                                  toast({
                                    title: "Query enhanced",
                                    description: "Added location and time details to your request",
                                  });
                                }
                              }}
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Smart Enhance
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Click to add location and time details to vague requests
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full create-plan-btn"
                    style={{ background: '#17B9E6', color: 'white' }}
                    disabled={isFormSubmitting}
                  >
                    {isFormSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating plan...
                      </>
                    ) : (
                      "Create Plan"
                    )}
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
                        <div className="absolute top-0 left-7 h-full w-px bg-brand-blue/20 -translate-x-1/2" />
                      )}

                      {/* Activity card */}
                      <div className="venue-glass p-4 sm:p-5">
                        <div className="flex items-start gap-3 sm:gap-4 mb-3">
                          <div className="flex-shrink-0 p-1.5 sm:p-2 bg-brand-blue/20 text-brand-blue rounded-full relative z-10">
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-2">
                              <h3 className="font-semibold text-brand-black text-base sm:text-lg truncate" style={{ letterSpacing: 'normal' }}>{place.name}</h3>
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
                      </div>

                      {/* Travel time indicator */}
                      {Array.isArray(itinerary.travelTimes) && 
                       index < (itinerary.travelTimes as Array<{
                        from: string;
                        to: string;
                        duration: number;
                        arrivalTime: string;
                      }>).length && (
                        <div className="ml-6 sm:ml-7 my-3 sm:my-4 p-2 flex items-center gap-2 text-xs sm:text-sm text-brand-black bg-white/50 backdrop-blur-sm rounded-md border border-brand-blue/10 shadow-sm">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-brand-blue" />
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