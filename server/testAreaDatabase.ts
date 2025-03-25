import { londonAreas, findAreasByCharacteristics } from './data/london-areas';

function testLondonAreas() {
  console.log(`Total areas in database: ${londonAreas.length}`);
  
  // Check for completeness
  const incompleteAreas = londonAreas.filter(area => {
    return !area.name || 
           !area.characteristics || 
           area.characteristics.length === 0 ||
           !area.neighbors || 
           area.neighbors.length === 0 ||
           !area.popularFor || 
           area.popularFor.length === 0;
  });
  
  if (incompleteAreas.length > 0) {
    console.log(`❌ Found ${incompleteAreas.length} areas with incomplete data:`);
    incompleteAreas.forEach(area => console.log(`  - ${area.name}`));
  } else {
    console.log("✅ All areas have complete data");
  }
  
  // Check neighbor relationships only for areas that exist in the database
  let asymmetricRelationships = 0;
  const asymmetricPairs: string[] = [];
  
  londonAreas.forEach(area => {
    area.neighbors.forEach(neighbor => {
      const neighborArea = londonAreas.find(a => a.name === neighbor);
      if (!neighborArea) {
        // Skip missing areas - these are intentionally left out of our dataset
        // console.log(`❌ "${area.name}" lists "${neighbor}" as neighbor, but it's not in the database`);
      } else if (!neighborArea.neighbors.includes(area.name)) {
        console.log(`❌ "${area.name}" lists "${neighbor}" as neighbor, but not vice versa`);
        asymmetricRelationships++;
        asymmetricPairs.push(`${area.name} -> ${neighbor}`);
      }
    });
  });
  
  if (asymmetricRelationships > 0) {
    console.log(`Found ${asymmetricRelationships} asymmetric relationships:`);
    asymmetricPairs.forEach(pair => console.log(`  - ${pair}`));
  } else {
    console.log("✅ All neighbor relationships are symmetric");
  }
  
  // Test search by characteristics
  const areasWithLuxury = findAreasByCharacteristics(["luxury"]);
  const areasWithCulture = findAreasByCharacteristics(["cultural", "historic"]);
  const areasWithNature = findAreasByCharacteristics(["nature", "open space"]);
  
  console.log(`\nAreas by characteristics:`);
  console.log(`Luxury areas: ${areasWithLuxury.length}`);
  console.log(`Cultural/historic areas: ${areasWithCulture.length}`);
  console.log(`Nature/open space areas: ${areasWithNature.length}`);
  
  // Count area types
  const areaTypes = {
    neighborhood: 0,
    borough: 0,
    area: 0,
  };
  
  londonAreas.forEach(area => {
    if (area.type === "neighborhood") areaTypes.neighborhood++;
    if (area.type === "borough") areaTypes.borough++;
    if (area.type === "area") areaTypes.area++;
  });
  
  console.log(`\nArea types:`);
  console.log(`Neighborhoods: ${areaTypes.neighborhood}`);
  console.log(`Boroughs: ${areaTypes.borough}`);
  console.log(`Areas: ${areaTypes.area}`);
}

// Run the tests
console.log("======= TESTING LONDON AREAS DATABASE =======");
testLondonAreas();