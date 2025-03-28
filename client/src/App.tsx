import React, { useState } from 'react';
import Logo from './components/Logo';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from './lib/queryClient';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/theme-toggle';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateICS } from '@/lib/ics';

const formSchema = z.object({
  query: z.string().min(10, "Please provide more details about your plans"),
  date: z.string().optional(),
  startTime: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function App() {
  const [itinerary, setItinerary] = useState(null);
  const { toast } = useToast();
  const [currentTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

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
    onSuccess: (data) => {
      setItinerary(data);
      toast({
        title: "Itinerary created!",
        description: "Your day plan is ready.",
      });
      
      // Smooth scroll to the itinerary section
      setTimeout(() => {
        const itineraryElement = document.getElementById('itinerary-section');
        if (itineraryElement) {
          itineraryElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating itinerary",
        description: error.message || "Please ensure you've specified a starting location and any fixed appointments.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="container mx-auto max-w-5xl p-4">
        {/* Input Section */}
        <div className="mt-8 mb-12">
          <div className="flex flex-col items-center mb-6">
            <Logo className="mb-4" />
            <p className="text-[#17B9E6] font-poppins text-center max-w-md">
              Enter your activities, locations and times below, we'll create a day plan for you.
            </p>
          </div>
          
          <div className="form-container p-6 rounded-xl">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => planMutation.mutate(data))}
                className="space-y-6"
              >
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="input-field p-4 rounded-xl border-gradient">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-brand-black font-inter font-bold">Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              className="bg-white/70 backdrop-blur-md border border-[#E6DBEE]"
                              disabled={planMutation.isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="input-field p-4 rounded-xl border-gradient">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-brand-black font-inter font-bold">Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              className="bg-white/70 backdrop-blur-md border border-[#E6DBEE]"
                              disabled={planMutation.isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="input-field p-4 rounded-xl border-gradient">
                  <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-brand-black font-inter font-bold">Your Plans</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. 12pm lunch in mayfair, then grab a coffee and have a walk"
                            className="min-h-[100px] bg-white/70 backdrop-blur-md border border-[#E6DBEE] text-[#737373] font-inter"
                            {...field}
                            disabled={planMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#17B9E6] hover:bg-[#17B9E6]/90 text-white font-poppins"
                  disabled={planMutation.isPending}
                >
                  {planMutation.isPending ? (
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
        
        {/* Itinerary Section - Only visible when itinerary data exists */}
        {itinerary && (
          <div id="itinerary-section" className="mt-12 mb-24">
            <div className="glass-card">
              <div className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
                  <h2 className="text-2xl font-rozha text-brand-black">Your Itinerary</h2>
                  <Button
                    variant="outline"
                    className="text-brand-black border-brand-blue hover:text-brand-blue bg-white/20 backdrop-blur-sm w-full sm:w-auto font-poppins"
                    onClick={() => generateICS(itinerary)}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Export to Calendar
                  </Button>
                </div>
                
                <div className="space-y-6">
                  {itinerary.places && itinerary.places.map((place, index) => (
                    <div key={`${place.placeId}-${index}`} className="relative">
                      {/* Timeline connector */}
                      {index > 0 && (
                        <div className="absolute top-0 left-7 h-full w-px bg-brand-blue/20 -translate-x-1/2" />
                      )}

                      {/* Activity card */}
                      <div className="venue-card p-4 sm:p-5 bg-[#E3E9F2] rounded-xl">
                        <div className="flex items-start gap-3 sm:gap-4 mb-3">
                          <div className="flex-shrink-0 p-1.5 sm:p-2 bg-brand-blue/20 text-brand-blue rounded-full relative z-10">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                              <span className="font-inter">{index + 1}</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-2">
                              <h3 className="font-inter font-bold text-brand-black text-base sm:text-lg truncate">{place.name}</h3>
                              {place.scheduledTime && (
                                <span className="text-xs sm:text-sm text-brand-black/80 font-mono">
                                  {new Date(place.scheduledTime).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-brand-black/70 mt-1 truncate font-inter">
                              {place.address}
                            </p>
                            {place.details && place.details.rating && (
                              <p className="text-xs text-brand-black/70 mt-1 font-inter">
                                Rating: {place.details.rating}
                              </p>
                            )}
                            
                            {/* Categories */}
                            {place.details && place.details.types && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {place.details.types.slice(0, 3).map(type => (
                                  <span 
                                    key={type} 
                                    className="text-xs px-3 py-1 rounded-full bg-[#BFD4ED] text-brand-black font-inter"
                                  >
                                    {type.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Travel time indicator */}
                      {Array.isArray(itinerary.travelTimes) && 
                       index < itinerary.travelTimes.length && (
                        <div className="ml-6 sm:ml-7 my-3 sm:my-4 p-2 flex items-center gap-2 text-xs sm:text-sm text-brand-black bg-[#BFD4ED] backdrop-blur-sm rounded-md">
                          <span className="truncate font-inter">
                            {itinerary.travelTimes[index].duration} minutes to{" "}
                            {itinerary.travelTimes[index].to}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}

export default App;