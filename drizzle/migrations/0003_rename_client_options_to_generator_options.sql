-- Migration: 0003_rename_client_options_to_generator_options
-- Created: 2026-05-17
-- Description: Rename client_options to generator_options for clarity

-- Rename the column in projects table
ALTER TABLE `projects` RENAME COLUMN `client_options` TO `generator_options`;
