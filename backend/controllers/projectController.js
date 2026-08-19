const crypto = require('crypto');
const pool = require('../config/db');

/**
 * GET /api/projects
 * List all projects with summary unit counts and status metrics
 */
const getProjects = async (req, res, next) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.id, p.name, p.code, p.project_type, p.builder_developer, p.location, p.city, p.status, p.total_units, p.brochure_url, p.possession_date, p.rera_number, p.created_at, p.updated_at,
              u.first_name AS creator_first_name, u.last_name AS creator_last_name,
              COUNT(un.id) AS actual_unit_count,
              SUM(CASE WHEN un.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units_count,
              SUM(CASE WHEN un.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units_count,
              SUM(CASE WHEN un.status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN units un ON p.id = un.project_id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );

    res.status(200).json({
      status: 'success',
      results: projects.length,
      data: projects
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:id
 * Get single project with buildings, units, and document links
 */
const getProjectById = async (req, res, next) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name,
              COUNT(un.id) AS actual_unit_count,
              SUM(CASE WHEN un.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units_count,
              SUM(CASE WHEN un.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units_count,
              SUM(CASE WHEN un.status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN units un ON p.id = un.project_id
       WHERE p.id = ?
       GROUP BY p.id`,
      [req.params.id]
    );

    if (projects.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found.'
      });
    }

    const [buildings] = await pool.query(
      `SELECT b.*,
              COUNT(un.id) AS total_units_in_building,
              SUM(CASE WHEN un.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units_in_building
       FROM buildings b
       LEFT JOIN units un ON b.id = un.building_id
       WHERE b.project_id = ?
       GROUP BY b.id`,
      [req.params.id]
    );

    const [units] = await pool.query(
      `SELECT un.id, un.unit_number, un.unit_type, un.floor_number, un.carpet_area_sqft, un.super_area_sqft, un.base_price, un.status, un.facing, b.name AS building_name
       FROM units un
       LEFT JOIN buildings b ON un.building_id = b.id
       WHERE un.project_id = ?
       ORDER BY un.unit_number ASC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...projects[0],
        buildings,
        units
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/projects
 * Create a new project
 */
const createProject = async (req, res, next) => {
  try {
    const { name, code, project_type, builder_name, location, city, status, total_units, possession_date, rera_number } = req.body;

    if (!name || !project_type || !location || !city) {
      return res.status(400).json({
        status: 'error',
        message: 'Name, project_type, location, and city are required.'
      });
    }

    // Auto-generate project code if not provided
    const projectCode = code ? code.trim().toUpperCase() : `PRJ-${Date.now().toString().slice(-5)}`;

    const [existing] = await pool.query('SELECT id FROM projects WHERE code = ?', [projectCode]);
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: `Project with code '${projectCode}' already exists.`
      });
    }

    const validTypes = ['RESIDENTIAL', 'COMMERCIAL', 'INDEPENDENT', 'VILLA', 'PLOTTED', 'MIXED'];
    const pType = validTypes.includes((project_type || '').toUpperCase()) ? project_type.toUpperCase() : 'RESIDENTIAL';

    // Handle uploaded brochure file
    let brochurePath = null;
    if (req.file) {
      brochurePath = `/uploads/brochures/${req.file.filename}`;
    }

    const projectId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO projects (id, name, code, project_type, builder_developer, location, city, status, total_units, brochure_url, possession_date, rera_number, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        name.trim(),
        projectCode,
        pType,
        builder_name ? builder_name.trim() : null,
        location.trim(),
        city.trim(),
        status || 'UNDER_CONSTRUCTION',
        total_units || 0,
        brochurePath,
        possession_date ? possession_date.trim() : null,
        rera_number ? rera_number.trim() : null,
        req.user.id
      ]
    );

    res.status(201).json({
      status: 'success',
      message: 'Project created successfully.',
      data: {
        id: projectId,
        name,
        code: projectCode,
        project_type: pType,
        builder_developer: builder_name,
        location,
        city,
        status: status || 'UNDER_CONSTRUCTION',
        brochure_url: brochurePath
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/projects/:id
 * Update project details
 */
const updateProject = async (req, res, next) => {
  try {
    const { name, project_type, builder_name, location, city, status, total_units, possession_date, rera_number } = req.body;

    // Handle uploaded brochure file
    let brochurePath = undefined;
    if (req.file) {
      brochurePath = `/uploads/brochures/${req.file.filename}`;
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (project_type) { updates.push('project_type = ?'); values.push(project_type); }
    if (builder_name !== undefined) { updates.push('builder_developer = ?'); values.push(builder_name); }
    if (location) { updates.push('location = ?'); values.push(location); }
    if (city) { updates.push('city = ?'); values.push(city); }
    if (status) { updates.push('status = ?'); values.push(status); }
    if (total_units !== undefined) { updates.push('total_units = ?'); values.push(total_units); }
    if (brochurePath !== undefined) { updates.push('brochure_url = ?'); values.push(brochurePath); }
    if (possession_date !== undefined) { updates.push('possession_date = ?'); values.push(possession_date); }
    if (rera_number !== undefined) { updates.push('rera_number = ?'); values.push(rera_number); }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields provided to update.'
      });
    }

    values.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Project details updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/projects/:id
 * Soft archive project
 */
const archiveProject = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `UPDATE projects SET status = 'ARCHIVED' WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Project archived successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject
};
