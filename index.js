require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
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

// ===============================
// Middleware
// ===============================

// Validate API key middleware
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('user_id, active')
      .eq('key', apiKey)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!data.active) {
      return res.status(401).json({ error: 'API key is inactive' });
    }

    req.userId = data.user_id;
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Rate limiting middleware
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

const rateLimiter = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const now = Date.now();
  
  if (rateLimit.has(apiKey)) {
    const { count, windowStart } = rateLimit.get(apiKey);
    
    if (now - windowStart > RATE_LIMIT_WINDOW) {
      rateLimit.set(apiKey, { count: 1, windowStart: now });
    } else if (count >= MAX_REQUESTS) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((windowStart + RATE_LIMIT_WINDOW - now) / 1000)
      });
    } else {
      rateLimit.set(apiKey, { count: count + 1, windowStart });
    }
  } else {
    rateLimit.set(apiKey, { count: 1, windowStart: now });
  }
  
  next();
};

// ===============================
// Routes
// ===============================

// Serve static pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get('/auth/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth', 'dashboard.html'));
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api', 'docs.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Management Portal is running' });
});

// Proxy endpoint to main service
app.post('/api/search', validateApiKey, rateLimiter, async (req, res) => {
  try {
    // Forward the request to the main service
    const response = await axios.post('https://mktdata-production.up.railway.app/api/search', req.body, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Return the response from the main service
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying to main service:', error);
    res.status(error.response?.status || 500).json(error.response?.data || { 
      error: 'Error communicating with main service' 
    });
  }
});

// API Key Management
app.post('/api/keys/generate', async (req, res) => {
  try {
    const { user } = await supabase.auth.getUser(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = 'mk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substr(0, 32);
    
    const { error } = await supabase
      .from('api_keys')
      .upsert({ 
        user_id: user.id,
        key: apiKey,
        created_at: new Date().toISOString(),
        active: true
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
    res.json({ key: apiKey });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// API Key Status Management
app.post('/api/keys/deactivate', async (req, res) => {
  try {
    const { user } = await supabase.auth.getUser(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { error } = await supabase
      .from('api_keys')
      .update({ active: false })
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ message: 'API key deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating API key:', error);
    res.status(500).json({ error: 'Failed to deactivate API key' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API Management Portal running on port ${port}`);
});
