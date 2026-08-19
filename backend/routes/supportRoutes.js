const express = require('express');
const router = express.Router();
const {
  createPublicTicket,
  getTickets,
  getTicketById,
  updateTicket
} = require('../controllers/supportController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public Support Request Submission (No CRM Login Required)
router.post('/tickets', createPublicTicket);

// Protected Support Queue Management for CRM Staff
router.get('/tickets', authenticateToken, getTickets);
router.get('/tickets/:id', authenticateToken, getTicketById);
router.patch('/tickets/:id', authenticateToken, updateTicket);

module.exports = router;
