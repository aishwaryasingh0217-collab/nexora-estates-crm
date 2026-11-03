const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { google } = require('googleapis');

/**
 * Google Calendar Service
 * Manages Calendar API integration for site visit synchronization
 */

let oauth2Client = null;
let calendarEnabled = false;
let lastKnownError = null;

/**
 * Helper to update or append environment variable in .env file
 */
function updateEnvFile(key, value) {
  try {
    const envPath = path.join(__dirname, '../../.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    process.env[key] = value;
    return true;
  } catch (err) {
    console.error(`[Google Calendar] Failed to auto-update ${key} in .env:`, err.message);
    return false;
  }
}

/**
 * Initialize Google Calendar OAuth2 client
 */
function initializeCalendar() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.log('[Google Calendar] Configuration not found - Calendar sync disabled');
      calendarEnabled = false;
      lastKnownError = 'Google Client ID, Secret, or Redirect URI missing.';
      return false;
    }

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Check if we have refresh token
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (refreshToken) {
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      calendarEnabled = true;
      lastKnownError = null;
      console.log('[Google Calendar] Initialized with refresh token');
      return true;
    } else {
      console.log('[Google Calendar] Refresh token not found - Calendar sync disabled');
      calendarEnabled = false;
      lastKnownError = 'Google Refresh token not found. Please connect Google Calendar.';
      return false;
    }
  } catch (error) {
    console.error('[Google Calendar] Initialization error:', error.message);
    calendarEnabled = false;
    lastKnownError = error.message;
    return false;
  }
}

/**
 * Check if Google Calendar is enabled and configured
 */
function isCalendarEnabled() {
  return calendarEnabled;
}

/**
 * Verify Google Calendar connection live against the Google API
 */
async function verifyCalendarConnection() {
  if (!oauth2Client) {
    initializeCalendar();
  }

  if (!oauth2Client || !process.env.GOOGLE_REFRESH_TOKEN) {
    calendarEnabled = false;
    return {
      connected: false,
      reason: 'Google Calendar credentials or refresh token missing. Please connect Google Calendar.'
    };
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    await calendar.calendarList.get({ calendarId });
    calendarEnabled = true;
    lastKnownError = null;
    return {
      connected: true,
      calendarId
    };
  } catch (error) {
    const errMsg = error.message || '';
    const isInvalidGrant = errMsg.includes('invalid_grant');
    calendarEnabled = false;
    lastKnownError = isInvalidGrant 
      ? 'Google authorization has expired (invalid_grant). Please click Reconnect Google Calendar.' 
      : `Google Calendar connection error: ${errMsg}`;
    
    return {
      connected: false,
      isInvalidGrant,
      reason: lastKnownError
    };
  }
}

/**
 * Create a Google Calendar event for a site visit with client and agent attendees
 */
async function createCalendarEvent(siteVisit) {
  if (!calendarEnabled && !oauth2Client) {
    initializeCalendar();
  }

  if (!oauth2Client || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.warn('[Google Calendar] Sync skipped: Refresh token not configured.');
    return { success: false, error: 'Google Calendar not connected. Please authorize Google Calendar.' };
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Build attendee list
    const attendees = [];
    const clientEmail = siteVisit.clientEmail ? String(siteVisit.clientEmail).trim() : '';
    if (clientEmail && clientEmail.includes('@')) {
      attendees.push({
        email: clientEmail,
        displayName: siteVisit.clientName ? siteVisit.clientName.trim() : 'Client',
        responseStatus: 'needsAction'
      });
    }

    const agentEmail = siteVisit.agentEmail ? String(siteVisit.agentEmail).trim() : '';
    if (agentEmail && agentEmail.includes('@')) {
      attendees.push({
        email: agentEmail,
        displayName: siteVisit.agentName ? siteVisit.agentName.trim() : 'Site Visit Agent',
        responseStatus: 'needsAction'
      });
    }

    const locationDetails = siteVisit.projectLocation
      ? (siteVisit.projectCity ? `${siteVisit.projectName || 'Project Site'}, ${siteVisit.projectLocation}, ${siteVisit.projectCity}` : `${siteVisit.projectName || 'Project Site'}, ${siteVisit.projectLocation}`)
      : (siteVisit.projectCity ? `${siteVisit.projectName || 'Project Site'}, ${siteVisit.projectCity}` : (siteVisit.projectName || 'Project Site Location'));

    const startDate = new Date(siteVisit.scheduledTime);
    const durationMinutes = siteVisit.durationMinutes || 60;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const descriptionLines = [
      `🗓️ Real Estate CRM - Site Visit Appointment`,
      `=========================================`,
      `🏢 Project: ${siteVisit.projectName || 'N/A'}`,
      `📍 Location: ${locationDetails}`,
      `👤 Client: ${siteVisit.clientName || 'N/A'}${siteVisit.clientPhone ? ` (Phone: ${siteVisit.clientPhone})` : ''}${clientEmail ? ` (Email: ${clientEmail})` : ''}`,
      `👔 Assigned Representative: ${siteVisit.agentName || 'N/A'}${agentEmail ? ` (Email: ${agentEmail})` : ''}`,
      ``,
      `📝 Notes / Agenda:`,
      `${siteVisit.notes || 'Property walkthrough and unit presentation.'}`
    ];

    const event = {
      summary: `Site Visit: ${siteVisit.projectName || 'Property'} - ${siteVisit.clientName || 'Client'}`,
      location: locationDetails,
      description: descriptionLines.join('\n'),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      attendees: attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 },       // 1 hour before
          { method: 'popup', minutes: 15 }        // 15 mins before
        ]
      }
    };

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
      sendUpdates: 'all' // Dispatches Google Calendar email invitation and adds event to client Gmail Calendar
    });

    console.log('[Google Calendar] Event created successfully with ID:', response.data.id);
    if (clientEmail) {
      console.log(`[Google Calendar] Invitation dispatched to client: ${clientEmail}`);
    } else {
      console.log('[Google Calendar] Note: No client email provided for invitation.');
    }

    return {
      success: true,
      id: response.data.id,
      htmlLink: response.data.htmlLink
    };
  } catch (error) {
    const isInvalidGrant = error.message && error.message.includes('invalid_grant');
    if (isInvalidGrant) {
      calendarEnabled = false;
      lastKnownError = 'Google authorization has expired (invalid_grant). Please re-authenticate.';
    }
    console.error('[Google Calendar] Create event error:', error.message);
    return {
      success: false,
      error: error.message,
      isInvalidGrant
    };
  }
}

/**
 * Update an existing Google Calendar event (reschedule, update details, or attendee changes)
 */
async function updateCalendarEvent(googleEventId, siteVisit) {
  if (!googleEventId) {
    return { success: false, error: 'No Google Event ID provided.' };
  }

  if (!oauth2Client) {
    initializeCalendar();
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Build attendee list
    const attendees = [];
    const clientEmail = siteVisit.clientEmail ? String(siteVisit.clientEmail).trim() : '';
    if (clientEmail && clientEmail.includes('@')) {
      attendees.push({
        email: clientEmail,
        displayName: siteVisit.clientName ? siteVisit.clientName.trim() : 'Client'
      });
    }
    const agentEmail = siteVisit.agentEmail ? String(siteVisit.agentEmail).trim() : '';
    if (agentEmail && agentEmail.includes('@')) {
      attendees.push({
        email: agentEmail,
        displayName: siteVisit.agentName ? siteVisit.agentName.trim() : 'Site Visit Agent'
      });
    }

    const locationDetails = siteVisit.projectLocation
      ? (siteVisit.projectCity ? `${siteVisit.projectName || 'Project Site'}, ${siteVisit.projectLocation}, ${siteVisit.projectCity}` : `${siteVisit.projectName || 'Project Site'}, ${siteVisit.projectLocation}`)
      : (siteVisit.projectCity ? `${siteVisit.projectName || 'Project Site'}, ${siteVisit.projectCity}` : (siteVisit.projectName || 'Project Site Location'));

    const startDate = new Date(siteVisit.scheduledTime);
    const durationMinutes = siteVisit.durationMinutes || 60;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const descriptionLines = [
      `🗓️ Real Estate CRM - Site Visit Appointment (Updated)`,
      `=========================================`,
      `🏢 Project: ${siteVisit.projectName || 'N/A'}`,
      `📍 Location: ${locationDetails}`,
      `👤 Client: ${siteVisit.clientName || 'N/A'}${siteVisit.clientPhone ? ` (Phone: ${siteVisit.clientPhone})` : ''}${clientEmail ? ` (Email: ${clientEmail})` : ''}`,
      `👔 Assigned Representative: ${siteVisit.agentName || 'N/A'}${agentEmail ? ` (Email: ${agentEmail})` : ''}`,
      ``,
      `📝 Notes / Agenda:`,
      `${siteVisit.notes || 'Property walkthrough and unit presentation.'}`
    ];

    const event = {
      summary: `Site Visit: ${siteVisit.projectName || 'Property'} - ${siteVisit.clientName || 'Client'}`,
      location: locationDetails,
      description: descriptionLines.join('\n'),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      attendees: attendees
    };

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    await calendar.events.update({
      calendarId: calendarId,
      eventId: googleEventId,
      resource: event,
      sendUpdates: 'all' // Send update notification to client and agent
    });

    console.log('[Google Calendar] Event updated successfully:', googleEventId);
    return { success: true };
  } catch (error) {
    console.error('[Google Calendar] Update event error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a Google Calendar event
 */
async function cancelCalendarEvent(googleEventId) {
  if (!googleEventId) {
    return { success: false, error: 'No Google Event ID provided.' };
  }

  if (!oauth2Client) {
    initializeCalendar();
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: googleEventId,
      sendUpdates: 'all' // Notify guests of cancellation
    });

    console.log('[Google Calendar] Event cancelled successfully:', googleEventId);
    return { success: true };
  } catch (error) {
    console.error('[Google Calendar] Cancel event error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get authorization URL for OAuth consent
 */
function getAuthUrl() {
  initializeCalendar();

  if (!oauth2Client) {
    return null;
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  
  const options = {
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Forces new refresh token creation every time
    include_granted_scopes: true
  };

  const calendarEmail = process.env.GOOGLE_CALENDAR_ID;
  if (calendarEmail && calendarEmail.includes('@')) {
    options.login_hint = calendarEmail;
  }
  
  return oauth2Client.generateAuthUrl(options);
}

/**
 * Exchange authorization code for tokens and auto-persist to .env
 */
async function getTokensFromCode(code) {
  if (!oauth2Client) {
    initializeCalendar();
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    calendarEnabled = true;
    lastKnownError = null;
    
    console.log('[Google Calendar] Tokens obtained successfully');
    if (tokens.refresh_token) {
      console.log('[Google Calendar] Auto-saving GOOGLE_REFRESH_TOKEN to .env');
      updateEnvFile('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
      process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
    }
    
    return tokens;
  } catch (error) {
    console.error('[Google Calendar] Token exchange error:', error.message);
    throw error;
  }
}

// Initialize on module load
initializeCalendar();

module.exports = {
  isCalendarEnabled,
  verifyCalendarConnection,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  getAuthUrl,
  getTokensFromCode,
  initializeCalendar
};

