import React, { useState } from 'react';
import VenueSwiper from './VenueSwiper';
import { PlaceDetails } from '@shared/schema';

// Mock venue data for testing
const mockVenues = {
  primary: {
    name: 'British Museum',
    formatted_address: 'Great Russell St, London WC1B 3DG',
    place_id: 'ChIJB9OTMDIbdkgRp0JWbQGZsS8',
    geometry: {
      location: {
        lat: 51.5194,
        lng: -0.1269
      }
    },
    types: ['museum', 'tourist_attraction'],
    rating: 4.7
  } as PlaceDetails,
  
  alternatives: [
    {
      name: 'Victoria and Albert Museum',
      formatted_address: 'Cromwell Rd, London SW7 2RL',
      place_id: 'ChIJVUo1s9QEdkgRiYQJN8Fj0R0',
      geometry: {
        location: {
          lat: 51.4966,
          lng: -0.1722
        }
      },
      types: ['museum', 'tourist_attraction'],
      rating: 4.6
    } as PlaceDetails,
    {
      name: 'Natural History Museum',
      formatted_address: 'Cromwell Rd, London SW7 5BD',
      place_id: 'ChIJPTNIJdUEdkgRXzlzOLR8uEo',
      geometry: {
        location: {
          lat: 51.4967,
          lng: -0.1764
        }
      },
      types: ['museum', 'tourist_attraction'],
      rating: 4.7
    } as PlaceDetails,
    {
      name: 'Science Museum',
      formatted_address: 'Exhibition Rd, South Kensington, London SW7 2DD',
      place_id: 'ChIJ9YmMVdIEdkgRQrOVLg1vOHo',
      geometry: {
        location: {
          lat: 51.4978,
          lng: -0.1745
        }
      },
      types: ['museum', 'tourist_attraction'],
      rating: 4.5
    } as PlaceDetails
  ]
};

const VenueSwiperTest: React.FC = () => {
  const [selectedVenue, setSelectedVenue] = useState<PlaceDetails | null>(null);
  
  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Venue Swiper Test</h1>
      <p className="text-gray-600 mb-6">
        Swipe left/right or use the arrow buttons to navigate between venue options.
        Select a venue to see it displayed below.
      </p>
      
      <VenueSwiper
        primary={mockVenues.primary}
        alternatives={mockVenues.alternatives}
        onSelect={(venue) => {
          setSelectedVenue(venue);
          console.log("Selected venue:", venue);
        }}
      />
      
      {selectedVenue && (
        <div className="mt-8 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
          <h2 className="font-bold mb-2">Selected Venue:</h2>
          <p><strong>Name:</strong> {selectedVenue.name}</p>
          <p><strong>Address:</strong> {selectedVenue.formatted_address}</p>
          <p><strong>Type:</strong> {selectedVenue.types?.join(', ')}</p>
        </div>
      )}
    </div>
  );
};

export default VenueSwiperTest;