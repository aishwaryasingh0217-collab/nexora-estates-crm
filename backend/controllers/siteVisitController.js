const crypto = require('crypto');
const pool = require('../config/db');
const googleCalendar = require('../services/googleCalendarService');
const { createNotification, broadcastToAdmins } = require('../services/notificationService');

/**
 * Helper: Log site visit history
 */
async function logVisitHistory(siteVisitId, action, performedBy, previousStatus, newStatus, notes) {
  try {
    const historyId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO site_visit_history (id, site_visit_id, action, performed_by, previous_status, new_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [historyId, siteVisitId, action, performedBy, previousStatus, newStatus, notes]
    );
  } catch (error) {
    console.error('[Site Visit History] Logging error:', error.message);
  }
}

const getSiteVisits = async (req, res, next) => {
  try {
    const { status, project_id, agent_id, lead_id, customer_id } = req.query;

    let query = `
      SELECT sv.*, p.name AS project_name, p.location AS project_location, p.city AS project_city,
             u.first_name AS agent_first_name, u.last_name AS agent_last_name, u.email AS agent_email,
             l.first_name AS lead_first_name, l.last_name AS lead_last_name, l.phone AS lead_phone, l.email AS lead_email,
             c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone, c.email AS customer_email
      FROM site_visits sv
      JOIN projects p ON sv.project_id = p.id
      JOIN users u ON sv.assigned_agent_id = u.id
      LEFT JOIN leads l ON sv.lead_id = l.id
      LEFT JOIN customers c ON sv.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND sv.status = ?`;
      params.push(status.toUpperCase());
    }
    if (project_id) {
      query += ` AND sv.project_id = ?`;
      params.push(project_id);
    }
    if (agent_id) {
      query += ` AND sv.assigned_agent_id = ?`;
      params.push(agent_id);
    }
    if (lead_id) {
      query += ` AND sv.lead_id = ?`;
      params.push(lead_id);
    }
    if (customer_id) {
      query += ` AND sv.customer_id = ?`;
      params.push(customer_id);
    }

    query += ` ORDER BY sv.scheduled_time DESC`;

    const [siteVisits] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: siteVisits.length,
      data: siteVisits
    });
  } catch (error) {
    next(error);
  }
};

const getSiteVisitById = async (req, res, next) => {
  try {
    const [siteVisits] = await pool.query(
      `SELECT sv.*, p.name AS project_name, p.location AS project_location, p.city AS project_city,
              u.first_name AS agent_first_name, u.last_name AS agent_last_name, u.email AS agent_email,
              l.first_name AS lead_first_name, l.last_name AS lead_last_name,
              l.phone AS lead_phone, l.email AS lead_email, l.stage AS lead_stage,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.phone AS customer_phone, c.email AS customer_email
       FROM site_visits sv
       JOIN projects p ON sv.project_id = p.id
       JOIN users u ON sv.assigned_agent_id = u.id
       LEFT JOIN leads l ON sv.lead_id = l.id
       LEFT JOIN customers c ON sv.customer_id = c.id
       WHERE sv.id = ?`,
      [req.params.id]
    );

    if (siteVisits.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Site visit record not found.'
      });
    }

    const [history] = await pool.query(
      `SELECT h.*, u.first_name AS performer_first_name, u.last_name AS performer_last_name
       FROM site_visit_history h
       LEFT JOIN users u ON h.performed_by = u.id
       WHERE h.site_visit_id = ?
       ORDER BY h.created_at DESC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: { ...siteVisits[0], history }
    });
  } catch (error) {
    next(error);
  }
};

const createSiteVisit = async (req, res, next) => {
  try {
    const { lead_id, customer_id, project_id, assigned_agent_id, scheduled_time, notes } = req.body;

    if (!project_id || !assigned_agent_id || !scheduled_time) {
      return res.status(400).json({
        status: 'error',
        message: 'project_id, assigned_agent_id, and scheduled_time are required.'
      });
    }

    const visitId = crypto.randomUUID();
    
    // Insert site visit
    await pool.query(
      `INSERT INTO site_visits (id, lead_id, customer_id, project_id, assigned_agent_id, scheduled_time, status, client_feedback)
       VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`,
      [
        visitId,
        lead_id || null,
        customer_id || null,
        project_id,
        assigned_agent_id,
        scheduled_time,
        notes || null
      ]
    );

    // Get details for Google Calendar
    const [visitDetails] = await pool.query(
      `SELECT 
        sv.id, sv.scheduled_time,
        COALESCE(l.first_name, c.first_name, 'Unknown') AS client_first_name,
        COALESCE(l.last_name, c.last_name, '') AS client_last_name,
        COALESCE(l.phone, c.phone, '') AS client_phone,
        COALESCE(l.email, c.email, '') AS client_email,
        p.name AS project_name,
        p.location AS project_location,
        p.city AS project_city,
        u.first_name AS agent_first_name,
        u.last_name AS agent_last_name,
        u.email AS agent_email
       FROM site_visits sv
       LEFT JOIN leads l ON sv.lead_id = l.id
       LEFT JOIN customers c ON sv.customer_id = c.id
       LEFT JOIN projects p ON sv.project_id = p.id
       LEFT JOIN users u ON sv.assigned_agent_id = u.id
       WHERE sv.id = ?`,
      [visitId]
    );

    let googleEventId = null;
    
    // Sync to Google Calendar if enabled
    if (googleCalendar.isCalendarEnabled() && visitDetails.length > 0) {
      const visit = visitDetails[0];
      googleEventId = await googleCalendar.createCalendarEvent({
        clientName: `${visit.client_first_name} ${visit.client_last_name}`.trim(),
        clientEmail: visit.client_email,
        clientPhone: visit.client_phone,
        projectName: visit.project_name,
        projectLocation: visit.project_location,
        projectCity: visit.project_city,
        agentName: `${visit.agent_first_name} ${visit.agent_last_name}`.trim(),
        agentEmail: visit.agent_email,
        scheduledTime: visit.scheduled_time,
        notes: notes
      });

      // Update with Google event ID if created
      if (googleEventId) {
        await pool.query(
          `UPDATE site_visits SET google_event_id = ? WHERE id = ?`,
          [googleEventId, visitId]
        );
      }
    }

    // If linked to a lead, update lead stage to VISIT_SCHEDULED
    if (lead_id) {
      await pool.query(
        `UPDATE leads SET stage = 'VISIT_SCHEDULED' WHERE id = ? AND stage IN ('INCOMING', 'CONTACTED')`,
        [lead_id]
      );
    }

    // Log history
    await logVisitHistory(visitId, 'CREATED', req.user.id, null, 'SCHEDULED', 'Site visit scheduled');

    // Trigger Notification for Assigned Agent & Admins
    const visitorName = visitDetails.length > 0 ? `${visitDetails[0].client_first_name} ${visitDetails[0].client_last_name}`.trim() : 'Prospect';
    const projName = visitDetails.length > 0 ? visitDetails[0].project_name : 'Project';
    const formattedDt = new Date(scheduled_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    if (assigned_agent_id) {
      await createNotification({
        recipientUserId: assigned_agent_id,
        type: 'INFO',
        title: 'Site Visit Scheduled',
        message: `Site visit for ${visitorName} at ${projName} is scheduled for ${formattedDt}.`,
        relatedEntityType: 'SITE_VISIT',
        relatedEntityId: visitId
      });
    }
    await broadcastToAdmins({
      type: 'INFO',
      title: 'New Site Visit Scheduled',
      message: `Site visit booked for ${visitorName} at ${projName} on ${formattedDt}.`,
      relatedEntityType: 'SITE_VISIT',
      relatedEntityId: visitId
    });

    res.status(201).json({
      status: 'success',
      message: 'Site visit appointment scheduled successfully.',
      data: {
        id: visitId,
        project_id,
        assigned_agent_id,
        scheduled_time,
        status: 'SCHEDULED',
        google_synced: !!googleEventId
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateSiteVisit = async (req, res, next) => {
  try {
    const { status, client_feedback, rating, scheduled_time, outcome, next_action } = req.body;

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        status: 'error',
        message: 'Rating must be between 1 and 5.'
      });
    }

    // Get current visit details
    const [currentVisit] = await pool.query(
      `SELECT sv.*, 
        COALESCE(l.first_name, c.first_name, 'Unknown') AS client_first_name,
        COALESCE(l.last_name, c.last_name, '') AS client_last_name,
        COALESCE(l.phone, c.phone, '') AS client_phone,
        COALESCE(l.email, c.email, '') AS client_email,
        p.name AS project_name,
        p.location AS project_location,
        p.city AS project_city,
        u.first_name AS agent_first_name,
        u.last_name AS agent_last_name,
        u.email AS agent_email
       FROM site_visits sv
       LEFT JOIN leads l ON sv.lead_id = l.id
       LEFT JOIN customers c ON sv.customer_id = c.id
       LEFT JOIN projects p ON sv.project_id = p.id
       LEFT JOIN users u ON sv.assigned_agent_id = u.id
       WHERE sv.id = ?`,
      [req.params.id]
    );

    if (currentVisit.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Site visit record not found.'
      });
    }

    const visit = currentVisit[0];
    const previousStatus = visit.status;

    // Build update query
    const updates = [];
    const values = [];

    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (client_feedback !== undefined) { updates.push('client_feedback = ?'); values.push(client_feedback); }
    if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }
    if (scheduled_time !== undefined) { updates.push('scheduled_time = ?'); values.push(scheduled_time); }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields provided to update.'
      });
    }

    values.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE site_visits SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Site visit record not found.'
      });
    }

    // Sync to Google Calendar
    if (googleCalendar.isCalendarEnabled()) {
      if (visit.google_event_id) {
        if (status === 'CANCELLED') {
          await googleCalendar.cancelCalendarEvent(visit.google_event_id);
        } else if (scheduled_time || (status && status !== 'CANCELLED') || client_feedback !== undefined) {
          await googleCalendar.updateCalendarEvent(visit.google_event_id, {
            clientName: `${visit.client_first_name} ${visit.client_last_name}`.trim(),
            clientEmail: visit.client_email,
            clientPhone: visit.client_phone,
            projectName: visit.project_name,
            projectLocation: visit.project_location,
            projectCity: visit.project_city,
            agentName: `${visit.agent_first_name} ${visit.agent_last_name}`.trim(),
            agentEmail: visit.agent_email,
            scheduledTime: scheduled_time || visit.scheduled_time,
            notes: client_feedback !== undefined ? client_feedback : visit.client_feedback
          });
        }
      } else if (status !== 'CANCELLED') {
        // Event was not created before; create it now
        const newGoogleEventId = await googleCalendar.createCalendarEvent({
          clientName: `${visit.client_first_name} ${visit.client_last_name}`.trim(),
          clientEmail: visit.client_email,
          clientPhone: visit.client_phone,
          projectName: visit.project_name,
          projectLocation: visit.project_location,
          projectCity: visit.project_city,
          agentName: `${visit.agent_first_name} ${visit.agent_last_name}`.trim(),
          agentEmail: visit.agent_email,
          scheduledTime: scheduled_time || visit.scheduled_time,
          notes: client_feedback !== undefined ? client_feedback : visit.client_feedback
        });

        if (newGoogleEventId) {
          await pool.query(
            `UPDATE site_visits SET google_event_id = ? WHERE id = ?`,
            [newGoogleEventId, req.params.id]
          );
        }
      }
    }

    // If status is COMPLETED and linked to a lead, update lead stage to VISIT_COMPLETED
    if (status === 'COMPLETED' && visit.lead_id) {
      await pool.query(
        `UPDATE leads SET stage = 'VISIT_COMPLETED' WHERE id = ? AND stage = 'VISIT_SCHEDULED'`,
        [visit.lead_id]
      );
    }

    // Log history
    let historyNotes = '';
    if (status && status !== previousStatus) {
      historyNotes += `Status changed from ${previousStatus} to ${status}. `;
    }
    if (scheduled_time) {
      historyNotes += `Rescheduled to ${scheduled_time}. `;
    }
    if (client_feedback) {
      historyNotes += `Feedback: ${client_feedback}`;
    }

    await logVisitHistory(
      req.params.id,
      status ? 'STATUS_CHANGED' : 'UPDATED',
      req.user.id,
      previousStatus,
      status || previousStatus,
      historyNotes
    );

    res.status(200).json({
      status: 'success',
      message: 'Site visit record updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSiteVisits,
  getSiteVisitById,
  createSiteVisit,
  updateSiteVisit
};
