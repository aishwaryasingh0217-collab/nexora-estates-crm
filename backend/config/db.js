const mysql = require('mysql2/promise');
const path = require('path');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Follow-ups, "today" lists and working hours are business-local times. Pin Node to the business
// timezone (hosting servers usually run UTC) and keep MySQL's NOW()/CURDATE() on the same clock.
process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const utcOffset = () => {
  const mins = -new Date().getTimezoneOffset();
  const abs = Math.abs(mins);
  return `${mins >= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'realestate_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'realestate_crm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.on('connection', (connection) => {
  connection.query(`SET time_zone = '${utcOffset()}'`);
});

module.exports = pool;
