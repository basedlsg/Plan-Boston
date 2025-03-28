import React, { useState, useEffect } from 'react';
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

  // Log state changes to debug
  useEffect(() => {
    console.log("App itineraryData state:", itineraryData);
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

  return (
    <div className="min-h-screen bg-white text-foreground" style={{ 
      maxWidth: '1200px', 
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      {/* Main Container with optimized spacing */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '2rem', // 2rem spacing between sections
        maxHeight: '100vh',
        overflow: 'auto'
      }}>
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
              // Implement calendar export functionality
              console.log('Exporting to calendar...');
            }}
          />
        </section>
      </div>
    </div>
  );
}

export default App;