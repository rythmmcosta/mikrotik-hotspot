-- MikroTik Hotspot Manager - Complete Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS hotspot_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotspot_db;

CREATE TABLE IF NOT EXISTS users (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username         VARCHAR(64) NOT NULL UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    role             ENUM('admin','operator') NOT NULL DEFAULT 'operator',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    full_name        VARCHAR(255) NULL,
    avatar_url       VARCHAR(512) NULL,
    mobile           VARCHAR(20) NULL,
    telegram_chat_id VARCHAR(64) NULL,
    last_login_at    DATETIME NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

CREATE TABLE IF NOT EXISTS assets (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    asset_type       ENUM('desktop','laptop','other') NOT NULL DEFAULT 'desktop',
    mac_address      VARCHAR(17) NOT NULL UNIQUE,
    ip_address       VARCHAR(45) NULL,
    connection_type  ENUM('lan','wifi') NOT NULL DEFAULT 'wifi',
    employee_id      INT UNSIGNED NULL,
    serial_number    VARCHAR(128) NULL,
    os_type          ENUM('windows','linux','macos') NULL,
    hostname         VARCHAR(255) NULL,
    status           ENUM('active','offline','blocked') NOT NULL DEFAULT 'offline',
    agent_installed  BOOLEAN NOT NULL DEFAULT FALSE,
    agent_version    VARCHAR(20) NULL,
    agent_last_seen  DATETIME NULL,
    agent_token_hash VARCHAR(255) NULL,
    notes            TEXT NULL,
    added_by         INT UNSIGNED NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_mac    (mac_address),
    INDEX idx_status (status),
    INDEX idx_emp    (employee_id)
);

CREATE TABLE IF NOT EXISTS asset_metrics (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id            INT UNSIGNED NOT NULL,
    collected_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cpu_percent         FLOAT NULL,
    cpu_per_core        JSON NULL,
    ram_total           BIGINT UNSIGNED NULL,
    ram_used            BIGINT UNSIGNED NULL,
    ram_percent         FLOAT NULL,
    disk_read_bytes     BIGINT UNSIGNED NULL,
    disk_write_bytes    BIGINT UNSIGNED NULL,
    net_bytes_sent      BIGINT UNSIGNED NULL,
    net_bytes_recv      BIGINT UNSIGNED NULL,
    net_packets_sent    BIGINT UNSIGNED NULL,
    net_packets_recv    BIGINT UNSIGNED NULL,
    active_connections  INT UNSIGNED NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_time (asset_id, collected_at)
);

CREATE TABLE IF NOT EXISTS browsing_log (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotspot_username VARCHAR(100) NULL,
    user_type        ENUM('employee','guest','asset') NULL,
    user_id          INT UNSIGNED NULL,
    domain           VARCHAR(255) NOT NULL,
    query_type       VARCHAR(10) NULL,
    ip_address       VARCHAR(45) NULL,
    mac_address      VARCHAR(17) NULL,
    queried_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_time   (hotspot_username, queried_at),
    INDEX idx_domain_time (domain, queried_at),
    INDEX idx_mac         (mac_address),
    INDEX idx_time        (queried_at)
);

CREATE TABLE IF NOT EXISTS usage_policies (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL UNIQUE,
    description           TEXT NULL,
    scope                 ENUM('employee','guest','asset','global') NOT NULL DEFAULT 'global',
    scope_id              INT UNSIGNED NULL,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    priority              TINYINT UNSIGNED NOT NULL DEFAULT 5,
    mikrotik_address_list VARCHAR(100) NULL,
    created_by            INT UNSIGNED NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_scope (scope)
);

CREATE TABLE IF NOT EXISTS policy_rules (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    policy_id   INT UNSIGNED NOT NULL,
    rule_type   ENUM('domain','ip','category') NOT NULL,
    value       VARCHAR(255) NOT NULL,
    action      ENUM('block','allow') NOT NULL DEFAULT 'block',
    description VARCHAR(255) NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (policy_id) REFERENCES usage_policies(id) ON DELETE CASCADE,
    INDEX idx_policy (policy_id)
);
