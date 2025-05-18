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

        if (!image) {
            return new Response(
                JSON.stringify({ error: 'Missing image' }),
                { headers, status: 400 }
            );
        }

        // Get the Gemini 1.5 Pro model
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro"
        });

        // First do a simple test to check if the model is accessible
        try {
            const testResult = await model.generateContent("Test connection.");
            await testResult.response;
            console.log('Model connection test successful');
        } catch (testError) {
            console.error('Model connection test failed:', testError);
            throw new Error(`Model connection test failed: ${testError.message}`);
        }

        // Remove the data:image/png;base64, prefix if it exists
        const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');

        // Convert base64 to Uint8Array
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        // Create parts array for the model
        const parts = [
            {
                text: `Look at this drawing and tell me what you think it represents. 
                Rules:
                - Respond with a JSON object containing:
                  - guess: a single word (noun) that best describes what you see
                  - confidence: a number between 0 and 1 indicating your confidence
                  - explanation: a brief analysis of what you see and why you made this guess
                - The guess should be a simple, common noun
                - Focus on the most obvious interpretation
                - Be concise but descriptive
                Example format: 
                {
                    "guess": "tree",
                    "confidence": 0.85,
                    "explanation": "The drawing shows a vertical trunk with branches spreading at the top and leaf-like shapes, characteristic of a simple tree drawing."
                }`
            },
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
            const analysis = JSON.parse(text);
            
            // Verify the response format
            if (!analysis.guess || !analysis.confidence || !analysis.explanation) {
                throw new Error('Invalid response format');
            }

            // Ensure confidence is a number between 0 and 1
            analysis.confidence = Math.min(1, Math.max(0, Number(analysis.confidence)));
            
            return new Response(
                JSON.stringify(analysis),
                { headers, status: 200 }
            );
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            
            // Try to extract JSON from the response using regex
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const extractedJson = JSON.parse(jsonMatch[0]);
                    return new Response(
                        JSON.stringify({
                            guess: extractedJson.guess || 'unknown',
                            confidence: Number(extractedJson.confidence) || 0.5,
                            explanation: extractedJson.explanation || 'Unable to provide detailed explanation'
                        }),
                        { headers, status: 200 }
                    );
                } catch (secondaryParseError) {
                    console.error('Failed secondary JSON parsing:', secondaryParseError);
                }
            }
            
            // If all parsing attempts fail, return a clean fallback response
            return new Response(
                JSON.stringify({
                    guess: 'unknown',
                    confidence: 0.5,
                    explanation: 'I can see the drawing but am unable to provide a detailed analysis at this time.'
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
                endpoint: 'Using base endpoint'
            }),
            { headers, status: 500 }
        );
    }
} 