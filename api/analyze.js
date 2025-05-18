import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with explicit API endpoint
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || 'NO_KEY_FOUND', {
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1'
});

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

        // First, list available models
        const models = await genAI.listModels();
        console.log('Available models:', models);

        // Remove the data:image/png;base64, prefix if it exists
        const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');

        // Convert base64 to Uint8Array
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        // Get the Gemini Pro Vision model
        const model = genAI.getGenerativeModel({ 
            model: "gemini-pro-vision"
        });

        // Create parts array for the model
        const parts = [
            { text: `Analyze this drawing. The user was asked to draw: "${prompt}". What do you see?` },
            {
                inlineData: {
                    mimeType: "image/png",
                    data: Buffer.from(imageData).toString('base64')
                }
            }
        ];

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        // Try to parse the response as JSON
        try {
            // Format the response as JSON
            const analysis = {
                models: models,
                guess: prompt,
                confidence: 0.8,
                explanation: text
            };
            
            return new Response(
                JSON.stringify(analysis),
                { headers, status: 200 }
            );
        } catch (parseError) {
            return new Response(
                JSON.stringify({
                    models: models,
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
                apiKeyPresent: !!process.env.GOOGLE_API_KEY,
                endpoint: 'Using v1 endpoint'
            }),
            { headers, status: 500 }
        );
    }
} 