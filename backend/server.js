const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const buildingRoutes = require('./routes/buildingRoutes');
const unitRoutes = require('./routes/unitRoutes');
const leadRoutes = require('./routes/leadRoutes');
const customerRoutes = require('./routes/customerRoutes');
const siteVisitRoutes = require('./routes/siteVisitRoutes');
const dealRoutes = require('./routes/dealRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const aiRoutes = require('./routes/aiRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const supportRoutes = require('./routes/supportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets if built
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../dist')));

// Health Check Endpoint
app.get('/api/health', async (req, res, next) => {
  try {
    const [result] = await pool.query('SELECT 1 + 1 AS db_check, NOW() AS server_time');
    
    res.status(200).json({
      status: 'healthy',
      server: 'Node.js Express Server',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        type: 'MySQL 9.6',
        database_name: process.env.DB_NAME || 'realestate_crm',
        db_check: result[0].db_check === 2,
        db_timestamp: result[0].server_time
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      server: 'Node.js Express Server',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: error.message
      }
    });
  }
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/site-visits', siteVisitRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes);

// Fallback to SPA index.html for non-API requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const publicIndex = path.join(__dirname, '../public/index.html');
  const distIndex = path.join(__dirname, '../dist/index.html');
  if (require('fs').existsSync(publicIndex)) {
    res.sendFile(publicIndex);
  } else if (require('fs').existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.status(404).json({ status: 'error', message: 'Endpoint not found' });
  }
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const server = app.listen(PORT, () => {
  console.log(`[Server] Real Estate CRM Backend listening on port ${PORT}`);
  if (process.argv.includes('--open')) {
    const url = `http://localhost:${PORT}/`;
    const openCmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
    const { exec } = require('child_process');
    exec(openCmd, (err) => {
      if (err) {
        console.error(`[Server] Could not automatically open browser: ${err.message}`);
      }
    });
  }
});

module.exports = app;

