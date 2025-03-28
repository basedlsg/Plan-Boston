import React, { useState } from 'react';
import { ThemeToggle } from "@/components/theme-toggle";
import InputScreen from './components/InputScreen';
import ItineraryScreen from './components/ItineraryScreen';
import { usePlanMutation } from './hooks/usePlanMutation';

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

function App() {
  const [itineraryData, setItineraryData] = useState<ItineraryData | null>(null);
  const planMutation = usePlanMutation();

  const handlePlanSubmit = async (formData: PlanFormData) => {
    try {
      const result = await planMutation.mutateAsync(formData);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      
      {/* Input Section */}
      <section className="py-8">
        <InputScreen 
          onSubmit={handlePlanSubmit}
          isLoading={planMutation.isPending}
        />
      </section>

      {/* Itinerary Section */}
      {itineraryData && (
        <section id="itinerary-section" className="py-8">
          <ItineraryScreen
            venues={itineraryData.venues}
            travelInfo={itineraryData.travelInfo}
            onExport={() => {
              // Implement calendar export functionality
              console.log('Exporting to calendar...');
            }}
          />
        </section>
      )}
    </div>
  );
}

export default App;