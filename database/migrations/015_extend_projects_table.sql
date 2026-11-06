-- Migration 015: Extend projects table with builder_developer, brochure_url, possession_date, rera_number, hero_image_url and updated project_type ENUM
-- Note: builder_developer column already exists in the table from migration 004
ALTER TABLE projects 
  MODIFY COLUMN project_type ENUM('RESIDENTIAL', 'COMMERCIAL', 'INDEPENDENT', 'VILLA', 'PLOTTED', 'MIXED') NOT NULL DEFAULT 'RESIDENTIAL';

-- Add hero_image_url (MySQL has no ADD COLUMN IF NOT EXISTS; the runner applies each file once)
ALTER TABLE projects ADD COLUMN hero_image_url VARCHAR(500) DEFAULT NULL;
