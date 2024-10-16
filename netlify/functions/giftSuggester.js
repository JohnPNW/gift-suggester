const axios = require('axios');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { budget, occasion, interests, lifestyle, personality } = JSON.parse(event.body);

  const prompt = `Suggest 5 gift ideas based on the following:
    Budget: ${budget}
    Occasion: ${occasion}
    Interests/Hobbies: ${interests}
    Lifestyle: ${lifestyle}
    Personality: ${personality}

    Format each suggestion as: "Gift: [gift name]. Description: [brief description]."`;

  try {
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

    const generatedText = response.data[0].generated_text;
    const suggestions = parseGiftSuggestions(generatedText);

    return {
      statusCode: 200,
      body: JSON.stringify(suggestions)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate suggestions' })
    };
  }
};

function parseGiftSuggestions(text) {
  const suggestions = text.split('\n')
    .filter(line => line.startsWith('Gift:'))
    .map(line => {
      const [giftPart, descriptionPart] = line.split('Description:');
      return {
        name: giftPart.replace('Gift:', '').trim(),
        description: descriptionPart ? descriptionPart.trim() : ''
      };
    });
  return suggestions.slice(0, 5);  // Ensure we return at most 5 suggestions
}
