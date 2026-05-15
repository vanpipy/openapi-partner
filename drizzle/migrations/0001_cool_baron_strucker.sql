ALTER TABLE `tasks` ADD `output_dir` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `output_files` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `output_size` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `download_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tasks` ADD `public_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_public_token_idx` ON `tasks` (`public_token`);