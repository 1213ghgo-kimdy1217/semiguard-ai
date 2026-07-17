CREATE TABLE `sample_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(32) NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sample_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `sample_stats_key_unique` UNIQUE(`key`)
);
