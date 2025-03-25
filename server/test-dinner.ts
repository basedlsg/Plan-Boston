import { parseActivity } from './lib/languageProcessing';
import { ACTIVITY_TYPE_MAPPINGS } from './lib/locationNormalizer';

// Test dinner activity detection
console.log("Testing dinner activity detection");
const testActivities = [
  "have dinner",
  "dinner at a fancy restaurant",
  "I want to have dinner in Soho",
  "fancy dinner with John",
  "looking for a place for dinner"
];

for (const activity of testActivities) {
  const result = parseActivity(activity);
  console.log(`\nActivity: "${activity}"`);
  console.log(`- Type: ${result.type}`);
  console.log(`- Venue Type: ${result.venueType || "none"}`);
  console.log(`- Requirements: ${result.requirements && result.requirements.length ? result.requirements.join(", ") : "none"}`);
}
