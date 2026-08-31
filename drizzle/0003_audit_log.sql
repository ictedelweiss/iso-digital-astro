CREATE TABLE IF NOT EXISTS `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`step` integer,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor_id` integer,
	`actor_name` text,
	`actor_email` text,
	`actor_role` text,
	`notes` text,
	`created_at` text NOT NULL
);
