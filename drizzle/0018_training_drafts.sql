CREATE TABLE IF NOT EXISTS `training_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`scenario_id` varchar(64) NOT NULL,
	`elapsed` int NOT NULL,
	`marker` int,
	`stage` varchar(16) NOT NULL,
	`signal` varchar(32) NOT NULL,
	`onset` varchar(4) NOT NULL,
	`comparison` varchar(32) NOT NULL,
	`certainty` varchar(32) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `training_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_draft_owner_scenario_unique` UNIQUE(`user_id`,`scenario_id`)
);
