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

    // Get query understanding from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: `You are a SQL query builder for a market data database with this structure:
                 Table: market_data
                 Columns:
                 - ticker (text): Stock symbol
                 - company_name (text): Company name
                 - live_status (text): 'Yes' or 'No'
                 - pattern_keywords (text): Keywords describing trading patterns
                 - pattern_description (text): Detailed pattern description
                 - pattern_strength (float): Value between -1 and 1
                 
                 Given a natural language query, return ONLY a JSON object with:
                 {
                   "sql_conditions": Array of SQL WHERE conditions,
                   "live_status_check": Boolean (if query mentions live/current patterns),
                   "pattern_strength_check": {
                     "min": number or null,
                     "max": number or null
                   },
                   "search_terms": Array of key terms to search in pattern_keywords and pattern_description
                 }
                 
                 Example: For "show me live bullish nasdaq patterns"
                 Return:
                 {
                   "sql_conditions": ["pattern_keywords ILIKE '%bullish%'", "pattern_keywords ILIKE '%nasdaq%'"],
                   "live_status_check": true,
                   "pattern_strength_check": {"min": 0, "max": null},
                   "search_terms": ["bullish", "nasdaq"]
                 }`
      }, {
        role: "user",
        content: `Convert this market query to SQL conditions: "${query}"`
      }]
    });

    // Parse the OpenAI response
    const queryParams = JSON.parse(completion.choices[0].message.content);
    console.log('Query parameters:', queryParams);

    // Build the Supabase query
    let dbQuery = supabase.from('market_data').select('*');

    // Apply SQL conditions
    if (queryParams.sql_conditions && queryParams.sql_conditions.length > 0) {
      const orConditions = queryParams.sql_conditions.map(condition => {
        // Extract the field name and search term from the SQL condition
        const matches = condition.match(/(\w+)\s+ILIKE\s+'%(.+)%'/i);
        if (matches) {
          const [, field, term] = matches;
          return `${field}.ilike.%${term}%`;
        }
        return condition;
      });
      dbQuery = dbQuery.or(orConditions.join(','));
    }

    // Apply live status check
    if (queryParams.live_status_check) {
      dbQuery = dbQuery.eq('live_status', 'Yes');
    }

    // Apply pattern strength filters
    if (queryParams.pattern_strength_check?.min !== null) {
      dbQuery = dbQuery.gte('pattern_strength', queryParams.pattern_strength_check.min);
    }
    if (queryParams.pattern_strength_check?.max !== null) {
      dbQuery = dbQuery.lte('pattern_strength', queryParams.pattern_strength_check.max);
    }

    // Apply text search for pattern keywords and descriptions
    if (queryParams.search_terms && queryParams.search_terms.length > 0) {
      const textSearchConditions = queryParams.search_terms.map(term => 
        `pattern_keywords.ilike.%${term}%,pattern_description.ilike.%${term}%`
      ).join(',');
      if (!queryParams.sql_conditions || queryParams.sql_conditions.length === 0) {
        dbQuery = dbQuery.or(textSearchConditions);
      }
    }

    // Execute query
    const { data, error } = await dbQuery;

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    // Filter and sort results
    let results = data || [];
    
    // Sort by pattern strength if appropriate
    if (query.toLowerCase().includes('strong') || query.toLowerCase().includes('strength')) {
      results = results.sort((a, b) => Math.abs(b.pattern_strength) - Math.abs(a.pattern_strength));
    }

    res.json({
      results,
      query_analysis: {
        parameters: queryParams,
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
