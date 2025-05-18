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
                text: `Respond with ONLY a raw JSON object containing:
                - guess: (string)
                - confidence: (number 0-1) 
                - explanation: (string)
                NO markdown formatting or additional text.`
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

        // Replace the current try-catch block with this:
        try {
            // First attempt to parse directly
            try {
                const analysis = JSON.parse(text);
                if (analysis.guess) return formatSuccess(analysis);
            } catch (e) {
                // If direct parse fails, try cleaning markdown
                const cleanText = text.replace(/^```json|```$/g, '').trim();
                const analysis = JSON.parse(cleanText);
                if (analysis.guess) return formatSuccess(analysis);
                
                // If still fails, try extracting JSON from string
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const analysis = JSON.parse(jsonMatch[0]);
                    if (analysis.guess) return formatSuccess(analysis);
                }
            }
            
            // If all parsing attempts fail
            throw new Error('Could not extract valid JSON from response');
            
            // Helper function for consistent success responses
            function formatSuccess(analysis) {
                analysis.confidence = Math.min(1, Math.max(0, Number(analysis.confidence)));
                return new Response(JSON.stringify(analysis), { headers, status: 200 });
            }
        } catch (parseError) {
            console.error('All parsing attempts failed:', parseError);
            return new Response(
                JSON.stringify({
                    guess: 'unknown',
                    confidence: 0.5,
                    explanation: 'The AI response format was unexpected'
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