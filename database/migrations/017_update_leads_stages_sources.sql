-- Migration 017: Update Leads Stages and Sources
ALTER TABLE leads 
MODIFY COLUMN source VARCHAR(100) NOT NULL,
MODIFY COLUMN stage VARCHAR(100) DEFAULT 'Fresh Lead';
