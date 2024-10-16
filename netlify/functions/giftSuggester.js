const axios = require('axios');

exports.handler = async function(event, context) {
  // ... (keep the existing headers and HTTP method checks)

  try {
    const { budget, occasion, interests, lifestyle, personality } = JSON.parse(event.body);

    const prompt = `Generate 5 gift ideas based on the following:
      Budget: ${budget}
      Occasion: ${occasion}
      Interests/Hobbies: ${interests}
      Lifestyle: ${lifestyle}
      Personality: ${personality}

      For each gift idea, provide the name of the gift and a brief description.
      Format: Gift: [gift name] - Description: [brief description]`;

    console.log('Sending request to HuggingFace API with prompt:', prompt);

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/gpt2',
      { inputs: prompt },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('HuggingFace API Response:', JSON.stringify(response.data));

    const generatedText = response.data[0].generated_text;
    console.log('Generated text:', generatedText);

    const suggestions = parseGiftSuggestions(generatedText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, suggestions })
    };
  } catch (error) {
    console.error('Error details:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to generate suggestions', 
        details: error.message 
      })
    };
  }
};

function parseGiftSuggestions(text) {
  console.log('Parsing gift suggestions from:', text);
  const lines = text.split('\n');
  const suggestions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('gift:')) {
      const giftMatch = line.match(/Gift:\s*(.*?)(?:\s*-\s*Description:|$)/i);
      const descriptionMatch = line.match(/Description:\s*(.*)/i) || lines[i + 1]?.match(/Description:\s*(.*)/i);
      
      if (giftMatch) {
        suggestions.push({
          name: giftMatch[1].trim(),
          description: descriptionMatch ? descriptionMatch[1].trim() : 'No description provided.'
        });
      }
    }
  }

  console.log('Parsed suggestions:', JSON.stringify(suggestions));
  return suggestions.slice(0, 5);  // Ensure we return at most 5 suggestions
}
