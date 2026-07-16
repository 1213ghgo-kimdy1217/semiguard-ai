CREATE TABLE `visitor_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visitor_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_stats_date_unique` UNIQUE(`date`)
);
