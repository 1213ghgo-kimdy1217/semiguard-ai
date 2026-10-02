-- The production table may already have been created by the approved manual setup.
-- Keep this additive migration safe to apply after that setup; verify its schema first.
CREATE TABLE IF NOT EXISTS `training_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`attempt_key` varchar(36) NOT NULL,
	`scenario_id` varchar(64) NOT NULL,
	`signal` varchar(32) NOT NULL,
	`onset` int NOT NULL,
	`marker` int,
	`comparison` varchar(32) NOT NULL,
	`certainty` varchar(32) NOT NULL,
	`signal_matched` int NOT NULL,
	`onset_matched` int NOT NULL,
	`comparison_matched` int NOT NULL,
	`certainty_matched` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `training_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_attempt_user_key_unique` UNIQUE(`user_id`,`attempt_key`),
	INDEX `training_attempt_user_created_idx` (`user_id`,`created_at`)
);
