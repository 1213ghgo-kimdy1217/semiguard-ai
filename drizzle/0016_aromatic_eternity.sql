CREATE TABLE `first_use_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ease_rating` int NOT NULL,
	`difficult_step` enum('none','orientation','risk_review','analysis_review') NOT NULL DEFAULT 'none',
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `first_use_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `first_use_feedback_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE INDEX `first_use_feedback_submitted_at_idx` ON `first_use_feedback` (`submitted_at`);