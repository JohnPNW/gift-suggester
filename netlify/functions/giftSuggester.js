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

    const prompt = `Generate 5 unique gift ideas based on the following:
      Budget: ${budget}
      Occasion: ${occasion}
      Interests/Hobbies: ${interests}
      Lifestyle: ${lifestyle}
      Personality: ${personality}

      For each gift idea, provide a specific gift name and a brief description.
      Format each suggestion as: "Gift: [specific gift name] - Description: [brief description]"`;

    const response = await axios.post(
      'https://api.openai.com/v1/engines/text-davinci-002/completions',
      {
        prompt: prompt,
        max_tokens: 200,
        n: 1,
        stop: null,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedText = response.data.choices[0].text.trim();
    console.log('Generated text:', generatedText);

    const suggestions = parseGiftSuggestions(generatedText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, suggestions })
    };
  } catch (error) {
    console.error('Error details:', error.response ? JSON.stringify(error.response.data) : error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to generate suggestions', 
        details: error.response ? error.response.data : error.message 
      })
    };
  }
};

function parseGiftSuggestions(text) {
  const suggestions = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase().startsWith('gift:')) {
      const parts = line.split('-');
      if (parts.length >= 2) {
        const name = parts[0].replace('Gift:', '').trim();
        const description = parts.slice(1).join('-').replace('Description:', '').trim();
        suggestions.push({ name, description });
      }
    }
  }

  return suggestions.slice(0, 5);  // Ensure we return at most 5 suggestions
}
