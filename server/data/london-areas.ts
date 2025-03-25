import { z } from "zod";

export const areaSchema = z.object({
  name: z.string(),
  type: z.enum(["borough", "neighborhood", "area"]),
  borough: z.string().optional(),
  characteristics: z.array(z.string()),
  neighbors: z.array(z.string()),
  popularFor: z.array(z.string()),
  crowdLevels: z.object({
    morning: z.number(),
    afternoon: z.number(),
    evening: z.number(),
    weekend: z.number(),
  }),
});

export type LondonArea = z.infer<typeof areaSchema>;

export const londonAreas: LondonArea[] = [
  {
    name: "Fitzrovia",
    type: "neighborhood",
    borough: "Camden/Westminster",
    characteristics: ["artsy", "mixed-use", "historic"],
    neighbors: ["Bloomsbury", "Marylebone", "Soho"],
    popularFor: ["art galleries", "media companies", "restaurants", "pubs"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 4,
      weekend: 3,
    },
  },
  {
    name: "Green Park",
    type: "area",
    borough: "Westminster",
    characteristics: ["royal park", "open space", "peaceful"],
    neighbors: ["Mayfair", "St. James's", "Piccadilly"],
    popularFor: ["picnics", "relaxation", "walking", "royal ceremonies"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 1,
      weekend: 4,
    },
  },
  // Add more central London areas
  {
    name: "Mayfair",
    type: "neighborhood",
    borough: "Westminster",
    characteristics: ["luxury", "upscale", "historic"],
    neighbors: ["Green Park", "Soho", "Hyde Park", "Marylebone"],
    popularFor: ["luxury shopping", "fine dining", "art galleries", "hotels"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "Soho",
    type: "neighborhood",
    borough: "Westminster",
    characteristics: ["vibrant", "nightlife", "entertainment", "diverse"],
    neighbors: ["Mayfair", "Fitzrovia", "Chinatown", "Covent Garden"],
    popularFor: ["restaurants", "bars", "nightclubs", "theaters", "shopping"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  // Add more areas...
];

// Helper function to find areas by characteristics
export function findAreasByCharacteristics(
  characteristics: string[],
  excludeAreas: string[] = [],
): LondonArea[] {
  return londonAreas.filter(
    (area) =>
      !excludeAreas.includes(area.name) &&
      characteristics.some(
        (c) => area.characteristics.includes(c) || area.popularFor.includes(c),
      ),
  );
}

// Helper to get crowd level for a specific time
export function getAreaCrowdLevel(
  area: LondonArea,
  timeOfDay: string,
  isWeekend: boolean,
): number {
  if (isWeekend) return area.crowdLevels.weekend;

  const hour = parseInt(timeOfDay.split(":")[0]);
  if (hour < 12) return area.crowdLevels.morning;
  if (hour < 17) return area.crowdLevels.afternoon;
  return area.crowdLevels.evening;
}

// Helper to find quiet areas
export function findQuietAreas(
  timeOfDay: string,
  isWeekend: boolean,
  nearArea?: string,
): LondonArea[] {
  const areas = nearArea
    ? londonAreas.filter((a) => a.neighbors.includes(nearArea))
    : londonAreas;

  return areas.filter((area) => {
    const crowdLevel = getAreaCrowdLevel(area, timeOfDay, isWeekend);
    return crowdLevel <= 2; // Areas with low crowd levels
  });
}
