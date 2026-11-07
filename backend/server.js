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
const workspaceRoutes = require('./routes/workspaceRoutes');
const { fieldRoleGate } = require('./middleware/accessGate');

const app = express();
const PORT = process.env.PORT || 5001;

// Behind cPanel/Nginx the client IP arrives in X-Forwarded-For (used by the enquiry spam guard)
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Core Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' })); // lead imports send up to 5,000 rows
app.use(express.urlencoded({ extended: true }));

// Create centralized API Router
const apiRouter = express.Router();

// Health Check Endpoint
apiRouter.get('/health', async (req, res, next) => {
  try {
    const [result] = await pool.query('SELECT 1 + 1 AS db_check, NOW() AS server_time');
    const production = process.env.NODE_ENV === 'production';
    const { demoHealth } = require('./services/bootTasks');
    const demo = await demoHealth();

    res.status(200).json({
      status: 'healthy',
      server: 'Node.js Express Server',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        type: 'MySQL 9.6',
        // The database name includes the hosting account id, so it's only shown outside production
        ...(production ? {} : { database_name: process.env.DB_NAME || 'realestate_crm' }),
        db_check: result[0].db_check === 2,
        db_timestamp: result[0].server_time
      },
      ...(demo ? { demo } : {})
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      server: 'Node.js Express Server',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        ...(process.env.NODE_ENV === 'production' ? {} : { error: error.message })
      }
    });
  }
});

// Company branding for the website, app and install prompt (public)
const { getSettings } = require('./services/settingsService');
apiRouter.get('/settings/public', async (req, res, next) => {
  try { res.json({ status: 'success', data: await getSettings() }); } catch (err) { next(err); }
});

// Signed calendar links (.ics) for iPhone/Google/Outlook — calendar apps can't send a login token
const { visitIcs, userFeed } = require('./controllers/icsController');
apiRouter.get('/ics/visit/:id', visitIcs);
apiRouter.get('/ics/feed/:userId', userFeed);

// Agents and channel partners may only reach their own workspace APIs (plus public reads).
apiRouter.use(fieldRoleGate);

// API Routes Mounting on apiRouter
apiRouter.use('/workspace', workspaceRoutes);
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

// Integrity check for app.js: logs loudly if the bundle is truncated or has a syntax error.
// It intentionally does NOT touch git — an automatic `git checkout` here used to silently
// discard uncommitted work (and could not help when the committed copy itself was broken).
app.get(['/app.js', '/nexora-crm/app.js'], (req, res, next) => {
  const appJsPath = path.join(publicDir, 'app.js');
  try {
    if (fs.existsSync(appJsPath)) {
      const content = fs.readFileSync(appJsPath, 'utf8');
      if (content.includes('[truncated for diff preview]')) {
        console.error('[Integrity Check] public/app.js contains a truncation marker — the file is incomplete.');
      } else {
        try {
          new (require('vm').Script)(content);
        } catch (syntaxErr) {
          console.error('[Integrity Check] Syntax error in public/app.js:', syntaxErr.message);
        }
      }
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(content);
    }
  } catch (err) {
    console.error('[Integrity Check] Error handling app.js:', err);
  }
  next();
});

// Installable-app manifest carries the owner's brand (falls back to the static file's values)
app.get(['/manifest.webmanifest', '/nexora-crm/manifest.webmanifest'], async (req, res, next) => {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'));
    const { company_name: name, short_name: short } = await getSettings();
    if (name) {
      manifest.name = `${name} — Sales & Partner App`;
      manifest.short_name = short || name.split(/\s+/)[0];
    }
    res.type('application/manifest+json').send(JSON.stringify(manifest));
  } catch (err) {
    next();
  }
});

const setStaticCacheHeaders = (res, filePath) => {
  if (filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  } else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|webp|svg|mp4|webm|woff|woff2|ttf|eot)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  } else if (filePath.match(/\.(js|css)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
};

const staticOptions = {
  maxAge: '1h',
  etag: true,
  setHeaders: setStaticCacheHeaders
};

app.use(express.static(publicDir, staticOptions));
app.use('/nexora-crm', express.static(publicDir, staticOptions));
app.use(express.static(distDir, staticOptions));
app.use('/nexora-crm', express.static(distDir, staticOptions));

// Fallback to SPA index.html for non-API requests
app.use((req, res, next) => {
  if (req.path.includes('/api/')) {
    return next();
  }
  const publicIndex = path.join(__dirname, '../public/index.html');
  const distIndex = path.join(__dirname, '../dist/index.html');
  if (require('fs').existsSync(publicIndex)) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(publicIndex);
  } else if (require('fs').existsSync(distIndex)) {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
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
  require('./services/bootTasks').startBootTasks();
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

