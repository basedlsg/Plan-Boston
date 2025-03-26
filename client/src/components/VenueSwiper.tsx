import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaceDetails } from '@shared/schema';

interface VenueSwiperProps {
  primary: PlaceDetails;
  alternatives: PlaceDetails[];
  onSelect: (venue: PlaceDetails) => void;
  className?: string;
}

const VenueSwiper: React.FC<VenueSwiperProps> = ({
  primary,
  alternatives,
  onSelect,
  className,
}) => {
  // Create an array with primary venue first, then alternatives
  const allVenues = [primary, ...alternatives];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(primary.place_id);
  
  // The required minimum distance between touchStart and touchEnd to be detected as a swipe
  const minSwipeDistance = 50;
  
  const handleNext = () => {
    if (currentIndex < allVenues.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const handleSelect = (venue: PlaceDetails) => {
    setSelectedVenueId(venue.place_id);
    onSelect(venue);
  };
  
  // Touch event handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset touchEnd
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < allVenues.length - 1) {
      handleNext();
    } else if (isRightSwipe && currentIndex > 0) {
      handlePrev();
    }
  };
  
  // Mouse event handlers (for desktop swiping)
  const [mouseDown, setMouseDown] = useState<number | null>(null);
  const [mouseUp, setMouseUp] = useState<number | null>(null);
  
  const onMouseDown = (e: React.MouseEvent) => {
    setMouseUp(null);
    setMouseDown(e.clientX);
  };
  
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown) return;
    setMouseUp(e.clientX);
  };
  
  const onMouseUp = () => {
    if (!mouseDown || !mouseUp) {
      setMouseDown(null);
      return;
    }
    
    const distance = mouseDown - mouseUp;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < allVenues.length - 1) {
      handleNext();
    } else if (isRightSwipe && currentIndex > 0) {
      handlePrev();
    }
    
    setMouseDown(null);
    setMouseUp(null);
  };
  
  const onMouseLeave = () => {
    setMouseDown(null);
    setMouseUp(null);
  };
  
  // Get current venue
  const currentVenue = allVenues[currentIndex];
  const isPrimary = currentIndex === 0;
  const isSelected = currentVenue.place_id === selectedVenueId;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Navigation arrows for desktop - left */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 md:flex hidden items-center justify-center w-8 h-8 rounded-full bg-white shadow-md text-brand-black hover:text-brand-blue transition-colors"
            aria-label="Previous venue"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        
        {/* Navigation arrows for desktop - right */}
        {currentIndex < allVenues.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 md:flex hidden items-center justify-center w-8 h-8 rounded-full bg-white shadow-md text-brand-black hover:text-brand-blue transition-colors"
            aria-label="Next venue"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        
        {/* Swipeable area */}
        <div 
          className={cn(
            "relative overflow-hidden rounded-lg shadow-md bg-white dark:bg-gray-800 cursor-pointer transition-all",
            isSelected ? "venue-selected" : ""
          )}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onClick={() => handleSelect(currentVenue)}
        >
          <div className="p-4">
            {/* Primary venue indicator */}
            {isPrimary && (
              <div className="flex items-center gap-1 text-brand-pink mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Primary Recommendation</span>
              </div>
            )}
            
            <h3 className="text-lg font-bold text-brand-black">{currentVenue.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{currentVenue.formatted_address}</p>
            
            {/* Rating if available */}
            {currentVenue.rating && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Rating:</span> {currentVenue.rating} ★
              </div>
            )}
            
            {/* Venue types */}
            {currentVenue.types && currentVenue.types.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {currentVenue.types.map(type => (
                  <span 
                    key={type} 
                    className="px-2 py-1 bg-brand-pink/10 text-brand-black rounded-full text-xs"
                  >
                    {type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            
            {/* Selected indicator instead of button */}
            {isSelected && (
              <div className="mt-3 text-center text-brand-blue font-semibold text-sm">
                Selected Venue
              </div>
            )}
          </div>
        </div>
        
        {/* Pagination dots */}
        <div className="flex justify-center mt-3">
          <div className="flex items-center gap-2">
            {allVenues.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  idx === currentIndex 
                    ? "bg-brand-blue w-4" 
                    : "bg-gray-300 dark:bg-gray-600"
                )}
                aria-label={`Go to venue ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Counter */}
      <div className="text-center text-sm text-gray-500 mt-2">
        {currentIndex + 1} of {allVenues.length} venues
      </div>
    </div>
  );
};

export default VenueSwiper;