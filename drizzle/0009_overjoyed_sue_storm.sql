CREATE TABLE `social_account_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`provider` enum('google','naver','kakao') NOT NULL,
	`provider_user_id` varchar(128) NOT NULL,
	`email` varchar(320),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_account_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_account_provider_identity` UNIQUE(`provider`,`provider_user_id`),
	CONSTRAINT `social_account_user_provider` UNIQUE(`user_id`,`provider`)
);
