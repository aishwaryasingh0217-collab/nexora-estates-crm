const express = require('express');
const router = express.Router();
const { getProjects, getProjectById, createProject, updateProject, archiveProject } = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { uploadBrochure } = require('../middleware/uploadMiddleware');

// Public View endpoints for website and CRM
router.get('/', getProjects);
router.get('/:id', getProjectById);

// Protected mutation endpoints (SUPER_ADMIN only)
router.use(authenticateToken);
router.post('/', authorizeRoles('SUPER_ADMIN'), uploadBrochure, createProject);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), uploadBrochure, updateProject);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), archiveProject);

module.exports = router;
