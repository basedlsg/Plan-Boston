import React, { useState, useEffect } from 'react';
import InputScreen from '../components/InputScreen';
import ItineraryScreen from '../components/ItineraryScreen';
import { usePlanMutation } from '../hooks/usePlanMutation';
import { exportToCalendar } from '../lib/calendar';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

interface PlanFormData {
  date: string;
  time: string;
  plans: string;
}

interface Venue {
  name: string;
  time: string;
  address: string;
  rating: number;
  categories: string[];
}

interface TravelInfo {
  duration: string;
  destination: string;
}

interface ItineraryData {
  venues: Venue[];
  travelInfo: TravelInfo[];
}

export default function HomePage() {
  const [itineraryData, setItineraryData] = useState<ItineraryData | null>(null);
  const planMutation = usePlanMutation();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Log state changes to debug
  useEffect(() => {
    console.log("HomePage itineraryData state:", itineraryData);
  }, [itineraryData]);

  const handlePlanSubmit = async (formData: PlanFormData) => {
    try {
      console.log("Submitting plan:", formData);
      const result = await planMutation.mutateAsync(formData);
      console.log("Plan creation result:", result);
      setItineraryData(result);

      // Smooth scroll to itinerary section after a brief delay
      setTimeout(() => {
        document.getElementById('itinerary-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    } catch (error) {
      console.error('Error creating plan:', error);
      // Error handling is managed by the mutation
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  return (
    <div className="bg-white text-foreground min-h-screen">
      {/* Header */}
      <header className="border-b py-4 px-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">London Day Planner</h1>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-muted-foreground">
                Welcome, {user.name || user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-8">
          {/* Input Section */}
          <section className="py-4">
            <InputScreen 
              onSubmit={handlePlanSubmit}
              isLoading={planMutation.isPending}
            />
          </section>

          {/* Itinerary Section - always render but conditionally show content */}
          <section id="itinerary-section" className="py-4">
            <ItineraryScreen
              venues={itineraryData?.venues || []}
              travelInfo={itineraryData?.travelInfo || []}
              onExport={() => {
                exportToCalendar(itineraryData?.venues || []);
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}