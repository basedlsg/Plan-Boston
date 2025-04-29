# Boston Day Planner

An intelligent day planning application for Boston that generates personalized, time-optimized itineraries through natural language processing.

## Features

- **Natural Language Input:** Describe your plans in plain English
- **Smart Scheduling:** Automatically fills gaps with interesting activities
- **Time-Aware Planning:** Considers standard durations, meal times, and travel times
- **Contextual Recommendations:** Suggests activities based on time of day and location
- **Weather-Aware Planning:** Adjusts recommendations based on weather conditions
- **Export Options:** Calendar export functionality

## Technology Stack

- **Frontend:** React with TypeScript, TailwindCSS, Shadcn UI components
- **Backend:** Express.js with TypeScript
- **AI Integration:** Google's Generative AI for natural language processing
- **External APIs:** Google Places API for location search and verification
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Passport.js for user management

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables (see `.env.example` for required variables)
4. Initialize the database:
```bash
npm run db:migrate
```
5. Start the development server:
```bash
npm run dev
```

## Usage

1. Visit the homepage
2. Enter your plans in natural language (e.g., "I want to visit Fenway Park in the morning, have lunch in the North End, and spend the afternoon at the Boston Public Garden")
3. Review and adjust the generated itinerary
4. Export to your calendar if desired

## API Keys

You'll need to obtain API keys for:
- Google Places API
- Google Geocoding API
- Google Generative AI (Gemini)
- OpenWeatherMap API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
