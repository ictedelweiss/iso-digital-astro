PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meeting_attendees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meeting_id` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`division` text NOT NULL,
	`email` text,
	`signature_path` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_meeting_attendees`("id", "meeting_id", "user_id", "name", "division", "email", "signature_path", "created_at") SELECT "id", "meeting_id", "user_id", "name", "division", "email", "signature_path", "created_at" FROM `meeting_attendees`;--> statement-breakpoint
DROP TABLE `meeting_attendees`;--> statement-breakpoint
ALTER TABLE `__new_meeting_attendees` RENAME TO `meeting_attendees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;