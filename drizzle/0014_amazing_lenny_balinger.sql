CREATE TABLE `product_activity_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_type` enum('visit','analysis_started','analysis_viewed') NOT NULL,
	`event_date` date NOT NULL,
	`occurred_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_activity_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_activity_user_event_date_unique` UNIQUE(`user_id`,`event_type`,`event_date`)
);
--> statement-breakpoint
CREATE INDEX `product_activity_event_date_idx` ON `product_activity_events` (`event_date`,`event_type`);