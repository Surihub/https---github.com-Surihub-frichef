import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const generateRecipe = async (ingredients, tools) => {
  const systemInstruction = `You are a creative 'Fridge Raider' chef. Your goal is to suggest the best possible single meal based on the user's available ingredients and cooking tools. 
  
  Strict Rules:
  1. Respond ONLY in Korean.
  2. Be creative but practical.
  3. Format the output strictly as JSON.
  4. Keep steps concise.`;

  const userPrompt = `Available Ingredients: ${ingredients.join(', ')}. 
  Available Tools: ${tools.join(', ')}. 
  Suggest one creative and delicious recipe that maximizes the use of these ingredients.`;

  try {
    if (!apiKey) {
      throw new Error("Missing VITE_GEMINI_API_KEY environment variable");
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            dishName: { type: SchemaType.STRING, description: "Name of the dish" },
            difficulty: { type: SchemaType.STRING, description: "Difficulty level (e.g., Easy, Medium)" },
            time: { type: SchemaType.STRING, description: "Total cooking time" },
            extraNeeded: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Common pantry items (salt, oil, etc.) or small extras needed",
            },
            steps: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Step-by-step cooking instructions",
            },
            proTip: { type: SchemaType.STRING, description: "A chef's secret tip for better taste" },
          },
          required: ["dishName", "difficulty", "time", "steps", "proTip"],
        },
      },
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const responseText = response.response?.text();

    if (responseText) {
      return JSON.parse(responseText);
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate recipe. Please try again.");
  }
};
