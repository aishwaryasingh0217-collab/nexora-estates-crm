-- Migration 003: Create user_audit_logs table
CREATE TABLE IF NOT EXISTS user_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    performed_by VARCHAR(36) NULL,
    target_user_id VARCHAR(36) NULL,
    action ENUM('USER_CREATED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'ACCESS_REVOKED', 'USER_UPDATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT') NOT NULL,
    ip_address VARCHAR(45) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_performed_by FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
