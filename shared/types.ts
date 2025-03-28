// Shared types for NLP processing

export interface StructuredRequest {
  startLocation: string | null;
  destinations: string[];
  fixedTimes: Array<{
    location: string;
    time: string;  // Format: "HH:MM" (24-hour)
    type?: string; // e.g., "restaurant", "cafe"
    // Additional parameters for enhanced search
    searchTerm?: string;
    keywords?: string[];
    minRating?: number;
  }>;
  preferences: {
    type?: string;
    requirements?: string[];
  };
  // Enhanced response from Gemini with detailed activity information
  activities?: Array<{
    description: string;
    location: string;
    time: string;
    searchParameters: {
      searchTerm: string;
      type: string;
      keywords: string[];
      minRating: number;
      requireOpenNow: boolean;
    };
    requirements: string[];
  }>;
}