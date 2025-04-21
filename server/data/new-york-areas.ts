import { z } from "zod";

export const areaSchema = z.object({
  name: z.string(),
  type: z.enum(["borough", "neighborhood", "area"]),
  borough: z.string(),
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

export type NYCArea = z.infer<typeof areaSchema>;

export const nycAreas: NYCArea[] = [
  {
    name: "Manhattan",
    type: "borough",
    borough: "Manhattan",
    characteristics: ["urban", "fast-paced", "commercial", "cultural"],
    neighbors: ["Brooklyn", "Queens", "Bronx"],
    popularFor: ["skyscrapers", "museums", "entertainment", "finance"],
    crowdLevels: {
      morning: 4,
      afternoon: 5,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Brooklyn",
    type: "borough",
    borough: "Brooklyn",
    characteristics: ["diverse", "trendy", "artistic", "historic"],
    neighbors: ["Manhattan", "Queens"],
    popularFor: ["brownstones", "parks", "food scene", "cultural diversity"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Midtown",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["busy", "commercial", "touristy", "entertainment"],
    neighbors: ["Times Square", "Chelsea", "Upper East Side", "Hell's Kitchen", "Murray Hill"],
    popularFor: ["Empire State Building", "Times Square", "shopping", "Broadway shows"],
    crowdLevels: {
      morning: 4,
      afternoon: 5,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "Greenwich Village",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["bohemian", "historic", "artistic", "lively"],
    neighbors: ["SoHo", "East Village", "West Village", "NoHo", "Union Square"],
    popularFor: ["NYU campus", "Washington Square Park", "jazz clubs", "historic architecture"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "SoHo",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["trendy", "artsy", "upscale", "shopping"],
    neighbors: ["Greenwich Village", "Tribeca", "Chinatown", "Little Italy", "West Village"],
    popularFor: ["designer boutiques", "cast-iron architecture", "art galleries", "upscale dining"],
    crowdLevels: {
      morning: 2,
      afternoon: 5,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Upper East Side",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["upscale", "sophisticated", "traditional", "elegant"],
    neighbors: ["Central Park", "Midtown", "Harlem", "Upper West Side"],
    popularFor: ["Museum Mile", "luxury apartments", "upscale shopping", "Central Park access"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "Upper West Side",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["residential", "cultural", "family-friendly", "intellectual"],
    neighbors: ["Central Park", "Harlem", "Midtown", "Upper East Side"],
    popularFor: ["Lincoln Center", "Natural History Museum", "Riverside Park", "brownstones"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "Central Park",
    type: "area",
    borough: "Manhattan",
    characteristics: ["urban park", "scenic", "recreational", "iconic"],
    neighbors: ["Upper East Side", "Upper West Side", "Midtown", "Harlem"],
    popularFor: ["walking paths", "Bethesda Fountain", "boating", "Central Park Zoo", "outdoor concerts"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 3,
      weekend: 5,
    },
  },
  {
    name: "Williamsburg",
    type: "neighborhood",
    borough: "Brooklyn",
    characteristics: ["hipster", "trendy", "artistic", "gentrified"],
    neighbors: ["Greenpoint", "Bushwick", "Bedford-Stuyvesant", "East Williamsburg"],
    popularFor: ["nightlife", "music venues", "craft breweries", "waterfront views"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "Times Square",
    type: "area",
    borough: "Manhattan",
    characteristics: ["touristy", "bright", "bustling", "commercial"],
    neighbors: ["Midtown", "Theater District", "Hell's Kitchen", "Garment District"],
    popularFor: ["Broadway shows", "billboards", "shopping", "New Year's Eve"],
    crowdLevels: {
      morning: 4,
      afternoon: 5,
      evening: 5,
      weekend: 5,
    },
  }
  // More NYC neighborhoods would be added here
];

// Helper function to find areas by characteristics
export function findAreasByCharacteristics(
  characteristics: string[],
  excludeAreas: string[] = [],
): NYCArea[] {
  return nycAreas.filter(
    (area) =>
      !excludeAreas.includes(area.name) &&
      characteristics.some(
        (c) => area.characteristics.includes(c) || area.popularFor.includes(c),
      ),
  );
}

// Helper to get crowd level for a specific time
export function getAreaCrowdLevel(
  area: NYCArea,
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
): NYCArea[] {
  const areas = nearArea
    ? nycAreas.filter((a) => a.neighbors.includes(nearArea))
    : nycAreas;

  return areas.filter((area) => {
    const crowdLevel = getAreaCrowdLevel(area, timeOfDay, isWeekend);
    return crowdLevel <= 2; // Areas with low crowd levels
  });
}