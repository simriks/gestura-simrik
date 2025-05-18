import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with explicit API endpoint
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || 'NO_KEY_FOUND', {
    apiEndpoint: 'https://generativelanguage.googleapis.com'
});

// Enable Edge Runtime
export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    // Reject GET requests
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers }
        );
    }

    try {
        const body = await req.json();
        const { image, prompt } = body;

        if (!image) {
            return new Response(
                JSON.stringify({ error: 'Missing image' }),
                { status: 400, headers }
            );
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        // Check connection (optional sanity check)
        try {
            const testResult = await model.generateContent("Test connection.");
            await testResult.response;
            console.log('Model connection successful');
        } catch (testError) {
            throw new Error(`Model connection failed: ${testError.message}`);
        }

        // Convert base64 to Uint8Array
        const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        const parts = [
            {
                text: `Respond with ONLY a raw JSON object containing:
                - guess: (string)
                - confidence: (number 0-1)
                - explanation: (string)
                NO markdown formatting or extra text.`
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
        const text = await response.text();

        // Parse JSON from Gemini output
        try {
            const tryParse = (str) => {
                try {
                    return JSON.parse(str);
                } catch {
                    const cleaned = str.replace(/^```json|```$/g, '').trim();
                    return JSON.parse(cleaned);
                }
            };

            const analysis = tryParse(text) || JSON.parse(text.match(/\{[\s\S]*\}/)[0]);

            if (analysis.guess) {
                analysis.confidence = Math.min(1, Math.max(0, Number(analysis.confidence)));
                return new Response(JSON.stringify(analysis), { status: 200, headers });
            }

            throw new Error('Response did not include expected fields');
        } catch (parseError) {
            console.error('Parsing failed:', parseError);
            return new Response(
                JSON.stringify({
                    guess: 'unknown',
                    confidence: 0.5,
                    explanation: 'AI response format was not valid JSON'
                }),
                { status: 200, headers }
            );
        }
    } catch (error) {
        console.error('API error:', error);
        return new Response(
            JSON.stringify({
                error: 'Failed to analyze drawing',
                details: error.message,
                apiKeyPresent: !!process.env.GOOGLE_API_KEY
            }),
            { status: 500, headers }
        );
    }
}
