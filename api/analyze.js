import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || 'NO_KEY_FOUND');

// This is the format Vercel expects
export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers, status: 200 });
    }
    
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { headers, status: 405 }
        );
    }

    try {
        const body = await req.json();
        const { image, prompt } = body;

        if (!image || !prompt) {
            return new Response(
                JSON.stringify({ error: 'Missing image or prompt' }),
                { headers, status: 400 }
            );
        }

        // Remove the data:image/png;base64, prefix if it exists
        const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');

        // Convert base64 to Uint8Array
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        // Get the Gemini Pro Vision model with correct model name
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        const result = await model.generateContent([
            {
                text: `You are analyzing a drawing in a fun drawing game. The user was asked to draw: "${prompt}". 
                       Analyze the drawing and respond in this exact JSON format:
                       {
                           "guess": "what you think the drawing represents",
                           "confidence": 0.0-1.0 (how confident you are in your guess),
                           "explanation": "your encouraging feedback about the drawing"
                       }`
            },
            {
                inlineData: {
                    mimeType: "image/png",
                    data: Buffer.from(imageData).toString('base64')
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // Try to parse the response as JSON
        try {
            const analysis = JSON.parse(text);
            return new Response(
                JSON.stringify(analysis),
                { headers, status: 200 }
            );
        } catch (parseError) {
            // If parsing fails, create a structured response from the text
            return new Response(
                JSON.stringify({
                    guess: prompt,
                    confidence: 0.7,
                    explanation: text
                }),
                { headers, status: 200 }
            );
        }
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        return new Response(
            JSON.stringify({ 
                error: 'Failed to analyze drawing',
                details: error.message,
                apiKeyPresent: !!process.env.GOOGLE_API_KEY
            }),
            { headers, status: 500 }
        );
    }
} 