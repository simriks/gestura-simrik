import { OpenAI } from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "system",
                    content: "You are analyzing drawings in a fun drawing game. The user was asked to draw a specific prompt. Be encouraging and specific in your feedback. Respond with a JSON object containing: guess (what you think it is), confidence (0-1), and explanation."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `The user was asked to draw: ${prompt}. What do you see in this drawing?`
                        },
                        {
                            type: "image_url",
                            image_url: image
                        }
                    ]
                }
            ],
            max_tokens: 150
        });

        const analysis = JSON.parse(response.choices[0].message.content);
        return res.status(200).json(analysis);
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        return res.status(500).json({ error: 'Failed to analyze drawing' });
    }
} 