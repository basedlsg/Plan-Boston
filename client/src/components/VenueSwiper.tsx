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
      <div className="relative venue-container">
        {/* Navigation arrows for desktop - left */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="nav-arrow absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 md:flex hidden items-center justify-center w-10 h-10 text-brand-blue"
            aria-label="Previous venue"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        
        {/* Navigation arrows for desktop - right */}
        {currentIndex < allVenues.length - 1 && (
          <button
            onClick={handleNext}
            className="nav-arrow absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 md:flex hidden items-center justify-center w-10 h-10 text-brand-blue"
            aria-label="Next venue"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        
        {/* Swipeable area */}
        <div 
          className={cn(
            "venue-glass relative overflow-hidden transition-all cursor-pointer py-5 px-6",
            isSelected ? "selected" : ""
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
          {/* Primary venue indicator */}
          {isPrimary && (
            <div className="flex items-center gap-1 text-brand-pink mb-3">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Primary Recommendation</span>
            </div>
          )}
          
          <h3 className="text-xl font-bold text-brand-black mb-1">{currentVenue.name}</h3>
          <p className="text-sm text-brand-black/70">{currentVenue.formatted_address}</p>
          
          {/* Rating if available */}
          {currentVenue.rating && (
            <div className="mt-3 text-sm text-brand-black/80">
              <span className="font-medium">Rating:</span> {currentVenue.rating} ★
            </div>
          )}
          
          {/* Venue types */}
          {currentVenue.types && currentVenue.types.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {currentVenue.types.slice(0, 3).map(type => (
                <span 
                  key={type} 
                  className="px-2.5 py-1 bg-white/30 backdrop-blur-sm text-brand-black rounded-full text-xs"
                >
                  {type.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          
          {/* Selected indicator */}
          {isSelected && (
            <div className="mt-4 pt-3 border-t border-white/20 text-center">
              <span className="px-4 py-1.5 bg-brand-blue/10 text-brand-blue rounded-full text-sm font-medium">
                Selected Venue
              </span>
            </div>
          )}
        </div>
        
        {/* Pagination dots */}
        <div className="pagination-dots">
          {allVenues.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "pagination-dot",
                idx === currentIndex ? "active" : ""
              )}
              aria-label={`Go to venue ${idx + 1}`}
            />
          ))}
        </div>
      </div>
      
      {/* Counter */}
      <div className="text-center text-sm text-white/80 mt-2">
        {currentIndex + 1} of {allVenues.length} venues
      </div>
    </div>
  );
};

export default VenueSwiper;