const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, updateUserAccess } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { protectDemoAccounts } = require('../services/demoMode');

// All routes require authenticated session
router.use(authenticateToken);

// View endpoints (Accessible by both SUPER_ADMIN and ADMIN)
router.get('/', getUsers);
router.get('/:id', getUserById);

// Mutation endpoints (SUPER_ADMIN only)
router.post('/', authorizeRoles('SUPER_ADMIN'), createUser);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), protectDemoAccounts, updateUser);
router.patch('/:id/access', authorizeRoles('SUPER_ADMIN'), protectDemoAccounts, updateUserAccess);

module.exports = router;
