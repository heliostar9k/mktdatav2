require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Serve the HTML page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// Add docs route
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get query intent and search strategy from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: `You are an advanced market intelligence system that understands various types of market-related queries.

                 QUERY TYPES TO UNDERSTAND:
                 1. Information Queries
                    - General information about stocks, patterns, or market conditions
                    - Historical context or background
                    - Example: "Tell me about ACME Inc" or "What's happening with energy stocks"
                 
                 2. Pattern Analysis
                    - Technical patterns in market behavior
                    - Trend identification
                    - Example: "Show patterns in tech when Fed was raising" or "What patterns are formed in Oil and XLY during a war"
                 
                 3. Trading Signals
                    - Actionable trading opportunities
                    - Current/Live patterns requiring immediate attention
                    - Example: "Any trading signals in SPY right now" or "Generate a trade for me with a 2% target gain"
                 
                 4. Market Insights
                    - Deeper analysis of market conditions
                    - Pattern strength and reliability
                    - Example: "What's the market showing for QQQ" or "Strong patterns today"

                 DATABASE FIELDS:
                 - ticker: Stock symbol
                 - company_name: Company name
                 - live_status: Current validity ('Yes'/'No')
                 - pattern_keywords: Pattern identification terms
                 - pattern_description: Detailed pattern explanation
                 - pattern_strength: Confidence metric (-1 to 1)

                 QUERY UNDERSTANDING REQUIREMENTS:
                 1. Identify primary intent (information/pattern/signal/insight)
                 2. Determine if live/current data is crucial
                 3. Extract relevant search terms
                 4. Understand strength/confidence requirements
                 5. Recognize time sensitivity
                 6. Identify specific instruments or sectors`
      }, {
        role: "user",
        content: `Analyze this market query: "${query}"
                 Return a JSON search strategy with:
                 {
                   "query_intent": {
                     "primary_type": "information|pattern|signal|insight",
                     "time_sensitive": boolean,
                     "requires_live": boolean
                   },
                   "search_parameters": {
                     "text_terms": ["term1", "term2", ...],
                     "fields_to_check": ["field1", "field2", ...],
                     "strength_requirements": {
                       "min": number or null,
                       "max": number or null,
                       "important": boolean
                     }
                   },
                   "result_preferences": {
                     "sort_field": string or null,
                     "sort_direction": "asc|desc",
                     "prioritize_live": boolean,
                     "prioritize_strength": boolean
                   }
                 }`
      }]
    });

    const searchStrategy = JSON.parse(completion.choices[0].message.content);
    console.log('Search strategy:', searchStrategy);

    // Build base query
    let dbQuery = supabase.from('market_data').select('*');

    // Apply text search across specified fields
    if (searchStrategy.search_parameters.text_terms.length > 0) {
      const textFields = searchStrategy.search_parameters.fields_to_check
        .filter(field => field !== 'pattern_strength');
      
      const searchConditions = textFields.flatMap(field => 
        searchStrategy.search_parameters.text_terms.map(term => 
          `${field}.ilike.%${term}%`
        )
      );
      
      if (searchConditions.length > 0) {
        dbQuery = dbQuery.or(searchConditions.join(','));
      }

      // Handle pattern_strength separately
      if (searchStrategy.search_parameters.strength_requirements.important) {
        const { min, max } = searchStrategy.search_parameters.strength_requirements;
        if (min !== null) {
          dbQuery = dbQuery.gte('pattern_strength', min);
        }
        if (max !== null) {
          dbQuery = dbQuery.lte('pattern_strength', max);
        }
      }
    }

    // Handle live status requirements
    if (searchStrategy.query_intent.requires_live) {
      dbQuery = dbQuery.eq('live_status', 'Yes');
    }

    // Execute query
    let { data: results, error } = await dbQuery;

    if (error) {
      console.error('Query error:', error);
      throw error;
    }

    // Post-process results
    if (results && results.length > 0) {
      // Handle sorting preferences
      if (searchStrategy.result_preferences.sort_field) {
        const direction = searchStrategy.result_preferences.sort_direction === 'desc' ? -1 : 1;
        results = results.sort((a, b) => {
          const aVal = a[searchStrategy.result_preferences.sort_field];
          const bVal = b[searchStrategy.result_preferences.sort_field];
          return (aVal > bVal ? 1 : -1) * direction;
        });
      }

      // Prioritize by strength if requested
      if (searchStrategy.result_preferences.prioritize_strength) {
        results = results.sort((a, b) => Math.abs(b.pattern_strength) - Math.abs(a.pattern_strength));
      }

      // Prioritize live patterns if requested
      if (searchStrategy.result_preferences.prioritize_live) {
        results = results.sort((a, b) => {
          if (a.live_status === 'Yes' && b.live_status !== 'Yes') return -1;
          if (a.live_status !== 'Yes' && b.live_status === 'Yes') return 1;
          return 0;
        });
      }
    }

    // Get additional insights from Perplexity if needed
    let additionalInsights = null;
    if (
      (results.length === 0 || 
       searchStrategy.query_intent.primary_type === 'information' ||
       searchStrategy.query_intent.primary_type === 'insight') &&
      searchStrategy.query_intent.primary_type !== 'signal'
    ) {
      try {
        const perplexityResponse = await axios.post('https://api.perplexity.ai/chat/completions', {
          model: "llama-3.1-sonar-small-128k-online",
          messages: [{
            role: "system",
            content: "Be precise and concise."
          }, {
            role: "user",
            content: `Analyze this market query: ${query}\nContext: ${results.length > 0 ? 
              `Based on existing patterns: ${results.map(r => r.pattern_description).join('. ')}` : 
              'No existing patterns found in database'}`
          }],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 150,
          search_domain_filter: ["perplexity.ai"],
          return_images: false,
          return_related_questions: false,
          search_recency_filter: "month"
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.PPLX_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        additionalInsights = perplexityResponse.data.choices[0].message.content;
      } catch (error) {
        console.error('Perplexity API error:', error);
      }
    }

    // Return results with complete analysis and insights
    res.json({
      results: results || [],
      analysis: {
        understanding: {
          query_type: searchStrategy.query_intent.primary_type,
          time_sensitive: searchStrategy.query_intent.time_sensitive,
          requires_live_data: searchStrategy.query_intent.requires_live
        },
        search_strategy: searchStrategy,
        result_count: results ? results.length : 0
      },
      additional_insights: additionalInsights
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
