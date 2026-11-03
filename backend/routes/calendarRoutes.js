const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const googleCalendar = require('../services/googleCalendarService');

// Protected CRM routes
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const check = await googleCalendar.verifyCalendarConnection();
    res.status(200).json({
      status: 'success',
      data: {
        connected: check.connected,
        reason: check.reason || null,
        isInvalidGrant: check.isInvalidGrant || false,
        authUrl: googleCalendar.getAuthUrl()
      }
    });
  } catch (error) {
    res.status(200).json({
      status: 'success',
      data: {
        connected: false,
        reason: error.message,
        authUrl: googleCalendar.getAuthUrl()
      }
    });
  }
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
 * Test Google Calendar event creation
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const testEmail = req.body.email || req.user.email;
    if (!testEmail) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient email is required for calendar test.'
      });
    }

    const testResult = await googleCalendar.createCalendarEvent({
      clientName: 'Test Invitation Client',
      clientEmail: testEmail,
      clientPhone: '+91 9876543210',
      projectName: 'Nexora Demonstration Project',
      projectLocation: 'MG Road, Bengaluru',
      projectCity: 'Bengaluru',
      agentName: req.user.name || 'CRM Administrator',
      agentEmail: req.user.email,
      scheduledTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      notes: 'This is a test calendar appointment dispatched from Nexora Estates CRM.'
    });

    if (testResult && testResult.success) {
      return res.status(200).json({
        status: 'success',
        message: `Test calendar invitation dispatched successfully to ${testEmail}! Check your Google Calendar & Inbox.`,
        data: testResult
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: testResult?.error || 'Failed to dispatch test calendar event.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
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
        <!DOCTYPE html>
        <html>
        <head><title>Connection Failed</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
          <div style="background:#1e293b; padding:2rem; border-radius:12px; max-width:480px; text-align:center; border:1px solid #ef4444;">
            <h2 style="color:#ef4444;">Google Calendar Connection Failed</h2>
            <p style="color:#cbd5e1;">${error}</p>
            <a href="/" style="display:inline-block; margin-top:1rem; background:#3b82f6; color:#fff; padding:0.5rem 1.25rem; border-radius:6px; text-decoration:none;">Back to CRM</a>
          </div>
        </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif; background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">
          <div style="background:#1e293b; padding:2rem; border-radius:12px; max-width:480px; text-align:center;">
            <h2 style="color:#ef4444;">Authorization Code Missing</h2>
            <a href="/" style="display:inline-block; margin-top:1rem; background:#3b82f6; color:#fff; padding:0.5rem 1.25rem; border-radius:6px; text-decoration:none;">Back to CRM</a>
          </div>
        </body>
        </html>
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
            max-width: 540px;
            width: 100%;
            border: 1px solid #334155;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            text-align: center;
          }
          h2 { color: #10b981; margin-top: 0; margin-bottom: 0.75rem; font-size: 1.5rem; }
          p { color: #cbd5e1; line-height: 1.6; margin: 0.5rem 0; }
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
          .btn:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✓ Google Calendar Connected Successfully!</h2>
          <p>Your Google Calendar integration has been authorized and persisted. All site visits scheduled in the CRM will now automatically send calendar invitations with RSVP to client Gmail addresses.</p>
          <a href="/" class="btn" onclick="if(window.opener){window.close();} return true;">Return to CRM</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
});

module.exports = router;