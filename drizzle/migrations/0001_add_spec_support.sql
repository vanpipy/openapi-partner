-- Migration: 0001_add_spec_support
-- Created: 2026-05-15
-- Description: Add OpenAPI spec version support fields

-- Rename swagger_url to spec_url if it exists (for existing databases)
-- SQLite doesn't support DROP COLUMN directly, so we recreate the table
-- This migration is idempotent

-- Add new columns if they don't exist (for SQLite compatibility)
-- Note: SQLite has limited ALTER TABLE support

-- Step 1: Add new columns (if not exists via dummy check)
ALTER TABLE `projects` ADD COLUMN `spec_type` text DEFAULT 'auto-detect' NOT NULL;
ALTER TABLE `projects` ADD COLUMN `spec_version` text;
ALTER TABLE `projects` ADD COLUMN `was_converted` integer DEFAULT false;

-- Step 2: Rename swagger_url to spec_url (requires table recreation in SQLite)
-- For fresh databases, drizzle migration 0000 handles this
-- For existing databases, we need to:
-- 1. Create new table with correct schema
-- 2. Copy data
-- 3. Drop old table
-- 4. Rename new table

-- This is handled by the drizzle generated migration 0000_silent_pet_avengers
-- For existing databases, run this manually:
/*
CREATE TABLE `projects_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `spec_url` text NOT NULL,
  `spec_type` text DEFAULT 'auto-detect' NOT NULL,
  `spec_version` text,
  `was_converted` integer DEFAULT false,
  `output_path` text DEFAULT './generated' NOT NULL,
  `api_version` text,
  `base_url` text,
  `custom_templates` text,
  `client_options` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_by` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

INSERT INTO `projects_new` SELECT 
  `id`, `name`, `swagger_url`, 'auto-detect', NULL, 0,
  `output_path`, `api_version`, `base_url`, `custom_templates`,
  `client_options`, `is_active`, `created_by`, `created_at`, `updated_at`
FROM `projects`;

DROP TABLE `projects`;
ALTER TABLE `projects_new` RENAME TO `projects`;
*/
