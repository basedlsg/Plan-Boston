# London Day Planner

An intelligent day planner that generates personalized, time-optimized itineraries for exploring London using advanced natural language processing and the Google Places API.

## Features

- **Natural Language Input**: Simply describe your plans in plain English (e.g., "I'm at Tower Bridge and need a coffee shop to work until my dinner at Hakkasan Mayfair at 8pm")
- **Smart Scheduling**: Automatically fills your day with interesting activities based on location and time
- **Time-Aware Planning**: 
  - Supports both 12-hour and 24-hour time formats
  - Considers typical activity durations
  - Automatically schedules lunch during appropriate hours
  - Accounts for travel time between locations
- **Contextual Recommendations**:
  - Morning activities (bakeries, markets, coffee spots)
  - Midday venues (museums, galleries, parks)
  - Afternoon activities (shopping, tea rooms, walks)
  - Evening entertainment (bars, theaters, live music)

## How It Works

1. **Input Your Plans**:
   - Select your preferred date
   - Choose a start time
   - Describe your plans in the text area

2. **Get Your Itinerary**:
   - The app analyzes your input to identify:
     - Starting location
     - Fixed appointments (e.g., dinner reservations)
     - Specific preferences (e.g., "quiet coffee shop")
   - Generates a sequential itinerary with:
     - Verified locations from Google Places
     - Estimated travel times
     - Suggested activities for free time periods

3. **Export Options**:
   - Export to calendar (ICS format)
   - View travel times between locations

## Technical Architecture

### Frontend
- React with TypeScript
- Real-time form validation
- Dynamic itinerary display
- Responsive design for all devices

### Backend
- Express server
- Natural language processing for request parsing
- Google Places API integration
- Smart scheduling algorithm
- PostgreSQL database for storing itineraries

### Key Components
- Time verification system
- Location-aware activity suggestions
- Travel time calculations
- Intelligent gap filling for unscheduled periods

## Example Use Cases

1. **Work & Dinner Plans**:
   "I'm at Liverpool Street Station and need a quiet café to work until my dinner at Duck & Waffle at 8pm"

2. **Tourist Day Out**:
   "Starting from Tower Bridge at 10am, I want to see some museums and have dinner in Soho at 7pm"

3. **Shopping & Entertainment**:
   "Meeting friends at Oxford Circus at 11am for shopping, then we have theater tickets for 7:30pm in Covent Garden"

The app will create a balanced itinerary that includes appropriate meal times, interesting activities, and accounts for travel between locations.
