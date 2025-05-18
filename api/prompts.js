import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || 'NO_KEY_FOUND');

export default async function handler(req) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Log request information
    console.log('API Key present:', !!process.env.GOOGLE_API_KEY);
    console.log('Request method:', req.method);

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers, status: 200 });
    }
    
    if (req.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }), 
            { headers, status: 405 }
        );
    }

    try {
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('Google API Key not found in environment variables');
        }

        // Get the Gemini Pro model
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = "Generate 5 fun, creative, and simple drawing prompts for a drawing game. Each prompt should be something that can be drawn in 30 seconds. Return them as a JSON array of strings. Examples: 'a happy cat', 'a sunny beach', 'a flying bird'.";

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the response text to get the array of prompts
        const promptsMatch = text.match(/\[.*\]/s);
        if (!promptsMatch) {
            throw new Error('Invalid response format from Gemini API');
        }

        const prompts = JSON.parse(promptsMatch[0]);
        
        return new Response(
            JSON.stringify(prompts),
            { headers, status: 200 }
        );
    } catch (error) {
        console.error('Error in prompts API:', error.message);
        return new Response(
            JSON.stringify({ 
                error: 'Failed to generate prompts',
                details: error.message,
                apiKeyPresent: !!process.env.GOOGLE_API_KEY
            }),
            { headers, status: 500 }
        );
    }
} 