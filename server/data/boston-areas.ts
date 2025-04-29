import { z } from "zod";

export const areaSchema = z.object({
  name: z.string(),
  type: z.enum(["region", "neighborhood", "area"]),
  region: z.string(),
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

export type BostonArea = z.infer<typeof areaSchema>;

export const bostonAreas: BostonArea[] = [
  {
    name: "Downtown",
    type: "region",
    region: "Downtown",
    characteristics: ["urban", "historic", "commercial", "cultural"],
    neighbors: ["Back Bay", "North End", "Beacon Hill", "Chinatown"],
    popularFor: ["government buildings", "historic sites", "shopping", "finance"],
    crowdLevels: {
      morning: 4,
      afternoon: 5,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "Back Bay",
    type: "neighborhood",
    region: "Downtown",
    characteristics: ["upscale", "historic", "shopping", "dining"],
    neighbors: ["Fenway", "South End", "Beacon Hill", "Cambridge"],
    popularFor: ["Newbury Street", "Copley Square", "Boston Public Library", "brownstones"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Beacon Hill",
    type: "neighborhood",
    region: "Downtown",
    characteristics: ["historic", "picturesque", "charming", "upscale"],
    neighbors: ["Back Bay", "West End", "Downtown", "Cambridge"],
    popularFor: ["Acorn Street", "State House", "historic architecture", "gas lamps"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "North End",
    type: "neighborhood",
    region: "Downtown",
    characteristics: ["italian", "historic", "food", "cultural"],
    neighbors: ["Downtown", "West End", "Waterfront", "Beacon Hill"],
    popularFor: ["Italian restaurants", "Paul Revere House", "Old North Church", "pastry shops"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "Fenway",
    type: "neighborhood",
    region: "West",
    characteristics: ["sports", "youthful", "university", "cultural"],
    neighbors: ["Back Bay", "Longwood", "Kenmore", "Mission Hill"],
    popularFor: ["Fenway Park", "Red Sox", "universities", "museums"],
    crowdLevels: {
      morning: 2,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "Seaport",
    type: "neighborhood",
    region: "East",
    characteristics: ["modern", "waterfront", "innovation", "dining"],
    neighbors: ["South Boston", "Downtown", "Fort Point"],
    popularFor: ["restaurants", "harbor views", "museums", "convention center"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 5,
      weekend: 5,
    },
  },
  {
    name: "South End",
    type: "neighborhood",
    region: "Central",
    characteristics: ["trendy", "diverse", "foodie", "historic"],
    neighbors: ["Back Bay", "Roxbury", "Bay Village", "South Boston"],
    popularFor: ["restaurants", "Victorian rowhouses", "arts", "boutiques"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Cambridge",
    type: "area",
    region: "North",
    characteristics: ["academic", "intellectual", "diverse", "cultural"],
    neighbors: ["Somerville", "Allston", "Charlestown"],
    popularFor: ["Harvard University", "MIT", "Harvard Square", "innovation"],
    crowdLevels: {
      morning: 3,
      afternoon: 4,
      evening: 4,
      weekend: 4,
    },
  },
  {
    name: "Somerville",
    type: "area",
    region: "North",
    characteristics: ["eclectic", "youthful", "diverse", "artsy"],
    neighbors: ["Cambridge", "Medford", "Charlestown"],
    popularFor: ["Davis Square", "Union Square", "restaurants", "breweries"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Charlestown",
    type: "neighborhood",
    region: "North",
    characteristics: ["historic", "waterfront", "residential", "scenic"],
    neighbors: ["North End", "Cambridge", "East Boston"],
    popularFor: ["Bunker Hill Monument", "USS Constitution", "Navy Yard", "Freedom Trail"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 2,
      weekend: 4,
    },
  },
  {
    name: "Jamaica Plain",
    type: "neighborhood",
    region: "Southwest",
    characteristics: ["diverse", "green", "lively", "community-oriented"],
    neighbors: ["Roxbury", "Mission Hill", "Roslindale", "Brookline"],
    popularFor: ["Jamaica Pond", "Arnold Arboretum", "restaurants", "local shops"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 3,
      weekend: 4,
    },
  },
  {
    name: "Allston/Brighton",
    type: "neighborhood",
    region: "West",
    characteristics: ["student", "diverse", "casual", "affordable"],
    neighbors: ["Fenway", "Brookline", "Cambridge"],
    popularFor: ["universities", "music venues", "ethnic restaurants", "student housing"],
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
    region: "Downtown",
    characteristics: ["cultural", "vibrant", "food", "busy"],
    neighbors: ["Downtown", "Theater District", "South End", "Financial District"],
    popularFor: ["Chinese restaurants", "markets", "cultural events", "bakeries"],
    crowdLevels: {
      morning: 3,
      afternoon: 5,
      evening: 4,
      weekend: 5,
    },
  },
  {
    name: "Dorchester",
    type: "neighborhood",
    region: "South",
    characteristics: ["diverse", "residential", "community-oriented", "evolving"],
    neighbors: ["South Boston", "Roxbury", "Mattapan"],
    popularFor: ["beaches", "parks", "diverse dining", "JFK Library"],
    crowdLevels: {
      morning: 2,
      afternoon: 3,
      evening: 2,
      weekend: 3,
    },
  },
  {
    name: "Financial District",
    type: "area",
    region: "Downtown",
    characteristics: ["business", "commercial", "historic", "bustling"],
    neighbors: ["Downtown", "Waterfront", "Chinatown", "North End"],
    popularFor: ["skyscrapers", "historic sites", "business centers", "restaurants"],
    crowdLevels: {
      morning: 5,
      afternoon: 5,
      evening: 2,
      weekend: 1,
    },
  }
];

// Helper functions for finding areas based on different criteria
export function findAreasByCharacteristics(
  characteristics: string[],
  excludeAreas: string[] = [],
): BostonArea[] {
  return bostonAreas.filter(area => 
    !excludeAreas.includes(area.name) && 
    characteristics.some(char => 
      area.characteristics.some(areaChar => 
        areaChar.toLowerCase().includes(char.toLowerCase())
      )
    )
  );
}

export function getAreaCrowdLevel(
  area: BostonArea,
  timeOfDay: string,
  isWeekend: boolean,
): number {
  if (isWeekend) {
    return area.crowdLevels.weekend;
  }
  
  switch (timeOfDay.toLowerCase()) {
    case 'morning': return area.crowdLevels.morning;
    case 'afternoon': return area.crowdLevels.afternoon;
    case 'evening': return area.crowdLevels.evening;
    default: return area.crowdLevels.afternoon;
  }
}

export function findQuietAreas(
  timeOfDay: string,
  isWeekend: boolean,
  nearArea?: string,
): BostonArea[] {
  const threshold = 3; // Areas with crowd level below this are considered quiet
  
  let filteredAreas = bostonAreas.filter(area => 
    getAreaCrowdLevel(area, timeOfDay, isWeekend) < threshold
  );
  
  // If nearArea is specified, prioritize areas that are neighbors
  if (nearArea) {
    const area = bostonAreas.find(a => a.name.toLowerCase() === nearArea.toLowerCase());
    if (area) {
      const neighbors = area.neighbors;
      filteredAreas.sort((a, b) => {
        const aIsNeighbor = neighbors.includes(a.name) ? 0 : 1;
        const bIsNeighbor = neighbors.includes(b.name) ? 0 : 1;
        return aIsNeighbor - bIsNeighbor;
      });
    }
  }
  
  return filteredAreas;
} 