require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


// Security middleware for production
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate limiting - more generous for production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 100, // More requests in production
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Neon Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Test database connection
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    console.log('Neon PostgreSQL database connected successfully');
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
}

// Health check endpoint (EXACTLY as specified)
app.get('/healthz', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    res.status(200).json({
      ok: true,
      version: "1.0",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "1.0",
      database: "disconnected",
      error: error.message
    });
  }
});


// Stats page with proper data handling
app.get('/code/:code', async (req, res) => {
  const { code } = req.params;

  try {
    // Get the link data for stats
    const result = await pool.query(
      'SELECT short_code, original_url, clicks, last_clicked_at, created_at FROM links WHERE short_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      // If link doesn't exist, redirect to dashboard
      return res.redirect('/');
    }

    // Send the HTML with embedded data for the stats page
    const link = result.rows[0];
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Stats for ${link.short_code} - TinyLink</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="bg-gray-50 min-h-screen">
          <header class="bg-white shadow-sm">
              <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div class="flex justify-between items-center py-4">
                      <a href="/" class="flex items-center space-x-2">
                          <span class="text-2xl">🔗</span>
                          <h1 class="text-2xl font-bold text-gray-900">TinyLink</h1>
                      </a>
                      <nav class="flex space-x-4">
                          <a href="/" class="text-gray-600 hover:text-gray-900 font-medium">Dashboard</a>
                      </nav>
                  </div>
              </div>
          </header>

          <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div class="flex items-center justify-between mb-6">
                      <h2 class="text-2xl font-semibold text-gray-800">Stats for: ${link.short_code}</h2>
                      <a href="/" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                          Back to Dashboard
                      </a>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div class="bg-blue-50 p-4 rounded-lg">
                          <h3 class="text-lg font-semibold text-blue-800 mb-2">Total Clicks</h3>
                          <p class="text-3xl font-bold text-blue-600">${link.clicks}</p>
                      </div>
                      
                      <div class="bg-green-50 p-4 rounded-lg">
                          <h3 class="text-lg font-semibold text-green-800 mb-2">Short URL</h3>
                          <p class="text-sm font-mono text-green-600 break-all">${window.location.origin}/${link.short_code}</p>
                          <button onclick="copyToClipboard('${window.location.origin}/${link.short_code}')" 
                                  class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors">
                              Copy URL
                          </button>
                      </div>
                  </div>

                  <div class="space-y-4">
                      <div>
                          <h3 class="text-lg font-semibold text-gray-800 mb-2">Original URL</h3>
                          <a href="${link.original_url}" target="_blank" class="text-blue-600 hover:text-blue-800 break-all">
                              ${link.original_url}
                          </a>
                      </div>
                      
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <h3 class="text-lg font-semibold text-gray-800 mb-2">Created</h3>
                              <p class="text-gray-600">${new Date(link.created_at).toLocaleString()}</p>
                          </div>
                          
                          <div>
                              <h3 class="text-lg font-semibold text-gray-800 mb-2">Last Clicked</h3>
                              <p class="text-gray-600">${link.last_clicked_at ? new Date(link.last_clicked_at).toLocaleString() : 'Never'}</p>
                          </div>
                      </div>
                  </div>
              </div>
          </main>

          <script>
          function copyToClipboard(text) {
              navigator.clipboard.writeText(text).then(() => {
                  alert('URL copied to clipboard!');
              }).catch(() => {
                  alert('Failed to copy URL');
              });
          }
          </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Stats page error:', error);
    res.redirect('/');
  }
});



// Redirect endpoint - EXACT path matching for automated testing
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  // Skip for reserved paths
  if (['api', 'healthz', 'code', 'public'].includes(code.toLowerCase())) {
    return res.redirect('/');
  }

  try {
    const result = await pool.query(
      'SELECT original_url FROM links WHERE short_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    // Update click count and last clicked time
    await pool.query(
      'UPDATE links SET clicks = clicks + 1, last_clicked_at = CURRENT_TIMESTAMP WHERE short_code = $1',
      [code]
    );

    // HTTP 302 redirect as specified
    res.redirect(302, result.rows[0].original_url);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API Routes - EXACT paths as specified

// GET /api/links - List all links
app.get('/api/links', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT short_code, original_url, clicks, last_clicked_at, created_at FROM links ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/links/:code - Stats for one code
app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(
      'SELECT short_code, original_url, clicks, last_clicked_at, created_at FROM links WHERE short_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/links - Create link (409 if code exists)
app.post('/api/links', async (req, res) => {
  const { url, customCode } = req.body;

  // Validate URL as specified
  if (!url || !validator.isURL(url, { require_protocol: true })) {
    return res.status(400).json({ error: 'Invalid URL. Please include http:// or https://' });
  }

  // Generate or validate short code - follows [A-Za-z0-9] pattern
  let shortCode = customCode;
  if (!shortCode) {
    shortCode = generateShortCode();
  } else {
    // Validate custom code pattern [A-Za-z0-9] (6-8 chars)
    if (!/^[A-Za-z0-9]{6,8}$/.test(shortCode)) {
      return res.status(400).json({
        error: 'Custom code must be 6-8 characters and contain only letters and numbers'
      });
    }
  }

  try {
    // Check if code already exists - 409 conflict as specified
    const existing = await pool.query(
      'SELECT short_code FROM links WHERE short_code = $1',
      [shortCode]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '409 Custom code already exists' });
    }

    // Insert new link
    const result = await pool.query(
      'INSERT INTO links (short_code, original_url) VALUES ($1, $2) RETURNING short_code, original_url, clicks, created_at',
      [shortCode, url]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/links/:code - Delete link
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM links WHERE short_code = $1 RETURNING short_code',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Delete link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Frontend Routes

// Dashboard - /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Stats page - /code/:code
app.get('/code/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.set('trust proxy', 1);

// Helper function to generate random short code [A-Za-z0-9]
function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const length = Math.floor(Math.random() * 3) + 6; // 6-8 characters
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start server
app.listen(PORT, async () => {
  console.log(`TinyLink server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: ${process.env.BASE_URL || `http://localhost:${PORT}`}/healthz`);
  
  await testDatabaseConnection();
});

module.exports = app;