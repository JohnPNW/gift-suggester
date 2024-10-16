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

  // Check for API key
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error('HUGGINGFACE_API_KEY is not set in environment variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Server configuration error', 
        details: 'API key is missing'
      })
    };
  }

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

    let retries = 3;
    let response;
    while (retries > 0) {
      try {
        response = await axios.post(
          'https://api-inference.huggingface.co/models/distilgpt2',
          { inputs: prompt },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (response.data && response.data[0] && response.data[0].generated_text) {
          break;
        }
      } catch (error) {
        console.log('Error from HuggingFace API:', error.message);
        if (error.response && error.response.data && error.response.data.error) {
          console.log('API Error details:', error.response.data.error);
          if (error.response.data.error.includes('currently loading')) {
            console.log('Model is loading. Retrying...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds before retrying
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      retries--;
    }

    if (!response || !response.data || !response.data[0] || !response.data[0].generated_text) {
      throw new Error('Failed to generate suggestions after retries');
    }

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
