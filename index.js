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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // First, use OpenAI to understand the query intent and structure
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: `You are a financial data query analyzer. The database contains market data with these fields:
                 - ticker: Stock symbol
                 - company_name: Company name
                 - live_status: Whether the pattern is live (Yes/No)
                 - pattern_keywords: Keywords describing the pattern
                 - pattern_description: Detailed pattern description
                 - pattern_strength: Numerical strength of the pattern (-1 to 1)
                 
                 Analyze the user's query and return a JSON object with:
                 1. primary_focus: Main aspect they're interested in
                 2. conditions: Array of conditions to check
                 3. sort_by: How to sort results (if applicable)
                 4. relevance_threshold: How strict to be with matching (0-1)`
      }, {
        role: "user",
        content: `Analyze this market query: "${query}"`
      }]
    });

    // Parse the analysis
    const analysis = JSON.parse(completion.choices[0].message.content);

    // Build the Supabase query based on the analysis
    let dbQuery = supabase
      .from('market_data')
      .select('*');

    // Apply conditions based on analysis
    analysis.conditions?.forEach(condition => {
      if (condition.field && condition.value) {
        if (condition.field === 'pattern_strength') {
          // Handle numerical comparisons
          if (condition.operator === '>') {
            dbQuery = dbQuery.gt('pattern_strength', condition.value);
          } else if (condition.operator === '<') {
            dbQuery = dbQuery.lt('pattern_strength', condition.value);
          }
        } else if (['pattern_keywords', 'pattern_description'].includes(condition.field)) {
          // Full text search in patterns
          dbQuery = dbQuery.textSearch(condition.field, condition.value);
        } else {
          // Regular field matching
          dbQuery = dbQuery.ilike(condition.field, `%${condition.value}%`);
        }
      }
    });

    // Execute query
    const { data, error } = await dbQuery;

    if (error) throw error;

    // Post-process results based on analysis
    let results = data;

    // Apply sorting if specified
    if (analysis.sort_by) {
      results = results.sort((a, b) => {
        if (analysis.sort_by === 'pattern_strength') {
          return b.pattern_strength - a.pattern_strength;
        }
        return 0;
      });
    }

    // Filter by relevance if specified
    if (analysis.relevance_threshold) {
      // Implement relevance scoring based on match quality
      results = results.filter(item => {
        // Simple relevance scoring example - can be made more sophisticated
        let score = 0;
        if (item.pattern_keywords?.toLowerCase().includes(analysis.primary_focus?.toLowerCase())) score += 0.5;
        if (item.pattern_description?.toLowerCase().includes(analysis.primary_focus?.toLowerCase())) score += 0.5;
        return score >= analysis.relevance_threshold;
      });
    }

    res.json({
      results,
      analysis: {
        understood_query: analysis,
        result_count: results.length
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
