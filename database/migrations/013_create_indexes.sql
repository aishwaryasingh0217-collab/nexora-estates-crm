-- Migration 013: Create performance strategy indexes

-- Indexes for Users & Auth
CREATE INDEX idx_users_status ON users(status);

-- Indexes for Inventory & Projects
CREATE INDEX idx_units_project_status ON units(project_id, status);
CREATE INDEX idx_units_building ON units(building_id);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_category ON units(asset_category, unit_type);

-- Indexes for Leads & Pipeline
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_agent ON leads(assigned_agent_id);
CREATE INDEX idx_leads_sla_due ON leads(sla_due_date);
CREATE INDEX idx_leads_phone ON leads(phone);

-- Indexes for Site Visits
CREATE INDEX idx_site_visits_scheduled ON site_visits(scheduled_time);
CREATE INDEX idx_site_visits_agent ON site_visits(assigned_agent_id);
CREATE INDEX idx_site_visits_status ON site_visits(status);

-- Indexes for Deals & Payments
CREATE INDEX idx_deals_customer ON deals(customer_id);
CREATE INDEX idx_deals_unit_status ON deals(unit_id, status);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_milestones_due ON payment_milestones(due_date, status);
CREATE INDEX idx_payments_deal ON payments(deal_id);

-- Index for Security Audit Logs
CREATE INDEX idx_audit_target_action ON user_audit_logs(target_user_id, action);
CREATE INDEX idx_audit_created ON user_audit_logs(created_at);
