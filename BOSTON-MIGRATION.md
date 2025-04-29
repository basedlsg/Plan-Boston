# NYC to Boston Migration Roadmap

This document outlines the changes made to adapt the NYC Day Planner application for Boston.

## Completed Changes

1. **Data Structure**
   - Created `boston-areas.ts` with Boston neighborhoods and regions
   - Updated type references from `NYCArea` to `BostonArea`

2. **Location Normalization**
   - Created `bostonLocationNormalizer.ts` with Boston-specific locations
   - Updated neighborhood variations and common misspellings
   - Modified transportation references from NYC subway to Boston T

3. **Timezone Configuration**
   - Updated timezone references to use `BOSTON_TIMEZONE` (same timezone as NYC)
   - Maintained backwards compatibility with `NYC_TIMEZONE`

4. **NLP Processing**
   - Updated prompts to reference Boston instead of NYC
   - Modified default locations from "Midtown" to "Downtown"
   - Updated activity and location handling logic

5. **Weather Service**
   - Updated default coordinates for Boston
   - Maintained backward compatibility with NYC variables

6. **Google Places Integration**
   - Updated search queries to use "Boston, MA" instead of "New York, NY"
   - Updated area matching to use Boston regions

7. **UI/UX Updates**
   - Changed application title to "Boston Day Planner"
   - Updated README and documentation
   - Modified export filenames for calendars and itineraries

8. **Configuration Changes**
   - Updated vite.config.ts base path to "/Boston/"
   - Changed server static file route from "/NYC" to "/Boston"
   - Updated session secret

9. **Testing**
   - Created Boston-specific location matching test

## Remaining Tasks

These tasks should be completed after the initial migration:

1. **API Keys**
   - Update API keys in your environment configuration in Replit

2. **Linter Errors**
   - Address remaining TypeScript linter errors (mostly related to type declarations)

3. **Testing**
   - Run comprehensive testing of all location-based features with Boston data
   - Verify that all Google Places API calls work properly with Boston locations

4. **Boston-Specific Features**
   - Consider adding MBTA transit information
   - Implement Boston-specific venue categories (e.g., seafood restaurants)
   - Add logic for handling universities and colleges

5. **Data Verification**
   - Verify that all Boston neighborhood data is accurate and comprehensive
   - Consider expanding the Boston areas dataset with more detailed information

## Tips for Testing

1. Use the included `find-nyc-references.sh` script to find any remaining NYC references
2. Test natural language queries specifically mentioning Boston locations
3. Verify that location normalization works correctly with the `testBostonLocationMatching.ts` test
4. Check that travel time calculations work properly between Boston locations

## Known Issues

Some references to "NYC" in function and variable names remain, primarily in the timezone utilities. These have been kept for backward compatibility but could be renamed in a future update. 