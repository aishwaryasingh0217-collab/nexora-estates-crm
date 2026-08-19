const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const googleCalendar = require('../services/googleCalendarService');

// Protected CRM routes
router.get('/status', authenticateToken, (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      connected: googleCalendar.isCalendarEnabled(),
      authUrl: googleCalendar.isCalendarEnabled() ? null : googleCalendar.getAuthUrl()
    }
  });
});

router.get('/auth', authenticateToken, (req, res) => {
  const authUrl = googleCalendar.getAuthUrl();

  if (!authUrl) {
    return res.status(500).json({
      status: 'error',
      message: 'Google Calendar configuration missing. Please configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env file.'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      authUrl
    }
  });
});

/**
 * GET /api/calendar/callback
 * Google OAuth callback
 */
router.get('/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).send(`
        <h2>Google Calendar connection failed</h2>
        <p>${error}</p>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <h2>Google Calendar connection failed</h2>
        <p>Authorization code is missing.</p>
      `);
    }

    const tokens = await googleCalendar.getTokensFromCode(code);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Calendar Connected</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1.5rem;
          }
          .card {
            background: #1e293b;
            padding: 2.5rem;
            border-radius: 12px;
            max-width: 580px;
            width: 100%;
            border: 1px solid #334155;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          }
          h2 { color: #10b981; margin-top: 0; margin-bottom: 0.75rem; font-size: 1.5rem; }
          p { color: #cbd5e1; line-height: 1.6; margin: 0.5rem 0; }
          pre {
            background: #0f172a;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            color: #38bdf8;
            border: 1px solid #334155;
            font-size: 0.9rem;
            margin: 1rem 0;
          }
          .btn {
            display: inline-block;
            background: #3b82f6;
            color: #ffffff;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 1.25rem;
            transition: background 0.2s;
          }
          .btn:hover {
            background: #2563eb;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✓ Google Calendar Connected</h2>
          <p>Your Google Calendar integration has been authorized successfully and is active in your CRM.</p>
          ${tokens.refresh_token ? `
            <p>To persist the connection across CRM server restarts, save the refresh token below into your <code>.env</code> file:</p>
            <pre>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
          ` : `
            <p>Access granted using existing authorization.</p>
          `}
          <a href="/" class="btn">Return to CRM Calendar</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
});

module.exports = router;