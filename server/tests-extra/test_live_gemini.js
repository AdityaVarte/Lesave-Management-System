require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  console.log('Testing live model ID:', model);
  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'Say hello in 3 words' }] }],
    });
    console.log('Live Gemini response:', res.text);
  } catch (err) {
    console.log('Live Gemini error status:', err.status || err.statusCode);
    console.log('Live Gemini error message:', err.message);
  }
}

test();
