import { OpenAI } from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a creative prompt generator for a drawing game. Generate 3 random words or short phrases that would be fun to draw. They should be of similar difficulty level. Return ONLY a JSON array with exactly 3 items, no other text."
                },
                {
                    role: "user",
                    content: "Generate 3 drawing prompts"
                }
            ],
            temperature: 0.9,
        });

        const prompts = JSON.parse(completion.choices[0].message.content);
        return res.status(200).json(prompts);
    } catch (error) {
        console.error('Error generating prompts:', error);
        return res.status(500).json({ error: 'Failed to generate prompts' });
    }
} 