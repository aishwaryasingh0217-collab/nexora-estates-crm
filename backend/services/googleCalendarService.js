const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { google } = require('googleapis');

/**
 * Google Calendar Service
 * Manages Calendar API integration for site visit synchronization
 */

let oauth2Client = null;
let calendarEnabled = false;

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
      console.log('[Google Calendar] Initialized successfully');
      return true;
    } else {
      console.log('[Google Calendar] Refresh token not found - Calendar sync disabled');
      calendarEnabled = false;
      return false;
    }
  } catch (error) {
    console.error('[Google Calendar] Initialization error:', error.message);
    calendarEnabled = false;
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
 * Create a Google Calendar event for a site visit with client and agent attendees
 */
async function createCalendarEvent(siteVisit) {
  if (!calendarEnabled) {
    return null;
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Build attendee list
    const attendees = [];
    if (siteVisit.clientEmail && typeof siteVisit.clientEmail === 'string' && siteVisit.clientEmail.includes('@')) {
      attendees.push({
        email: siteVisit.clientEmail.trim(),
        displayName: siteVisit.clientName ? siteVisit.clientName.trim() : 'Client',
        responseStatus: 'needsAction'
      });
    }
    if (siteVisit.agentEmail && typeof siteVisit.agentEmail === 'string' && siteVisit.agentEmail.includes('@')) {
      attendees.push({
        email: siteVisit.agentEmail.trim(),
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
      `👤 Client: ${siteVisit.clientName || 'N/A'}${siteVisit.clientPhone ? ` (Phone: ${siteVisit.clientPhone})` : ''}${siteVisit.clientEmail ? ` (Email: ${siteVisit.clientEmail})` : ''}`,
      `👔 Assigned Representative: ${siteVisit.agentName || 'N/A'}${siteVisit.agentEmail ? ` (Email: ${siteVisit.agentEmail})` : ''}`,
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
      sendUpdates: 'all' // Crucial: Send invitations to client and agent attendees
    });

    console.log('[Google Calendar] Event created successfully with ID:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('[Google Calendar] Create event error:', error.message);
    return null;
  }
}

/**
 * Update an existing Google Calendar event (reschedule, update details, or attendee changes)
 */
async function updateCalendarEvent(googleEventId, siteVisit) {
  if (!calendarEnabled || !googleEventId) {
    return false;
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Build attendee list
    const attendees = [];
    if (siteVisit.clientEmail && typeof siteVisit.clientEmail === 'string' && siteVisit.clientEmail.includes('@')) {
      attendees.push({
        email: siteVisit.clientEmail.trim(),
        displayName: siteVisit.clientName ? siteVisit.clientName.trim() : 'Client'
      });
    }
    if (siteVisit.agentEmail && typeof siteVisit.agentEmail === 'string' && siteVisit.agentEmail.includes('@')) {
      attendees.push({
        email: siteVisit.agentEmail.trim(),
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
      `👤 Client: ${siteVisit.clientName || 'N/A'}${siteVisit.clientPhone ? ` (Phone: ${siteVisit.clientPhone})` : ''}${siteVisit.clientEmail ? ` (Email: ${siteVisit.clientEmail})` : ''}`,
      `👔 Assigned Representative: ${siteVisit.agentName || 'N/A'}${siteVisit.agentEmail ? ` (Email: ${siteVisit.agentEmail})` : ''}`,
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
      sendUpdates: 'all' // Crucial: Send notification of updates to all attendees
    });

    console.log('[Google Calendar] Event updated successfully:', googleEventId);
    return true;
  } catch (error) {
    console.error('[Google Calendar] Update event error:', error.message);
    return false;
  }
}

/**
 * Cancel a Google Calendar event
 */
async function cancelCalendarEvent(googleEventId) {
  if (!calendarEnabled || !googleEventId) {
    return false;
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: googleEventId,
      sendUpdates: 'all' // Crucial: Notify guests that the event has been cancelled
    });

    console.log('[Google Calendar] Event cancelled successfully:', googleEventId);
    return true;
  } catch (error) {
    console.error('[Google Calendar] Cancel event error:', error.message);
    return false;
  }
}

/**
 * Get authorization URL for OAuth consent
 */
function getAuthUrl() {
  if (!oauth2Client) {
    initializeCalendar();
  }

  if (!oauth2Client) {
    return null;
  }

  const scopes = ['https://www.googleapis.com/auth/calendar'];
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(code) {
  if (!oauth2Client) {
    initializeCalendar();
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    calendarEnabled = true;
    
    console.log('[Google Calendar] Tokens obtained successfully');
    console.log('[Google Calendar] Refresh Token:', tokens.refresh_token);
    console.log('[Google Calendar] Add this to your .env file: GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    
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
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  getAuthUrl,
  getTokensFromCode,
  initializeCalendar
};
