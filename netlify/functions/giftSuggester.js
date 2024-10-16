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
    console.log('Received request body:', event.body);
    const { budget, occasion, interests, lifestyle, personality } = JSON.parse(event.body);

    const prompt = `Generate 5 unique gift ideas based on the following:
      Budget: ${budget}
      Occasion: ${occasion}
      Interests/Hobbies: ${interests}
      Lifestyle: ${lifestyle}
      Personality: ${personality}

      For each gift idea, provide a specific gift name and a brief description.
      Format each suggestion as: "Gift: [specific gift name] - Description: [brief description]"`;

    console.log('Sending request to OpenAI API with prompt:', prompt);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant that suggests gift ideas." },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        n: 1,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('OpenAI API Response:', JSON.stringify(response.data));

    const generatedText = response.data.choices[0].message.content.trim();
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
  console.log('Parsing gift suggestions from:', text);
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

  console.log('Parsed suggestions:', JSON.stringify(suggestions));
  return suggestions.slice(0, 5);  // Ensure we return at most 5 suggestions
}
