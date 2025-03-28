import processWithGemini from './lib/geminiProcessor';

async function testGeminiProcessing() {
  console.log("=== Testing Gemini Processor ===");
  
  const testQueries = [
    "I want to have dinner in Soho at 8pm",
    "Coffee in Shoreditch around 10am",
    "What's a good place for lunch in Camden?",
    "Museums near Kensington in the afternoon",
    "Romantic dinner in Mayfair",
    "Something fun to do in Hackney at 6"
  ];
  
  for (const query of testQueries) {
    console.log(`\nTesting query: "${query}"`);
    try {
      const result = await processWithGemini(query);
      console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Error processing query:", error);
    }
  }
}

testGeminiProcessing().catch(console.error);