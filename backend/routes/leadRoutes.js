const express = require('express');
const router = express.Router();
const { getLeads, getLeadById, createLead, updateLead, bookLead, convertLeadToCustomer } = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(authenticateToken);

router.get('/', getLeads);
router.get('/:id', getLeadById);

router.post('/', authorizeRoles('SUPER_ADMIN'), createLead);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), updateLead);
router.post('/:id/book', authorizeRoles('SUPER_ADMIN'), bookLead);
router.post('/:id/convert', authorizeRoles('SUPER_ADMIN'), convertLeadToCustomer);

module.exports = router;
