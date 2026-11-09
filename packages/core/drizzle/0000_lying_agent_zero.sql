CREATE TABLE `coach_note` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`at` integer NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `health_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`steps` integer,
	`resting_hr` integer,
	`sleep_min` integer,
	`active_kcal` integer,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `health_hr_sample` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`t` integer NOT NULL,
	`bpm` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `health_hr_sample_t_idx` ON `health_hr_sample` (`t`);--> statement-breakpoint
CREATE TABLE `injury` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`body_area` text NOT NULL,
	`side` text,
	`description` text DEFAULT '' NOT NULL,
	`avoid_areas` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_on` text,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pain_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`workout_id` text,
	`exercise_id` text,
	`body_area` text NOT NULL,
	`score` integer NOT NULL,
	`kind` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pain_entry_at_idx` ON `pain_entry` (`at`);--> statement-breakpoint
CREATE TABLE `planned_session` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`warmup` text DEFAULT '[]' NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`birth_year` integer,
	`sex` text,
	`height_cm` real,
	`goals` text DEFAULT '[]' NOT NULL,
	`equipment` text DEFAULT '[]' NOT NULL,
	`sports` text DEFAULT '[]' NOT NULL,
	`pool_days` text DEFAULT '[]' NOT NULL,
	`units` text DEFAULT 'metric' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_point` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`workout_id` text NOT NULL,
	`t` integer NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`alt` real,
	`hr` integer
);
--> statement-breakpoint
CREATE INDEX `run_point_workout_idx` ON `run_point` (`workout_id`);--> statement-breakpoint
CREATE TABLE `scan_import` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`kind` text NOT NULL,
	`file_ref` text NOT NULL,
	`extracted` text
);
--> statement-breakpoint
CREATE TABLE `set_log` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`load_kg` real,
	`rpe` real,
	`duration_s` integer,
	`foot_contacts` integer
);
--> statement-breakpoint
CREATE INDEX `set_log_workout_idx` ON `set_log` (`workout_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`date` text NOT NULL,
	`kg` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`type` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`distance_m` real,
	`duration_s` integer,
	`avg_hr` integer,
	`notes` text,
	`planned_session_id` text
);
--> statement-breakpoint
CREATE INDEX `workout_started_at_idx` ON `workout` (`started_at`);