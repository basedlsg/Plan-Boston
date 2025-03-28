import React, { useEffect } from 'react';

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

interface ItineraryScreenProps {
  venues: Venue[];
  travelInfo: TravelInfo[];
  onExport: () => void;
}

const ItineraryScreen: React.FC<ItineraryScreenProps> = ({
  venues,
  travelInfo,
  onExport
}) => {
  // Add debug logging to track the data flow
  useEffect(() => {
    console.log("ItineraryScreen received venues:", venues);
    console.log("ItineraryScreen received travelInfo:", travelInfo);
  }, [venues, travelInfo]);

  const hasVenues = venues && Array.isArray(venues) && venues.length > 0;
  const hasTravelInfo = travelInfo && Array.isArray(travelInfo);

  // Don't render anything if there are no venues
  if (!hasVenues) {
    return null;
  }

  return (
    <div className="bg-white flex flex-col items-center w-full">
      <div className="w-full max-w-md px-4 pb-12">
        {/* Header - only shown when we have venues */}
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ 
            fontFamily: "'Rozha One', serif",
            color: 'var(--color-text-black)'
          }}>
            Your London Itinerary
          </h1>

          <button
            onClick={onExport}
            className="w-full py-3 rounded-2xl text-white font-medium"
            style={{ background: '#17B9E6' }}
          >
            Export to Calendar
          </button>
        </div>

        {/* Venues List */}
        <div className="space-y-6">
          {venues.map((venue, index) => (
            <React.Fragment key={`${venue.name}-${index}`}>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-3" style={{ 
                  fontFamily: "'Rozha One', serif"
                }}>
                  {venue.name}
                </h2>
                
                <div className="space-y-2 mb-4">
                  <p className="text-lg font-semibold">{venue.time}</p>
                  <p className="text-gray-500 text-sm">{venue.address}</p>
                  <p className="text-gray-500 text-sm">Rating: {venue.rating || 'N/A'}</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {venue.categories && Array.isArray(venue.categories) && venue.categories.map((category, catIndex) => (
                    <span 
                      key={`${category}-${catIndex}`} 
                      className="px-3 py-1 rounded-full text-xs"
                      style={{
                        background: 'rgba(23, 185, 230, 0.1)',
                        color: 'var(--color-text-black)',
                        border: '1px solid rgba(23, 185, 230, 0.2)'
                      }}
                    >
                      {category.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
              
              {index < venues.length - 1 && hasTravelInfo && travelInfo[index] && (
                <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg text-gray-500 text-sm shadow-sm border border-gray-100">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{color: '#17B9E6'}}
                  >
                    <path
                      d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8C0 10.1217 0.842855 12.1566 2.34315 13.6569C3.84344 15.1571 5.87827 16 8 16C10.1217 16 12.1566 15.1571 13.6569 13.6569C15.1571 12.1566 16 10.1217 16 8C16 5.87827 15.1571 3.84344 13.6569 2.34315C12.1566 0.842855 10.1217 0 8 0ZM8 14.4C6.25044 14.4 4.57275 13.7257 3.32294 12.5259C2.07312 11.326 1.39819 9.64784 1.39819 7.89828C1.39819 6.14872 2.07312 4.47103 3.32294 3.27121C4.57275 2.0714 6.25044 1.39647 8 1.39647C9.74956 1.39647 11.4272 2.0714 12.6771 3.27121C13.9269 4.47103 14.6018 6.14872 14.6018 7.89828C14.6018 9.64784 13.9269 11.326 12.6771 12.5259C11.4272 13.7257 9.74956 14.4 8 14.4Z"
                      fill="currentColor"
                    />
                    <path
                      d="M8 3.2C7.68174 3.2 7.37652 3.32643 7.15147 3.55147C6.92643 3.77652 6.8 4.08174 6.8 4.4V7.6H4.4C4.08174 7.6 3.77652 7.72643 3.55147 7.95147C3.32643 8.17652 3.2 8.48174 3.2 8.8C3.2 9.11826 3.32643 9.42348 3.55147 9.64853C3.77652 9.87357 4.08174 10 4.4 10H8C8.31826 10 8.62348 9.87357 8.84853 9.64853C9.07357 9.42348 9.2 9.11826 9.2 8.8V4.4C9.2 4.08174 9.07357 3.77652 8.84853 3.55147C8.62348 3.32643 8.31826 3.2 8 3.2Z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="whitespace-normal overflow-visible">{travelInfo[index].duration} to {travelInfo[index].destination}</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ItineraryScreen;