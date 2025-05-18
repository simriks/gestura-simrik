import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image, prompt } = req.body;

        if (!image || !prompt) {
            return res.status(400).json({ error: 'Missing image or prompt' });
        }

        // Remove the data:image/png;base64, prefix if it exists
        const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');

        // Convert base64 to Uint8Array
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        // Get the Gemini Pro Vision model
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
            return res.status(200).json(analysis);
        } catch (parseError) {
            // If parsing fails, create a structured response from the text
            return res.status(200).json({
                guess: prompt,
                confidence: 0.7,
                explanation: text
            });
        }
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        return res.status(500).json({ error: 'Failed to analyze drawing' });
    }
} 