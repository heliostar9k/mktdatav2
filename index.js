require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get SQL query from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: `You are a SQL query generator. Given a natural language query about market data, 
                 generate a Supabase SQL query. The table is called market_data and has columns: 
                 ticker, company_name, live_status, pattern_keywords, pattern_description, pattern_strength`
      }, {
        role: "user",
        content: `Convert this request into a SQL query: "${query}". 
                 If it mentions "live", add a filter for live_status = 'Yes'.
                 If it mentions specific keywords, search in pattern_keywords and pattern_description.
                 Return only the SQL query, nothing else.`
      }]
    });

    const sqlQuery = completion.choices[0].message.content;

    // Query Supabase
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .textSearch('pattern_description', query);

    if (error) throw error;

    res.json({ results: data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
