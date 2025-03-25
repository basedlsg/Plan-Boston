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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateICS } from "@/lib/ics";
import type { Itinerary, Place } from "@shared/schema";
import { format } from "date-fns";
import { TimeInput } from "@/components/TimeInput";
import { formatDateTime, formatTime, getLocalTimeNow } from "@/lib/dateUtils";
import { Link } from "wouter";

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
      toast({
        title: "Itinerary created!",
        description: "Your day plan is ready.",
      });
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 max-w-3xl mx-auto">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Plan
            </h1>
            <p className="text-muted-foreground">
              Tell us your plans and we'll create a verified itinerary
            </p>
            <div className="flex justify-center mt-2">
              <Link href="/venue-swiper-test">
                <Button variant="outline" size="sm">
                  Try Venue Swiper Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Form Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Create Your Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => planMutation.mutate(data))}
                  className="space-y-6"
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
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
                            <TimeInput
                              value={field.value}
                              onChange={field.onChange}
                              className="w-full"
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
                            placeholder="e.g. Starting from Green Park, I need a quiet café to work until my dinner at Duck & Waffle at 8pm"
                            className="min-h-[120px] resize-y"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={planMutation.isPending}
                  >
                    {planMutation.isPending ? "Creating plan..." : "Create Plan"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Itinerary Display */}
          {itinerary && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Your Itinerary
                  <Button
                    variant="outline"
                    onClick={() => generateICS(itinerary)}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Export to Calendar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(itinerary.places as Place[]).map((place, index) => (
                    <div key={`${place.placeId}-${index}`} className="relative">
                      {/* Timeline connector */}
                      {index > 0 && (
                        <div className="absolute top-0 left-7 h-full w-px bg-border -translate-x-1/2" />
                      )}

                      {/* Activity card */}
                      <div className="flex items-start gap-4 bg-card rounded-lg p-4 shadow-sm">
                        <div className="flex-shrink-0 p-2 bg-primary/5 rounded-full relative z-10">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between">
                            <h3 className="font-semibold">{place.name}</h3>
                            {place.scheduledTime && (
                              <span className="text-sm text-muted-foreground font-mono">
                                {formatTime(place.scheduledTime)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {place.address}
                          </p>
                        </div>
                      </div>

                      {/* Travel time indicator */}
                      {index < (itinerary.travelTimes as Array<{
                        from: string;
                        to: string;
                        duration: number;
                        arrivalTime: string;
                      }>).length && (
                        <div className="ml-7 my-4 p-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md">
                          <MapPin className="w-4 h-4" />
                          {itinerary.travelTimes[index].duration} minutes to{" "}
                          {itinerary.travelTimes[index].to}
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