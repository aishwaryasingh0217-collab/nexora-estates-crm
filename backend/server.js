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
const channelPartnerRoutes = require('./routes/channelPartnerRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const rentalNewsRoutes = require('./routes/rentalNewsRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create centralized API Router
const apiRouter = express.Router();

// Health Check Endpoint
apiRouter.get('/health', async (req, res, next) => {
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

// API Routes Mounting on apiRouter
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/buildings', buildingRoutes);
apiRouter.use('/units', unitRoutes);
apiRouter.use('/leads', leadRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/site-visits', siteVisitRoutes);
apiRouter.use('/deals', dealRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/calendar', calendarRoutes);
apiRouter.use('/whatsapp', whatsappRoutes);
apiRouter.use('/support', supportRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/channel-partners', channelPartnerRoutes);
apiRouter.use('/marketplace', marketplaceRoutes);
apiRouter.use('/rental-news', rentalNewsRoutes);

// Mount API Router for standard /api, cPanel subpath /nexora-crm/api, and custom APP_BASE_PATH
app.use('/api', apiRouter);
app.use('/nexora-crm/api', apiRouter);
if (process.env.APP_BASE_PATH) {
  const customBase = process.env.APP_BASE_PATH.replace(/\/+$/, '');
  if (customBase && customBase !== '/nexora-crm') {
    app.use(`${customBase}/api`, apiRouter);
  }
}

// Serve static frontend assets for both root and /nexora-crm subpath
const publicDir = path.join(__dirname, '../public');
const distDir = path.join(__dirname, '../dist');
const fs = require('fs');
const { execSync } = require('child_process');

// Self-Healing Anti-Truncation & Syntax Integrity Guard for app.js
app.get(['/app.js', '/nexora-crm/app.js'], (req, res, next) => {
  const appJsPath = path.join(publicDir, 'app.js');
  try {
    if (fs.existsSync(appJsPath)) {
      let content = fs.readFileSync(appJsPath, 'utf8');
      const isTruncated = content.includes('[truncated for diff preview]') || content.includes('... [truncated');
      
      let hasSyntaxError = false;
      if (!isTruncated) {
        try {
          const vm = require('vm');
          new vm.Script(content);
        } catch (syntaxErr) {
          hasSyntaxError = true;
          console.error('[Integrity Guard] Syntax error detected in app.js:', syntaxErr.message);
        }
      }

      if (isTruncated || hasSyntaxError) {
        console.warn('[Integrity Guard] Auto-healing public/app.js from git HEAD...');
        try {
          execSync('git checkout HEAD -- public/app.js', { cwd: path.join(__dirname, '..') });
          content = fs.readFileSync(appJsPath, 'utf8');
          console.log('[Integrity Guard] Successfully auto-restored public/app.js to pristine state.');
        } catch (gitErr) {
          console.error('[Integrity Guard] Git recovery error:', gitErr.message);
        }
      }

      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(content);
    }
  } catch (err) {
    console.error('[Integrity Guard] Error handling app.js:', err);
  }
  next();
});

app.use(express.static(publicDir));
app.use('/nexora-crm', express.static(publicDir));
app.use(express.static(distDir));
app.use('/nexora-crm', express.static(distDir));

// Fallback to SPA index.html for non-API requests
app.use((req, res, next) => {
  if (req.path.includes('/api/')) {
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

