CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_code` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`location` text NOT NULL,
	`condition` text NOT NULL,
	`status` text NOT NULL,
	`serial_number` text,
	`purchase_date` text,
	`value` real,
	`assigned_to` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_asset_code_unique` ON `assets` (`asset_code`);--> statement-breakpoint
CREATE TABLE `handover_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`handover_id` integer NOT NULL,
	`step` integer NOT NULL,
	`role` text NOT NULL,
	`role_title` text NOT NULL,
	`approver_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`date` text,
	`signature` text,
	`notes` text,
	FOREIGN KEY (`handover_id`) REFERENCES `handover_forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `handover_forms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_name` text NOT NULL,
	`handover_date` text NOT NULL,
	`recipient_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`serial_number` text,
	`specification` text,
	`loan_period` text,
	`item_condition` text,
	`notes` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`current_approval_step` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`leave_id` integer NOT NULL,
	`step` integer NOT NULL,
	`role` text NOT NULL,
	`role_title` text NOT NULL,
	`approver_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`date` text,
	`signature` text,
	`notes` text,
	FOREIGN KEY (`leave_id`) REFERENCES `leave_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requester_id` integer NOT NULL,
	`department` text NOT NULL,
	`work_days` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`current_approval_step` integer DEFAULT 1 NOT NULL,
	`hak_prev` integer DEFAULT 0 NOT NULL,
	`hak_curr` integer DEFAULT 12 NOT NULL,
	`total_hak` integer DEFAULT 12 NOT NULL,
	`taken_until` integer DEFAULT 0 NOT NULL,
	`sisa_curr` integer NOT NULL,
	`request_days` integer NOT NULL,
	`sisa_after` integer NOT NULL,
	`requester_signature` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pr_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_id` integer NOT NULL,
	`step` integer NOT NULL,
	`role` text NOT NULL,
	`role_title` text NOT NULL,
	`approver_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`date` text,
	`signature` text,
	`notes` text,
	FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pr_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`qty` real NOT NULL,
	`unit` text NOT NULL,
	`price` real NOT NULL,
	FOREIGN KEY (`pr_id`) REFERENCES `purchase_requisitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_requisitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pr_number` text NOT NULL,
	`title` text NOT NULL,
	`requester_id` integer NOT NULL,
	`department` text NOT NULL,
	`needed_date` text NOT NULL,
	`budget_status` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`current_approval_step` integer DEFAULT 1 NOT NULL,
	`requester_signature` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_requisitions_pr_number_unique` ON `purchase_requisitions` (`pr_number`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`department` text NOT NULL,
	`job_title` text NOT NULL,
	`role` text NOT NULL,
	`signature_data` text,
	`has_signature` integer DEFAULT false,
	`ms_id` text,
	`avatar_url` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_ms_id_unique` ON `users` (`ms_id`);