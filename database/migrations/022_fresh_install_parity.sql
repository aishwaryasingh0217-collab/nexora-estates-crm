-- Migration 022: Make a brand-new install match the schema production databases already have.
-- Some tables/columns were added outside the migration runner (notifications lived in backend/migrations,
-- project columns were added by hand). Every statement here is safe on databases that already have them.

-- 1. Notifications (previously only in backend/migrations/004, which the runner never executed)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  recipient_user_id VARCHAR(36) NOT NULL,
  type ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER') NOT NULL DEFAULT 'INFO',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(50) NULL,
  related_entity_id VARCHAR(36) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipient_read (recipient_user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Project columns the CRM and website read (MySQL has no ADD COLUMN IF NOT EXISTS, so check first)
SET @add = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE projects ADD COLUMN builder_developer VARCHAR(150) NULL', 'DO 0')
              FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'builder_developer');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE projects ADD COLUMN possession_date VARCHAR(100) NULL', 'DO 0')
              FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'possession_date');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE projects ADD COLUMN rera_number VARCHAR(100) NULL', 'DO 0')
              FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'rera_number');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE projects ADD COLUMN brochure_url VARCHAR(255) NULL', 'DO 0')
              FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'brochure_url');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. The Super Admin's "Create project" form sends types/statuses beyond the original ENUMs
ALTER TABLE projects
  MODIFY COLUMN project_type VARCHAR(50) NOT NULL DEFAULT 'RESIDENTIAL',
  MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'UNDER_CONSTRUCTION';
