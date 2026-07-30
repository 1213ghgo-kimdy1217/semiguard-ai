CREATE TABLE `threshold_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(32) NOT NULL,
	`normal_max` int NOT NULL DEFAULT 29,
	`caution_max` int NOT NULL DEFAULT 49,
	`warning_max` int NOT NULL DEFAULT 69,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `threshold_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `threshold_settings_key_unique` UNIQUE(`key`)
);
