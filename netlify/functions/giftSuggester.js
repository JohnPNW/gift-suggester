const axios = require('axios');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'This was a preflight call!' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { budget, occasion, interests, lifestyle, personality } = JSON.parse(event.body);

    const prompt = `Suggest 5 gift ideas based on the following:
      Budget: ${budget}
      Occasion: ${occasion}
      Interests/Hobbies: ${interests}
      Lifestyle: ${lifestyle}
      Personality: ${personality}

      Format each suggestion as: "Gift: [gift name]. Description: [brief description]."`;

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
    console.log('Received response from HuggingFace API:', JSON.stringify(response.data));

    const generatedText = response.data[0].generated_text;
    const suggestions = parseGiftSuggestions(generatedText);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, suggestions })
    };
  } catch (error) {
    console.error('Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to generate suggestions', 
        details: error.response ? error.response.data : error.message 
      })
    };
  }
};

function parseGiftSuggestions(text) {
  console.log('Parsing gift suggestions from:', text);
  const suggestions = text.split('\n')
    .filter(line => line.startsWith('Gift:'))
    .map(line => {
      const [giftPart, descriptionPart] = line.split('Description:');
      return {
        name: giftPart.replace('Gift:', '').trim(),
        description: descriptionPart ? descriptionPart.trim() : ''
      };
    });
  console.log('Parsed suggestions:', JSON.stringify(suggestions));
  return suggestions.slice(0, 5);  // Ensure we return at most 5 suggestions
}
