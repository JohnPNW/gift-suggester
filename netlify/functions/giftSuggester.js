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

    const prompt = `Task: Generate 5 unique and specific gift ideas.
Occasion: ${occasion}
Budget: $${budget}
Recipient interests: ${interests}
Lifestyle: ${lifestyle}
Personality: ${personality}

For each gift idea, provide:
1. A specific gift name (not just "Gift Name")
2. A brief description of why it's suitable

Format each suggestion as: "1. [Specific Gift Name]: [Brief description]"
Be creative and avoid generic suggestions.`;

    console.log('Sending request to HuggingFace API with prompt:', prompt);

    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error('HUGGINGFACE_API_KEY is not set in environment variables');
    }

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/google/flan-t5-base',
      { inputs: prompt },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Raw HuggingFace API response:', JSON.stringify(response.data));

    let generatedText = '';
    if (Array.isArray(response.data) && response.data.length > 0) {
      generatedText = response.data[0].generated_text || '';
    } else if (typeof response.data === 'object') {
      generatedText = response.data.generated_text || '';
    }

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
  if (!text) {
    console.log('No text to parse');
    return suggestions;
  }
  
  const lines = text.split('\n');
  for (let line of lines) {
    const match = line.match(/(\d+)\.\s*(.+?):\s*(.+)/);
    if (match) {
      suggestions.push({
        name: match[2].trim(),
        description: match[3].trim()
      });
    }
  }

  // If no suggestions were parsed, try to extract any meaningful content
  if (suggestions.length === 0) {
    const fallbackMatch = text.match(/(.+?):\s*(.+)/);
    if (fallbackMatch) {
      suggestions.push({
        name: fallbackMatch[1].trim(),
        description: fallbackMatch[2].trim()
      });
    }
  }

  console.log('Parsed suggestions:', JSON.stringify(suggestions));
  return suggestions.slice(0, 5);  // Ensure we return at most 5 suggestions
}
