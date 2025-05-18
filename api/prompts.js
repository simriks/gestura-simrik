import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the Gemini Pro model
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = "Generate 5 fun, creative, and simple drawing prompts for a drawing game. Each prompt should be something that can be drawn in 30 seconds. Return them as a JSON array of strings. Examples: 'a happy cat', 'a sunny beach', 'a flying bird'.";

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the response text to get the array of prompts
        // The response might include markdown or extra text, so we'll extract just the JSON array
        const promptsMatch = text.match(/\[.*\]/s);
        if (!promptsMatch) {
            throw new Error('Invalid response format');
        }

        const prompts = JSON.parse(promptsMatch[0]);
        
        return res.status(200).json(prompts);
    } catch (error) {
        console.error('Error generating prompts:', error);
        return res.status(500).json({ error: 'Failed to generate prompts' });
    }
} 