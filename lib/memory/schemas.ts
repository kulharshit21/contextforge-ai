import { z } from "zod";

export const MEMORY_FILE_KEYS = [
  "PROJECT_STATE",
  "ARCHITECTURE",
  "FEATURES",
  "DECISIONS",
  "BUGS_AND_FIXES",
  "FAILED_ATTEMPTS",
  "API_CONTRACTS",
  "ENV_AND_SETUP",
  "CODING_RULES",
  "CURRENT_TASKS",
] as const;

export const PROVIDER_NAMES = ["gemini", "ollama", "mock"] as const;
export const PRIVACY_MODES = ["local", "cloud"] as const;

export type MemoryFileKey = (typeof MEMORY_FILE_KEYS)[number];
export type ProviderName = (typeof PROVIDER_NAMES)[number];
export type PrivacyMode = (typeof PRIVACY_MODES)[number];

export const MemoryFileKeySchema = z.enum(MEMORY_FILE_KEYS);
export const ProviderNameSchema = z.enum(PROVIDER_NAMES);
export const PrivacyModeSchema = z.enum(PRIVACY_MODES);

export const MemoryItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  created_at: z.string(),
  updated_at: z.string(),
  related_files: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const MemoryFileSchema = z.object({
  file_key: MemoryFileKeySchema,
  title: z.string(),
  purpose: z.string(),
  summary: z.string(),
  version: z.number().int().positive().default(1),
  updated_at: z.string(),
  items: z.array(MemoryItemSchema).default([]),
});

export const RepoCommitSchema = z.object({
  hash: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
});

export const RepoScanSchema = z.object({
  workspace_root: z.string(),
  framework: z.string().default("unknown"),
  package_manager: z.string().default("npm"),
  scripts: z.record(z.string(), z.string()).default({}),
  app_routes: z.array(z.string()).default([]),
  api_routes: z.array(z.string()).default([]),
  library_files: z.array(z.string()).default([]),
  database_migrations: z.array(z.string()).default([]),
  env_examples: z.array(z.string()).default([]),
  test_files: z.array(z.string()).default([]),
  readme_summary: z.string().default(""),
  branch: z.string().default("unknown"),
  commit_hash: z.string().default("unknown"),
  recent_commits: z.array(RepoCommitSchema).default([]),
  files_inspected: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  totals: z
    .object({
      file_count: z.number().int().nonnegative().default(0),
      bytes_read: z.number().int().nonnegative().default(0),
    })
    .default({
      file_count: 0,
      bytes_read: 0,
    }),
  scanned_at: z.string(),
});

export const ExtractedMemoryEntrySchema = z.object({
  title: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1).default(0.72),
  related_files: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  source: z.string().default("chat-ingest"),
});

export const ExtractedMemorySchema = z.object({
  project_state: z.array(ExtractedMemoryEntrySchema).default([]),
  architecture: z.array(ExtractedMemoryEntrySchema).default([]),
  features: z.array(ExtractedMemoryEntrySchema).default([]),
  decisions: z.array(ExtractedMemoryEntrySchema).default([]),
  bugs_and_fixes: z.array(ExtractedMemoryEntrySchema).default([]),
  failed_attempts: z.array(ExtractedMemoryEntrySchema).default([]),
  api_contracts: z.array(ExtractedMemoryEntrySchema).default([]),
  env_and_setup: z.array(ExtractedMemoryEntrySchema).default([]),
  coding_rules: z.array(ExtractedMemoryEntrySchema).default([]),
  current_tasks: z.array(ExtractedMemoryEntrySchema).default([]),
});

export const CapsuleSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  relevant_context: z.array(z.string()),
  files_likely_needed: z.array(z.string()),
  files_to_avoid: z.array(z.string()),
  previous_errors_to_remember: z.array(z.string()),
  commands_to_run: z.array(z.string()),
  agent_prompt: z.string(),
  estimated_raw_tokens: z.number().int().nonnegative(),
  estimated_capsule_tokens: z.number().int().nonnegative(),
  saved_percent: z.number().min(0).max(100),
});

export const DriftIssueSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  title: z.string(),
  description: z.string(),
  suggested_fix: z.string(),
  evidence: z.array(z.string()).default([]),
  status: z.enum(["open", "resolved"]).default("open"),
});

export const ProjectSettingsSchema = z.object({
  aiProvider: ProviderNameSchema.default("mock"),
  privacyMode: PrivacyModeSchema.default("local"),
  geminiApiKey: z.string().default(""),
  ollamaUrl: z.string().default("http://localhost:11434"),
  maxTokenBudget: z.number().int().positive().default(6000),
  memoryUpdateBehavior: z
    .enum(["preview_first", "append_with_source", "manual_only"])
    .default("preview_first"),
});

export const ProjectRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  repoUrl: z.string().default(""),
  localPathHint: z.string().default(""),
  workspaceRoot: z.string(),
  stack: z.array(z.string()).default([]),
  editable: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: ProjectSettingsSchema,
});

export type MemoryItem = z.infer<typeof MemoryItemSchema>;
export type MemoryFile = z.infer<typeof MemoryFileSchema>;
export type RepoScan = z.infer<typeof RepoScanSchema>;
export type ExtractedMemory = z.infer<typeof ExtractedMemorySchema>;
export type Capsule = z.infer<typeof CapsuleSchema>;
export type DriftIssue = z.infer<typeof DriftIssueSchema>;
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
