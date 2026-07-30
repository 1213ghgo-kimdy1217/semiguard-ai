CREATE TABLE `sensor_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(32) NOT NULL,
	`current_caution` float NOT NULL DEFAULT 7,
	`current_warning` float NOT NULL DEFAULT 9,
	`current_danger` float NOT NULL DEFAULT 11,
	`temp_caution` float NOT NULL DEFAULT 55,
	`temp_warning` float NOT NULL DEFAULT 70,
	`temp_danger` float NOT NULL DEFAULT 85,
	`vib_caution` float NOT NULL DEFAULT 0.6,
	`vib_warning` float NOT NULL DEFAULT 0.8,
	`vib_danger` float NOT NULL DEFAULT 1,
	`noise_caution` float NOT NULL DEFAULT 65,
	`noise_warning` float NOT NULL DEFAULT 75,
	`noise_danger` float NOT NULL DEFAULT 85,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sensor_thresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `sensor_thresholds_key_unique` UNIQUE(`key`)
);
