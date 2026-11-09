/**
 * Business Suite API — /api/suite/*
 * Every route requires sign-in and a capability from services/permissions.js; record-level rules
 * (own team, own customers, own clients) are applied inside the controllers and services.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireCapability: need, requireAnyCapability: needAny, can } = require('../services/permissions');
const { uploadTo, storedPath } = require('../middleware/fileUpload');

const gov = require('../controllers/suite/governanceController');
const sales = require('../controllers/suite/salesController');
const fin = require('../controllers/suite/financeController');
const inv = require('../controllers/suite/inventoryController');
const mkt = require('../controllers/suite/marketingController');
const crm = require('../controllers/suite/crmController');
const owner = require('../controllers/suite/ownerController');
const testing = require('../controllers/suite/testingController');
const ai = require('../controllers/suite/aiController');
const fieldPortal = require('../controllers/suite/fieldPortalController');

router.use(authenticateToken);

// ------------------------------------------------------------------ me
router.get('/me', gov.me);
router.post('/me/password', gov.changePassword);
router.get('/me/sessions', gov.mySessions);
router.post('/me/sessions/:id/revoke', gov.revokeMySession);

// ------------------------------------------------------------------ private files (documents, evidence)
const FILE_AREA_CAPS = { 'project-docs': 'inventory.view', 'customer-docs': 'crm.view', 'test-evidence': 'testing.use' };
router.get('/files/:area/:name', (req, res) => {
  const cap = FILE_AREA_CAPS[req.params.area];
  if (!cap || !can(req.user, cap)) return res.status(403).json({ status: 'error', message: 'Your role does not allow this file.' });
  const file = storedPath(req.params.area, req.params.name);
  if (!file) return res.status(404).json({ status: 'error', message: 'File not found.' });
  res.set('Cache-Control', 'private, max-age=300');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(file);
});

// ------------------------------------------------------------------ approvals, escalations, audit, timelines
router.get('/approvals', needAny('approvals.view', 'bookings.initiate', 'finance.refund.request', 'leads.create'), gov.listApprovals);
router.post('/approvals/:id/decide', needAny('approvals.view', 'bookings.approve', 'finance.refund.decide', 'visits.approve'), gov.decideApproval);
router.get('/escalations', gov.listEscalations);
router.post('/escalations', need('ai.use'), gov.raiseEscalation);
router.patch('/escalations/:id', gov.updateEscalation);
router.get('/audit', gov.listAudit);
router.get('/audit/verify', need('audit.view.all'), gov.verifyAudit);
router.get('/timeline/:type/:id', gov.recordTimeline);

// ------------------------------------------------------------------ settings & people
router.get('/settings/workflow', need('settings.manage'), gov.getWorkflow);
router.put('/settings/workflow', need('settings.manage'), gov.setWorkflow);
router.get('/users', need('users.manage'), gov.listUsers);
router.post('/users', need('users.manage'), gov.createUser);
router.patch('/users/:id', need('users.manage'), gov.updateUser);
router.post('/users/:id/role', need('users.manage'), gov.changeRole);
router.post('/users/:id/status', need('users.manage'), gov.setStatus);
router.post('/users/:id/reset-password', need('users.manage'), gov.resetPassword);
router.get('/users/:id/sessions', need('users.manage'), gov.userSessions);
router.post('/users/:id/sessions/revoke', need('users.manage'), gov.revokeUserSessions);
router.get('/partner-firms', needAny('users.manage', 'inventory.allocate'), gov.partnerFirms);

// ------------------------------------------------------------------ sales head & sales manager
router.get('/sales/dashboard', need('reports.sales'), sales.dashboard);
router.get('/sales/leads', need('leads.view.all'), sales.listLeads);
router.post('/sales/leads/assign', need('leads.assign'), sales.assignLeads);
router.post('/sales/leads/import', need('leads.import'), sales.importLeads);
router.get('/sales/leads/:id', needAny('leads.view.all', 'leads.view.own'), sales.getLead);
router.post('/sales/leads/:id/book', needAny('leads.view.all', 'leads.view.own', 'bookings.initiate'), sales.bookLead);
router.post('/sales/leads/:id/visits', needAny('visits.allocate', 'visits.schedule'), sales.scheduleVisit);
router.get('/sales/team', need('team.view'), sales.team);
router.get('/sales/members', need('team.view'), sales.members);
router.patch('/sales/team/:id/availability', need('team.view'), sales.setAvailability);
router.get('/sales/performance', need('reports.sales'), sales.performance);
router.get('/sales/targets', need('targets.set'), sales.getTargets);
router.put('/sales/targets', need('targets.set'), sales.setTargets);
router.get('/sales/projects', need('reports.sales'), sales.projectSales);
router.get('/sales/conversion', need('reports.sales'), sales.conversion);
router.get('/sales/visits', need('visits.allocate'), sales.listVisits);
router.post('/sales/visits/:id/action', need('visits.allocate'), sales.visitAction);
router.get('/sales/visits/:id/history', need('visits.allocate'), sales.visitHistory);
router.get('/sales/bookings', need('bookings.view.all'), sales.listBookings);
router.post('/sales/bookings/:id/action', need('bookings.approve'), sales.bookingAction);
router.get('/sales/activity', need('team.view'), sales.activity);
router.get('/sales/calls', need('calls.monitor'), sales.calls);
router.get('/sales/followups', need('team.view'), sales.followups);

// ------------------------------------------------------------------ inside sales (telecaller)
router.get('/inside/queue', needAny('inside.queue', 'reports.sales'), fieldPortal.getInsideQueue);
router.post('/inside/disposition', needAny('inside.queue', 'reports.sales'), fieldPortal.insideDisposition);
router.post('/inside/schedule-visit', needAny('visits.schedule', 'visits.allocate'), fieldPortal.insideScheduleVisit);
router.get('/inside/inventory-match', needAny('inventory.directory', 'inside.queue'), fieldPortal.insideInventoryMatch);

// ------------------------------------------------------------------ outside sales (field / site agent)
router.get('/outside/visits', needAny('outside.visits', 'reports.sales'), fieldPortal.getOutsideVisits);
router.post('/outside/visits/:id/checkin', needAny('visits.checkin', 'visits.allocate'), fieldPortal.outsideCheckIn);
router.get('/outside/project-matrix', needAny('inventory.directory', 'outside.visits'), fieldPortal.getProjectMatrix);
router.post('/outside/spot-book', needAny('bookings.initiate', 'outside.visits'), fieldPortal.outsideSpotBook);

// ------------------------------------------------------------------ channel partner (broker desk)
router.get('/partner/dashboard', needAny('partner.desk', 'reports.sales'), fieldPortal.getPartnerDashboard);
router.post('/partner/register-client', needAny('partner.register', 'leads.create'), fieldPortal.partnerRegisterClient);
router.get('/partner/commissions', needAny('partner.desk', 'reports.sales'), fieldPortal.getPartnerCommissions);
router.get('/partner/collaterals', needAny('partner.desk', 'reports.sales'), fieldPortal.getPartnerCollaterals);

// ------------------------------------------------------------------ finance
router.get('/finance/overview', need('finance.view'), fin.overview);
router.get('/finance/modes', need('finance.view'), fin.modes);
router.get('/finance/deals', needAny('finance.view', 'finance.refund.request'), fin.deals);
router.get('/finance/deals/:id', needAny('finance.view', 'finance.refund.request'), fin.dealDetail);
router.get('/finance/milestones/:dealId', need('finance.view'), fin.milestones);
router.get('/finance/payments', need('finance.view'), fin.payments);
router.post('/finance/payments', need('finance.record'), fin.recordPayment);
router.post('/finance/payments/:id/verify', need('finance.verify'), fin.verifyPayment);
router.post('/finance/payments/:id/reject', need('finance.verify'), fin.rejectPayment);
router.get('/finance/payments/:id/receipt', needAny('finance.view', 'crm.view'), fin.receipt);
router.get('/finance/invoices', need('finance.view'), fin.invoices);
router.post('/finance/invoices', need('finance.invoice'), fin.createInvoice);
router.post('/finance/invoices/:id/cancel', need('finance.invoice'), fin.cancelInvoice);
router.get('/finance/outstanding', need('finance.view'), fin.outstanding);
router.get('/finance/overdue', need('finance.view'), fin.overdueMilestones);
router.get('/finance/refunds', needAny('finance.view', 'finance.refund.request'), fin.refunds);
router.post('/finance/refunds', need('finance.refund.request'), fin.requestRefund);
router.post('/finance/refunds/:id/process', need('finance.refund.process'), fin.processRefund);
router.get('/finance/bank', need('finance.reconcile'), fin.bankLines);
router.post('/finance/bank/import', need('finance.reconcile'), fin.importBank);
router.post('/finance/bank/:id/match', need('finance.reconcile'), fin.matchBank);
router.post('/finance/bank/:id/ignore', need('finance.reconcile'), fin.ignoreBank);
router.get('/finance/commissions', need('finance.view'), fin.commissions);
router.post('/finance/commissions/:id/pay', need('finance.commission.pay'), fin.payCommission);
router.get('/finance/reports', need('finance.view'), fin.reports);

// ------------------------------------------------------------------ projects & inventory
router.get('/inventory/options', need('inventory.directory'), inv.options);
router.get('/inventory/summary', need('inventory.view'), inv.summary);
router.get('/inventory/projects', need('inventory.view'), inv.listProjects);
router.post('/inventory/projects', need('inventory.manage'), inv.createProject);
router.get('/inventory/projects/:id', need('inventory.view'), inv.getProject);
router.patch('/inventory/projects/:id', need('inventory.manage'), inv.updateProject);
router.post('/inventory/projects/:id/towers', need('inventory.manage'), inv.createTower);
router.patch('/inventory/towers/:id', need('inventory.manage'), inv.updateTower);
router.post('/inventory/projects/:id/documents', need('inventory.documents'), uploadTo('project-docs'), inv.uploadDocument);
router.delete('/inventory/projects/:id/documents/:docId', need('inventory.documents'), inv.deleteDocument);
router.get('/inventory/units', need('inventory.view'), inv.listUnits);
router.post('/inventory/units', need('inventory.manage'), inv.createUnit);
router.post('/inventory/units/bulk', need('inventory.manage', 'inventory.pricing'), inv.bulkCreateUnits);
router.patch('/inventory/units/:id', need('inventory.manage'), inv.updateUnit);
router.post('/inventory/units/:id/price', need('inventory.pricing'), inv.setPrice);
router.post('/inventory/units/:id/status', need('inventory.manage'), inv.setStatus);
router.post('/inventory/units/:id/allocate', need('inventory.allocate'), inv.allocate);
router.get('/inventory/ageing', need('inventory.view'), inv.ageing);
router.get('/inventory/directory', need('inventory.directory'), inv.directory);
router.get('/inventory/recommend/:leadId', need('inventory.directory'), inv.recommend);

// ------------------------------------------------------------------ marketing
router.get('/marketing/options', need('marketing.view'), mkt.options);
router.get('/marketing/channels', need('marketing.view'), mkt.listChannels);
router.post('/marketing/channels', need('marketing.manage'), mkt.createChannel);
router.patch('/marketing/channels/:id', need('marketing.manage'), mkt.updateChannel);
router.get('/marketing/campaigns', need('marketing.view'), mkt.listCampaigns);
router.post('/marketing/campaigns', need('marketing.manage'), mkt.createCampaign);
router.get('/marketing/campaigns/:id', need('marketing.view'), mkt.getCampaign);
router.patch('/marketing/campaigns/:id', need('marketing.manage'), mkt.updateCampaign);
router.post('/marketing/campaigns/:id/spend', need('marketing.manage'), mkt.addSpend);
router.get('/marketing/analytics', need('marketing.view'), mkt.analytics);
router.get('/marketing/attribution', need('marketing.view'), mkt.attribution);

// ------------------------------------------------------------------ customer relationship
router.get('/crm/options', needAny('crm.view', 'crm.ticket.create'), crm.options);
router.get('/crm/summary', need('crm.view'), crm.summary);
router.get('/crm/team', need('crm.view'), crm.team);
router.get('/crm/customers', needAny('crm.view', 'crm.ticket.create'), crm.listCustomers);
router.get('/crm/customers/:id', need('crm.view'), crm.getCustomer);
router.patch('/crm/customers/:id', need('crm.manage'), crm.updateCustomer);
router.post('/crm/customers/:id/communications', need('crm.manage'), crm.addCommunication);
router.patch('/crm/documents/:id', need('crm.manage'), crm.updateDocument);
router.post('/crm/documents/:id/file', need('crm.manage'), uploadTo('customer-docs'), crm.uploadDocumentFile);
router.get('/crm/tickets', needAny('crm.view', 'crm.ticket.create'), crm.listTickets);
router.post('/crm/tickets', need('crm.ticket.create'), crm.createTicket);
router.patch('/crm/tickets/:id', needAny('crm.manage', 'crm.ticket.create'), crm.updateTicket);
router.post('/crm/tickets/:id/feedback', need('crm.manage'), crm.ticketFeedback);
router.get('/crm/possession', need('crm.view'), crm.listPossession);
router.post('/crm/possession', need('crm.manage'), crm.addPossession);

// ------------------------------------------------------------------ business owner
router.get('/owner/dashboard', need('owner.dashboard'), owner.dashboard);
router.get('/owner/drilldown/:metric', need('owner.dashboard'), owner.drilldown);
router.get('/owner/employees', need('owner.dashboard'), owner.employees);

// ------------------------------------------------------------------ AI (answers from live data; changes only on confirmation)
router.get('/ai/status', need('ai.use'), ai.status);
router.post('/ai/chat', need('ai.use'), ai.chat);
router.post('/ai/actions/:id/confirm', need('ai.use'), ai.confirmAction);
router.post('/ai/actions/:id/cancel', need('ai.use'), ai.cancelAction);
router.post('/ai/extract-brochure', need('inventory.manage'), ai.extractBrochure);
router.post('/ai/parse-leads', need('leads.import'), ai.parseLeads);
router.post('/ai/leads/:id/assist', needAny('calls.make', 'leads.view.all'), ai.leadAssist);
router.post('/ai/distribution/suggest', need('leads.assign'), ai.suggestDistribution);
router.post('/ai/distribution/apply', need('leads.assign'), ai.applyDistribution);

// ------------------------------------------------------------------ manual testing center (testing environment only)
const tc = [need('testing.use'), testing.requireTestingEnv];
router.get('/testing/summary', ...tc, testing.summary);
router.get('/testing/cases', ...tc, testing.listCases);
router.get('/testing/cases/:id', ...tc, testing.getCase);
router.patch('/testing/cases/:id', ...tc, testing.recordResult);
router.post('/testing/cases/:id/evidence', ...tc, uploadTo('test-evidence', { types: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] }), testing.addEvidence);
router.delete('/testing/evidence/:evidenceId', ...tc, testing.deleteEvidence);
router.get('/testing/bugs', ...tc, testing.listBugs);
router.post('/testing/bugs', ...tc, testing.createBug);
router.get('/testing/bugs/:bugId', ...tc, testing.getBug);
router.patch('/testing/bugs/:bugId', ...tc, testing.updateBug);
router.post('/testing/bugs/:bugId/evidence', ...tc, uploadTo('test-evidence', { types: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] }), testing.addEvidence);
router.get('/testing/accounts', ...tc, testing.accounts);
router.get('/testing/leads', ...tc, testing.testLeads);
router.get('/testing/notifications', ...tc, testing.notifications);
router.get('/testing/activity', ...tc, testing.activity);
router.get('/testing/export.csv', ...tc, testing.exportResults);

module.exports = router;
