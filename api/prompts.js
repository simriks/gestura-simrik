import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with explicit API endpoint
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || 'NO_KEY_FOUND', {
    apiEndpoint: 'https://generativelanguage.googleapis.com'
});

// This is the format Vercel expects
export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        // First, check if we have the API key
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY is not set in environment variables');
        }

        if (process.env.GOOGLE_API_KEY === 'NO_KEY_FOUND') {
            throw new Error('GOOGLE_API_KEY has default value, not properly set');
        }

        try {
            // Get the Gemini 1.5 Pro model
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-pro"
            });

            // First do a simple test to check if the model is accessible
            const testResult = await model.generateContent("Test connection.");
            await testResult.response;
            console.log('Model connection test successful');

            // Now proceed with the actual prompt
            const result = await model.generateContent("Return a JSON array of 5 simple, easily drawable, single English words. Only return the array, no extra text or details. Examples: 'phone', 'wallet', 'pie', 'cat', 'tree'.");
            const response = await result.response;
            const text = response.text();
            
            // Try to parse as JSON first
            try {
                const prompts = JSON.parse(text);
                return new Response(
                    JSON.stringify(prompts),
                    { headers, status: 200 }
                );
            } catch (parseError) {
                // If parsing fails, try to extract array using regex
                const promptsMatch = text.match(/\[.*\]/s);
                if (!promptsMatch) {
                    throw new Error('Could not parse Gemini response: ' + text);
                }
                const prompts = JSON.parse(promptsMatch[0]);
                return new Response(
                    JSON.stringify(prompts),
                    { headers, status: 200 }
                );
            }
        } catch (geminiError) {
            throw new Error('Gemini API error: ' + geminiError.message);
        }
    } catch (error) {
        console.error('Error in prompts API:', error);
        
        // Return detailed error information
        return new Response(
            JSON.stringify({ 
                error: 'Failed to generate prompts',
                details: error.message,
                apiKeyPresent: !!process.env.GOOGLE_API_KEY,
                apiKeyValue: process.env.GOOGLE_API_KEY ? 'Key exists but hidden' : 'No key found',
                endpoint: 'Using base endpoint'
            }),
            { headers, status: 500 }
        );
    }
} 