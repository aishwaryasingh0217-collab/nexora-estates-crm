/**
 * Real Estate CRM - Node.js Database Migration Runner
 * Target Engine: MySQL 9.6 / 8.0+
 * Usage: node database/migrate.js
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Configuration from environment variables
if (!process.env.DB_PASSWORD) {
  console.error('[Migration Error] DB_PASSWORD environment variable is required.');
  process.exit(1);
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'realestate_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'realestate_crm',
  multipleStatements: true
};

async function runMigrations() {
  console.log(`[Migration] Connecting to MySQL at ${dbConfig.host}:${dbConfig.port} as user '${dbConfig.user}'...`);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log(`[Migration] Successfully connected to database '${dbConfig.database}'.`);

    // Hosts can start several copies of the app at once (AUTO_MIGRATE): run one migration pass at a time.
    // The lock belongs to this connection, so it is released when the run ends or crashes.
    const [[{ got }]] = await connection.query('SELECT GET_LOCK(?, 120) AS got', [`nexora_migrate:${dbConfig.database}`.slice(0, 64)]);
    if (Number(got) !== 1) throw new Error('Another migration run is still going after 2 minutes.');

    // Ensure migration tracker table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    // .sql files run as-is; .js files export `up(connection)` for steps that need checks first
    // (MySQL has no ADD COLUMN IF NOT EXISTS, and some guards depend on the data already there)
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') || file.endsWith('.js'))
      .sort();

    const [rows] = await connection.query('SELECT migration_name FROM schema_migrations');
    const executedMigrations = new Set(rows.map(row => row.migration_name));

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`[Migration] Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`[Migration] Executing ${file}...`);
      const filePath = path.join(migrationsDir, file);
      if (file.endsWith('.js')) {
        await require(filePath).up(connection);
      } else {
        const sql = fs.readFileSync(filePath, 'utf8');
        if (sql.trim().length > 0) {
          await connection.query(sql);
        }
      }

      await connection.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      console.log(`[Migration] Completed ${file}`);
    }

    console.log('[Migration] All database migrations applied successfully!');
  } catch (error) {
    console.error('[Migration Error] Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
