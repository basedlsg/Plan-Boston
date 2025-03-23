import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateICS } from "@/lib/ics";
import type { Itinerary, Place } from "@shared/schema";
import { format } from "date-fns";

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

  // Fetch current server time when component mounts
  useState(() => {
    fetch("/api/time")
      .then(res => res.json())
      .then(data => {
        const date = new Date(data.currentTime);
        setCurrentTime(format(date, "yyyy-MM-dd'T'HH:mm"));
      })
      .catch(console.error);
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
    },
  });

  const planMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/plan", data);
      return res.json();
    },
    onSuccess: (data: Itinerary) => {
      setItinerary(data);
      toast({
        title: "Itinerary created!",
        description: "Your London day plan is ready.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating itinerary",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              London Day Planner
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Tell us your plans and we'll create a verified itinerary with the perfect spots to explore London
            </p>
          </div>

          <Card className="border-2 border-muted/20 shadow-lg">
            <CardContent className="pt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => planMutation.mutate(data))}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-background"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              className="bg-background"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="query"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Plans</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. I'm at Green Park and need a quiet coffee shop to work until my dinner at Duck & Waffle at 8pm"
                            className="min-h-[120px] resize-y bg-background"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                    disabled={planMutation.isPending}
                  >
                    {planMutation.isPending ? "Creating plan..." : "Create Plan"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {itinerary && (
            <Card className="border-2 border-muted/20 shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/5">
                <CardTitle className="flex justify-between items-center flex-wrap gap-4">
                  <span>Your Itinerary</span>
                  <Button
                    variant="outline"
                    onClick={() => generateICS(itinerary)}
                    className="ml-auto"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Export to Calendar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {(itinerary.places as Place[]).map((place, index) => (
                    <div key={`${place.placeId}-${index}`} className="relative">
                      {index > 0 && (
                        <div className="absolute top-0 left-7 h-full w-px bg-gradient-to-b from-primary/20 to-secondary/20 -translate-x-1/2" />
                      )}
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 p-2 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 relative z-10">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between flex-wrap gap-2">
                            <h3 className="font-semibold truncate">{place.name}</h3>
                            {place.scheduledTime && (
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                {format(new Date(place.scheduledTime), 'h:mm a')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {place.address}
                          </p>
                        </div>
                      </div>
                      {index < (itinerary.travelTimes as Array<{
                        from: string;
                        to: string;
                        duration: number;
                        arrivalTime: string;
                      }>).length && (
                        <div className="ml-7 my-4 flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="break-words">
                            {itinerary.travelTimes[index].duration} minutes to{" "}
                            {itinerary.travelTimes[index].to}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}