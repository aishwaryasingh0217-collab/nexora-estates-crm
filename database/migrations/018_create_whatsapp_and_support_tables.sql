-- Migration 018: Create WhatsApp Conversations, Messages, and Support Tickets Tables

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id VARCHAR(36) PRIMARY KEY,
  phone_number VARCHAR(30) NOT NULL,
  customer_id VARCHAR(36) NULL,
  lead_id VARCHAR(36) NULL,
  state ENUM('AI_ACTIVE', 'HUMAN_REQUIRED', 'HUMAN_ACTIVE', 'CLOSED') DEFAULT 'AI_ACTIVE',
  assigned_agent_id VARCHAR(36) NULL,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_conv_phone (phone_number),
  INDEX idx_wa_conv_customer (customer_id),
  INDEX idx_wa_conv_lead (lead_id),
  INDEX idx_wa_conv_state (state),
  INDEX idx_wa_conv_last_msg (last_message_at),
  CONSTRAINT fk_wa_conv_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_wa_conv_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_wa_conv_agent FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  whatsapp_message_id VARCHAR(150) NOT NULL UNIQUE,
  sender_type ENUM('CUSTOMER', 'AI', 'AGENT') DEFAULT 'CUSTOMER',
  sender_phone VARCHAR(30) NOT NULL,
  direction ENUM('INBOUND', 'OUTBOUND') NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  message_content TEXT NOT NULL,
  raw_payload JSON NULL,
  delivery_status ENUM('RECEIVED', 'SENT', 'DELIVERED', 'READ', 'FAILED') DEFAULT 'RECEIVED',
  processing_status ENUM('PENDING', 'PROCESSED', 'FAILED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wa_msg_conv (conversation_id),
  INDEX idx_wa_msg_wa_id (whatsapp_message_id),
  INDEX idx_wa_msg_created (created_at),
  CONSTRAINT fk_wa_msg_conv FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(36) PRIMARY KEY,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id VARCHAR(36) NULL,
  lead_id VARCHAR(36) NULL,
  whatsapp_conversation_id VARCHAR(36) NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') DEFAULT 'OPEN',
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
  assigned_to VARCHAR(36) NULL,
  resolution_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ticket_num (ticket_number),
  INDEX idx_ticket_phone (phone),
  INDEX idx_ticket_email (email),
  INDEX idx_ticket_status (status),
  INDEX idx_ticket_priority (priority),
  INDEX idx_ticket_created (created_at),
  CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_conv FOREIGN KEY (whatsapp_conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
