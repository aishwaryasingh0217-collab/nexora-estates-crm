const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const c = require('../controllers/workspaceController');

const { wrap, requireKind } = c;
const staff = requireKind('agent', 'manager');
const manager = requireKind('manager');
const partner = requireKind('partner');

router.use(authenticateToken, c.loadWorkspaceUser);

// Me
router.get('/me', wrap(c.getMe));
router.patch('/me/availability', staff, wrap(c.setMyAvailability));

// Today (role-aware: agent queue · partner dashboard)
router.get('/today', wrap(c.getToday));

// Phone alerts (Web Push) — every role
router.get('/push/key', wrap(c.getPushKey));
router.post('/push/subscribe', wrap(c.subscribePush));
router.post('/push/unsubscribe', wrap(c.unsubscribePush));
router.post('/push/test', wrap(c.testPush));

// Company branding (owner only; checked in the controller)
router.put('/settings', manager, wrap(c.updateCompanySettings));

// Live sync + calendar (every role, scoped to what they may see)
router.get('/pulse', wrap(c.getPulse));
router.get('/calendar', wrap(c.getCalendar));

// Leads — scoped per role inside the controller
router.get('/leads', wrap(c.listLeads));
router.post('/leads', wrap(c.createLead));
router.post('/leads/distribute', manager, wrap(c.distributeLeads));
router.post('/leads/import', manager, wrap(c.importLeads));
router.get('/leads/export', wrap(c.exportLeads));
router.get('/leads/:id', wrap(c.getLead));
router.patch('/leads/:id', staff, wrap(c.updateLead));
router.post('/leads/:id/activities', wrap(c.logLeadActivity));
router.post('/leads/:id/visits', wrap(c.scheduleVisit));
router.post('/leads/:id/book', staff, wrap(c.bookUnit));
router.post('/leads/:id/assign', manager, wrap(c.assignLead));

// Site visits
router.get('/visits', wrap(c.listVisits));
router.patch('/visits/:id', wrap(c.updateVisit));

// Inventory
router.get('/projects', wrap(c.listProjects));
router.get('/projects/:id/units', wrap(c.listProjectUnits));

// Manager
router.get('/team', manager, wrap(c.getTeam));
router.get('/team/members', manager, wrap(c.listAssignees));
router.get('/activity', manager, wrap(c.getActivity));
router.get('/reports', manager, wrap(c.getReports));
router.patch('/team/:id/availability', manager, wrap(c.setAgentAvailability));

// Partner
router.get('/earnings', partner, wrap(c.getEarnings));

module.exports = router;
