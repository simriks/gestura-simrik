const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Style-specific prompts
const stylePrompts = {
  'van-gogh': "Transform this drawing into the style of Van Gogh, with bold brushstrokes, vibrant colors, and swirling patterns characteristic of his post-impressionist style.",
  'anime': "Transform this drawing into anime style art, with clean lines, expressive features, and vibrant colors typical of Japanese animation.",
  'pixel': "Transform this drawing into pixel art, with a retro gaming aesthetic, limited color palette, and distinct pixelated blocks.",
  'watercolor': "Transform this drawing into a soft watercolor painting, with gentle color gradients, subtle blending, and delicate washes.",
  'sketch': "Transform this drawing into a detailed pencil sketch, with careful shading, precise linework, and a monochromatic style."
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, style } = req.body;

    if (!image || !style) {
      return res.status(400).json({ error: 'Missing image or style parameter' });
    }

    // Remove data URL prefix to get base64 string
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    // Get the style-specific prompt
    const stylePrompt = stylePrompts[style] || stylePrompts['van-gogh'];

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    // Prepare the prompt parts
    const prompt = [
      stylePrompt,
      {
        inlineData: {
          mimeType: "image/png",
          data: base64Image
        }
      }
    ];

    // Generate the response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Extract the transformed image and any explanation
    const transformedImage = response.text();
    
    return res.status(200).json({
      transformedImage,
      explanation: `Your drawing transformed in ${style} style!`
    });

  } catch (error) {
    console.error('Error in transform API:', error);
    return res.status(500).json({ error: 'Failed to transform image' });
  }
} 