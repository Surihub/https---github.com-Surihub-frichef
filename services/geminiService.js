import { ingredientsWithStepAmounts, hasIngredientAmount } from '../components/recipeFormat';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const ingredientSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING, description: 'Ingredient name only' },
      quantity: { type: SchemaType.STRING, description: 'Explicit quantity with unit, e.g. 1큰술, 2개, 100g, 1/2개' },
    },
    required: ['name', 'quantity'],
  },
};

const ingredientStrings = items => {
  if (!Array.isArray(items) || !items.length) throw new Error('Missing ingredient quantities');
  return items.map(item => {
    if (!item.name?.trim() || !item.quantity?.trim() || !/\d|반|약간|적당량/.test(item.quantity)) {
      throw new Error('Missing ingredient quantity');
    }
    return `${item.name.trim()} ${item.quantity.trim()}`;
  });
};

export const completeIngredientAmounts = async recipe => {
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: { ingredients: ingredientSchema },
        required: ['ingredients'],
      },
    },
  });
  const response = await model.generateContent(`다음 요리의 모든 재료에 분량을 붙여줘. 기존에 명시한 분량은 유지하고 누락된 분량만 조리 순서와 1인분 기준으로 제안해줘. 조미료도 포함. 큰술/작은술/개/g/ml 등 간단한 단위 사용. JSON으로만 응답. 요리: ${JSON.stringify({ dishName: recipe.dishName, ingredients: recipe.ingredients, extraNeeded: recipe.extraNeeded, steps: recipe.steps })}`);
  return ingredientStrings(JSON.parse(response.response.text()).ingredients);
};

export const repairExistingRecipe = async recipe => {
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const knownIngredients = ingredientsWithStepAmounts(recipe);
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          ingredients: ingredientSchema,
          steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['ingredients', 'steps'],
      },
    },
  });
  const prompt = `기존 레시피의 표시만 정리해줘. 요리나 핵심 조리 과정은 바꾸지 마.
재료 목록의 모든 재료에 분량을 기입. 본문에서 추출한 확정 분량은 반드시 그대로 유지. 없는 분량만 기존 요리와 인분에 맞춰 제안. 재료 누락 금지.
분량은 재료에만 표시하고 순서에는 반복하지 마. 조리 시간과 온도는 유지.
순서는 4~6개의 짧은 구절로, 예: 두부 썰기, 양념장 섞기. 합니다/습니다/줍니다/입니다/주세요 금지.
팬 예열, 식용유 두르기, 주걱 설명 생략. 가열 단계 끝에 [[중불]]처럼 불 세기 표시.
확정 분량 포함 재료: ${JSON.stringify(knownIngredients)}
기존 레시피: ${JSON.stringify({ dishName: recipe.dishName, ingredients: recipe.ingredients, extraNeeded: recipe.extraNeeded, steps: recipe.steps })}`;
  const response = await model.generateContent(prompt);
  const result = JSON.parse(response.response.text());
  let ingredients = ingredientStrings(result.ingredients);
  // Preserve exact amounts already present in the original ingredients or instructions.
  for (const known of knownIngredients.filter(hasIngredientAmount)) {
    const name = known.replace(/\s*(?:\d+(?:[./]\d+)?|반)\s*(?:큰술|작은술|공기|꼬집|스푼|컵|개|장|쪽|대|줌|봉|팩|인분|ml|mL|kg|g|L).*$/, '').trim().replace(/\s*(?:약간|적당량)$/, '');
    const index = ingredients.findIndex(item => item.startsWith(`${name} `));
    if (index >= 0) ingredients[index] = known;
    else ingredients.push(known);
  }
  for (const original of knownIngredients.filter(item => !hasIngredientAmount(item))) {
    if (!ingredients.some(item => item.startsWith(`${original} `))) throw new Error('Missing original ingredient');
  }
  if (!Array.isArray(result.steps) || !result.steps.length || result.steps.some(step => typeof step !== 'string' || /습니다|입니다|줍니다|주세요/.test(step) || hasIngredientAmount(step))) {
    throw new Error('Invalid compact steps');
  }
  return { ...recipe, ingredients, extraNeeded: [], steps: result.steps, formatVersion: 3 };
};

export const generateRecipe = async (ingredients, tools) => {
  const systemInstruction = `You are a creative 'Fridge Raider' chef. Your goal is to suggest the best possible single meal based on the user's available ingredients and cooking tools. 
  
  Strict Rules:
  1. Respond ONLY in Korean.
  2. Be creative but practical.
  3. Format the output strictly as JSON.
  4. Return 4-6 short steps, each at most 45 Korean characters. Use terse Korean action phrases like "양파 썰기", "3분 볶기". Never use formal sentence endings such as 합니다, 입니다, 주세요.
  5. Include an ingredients array of {name, quantity} objects containing ALL ingredients including seasoning, with specific quantities for one serving, e.g. {"name":"간장","quantity":"1큰술"}, {"name":"계란","quantity":"2개"}. Use quantities supplied by the user where applicable; otherwise suggest practical amounts. Do not put ingredients in extraNeeded.
  6. For each heating step append the heat level at the very end in double brackets, e.g. "양파 볶기[[중불]]". Use 약불, 중불 or 강불. Omit heat for steps without heating. Keep the whole recipe compact for a single phone screen.
  7. Ingredient amounts belong ONLY in the ingredients array. Do not repeat quantities like 1큰술, 2개, 100g in steps. Steps use names only, e.g. "간장 넣고 볶기[[중불]]". Keep useful cooking times and temperatures in steps.
  8. Skip obvious setup instructions: preheating pans, coating pans with oil, preparing tools. Never mention spatulas, silicone spatulas, or generic tool handling. Start with meaningful cooking actions. Include oil in the ingredient list with its amount if used, without dedicating a step to it.`;

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
            ingredients: ingredientSchema,
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
          required: ["ingredients", "dishName", "difficulty", "time", "steps", "proTip"],
        },
      },
    });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const responseText = response.response?.text();

    if (responseText) {
      const result = JSON.parse(responseText);
      if (!Array.isArray(result.steps) || !result.steps.length || result.steps.some(step => typeof step !== 'string' || /습니다|입니다|줍니다|주세요/.test(step) || hasIngredientAmount(step))) {
        throw new Error('Invalid compact steps');
      }
      return { ...result, ingredients: ingredientStrings(result.ingredients), formatVersion: 3 };
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate recipe. Please try again.");
  }
};

export const converseRecipe = async messages => {
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');
  const { conversationContents, conversationReply } = await import('./conversation.js');
  const contents = conversationContents(messages);
  if (!contents.length || contents[0].role !== 'user' || contents.at(-1).role !== 'user') throw new Error('Invalid conversation');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `당신은 '뭐먹지?'의 한국어 요리 대화 도우미입니다. 항상 자연스러운 존댓말로 1~3문장만 답하세요. 마크다운, 코드 블록, 장황한 인사 금지.
전체 대화를 기억하고 사용자가 말한 재료, 싫어하는 메뉴, 알레르기, 조리 시간, 맛과 조리도구 조건을 다음 추천에 모두 반영하세요. 거절한 메뉴는 사용자가 다시 원하지 않는 한 반복하지 마세요. 재료가 없으면 가장 필요한 질문 하나만 하세요. 재료가 있으면 바로 1~2개 메뉴를 제안하고 취향을 좁히세요. 없는 주요 재료를 있는 것처럼 가정하지 마세요.
사용자가 메뉴를 골랐거나 레시피·만드는 방법을 원하면 recipe 필드로 완성 레시피를 제공하세요. 단순한 메뉴 제안·질문에는 recipe를 생략하세요. reply에는 대화만, 자세한 조리법은 recipe에만 넣으세요.
recipe는 1인분 기준 모든 재료와 조미료의 구체적 분량(name, quantity)을 포함하세요. 기존 대화에서 사용자가 명시한 분량과 인분은 우선하세요.
조리 순서는 4~6개의 짧은 구절로 작성하세요. '양파 썰기', '3분 볶기'처럼 작성하고 합니다/습니다/줍니다/주세요 금지. 재료 분량은 ingredients에만 넣고 steps에 반복하지 마세요. 조리 시간과 온도는 유지하세요. 가열 단계 끝에는 [[약불]], [[중불]], [[강불]] 표시. 팬 예열·도구 설명 같은 뻔한 준비 단계는 생략하세요.
반드시 지정된 JSON 구조로만 출력하세요.`,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          reply: { type: SchemaType.STRING, description: 'Short conversational Korean response' },
          recipe: {
            type: SchemaType.OBJECT,
            properties: {
              dishName: { type: SchemaType.STRING }, ingredients: ingredientSchema,
              steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              time: { type: SchemaType.STRING }, difficulty: { type: SchemaType.STRING }, proTip: { type: SchemaType.STRING },
            },
            required: ['dishName', 'ingredients', 'steps'],
          },
        },
        required: ['reply'],
      },
    },
  });
  const response = await model.generateContent({ contents }, { timeout: 45000 });
  return conversationReply(response.response.text());
};
