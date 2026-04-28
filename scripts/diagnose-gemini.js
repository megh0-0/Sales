const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("ERROR: No API Key found in .env");
    return;
  }

  console.log("Using API Key:", apiKey.substring(0, 5) + "..." + apiKey.substring(apiKey.length - 5));
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // There is no direct "listModels" in the simple genAI object, 
    // but we can try a basic fetch to see if the key is valid.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("test");
    console.log("Direct Test Success!");
  } catch (error) {
    console.log("\n--- DIAGNOSTIC RESULTS ---");
    console.log("Error Code:", error.status || "N/A");
    console.log("Error Message:", error.message);
    
    if (error.message.includes("404")) {
      console.log("\nPOSSIBLE REASONS FOR 404:");
      console.log("1. Your API Key is from Google Cloud Console, but 'Generative Language API' is not enabled.");
      console.log("2. Your API Key is restricted to a specific region that doesn't support Flash yet.");
      console.log("3. You are using a Vertex AI key with the AI Studio SDK (different libraries).");
    }
  }
}

checkModels();
