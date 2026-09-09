CREATE TABLE `modules` (
	`key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_system` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`module_key` text NOT NULL,
	`can_view` integer DEFAULT false NOT NULL,
	`can_create` integer DEFAULT false NOT NULL,
	`can_edit` integer DEFAULT false NOT NULL,
	`can_delete` integer DEFAULT false NOT NULL,
	`can_approve` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_module_unique` ON `role_permissions` (`role`,`module_key`);--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`effect` text NOT NULL,
	`can_view` integer DEFAULT false NOT NULL,
	`can_create` integer DEFAULT false NOT NULL,
	`can_edit` integer DEFAULT false NOT NULL,
	`can_delete` integer DEFAULT false NOT NULL,
	`can_approve` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_module_unique` ON `user_permissions` (`user_id`,`module_key`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;