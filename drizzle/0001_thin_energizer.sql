CREATE TABLE `anomaly_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`current` float NOT NULL,
	`temperature` float NOT NULL,
	`vibration` float NOT NULL,
	`noise` float NOT NULL,
	`anomaly_score` float NOT NULL,
	`risk_level` enum('normal','caution','warning','danger') NOT NULL,
	`is_anomaly` int NOT NULL DEFAULT 0,
	CONSTRAINT `anomaly_logs_id` PRIMARY KEY(`id`)
);
