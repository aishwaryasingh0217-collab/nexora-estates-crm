const express = require('express');
const router = express.Router();
const { getRentalNews } = require('../controllers/rentalNewsController');

// GET /api/rental-news (fetches live, daily-updating Indian rental real estate news & advice)
router.get('/', getRentalNews);

module.exports = router;
