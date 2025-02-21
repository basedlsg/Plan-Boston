import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Clock, Calendar } from "lucide-react";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateICS } from "@/lib/ics";
import type { Itinerary } from "@shared/schema";

const formSchema = z.object({
  query: z.string().min(10, "Please provide more details about your plans"),
});

export default function Home() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      query: "",
    },
  });

  const planMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              London Day Planner
            </h1>
            <p className="text-muted-foreground">
              Tell us your plans and we'll create a verified itinerary
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => planMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="e.g. Start at British Museum at 10am, lunch at Borough Market, then dinner at Duck & Waffle"
                        className="h-20"
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

          {itinerary && (
            <Card>
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
                  {itinerary.places.map((place, index) => (
                    <div key={place.placeId}>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 p-2 bg-primary/5 rounded-full">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{place.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {place.address}
                          </p>
                        </div>
                      </div>
                      {index < itinerary.travelTimes.length && (
                        <div className="ml-7 my-4 flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {itinerary.travelTimes[index].duration} minutes to next
                          destination
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
