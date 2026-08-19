-- Migration 014: Seed initial roles catalog
INSERT INTO roles (id, name, description) VALUES 
  (1, 'SUPER_ADMIN', 'Platform Super Administrator with full create/update/delete and user access management privileges'),
  (2, 'ADMIN', 'Standard Administrator with view and analytics access')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);
