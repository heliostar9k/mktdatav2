require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Anthropic } = require('@anthropic-ai/sdk');
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

// Initialize Anthropic (Claude)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
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
    console.log('Received query:', query);

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get query intent and search strategy from Claude
    const completion = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      temperature: 0,
      messages: [{
        role: 'system',
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
                 6. Identify specific instruments or sectors
                 
                 Based on this understanding, analyze this market query: "${query}"
                 Return only a valid JSON string in this exact format without any explanations or additional text:
                 {
                   "query_intent": {
                     "primary_type": "information|pattern|signal|insight",
                     "time_sensitive": boolean,
                     "requires_live": boolean
                   },
                   "search_parameters": {
                     "text_terms": ["term1", "term2"],
                     "fields_to_check": ["field1", "field2"],
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

    // Extract and parse JSON from Claude's response
    let searchStrategy;
    try {
        const text = completion.content;
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}') + 1;
        
        if (startIndex === -1 || endIndex === 0) {
            throw new Error('No JSON found in response');
        }
        
        const jsonStr = text.substring(startIndex, endIndex)
            .replace(/\n/g, '')
            .replace(/\\n/g, '')
            .replace(/\s+/g, ' ');
        
        searchStrategy = JSON.parse(jsonStr);
        
        // Validate required fields
        if (!searchStrategy.query_intent || !searchStrategy.search_parameters || !searchStrategy.result_preferences) {
            throw new Error('Missing required fields in search strategy');
        }
        
        // Ensure search_parameters.text_terms is an array
        if (!Array.isArray(searchStrategy.search_parameters.text_terms)) {
            searchStrategy.search_parameters.text_terms = [];
        }
        
        console.log('Search strategy:', JSON.stringify(searchStrategy, null, 2));
    } catch (error) {
        console.error('Parse error:', error, '\nRaw response:', completion.content);
        throw new Error('Failed to parse response: ' + error.message);
    }

    console.log('Building Supabase query');
    // Build base query
    let dbQuery = supabase.from('market_data').select('*');

    // Apply text search across all relevant fields for broader matching
    if (searchStrategy.search_parameters && Array.isArray(searchStrategy.search_parameters.text_terms) && searchStrategy.search_parameters.text_terms.length > 0) {
      const searchFields = ['ticker', 'company_name', 'pattern_keywords', 'pattern_description'];
      
      const searchConditions = searchFields.flatMap(field => 
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
    console.log('Executing Supabase query');
    let { data: results, error } = await dbQuery;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    console.log(`Found ${results ? results.length : 0} results`);

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
      console.log('Requesting Perplexity insights');
      try {
        const perplexityResponse = await axios.post('https://api.perplexity.ai/chat/completions', {
          model: "llama-3.1-sonar-small-128k-online",
          messages: [{
            role: "system",
            content: "You are a financial market analysis expert. Provide comprehensive insights about market patterns, stocks, and trading conditions. Be specific and thorough in your analysis."
          }, {
            role: "user",
            content: `Analyze this market query: ${query}\nContext: ${results.length > 0 ? 
              `Based on existing patterns: ${results.map(r => r.pattern_description).join('. ')}` : 
              'No existing patterns found in database'}`
          }],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 500,
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
        console.log('Received Perplexity insights');
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
