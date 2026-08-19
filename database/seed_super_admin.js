/**
 * Admin Accounts Seed Script
 * Target: realestate_crm.users table
 * 
 * 1. SUPER_ADMIN (Full CRUD + User Management):
 *    Username: admin
 *    Email: admin@realestatecrm.com
 *    Password: AdminPassword123!
 * 
 * 2. ADMIN (View / Read-Only / Analytics):
 *    Username: admin_user
 *    Email: admin_user@realestatecrm.com
 *    Password: AdminPassword123!
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../backend/config/db');

async function seedAdminAccounts() {
  console.log('[Seed] Seeding Admin and Super Admin accounts...');

  try {
    const rawPassword = 'AdminPassword123!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 1. Super Admin (Full CRUD permissions)
    const superAdminId = 'a1b2c3d4-0000-4000-8000-000000000001';
    const superUsername = 'admin';
    const superEmail = 'admin@realestatecrm.com';
    const superRoleId = 1; // SUPER_ADMIN

    await pool.query(
      `INSERT INTO users (id, role_id, username, email, password_hash, first_name, last_name, phone, status)
       VALUES (?, ?, ?, ?, ?, 'Super', 'Admin', '+1234567890', 'ACTIVE')
       ON DUPLICATE KEY UPDATE 
         password_hash = VALUES(password_hash),
         role_id = VALUES(role_id),
         status = 'ACTIVE'`,
      [superAdminId, superRoleId, superUsername, superEmail, passwordHash]
    );

    // 2. Standard Admin (View/Analytics only, No CRUD)
    const adminId = 'a2b2c3d4-0000-4000-8000-000000000002';
    const adminUsername = 'admin_user';
    const adminEmail = 'admin_user@realestatecrm.com';
    const adminRoleId = 2; // ADMIN

    await pool.query(
      `INSERT INTO users (id, role_id, username, email, password_hash, first_name, last_name, phone, status)
       VALUES (?, ?, ?, ?, ?, 'Standard', 'Admin', '+1234567891', 'ACTIVE')
       ON DUPLICATE KEY UPDATE 
         password_hash = VALUES(password_hash),
         role_id = VALUES(role_id),
         status = 'ACTIVE'`,
      [adminId, adminRoleId, adminUsername, adminEmail, passwordHash]
    );

    console.log('[Seed] Admin accounts successfully seeded!');
    console.log(`[Super Admin] Username: ${superUsername} | Email: ${superEmail} | Password: ${rawPassword}`);
    console.log(`[Standard Admin] Username: ${adminUsername} | Email: ${adminEmail} | Password: ${rawPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]: Failed to seed Admin accounts:', error.message);
    process.exit(1);
  }
}

seedAdminAccounts();

