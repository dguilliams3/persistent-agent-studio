CREATE TABLE `cold_storage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cold_storage_persona` ON `cold_storage` (`persona_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE INDEX `idx_config_key` ON `config` (`key`);--> statement-breakpoint
CREATE TABLE `cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))',
	`model` text,
	`trigger` text,
	`cycle_interval` integer,
	`loop_count` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_creation_tokens` integer,
	`cache_read_tokens` integer,
	`cache_ttl` text,
	`volatile_caching_enabled` integer,
	`history_prefix_size` integer,
	`history_tail_size` integer,
	`action_count` integer,
	`primary_action` text,
	`actions_json` text,
	`estimated_cost_cents` real,
	`status` text DEFAULT 'completed',
	`error_message` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cycles_created` ON `cycles` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cycles_model` ON `cycles` (`model`);--> statement-breakpoint
CREATE INDEX `idx_cycles_status` ON `cycles` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cycles_trigger` ON `cycles` (`trigger`);--> statement-breakpoint
CREATE INDEX `idx_cycles_primary_action` ON `cycles` (`primary_action`);--> statement-breakpoint
CREATE INDEX `idx_cycles_persona` ON `cycles` (`persona_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `glossary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wrong_form` text NOT NULL,
	`correct_form` text NOT NULL,
	`category` text DEFAULT 'name',
	`use_in_prompt` integer DEFAULT 1,
	`use_in_replace` integer DEFAULT 1,
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `glossary_wrong_form_unique` ON `glossary` (`wrong_form`);--> statement-breakpoint
CREATE INDEX `idx_glossary_wrong_form` ON `glossary` (`wrong_form`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text,
	`internal` text,
	`cycle_id` integer,
	`summarized_at` text,
	`embedding` integer,
	`embedding_model` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_created` ON `history` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_history_type` ON `history` (`type`);--> statement-breakpoint
CREATE INDEX `idx_history_persona_created` ON `history` (`persona_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_history_cycle` ON `history` (`cycle_id`);--> statement-breakpoint
CREATE INDEX `idx_history_summarized` ON `history` (`summarized_at`);--> statement-breakpoint
CREATE TABLE `image_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))',
	`source_type` text NOT NULL,
	`history_id` integer,
	`cycle_id` integer,
	`prompt` text,
	`media_type` text,
	`width` integer,
	`height` integer,
	`size_bytes` integer,
	`base64_data` text,
	`r2_key` text,
	`r2_bucket` text,
	`title` text,
	`description` text,
	`is_favorite` integer DEFAULT 0,
	`deleted_at` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_image_assets_source` ON `image_assets` (`source_type`);--> statement-breakpoint
CREATE INDEX `idx_image_assets_history` ON `image_assets` (`history_id`);--> statement-breakpoint
CREATE INDEX `idx_image_assets_cycle` ON `image_assets` (`cycle_id`);--> statement-breakpoint
CREATE INDEX `idx_image_assets_created` ON `image_assets` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_image_assets_r2` ON `image_assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `idx_image_assets_persona` ON `image_assets` (`persona_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `learned` (
	`id` integer PRIMARY KEY NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	`confidence` text DEFAULT 'emerging',
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text,
	`supporting_evidence` text,
	`challenging_evidence` text,
	`promoted_to_cold_storage_at` text,
	`embedding` blob,
	`embedding_model` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_learned_confidence` ON `learned` (`confidence`);--> statement-breakpoint
CREATE INDEX `idx_learned_persona` ON `learned` (`persona_id`);--> statement-breakpoint
CREATE TABLE `memory_branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parent_branch` text,
	`is_active` integer DEFAULT 0,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_branches_name_unique` ON `memory_branches` (`name`);--> statement-breakpoint
CREATE TABLE `memory_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`target_table` text NOT NULL,
	`target_id` integer NOT NULL,
	`override_type` text NOT NULL,
	`override_data` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`branch_id`) REFERENCES `memory_branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_memory_overrides_branch` ON `memory_overrides` (`branch_id`,`target_table`);--> statement-breakpoint
CREATE UNIQUE INDEX `memory_overrides_unique` ON `memory_overrides` (`branch_id`,`target_table`,`target_id`,`override_type`);--> statement-breakpoint
CREATE TABLE `notebook` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`content` text NOT NULL,
	`last_viewed_at` text,
	`embedding` blob,
	`embedding_model` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notebook_title_unique` ON `notebook` (`title`);--> statement-breakpoint
CREATE INDEX `idx_notebook_title` ON `notebook` (`title`);--> statement-breakpoint
CREATE INDEX `idx_notebook_persona` ON `notebook` (`persona_id`);--> statement-breakpoint
CREATE INDEX `idx_notebook_last_viewed` ON `notebook` (`last_viewed_at`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`content` text NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))',
	`deleted_at` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_observations_title` ON `observations` (`title`);--> statement-breakpoint
CREATE INDEX `idx_observations_created_at` ON `observations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_observations_deleted` ON `observations` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_observations_persona` ON `observations` (`persona_id`);--> statement-breakpoint
CREATE TABLE `pending_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` text NOT NULL,
	`custom_id` text NOT NULL,
	`submitted_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`cycle_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	`results_json` text,
	`error_message` text,
	`trigger` text,
	`model` text,
	`cancelled_by` text,
	`timeout_seconds` integer,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_batches_batch_id_unique` ON `pending_batches` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_pending_batches_status` ON `pending_batches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pending_batches_submitted` ON `pending_batches` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_pending_batches_cancelled_by` ON `pending_batches` (`cancelled_by`);--> statement-breakpoint
CREATE TABLE `pending_view_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`image_id` integer NOT NULL,
	`requested_at` text DEFAULT '(datetime(''now''))',
	`cycle_id` integer,
	`viewed` integer DEFAULT 0,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_id`) REFERENCES `history`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pending_view_persona` ON `pending_view_images` (`persona_id`,`viewed`);--> statement-breakpoint
CREATE TABLE `personas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`system_prompt_template` text,
	`operator_context_id` text,
	`forked_from_id` integer,
	`total_cycles` integer DEFAULT 0,
	`total_cost_cents` integer DEFAULT 0,
	`created_at` text DEFAULT '(datetime(''now''))',
	`archived_at` text,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personas_slug_unique` ON `personas` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_personas_slug` ON `personas` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_personas_archived` ON `personas` (`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_personas_created` ON `personas` (`created_at`);--> statement-breakpoint
CREATE TABLE `pinned_images` (
	`slot` integer PRIMARY KEY NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`image_id` integer NOT NULL,
	`pinned_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_id`) REFERENCES `history`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pinned_images_persona` ON `pinned_images` (`persona_id`,`slot`);--> statement-breakpoint
CREATE TABLE `prompt_components` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_prompt_components_persona` ON `prompt_components` (`persona_id`,`kind`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_components_unique` ON `prompt_components` (`persona_id`,`kind`,`name`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	`domain` text,
	`status` text DEFAULT 'open',
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text,
	`resolved_into` text,
	`embedding` blob,
	`embedding_model` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_questions_status` ON `questions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_questions_domain` ON `questions` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_questions_persona` ON `questions` (`persona_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	`condition` text DEFAULT 'persistent',
	`dismissed_at` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_condition` ON `reminders` (`condition`);--> statement-breakpoint
CREATE INDEX `idx_reminders_persona` ON `reminders` (`persona_id`);--> statement-breakpoint
CREATE TABLE `sim_anomaly_flags` (
	`id` integer PRIMARY KEY NOT NULL,
	`persona_id` integer NOT NULL,
	`target_table` text NOT NULL,
	`target_id` integer NOT NULL,
	`basin_distance` real,
	`z_score` real,
	`flagged_axes` text,
	`detection_method` text,
	`inspected` integer DEFAULT 0,
	`verdict` text,
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sim_anomaly_unresolved` ON `sim_anomaly_flags` (`persona_id`,`inspected`,`verdict`);--> statement-breakpoint
CREATE UNIQUE INDEX `sim_anomaly_flags_unique` ON `sim_anomaly_flags` (`target_table`,`target_id`);--> statement-breakpoint
CREATE TABLE `sim_axis_scores` (
	`id` integer PRIMARY KEY NOT NULL,
	`persona_id` integer NOT NULL,
	`axis_id` integer NOT NULL,
	`target_table` text NOT NULL,
	`target_id` integer NOT NULL,
	`score` real NOT NULL,
	`percentile` real,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`axis_id`) REFERENCES `sim_concept_axes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sim_scores_axis` ON `sim_axis_scores` (`axis_id`);--> statement-breakpoint
CREATE INDEX `idx_sim_scores_target` ON `sim_axis_scores` (`target_table`,`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sim_axis_scores_unique` ON `sim_axis_scores` (`axis_id`,`target_table`,`target_id`);--> statement-breakpoint
CREATE TABLE `sim_basin_metrics` (
	`id` integer PRIMARY KEY NOT NULL,
	`persona_id` integer NOT NULL,
	`metric_type` text NOT NULL,
	`centroid` blob,
	`mean_distance` real,
	`std_distance` real,
	`outlier_threshold` real,
	`sample_count` integer,
	`computed_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`metadata` text DEFAULT '{}',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sim_basin_metrics_timeseries` ON `sim_basin_metrics` (`persona_id`,`metric_type`,`computed_at`);--> statement-breakpoint
CREATE INDEX `idx_sim_basin_metrics_persona` ON `sim_basin_metrics` (`persona_id`);--> statement-breakpoint
CREATE TABLE `sim_concept_axes` (
	`id` integer PRIMARY KEY NOT NULL,
	`persona_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`positive_examples` text NOT NULL,
	`negative_examples` text NOT NULL,
	`concept_vector` blob,
	`vector_model` text DEFAULT 'bge-base-en-v1.5',
	`is_active` integer DEFAULT 1,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sim_axes_persona` ON `sim_concept_axes` (`persona_id`);--> statement-breakpoint
CREATE INDEX `idx_sim_axes_active` ON `sim_concept_axes` (`persona_id`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `sim_concept_axes_unique` ON `sim_concept_axes` (`persona_id`,`name`);--> statement-breakpoint
CREATE TABLE `state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`summary` text NOT NULL,
	`message_count` integer,
	`covered_range` text,
	`metadata` text DEFAULT '{}',
	`embedding` blob,
	`embedding_model` text,
	`source_ids` text,
	`source_type` text DEFAULT 'history',
	`archived_at` text,
	`replaced_by_id` integer,
	`token_count` integer,
	`token_model` text,
	`promoted_to_block2` integer DEFAULT 0,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_summaries_created` ON `summaries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_summaries_persona` ON `summaries` (`persona_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_summaries_active` ON `summaries` (`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_summaries_replaced_by` ON `summaries` (`replaced_by_id`);--> statement-breakpoint
CREATE INDEX `idx_summaries_source_type` ON `summaries` (`source_type`);--> statement-breakpoint
CREATE TABLE `synthetic_memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`memory_type` text NOT NULL,
	`content` text NOT NULL,
	`internal` text,
	`position_timestamp` text,
	`position_after_id` integer,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`branch_id`) REFERENCES `memory_branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_synthetic_memories_branch` ON `synthetic_memories` (`branch_id`);--> statement-breakpoint
CREATE TABLE `voice_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`text` text NOT NULL,
	`model` text DEFAULT 'v2' NOT NULL,
	`stability` real,
	`audio_base64` text NOT NULL,
	`char_count` integer NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_voice_history_created` ON `voice_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_voice_history_persona` ON `voice_history` (`persona_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `voice_transcriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` integer DEFAULT 1 NOT NULL,
	`history_id` integer,
	`raw_transcription` text NOT NULL,
	`corrected_text` text,
	`detected_emotion` text,
	`corrected_emotion` text,
	`audio_duration` real,
	`glossary_applied` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`history_id`) REFERENCES `history`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_voice_transcriptions_history` ON `voice_transcriptions` (`history_id`);--> statement-breakpoint
CREATE INDEX `idx_voice_transcriptions_persona` ON `voice_transcriptions` (`persona_id`);--> statement-breakpoint
CREATE INDEX `idx_voice_transcriptions_created` ON `voice_transcriptions` (`created_at`);