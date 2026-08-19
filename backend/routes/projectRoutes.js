const express = require('express');
const router = express.Router();
const { getProjects, getProjectById, createProject, updateProject, archiveProject } = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { uploadBrochure } = require('../middleware/uploadMiddleware');

router.use(authenticateToken);

// View endpoints (SUPER_ADMIN and ADMIN)
router.get('/', getProjects);
router.get('/:id', getProjectById);

// Mutation endpoints (SUPER_ADMIN only) with file upload support
router.post('/', authorizeRoles('SUPER_ADMIN'), uploadBrochure, createProject);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), uploadBrochure, updateProject);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), archiveProject);

module.exports = router;
