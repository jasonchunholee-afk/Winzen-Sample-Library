import { GoogleGenAI } from '@google/genai';

async function test(model: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model,
      contents: "Hi"
    });
    console.log(`Model ${model} SUCCESS:`, res.text);
  } catch (e: any) {
    console.log(`Model ${model} FAILED:`, e.message);
  }
}

async function run() {
  await test('gemini-3.6-flash');
  await test('gemini-3.8-flash');
}
run();
