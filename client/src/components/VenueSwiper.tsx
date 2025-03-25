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
  
  const handleSelect = () => {
    onSelect(allVenues[currentIndex]);
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

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Swipeable area */}
        <div 
          className="relative overflow-hidden rounded-lg shadow-md bg-white dark:bg-gray-800"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        >
          <div className="p-4">
            {/* Primary venue indicator */}
            {isPrimary && (
              <div className="flex items-center gap-1 text-primary mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Primary Recommendation</span>
              </div>
            )}
            
            <h3 className="text-lg font-bold">{currentVenue.name}</h3>
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
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs"
                  >
                    {type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
            
            {/* Selection button */}
            <button
              onClick={handleSelect}
              className="mt-4 w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Select This Venue
            </button>
          </div>
        </div>
        
        {/* Navigation buttons */}
        <div className="flex justify-between mt-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          {/* Pagination indicator */}
          <div className="flex items-center gap-1">
            {allVenues.map((_, idx) => (
              <div 
                key={idx}
                className={cn(
                  "h-2 w-2 rounded-full",
                  idx === currentIndex 
                    ? "bg-primary" 
                    : "bg-gray-300 dark:bg-gray-600"
                )}
              />
            ))}
          </div>
          
          <button
            onClick={handleNext}
            disabled={currentIndex === allVenues.length - 1}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
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