-- Additive DDL applied by the authorized table operator on 2026-10-09.
-- Empty measurement storage only; no existing tables/records modified.
CREATE TABLE IF NOT EXISTS `practice_activity_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `participant_id` varchar(64) NOT NULL,
  `event_type` enum('visit', 'practice_started', 'practice_completed') NOT NULL,
  `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `practice_activity_events_id` PRIMARY KEY (`id`),
  INDEX `practice_activity_participant_time_idx` (`participant_id`, `occurred_at`, `event_type`),
  INDEX `practice_activity_time_type_idx` (`occurred_at`, `event_type`)
);
