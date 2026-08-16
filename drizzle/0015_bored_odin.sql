CREATE TABLE `user_onboarding_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`current_step` int NOT NULL DEFAULT 1,
	`completed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_onboarding_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_onboarding_progress_user_id_unique` UNIQUE(`user_id`)
);
