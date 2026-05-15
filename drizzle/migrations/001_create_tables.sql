-- Migration: 001_create_tables
-- Created: 2026-05-15
-- Description: Initial schema for Config Platform

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `username` text NOT NULL,
  `password_hash` text NOT NULL,
  `role` text DEFAULT 'viewer' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `users_username_unique` UNIQUE(`username`)
);

-- ============================================
-- Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- ============================================
-- Configs Table
-- ============================================
CREATE TABLE IF NOT EXISTS `configs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `key` text NOT NULL,
  `value` text NOT NULL,
  `type` text NOT NULL,
  `environment` text NOT NULL,
  `description` text,
  `validation` text,
  `created_by` integer,
  `updated_by` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`)
);

-- Unique index on key + environment
CREATE UNIQUE INDEX IF NOT EXISTS `key_environment_idx` ON `configs` (`key`, `environment`);

-- ============================================
-- Config History Table
-- ============================================
CREATE TABLE IF NOT EXISTS `config_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `config_id` integer NOT NULL,
  `old_value` text,
  `new_value` text NOT NULL,
  `changed_by` integer,
  `changed_at` integer NOT NULL,
  `change_reason` text,
  FOREIGN KEY (`config_id`) REFERENCES `configs`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`)
);

-- ============================================
-- Drizzle Migrations Table
-- ============================================
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `hash` text NOT NULL,
  `created_at` integer,
  `name` text
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS `sessions_user_id_idx` ON `sessions` (`user_id`);
CREATE INDEX IF NOT EXISTS `sessions_expires_at_idx` ON `sessions` (`expires_at`);
CREATE INDEX IF NOT EXISTS `configs_environment_idx` ON `configs` (`environment`);
CREATE INDEX IF NOT EXISTS `configs_deleted_at_idx` ON `configs` (`deleted_at`);
CREATE INDEX IF NOT EXISTS `config_history_config_id_idx` ON `config_history` (`config_id`);
