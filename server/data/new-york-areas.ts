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
  },
  
  // Lower Manhattan neighborhoods
  {
    name: "Financial District",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["financial", "historic", "business", "tourist"],
    neighbors: ["Tribeca", "Chinatown", "Battery Park"],
    popularFor: ["Wall Street", "One World Trade", "Stock Exchange", "Battery Park"],
    crowdLevels: {
      morning: 5,
      afternoon: 5,
      evening: 2,
      weekend: 2,
    },
  },
  {
    name: "Tribeca",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["upscale", "trendy", "residential", "artistic"],
    neighbors: ["SoHo", "Financial District", "Chinatown"],
    popularFor: ["restaurants", "converted lofts", "film festival", "art galleries"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 4,
      weekend: 4,
    },
  },
  {
    name: "Chinatown",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["cultural", "vibrant", "historic", "food"],
    neighbors: ["Little Italy", "Lower East Side", "SoHo", "Financial District"],
    popularFor: ["dim sum", "markets", "festivals", "authentic Chinese cuisine"],
    crowdLevels: {
      morning: 3,
      afternoon: 5,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Little Italy",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["italian", "historic", "touristy", "food"],
    neighbors: ["Chinatown", "NoLita", "SoHo", "Lower East Side"],
    popularFor: ["italian restaurants", "San Gennaro Festival", "pastry shops", "cafes"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "Lower East Side",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["historic", "trendy", "diverse", "nightlife"],
    neighbors: ["East Village", "Chinatown", "NoLita", "Two Bridges"],
    popularFor: ["bars", "vintage shopping", "music venues", "tenement museum"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "East Village",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["bohemian", "youthful", "diverse", "artistic"],
    neighbors: ["NoHo", "Greenwich Village", "Lower East Side", "Gramercy"],
    popularFor: ["dive bars", "international cuisine", "vintage shops", "Tompkins Square Park"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "West Village",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["charming", "historic", "upscale", "quaint"],
    neighbors: ["Greenwich Village", "Chelsea", "SoHo", "Meatpacking District"],
    popularFor: ["brownstones", "cobblestone streets", "boutiques", "quiet restaurants"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Chelsea",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["artistic", "trendy", "diverse", "shopping"],
    neighbors: ["Greenwich Village", "Hell's Kitchen", "Flatiron District", "Meatpacking District"],
    popularFor: ["High Line", "art galleries", "Chelsea Market", "piers"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Hell's Kitchen",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["diverse", "foodie", "vibrant", "entertainment"],
    neighbors: ["Midtown", "Chelsea", "Upper West Side", "Theater District"],
    popularFor: ["restaurants", "theaters", "nightlife", "riverside parks"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 5,
      weekend: 4,
    },
  },
  {
    name: "Flatiron District",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["historic", "business", "architectural", "trendy"],
    neighbors: ["Chelsea", "Gramercy", "Murray Hill", "NoMad"],
    popularFor: ["Flatiron Building", "Madison Square Park", "shopping", "dining"],
    crowdLevels: {
      morning: 4,
      afternoon: 5,
      evening: 4,
      weekend: 4,
    },
  },
  {
    name: "Gramercy",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["upscale", "quiet", "residential", "historic"],
    neighbors: ["East Village", "Flatiron District", "Murray Hill", "Kips Bay"],
    popularFor: ["Gramercy Park", "townhouses", "Union Square", "restaurants"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 3,
      weekend: 3,
    },
  },
  {
    name: "Harlem",
    type: "neighborhood",
    borough: "Manhattan",
    characteristics: ["historic", "cultural", "diverse", "artistic"],
    neighbors: ["Upper West Side", "Upper East Side", "East Harlem", "Washington Heights"],
    popularFor: ["Apollo Theater", "soul food", "jazz clubs", "historic architecture"],
    crowdLevels: {
      morning: 3,
      afternoon: 3,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "DUMBO",
    type: "neighborhood",
    borough: "Brooklyn",
    characteristics: ["trendy", "artistic", "industrial", "waterfront"],
    neighbors: ["Brooklyn Heights", "Vinegar Hill", "Downtown Brooklyn"],
    popularFor: ["waterfront views", "Brooklyn Bridge Park", "art galleries", "converted warehouses"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 3,
      weekend: 5,
    },
  },
  {
    name: "Brooklyn Heights",
    type: "neighborhood",
    borough: "Brooklyn",
    characteristics: ["historic", "upscale", "quiet", "waterfront"],
    neighbors: ["DUMBO", "Downtown Brooklyn", "Cobble Hill"],
    popularFor: ["Promenade", "historic brownstones", "quiet streets", "waterfront views"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 2,
      weekend: 4,
    },
  },
  {
    name: "Park Slope",
    type: "neighborhood",
    borough: "Brooklyn",
    characteristics: ["family-friendly", "historic", "residential", "foodie"],
    neighbors: ["Prospect Heights", "Gowanus", "Windsor Terrace"],
    popularFor: ["Prospect Park", "brownstones", "restaurants", "bars"],
    crowdLevels: {
      morning: 3,
      afternoon: 3,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "Astoria",
    type: "neighborhood",
    borough: "Queens",
    characteristics: ["diverse", "cultural", "authentic", "food"],
    neighbors: ["Long Island City", "Woodside", "Jackson Heights"],
    popularFor: ["Greek food", "Astoria Park", "Museum of the Moving Image", "beer gardens"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 4,
      weekend: 4,
    },
  }
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