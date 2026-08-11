CREATE TABLE `data_sharing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`shared_with_user_id` int NOT NULL,
	`permission` enum('view','edit') NOT NULL DEFAULT 'view',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_sharing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`total_anomalies` int NOT NULL DEFAULT 0,
	`total_saved_cost` int NOT NULL DEFAULT 0,
	`danger_reset_offset` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_stats_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `anomaly_logs` ADD `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `anomaly_logs` ADD `llm_analysis_ko` text;--> statement-breakpoint
ALTER TABLE `anomaly_logs` ADD `llm_analysis_en` text;--> statement-breakpoint
ALTER TABLE `anomaly_logs` ADD `llm_analysis_ja` text;--> statement-breakpoint
ALTER TABLE `users` ADD `badge_number` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `date_of_birth` date;--> statement-breakpoint
ALTER TABLE `anomaly_logs` DROP COLUMN `llm_analysis`;