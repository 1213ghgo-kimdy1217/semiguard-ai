CREATE TABLE `chat_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`session_id` int NOT NULL,
	`message_id` int,
	`message_content` text NOT NULL,
	`feedback_type` enum('like','dislike') NOT NULL,
	`reason_code` varchar(32),
	`reason_text` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manual_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`chunk_index` int NOT NULL,
	`content` text NOT NULL,
	`keywords` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manual_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manual_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`file_key` varchar(512),
	`source_type` enum('text','upload') NOT NULL DEFAULT 'text',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manual_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chat_feedback_user_idx` ON `chat_feedback` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_feedback_session_idx` ON `chat_feedback` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_feedback_message_idx` ON `chat_feedback` (`message_id`);--> statement-breakpoint
CREATE INDEX `manual_chunks_document_idx` ON `manual_chunks` (`document_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `manual_documents_user_idx` ON `manual_documents` (`user_id`,`created_at`);