const crypto = require('crypto');
const pool = require('../config/db');

const getBuildings = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    let query = `
      SELECT b.*, p.name AS project_name,
             COUNT(u.id) AS total_units,
             SUM(CASE WHEN u.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_units,
             SUM(CASE WHEN u.status = 'BOOKED' THEN 1 ELSE 0 END) AS booked_units,
             SUM(CASE WHEN u.status = 'SOLD' THEN 1 ELSE 0 END) AS sold_units
      FROM buildings b
      JOIN projects p ON b.project_id = p.id
      LEFT JOIN units u ON b.id = u.building_id
    `;
    const params = [];

    if (project_id) {
      query += ` WHERE b.project_id = ?`;
      params.push(project_id);
    }

    query += ` GROUP BY b.id ORDER BY b.created_at DESC`;

    const [buildings] = await pool.query(query, params);

    res.status(200).json({
      status: 'success',
      results: buildings.length,
      data: buildings
    });
  } catch (error) {
    next(error);
  }
};

const getBuildingById = async (req, res, next) => {
  try {
    const [buildings] = await pool.query(
      `SELECT b.*, p.name AS project_name
       FROM buildings b
       JOIN projects p ON b.project_id = p.id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (buildings.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Building / Tower not found.'
      });
    }

    const [units] = await pool.query(
      `SELECT * FROM units WHERE building_id = ? ORDER BY floor_number ASC, unit_number ASC`,
      [req.params.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...buildings[0],
        units
      }
    });
  } catch (error) {
    next(error);
  }
};

const createBuilding = async (req, res, next) => {
  try {
    const { project_id, name, total_floors, units_per_floor } = req.body;

    if (!project_id || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'project_id and building name are required.'
      });
    }

    const buildingId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO buildings (id, project_id, name, total_floors, units_per_floor, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [buildingId, project_id, name.trim(), total_floors || 1, units_per_floor || 1]
    );

    res.status(201).json({
      status: 'success',
      message: 'Building tower created successfully.',
      data: {
        id: buildingId,
        project_id,
        name: name.trim(),
        total_floors: total_floors || 1,
        units_per_floor: units_per_floor || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateBuilding = async (req, res, next) => {
  try {
    const { name, total_floors, units_per_floor, status } = req.body;

    const [result] = await pool.query(
      `UPDATE buildings
       SET name = COALESCE(?, name),
           total_floors = COALESCE(?, total_floors),
           units_per_floor = COALESCE(?, units_per_floor),
           status = COALESCE(?, status)
       WHERE id = ?`,
      [name, total_floors, units_per_floor, status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Building not found.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Building updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBuildings,
  getBuildingById,
  createBuilding,
  updateBuilding
};
