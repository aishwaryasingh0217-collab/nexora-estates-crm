-- Migration 015: Extend projects table with builder_developer, brochure_url, possession_date, rera_number, and updated project_type ENUM
-- Note: builder_developer column already exists in the table from migration 004
ALTER TABLE projects 
  MODIFY COLUMN project_type ENUM('RESIDENTIAL', 'COMMERCIAL', 'INDEPENDENT', 'VILLA', 'PLOTTED', 'MIXED') NOT NULL DEFAULT 'RESIDENTIAL';

-- Add columns if they don't exist (brochure_url, possession_date, rera_number already exist)
-- This migration is for documentation purposes as the columns were manually added
