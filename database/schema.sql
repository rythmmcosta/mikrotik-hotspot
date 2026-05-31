-- MikroTik Hotspot Manager - Complete Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS hotspot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotspot_db;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(64) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','operator') NOT NULL DEFAULT 'operator',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role  (role)
);

CREATE TABLE IF NOT EXISTS bandwidth_profiles (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(64) NOT NULL UNIQUE,
    description           TEXT NULL,
    rate_limit_rx         VARCHAR(32) NOT NULL,
    rate_limit_tx         VARCHAR(32) NOT NULL,
    burst_limit_rx        VARCHAR(32) NULL,
    burst_limit_tx        VARCHAR(32) NULL,
    burst_threshold_rx    VARCHAR(32) NULL,
    burst_threshold_tx    VARCHAR(32) NULL,
    burst_time_seconds    SMALLINT UNSIGNED NULL,
    mikrotik_profile_name VARCHAR(64) NULL,
    is_default_employee   BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_guest      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name            VARCHAR(255) NOT NULL,
    email                VARCHAR(255) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    hotspot_username     VARCHAR(64) NOT NULL UNIQUE,
    hotspot_password     VARCHAR(512) NOT NULL,
    bandwidth_profile_id INT UNSIGNED NULL,
    status               ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
    mikrotik_synced      BOOLEAN NOT NULL DEFAULT FALSE,
    notes                TEXT NULL,
    created_by           INT UNSIGNED NOT NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bandwidth_profile_id) REFERENCES bandwidth_profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_email  (email),
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS guests (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name            VARCHAR(255) NOT NULL,
    email                VARCHAR(255) NOT NULL,
    mobile               VARCHAR(32) NOT NULL,
    email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    mobile_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    hotspot_username     VARCHAR(64) NULL UNIQUE,
    hotspot_password     VARCHAR(512) NULL,
    bandwidth_profile_id INT UNSIGNED NULL,
    status               ENUM('pending_otp','pending_approval','approved','rejected','expired','suspended')
                         NOT NULL DEFAULT 'pending_otp',
    approval_notes       TEXT NULL,
    approved_by          INT UNSIGNED NULL,
    approved_at          DATETIME NULL,
    rejected_by          INT UNSIGNED NULL,
    rejected_at          DATETIME NULL,
    access_expires_at    DATETIME NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bandwidth_profile_id) REFERENCES bandwidth_profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_email  (email),
    INDEX idx_status (status),
    INDEX idx_mobile (mobile)
);

CREATE TABLE IF NOT EXISTS otp_log (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    target_type  ENUM('guest_email','guest_mobile') NOT NULL,
    target_id    INT UNSIGNED NOT NULL,
    target_value VARCHAR(255) NOT NULL,
    otp_code     VARCHAR(64) NOT NULL,
    channel      ENUM('email','sms') NOT NULL,
    is_used      BOOLEAN NOT NULL DEFAULT FALSE,
    is_expired   BOOLEAN NOT NULL DEFAULT FALSE,
    attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at   DATETIME NOT NULL,
    used_at      DATETIME NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_id) REFERENCES guests(id) ON DELETE CASCADE,
    INDEX idx_target  (target_type, target_id),
    INDEX idx_expires (expires_at),
    INDEX idx_used    (is_used, is_expired)
);

CREATE TABLE IF NOT EXISTS access_queue (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    guest_id     INT UNSIGNED NOT NULL UNIQUE,
    full_name    VARCHAR(255) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    mobile       VARCHAR(32) NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    priority     TINYINT UNSIGNED NOT NULL DEFAULT 5,
    notes        TEXT NULL,
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
    INDEX idx_submitted (submitted_at),
    INDEX idx_priority  (priority, submitted_at)
);

CREATE TABLE IF NOT EXISTS connections (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id        VARCHAR(128) NOT NULL UNIQUE,
    user_type         ENUM('employee','guest') NOT NULL,
    user_id           INT UNSIGNED NOT NULL,
    hotspot_username  VARCHAR(64) NOT NULL,
    mac_address       VARCHAR(17) NOT NULL,
    ip_address        VARCHAR(45) NOT NULL,
    bytes_in          BIGINT UNSIGNED NOT NULL DEFAULT 0,
    bytes_out         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    uptime_seconds    INT UNSIGNED NOT NULL DEFAULT 0,
    connected_at      DATETIME NOT NULL,
    disconnected_at   DATETIME NULL,
    disconnect_reason ENUM('logout','admin_terminate','idle_timeout','session_timeout','unknown') NULL,
    terminated_by     INT UNSIGNED NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (terminated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_session   (session_id),
    INDEX idx_user      (user_type, user_id),
    INDEX idx_active    (is_active, connected_at),
    INDEX idx_mac       (mac_address),
    INDEX idx_connected (connected_at)
);

CREATE TABLE IF NOT EXISTS settings (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category     VARCHAR(64) NOT NULL,
    key_name     VARCHAR(128) NOT NULL,
    value        TEXT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    description  VARCHAR(255) NULL,
    updated_by   INT UNSIGNED NULL,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_category_key (category, key_name),
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category (category)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED NULL,
    username      VARCHAR(64) NOT NULL,
    action        VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NULL,
    resource_id   VARCHAR(64) NULL,
    details       JSON NULL,
    ip_address    VARCHAR(45) NULL,
    user_agent    VARCHAR(512) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user     (user_id),
    INDEX idx_action   (action),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_created  (created_at)
);
