import { createDeterministicCapsule } from "@/lib/memory/capsule";
import { detectMemoryDrift } from "@/lib/memory/drift";
import {
  CapsuleSchema,
  DriftIssueSchema,
  ExtractedMemorySchema,
  type ExtractedMemory,
  type MemoryFile,
  type RepoScan,
} from "@/lib/memory/schemas";
import { buildCapsulePrompt } from "@/lib/prompts/capsule";
import { DRIFT_DETECTION_PROMPT } from "@/lib/prompts/drift";
import { buildChatExtractionPrompt } from "@/lib/prompts/extract";
import {
  getPreferredProvider,
  getPrivacyMode,
  isCloudProvider,
  type PrivacyMode,
  type ProviderName,
} from "@/lib/utils/env";

import { GeminiProvider } from "./providers/gemini";
import { MockProvider, type AIProvider } from "./providers/mock";
import { OllamaProvider } from "./providers/ollama";

function chunkText(input: string, maxChars = 12_000) {
  if (input.length <= maxChars) {
    return [input];
  }

  const chunks: string[] = [];
  for (let index = 0; index < input.length; index += maxChars) {
    chunks.push(input.slice(index, index + maxChars));
  }
  return chunks;
}

function extractRelatedFiles(input: string) {
  return [
    ...new Set(
      input.match(/(?:[\w-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|md|json|sql|py|css)/g) ?? [],
    ),
  ];
}

function buildTags(input: string) {
  const tags = [];
  const lowered = input.toLowerCase();

  if (lowered.includes("supabase")) tags.push("supabase");
  if (lowered.includes("rls")) tags.push("rls");
  if (lowered.includes("invoice")) tags.push("invoice");
  if (lowered.includes("auth")) tags.push("auth");
  if (lowered.includes("bug") || lowered.includes("error")) tags.push("bug");

  return tags;
}

function classifySection(input: string): keyof ExtractedMemory {
  const lowered = input.toLowerCase();

  if (/(rls|must not|do not|coding rule|naming convention|constraint)/.test(lowered)) {
    return "coding_rules";
  }

  if (/(failed attempt|tried|did not work|failed because)/.test(lowered)) {
    return "failed_attempts";
  }

  if (/(bug|error|redirect loop|stack trace|fix)/.test(lowered)) {
    return "bugs_and_fixes";
  }

  if (/(route|endpoint|payload|response|schema|table|migration|contract)/.test(lowered)) {
    return "api_contracts";
  }

  if (/(npm|pnpm|yarn|bun|env|setup|install|variable)/.test(lowered)) {
    return "env_and_setup";
  }

  if (/(decision|decided|tradeoff|alternative)/.test(lowered)) {
    return "decisions";
  }

  if (/(architecture|folder|data flow|auth flow|storage flow)/.test(lowered)) {
    return "architecture";
  }

  if (/(task|next step|blocker|todo|active)/.test(lowered)) {
    return "current_tasks";
  }

  if (/(feature|completed|implemented|invoice|pharmacy)/.test(lowered)) {
    return "features";
  }

  return "project_state";
}

function filterByMode(section: keyof ExtractedMemory, mode: string) {
  const normalizedMode = mode.toLowerCase();

  if (normalizedMode === "full extraction") {
    return true;
  }

  if (normalizedMode === "bugs only") {
    return section === "bugs_and_fixes" || section === "failed_attempts";
  }

  if (normalizedMode === "decisions only") {
    return section === "decisions";
  }

  if (normalizedMode === "features only") {
    return section === "features";
  }

  if (normalizedMode === "setup/env only") {
    return section === "env_and_setup";
  }

  return true;
}

function heuristicExtractMemory(chatText: string, mode: string): ExtractedMemory {
  const result = ExtractedMemorySchema.parse({});
  const segments = chatText
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 24);

  for (const segment of segments) {
    const section = classifySection(segment);
    if (!filterByMode(section, mode)) {
      continue;
    }

    result[section].push({
      title: segment.split(/[\r\n.!?]/)[0]?.slice(0, 80) || "Extracted memory",
      content: segment,
      confidence: 0.68,
      related_files: extractRelatedFiles(segment),
      tags: buildTags(segment),
      source: "chat-ingest:heuristic",
    });
  }

  return result;
}

function parseJsonSafely<T>(text: string, schema: { parse: (value: unknown) => T }) {
  try {
    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  } catch {
    return null;
  }
}

export type ProviderResolution = {
  provider: AIProvider;
  effectiveProvider: ProviderName;
  privacyMode: PrivacyMode;
  warning?: string;
};

export function resolveProvider(requested?: ProviderName): ProviderResolution {
  const preferred = requested ?? getPreferredProvider();
  const privacyMode = getPrivacyMode();

  if (privacyMode === "local" && preferred === "gemini") {
    try {
      return {
        provider: new OllamaProvider(),
        effectiveProvider: "ollama",
        privacyMode,
        warning:
          "Privacy mode is LOCAL, so cloud Gemini calls are blocked. Falling back to Ollama.",
      };
    } catch {
      return {
        provider: new MockProvider(),
        effectiveProvider: "mock",
        privacyMode,
        warning:
          "Privacy mode is LOCAL and Ollama is unavailable. Falling back to the mock provider.",
      };
    }
  }

  try {
    if (preferred === "gemini") {
      return {
        provider: new GeminiProvider(),
        effectiveProvider: "gemini",
        privacyMode,
      };
    }

    if (preferred === "ollama") {
      return {
        provider: new OllamaProvider(),
        effectiveProvider: "ollama",
        privacyMode,
      };
    }
  } catch {
    return {
      provider: new MockProvider(),
      effectiveProvider: "mock",
      privacyMode,
      warning: `Configured provider ${preferred} was unavailable, so ContextForge switched to mock mode.`,
    };
  }

  return {
    provider: new MockProvider(),
    effectiveProvider: "mock",
    privacyMode,
  };
}

export async function extractMemoryFromChat(
  chatText: string,
  mode = "Full extraction",
  requestedProvider?: ProviderName,
) {
  const resolution = resolveProvider(requestedProvider);

  if (resolution.effectiveProvider === "mock") {
    return {
      extracted: heuristicExtractMemory(chatText, mode),
      provider: resolution,
    };
  }

  const chunks = chunkText(chatText);
  const merged = ExtractedMemorySchema.parse({});

  for (const chunk of chunks) {
    const output = await resolution.provider.generateText({
      systemPrompt: buildChatExtractionPrompt(mode),
      userPrompt: chunk,
      temperature: 0.1,
    });

    const parsed = parseJsonSafely(output.text, ExtractedMemorySchema);
    const extracted = parsed ?? heuristicExtractMemory(chunk, mode);

    for (const key of Object.keys(merged) as Array<keyof ExtractedMemory>) {
      merged[key].push(...extracted[key]);
    }
  }

  return {
    extracted: merged,
    provider: resolution,
  };
}

export async function generateCapsuleFromMemory(
  task: string,
  memoryFiles: MemoryFile[],
  repoScan: RepoScan,
  requestedProvider?: ProviderName,
) {
  const resolution = resolveProvider(requestedProvider);
  const fallback = createDeterministicCapsule(task, memoryFiles, repoScan);

  if (resolution.effectiveProvider === "mock") {
    return {
      capsule: fallback,
      provider: resolution,
    };
  }

  try {
    const output = await resolution.provider.generateText({
      systemPrompt: buildCapsulePrompt(task),
      userPrompt: JSON.stringify(
        {
          task,
          repoScan,
          memoryFiles: memoryFiles.map((file) => ({
            file_key: file.file_key,
            summary: file.summary,
            items: file.items.slice(0, 5),
          })),
        },
        null,
        2,
      ),
      temperature: 0.2,
    });

    const parsed = parseJsonSafely(output.text, CapsuleSchema);
    return {
      capsule: parsed ?? fallback,
      provider: resolution,
    };
  } catch {
    return {
      capsule: fallback,
      provider: {
        ...resolution,
        warning:
          "AI capsule generation failed, so ContextForge used the deterministic local capsule instead.",
      },
    };
  }
}

export async function analyzeMemoryDrift(
  workspaceRoot: string,
  memoryFiles: MemoryFile[],
  repoScan: RepoScan,
  requestedProvider?: ProviderName,
) {
  const deterministic = detectMemoryDrift(workspaceRoot, memoryFiles, repoScan);
  const resolution = resolveProvider(requestedProvider);

  if (resolution.effectiveProvider === "mock") {
    return {
      issues: deterministic,
      provider: resolution,
    };
  }

  try {
    const output = await resolution.provider.generateText({
      systemPrompt: DRIFT_DETECTION_PROMPT,
      userPrompt: JSON.stringify(
        {
          repoScan,
          memoryFiles: memoryFiles.map((file) => ({
            file_key: file.file_key,
            summary: file.summary,
            items: file.items.slice(0, 5),
          })),
          deterministicIssues: deterministic,
        },
        null,
        2,
      ),
      temperature: 0.1,
    });

    const parsed = parseJsonSafely(output.text, DriftIssueSchema.array());
    return {
      issues: parsed ?? deterministic,
      provider: resolution,
    };
  } catch {
    return {
      issues: deterministic,
      provider: {
        ...resolution,
        warning:
          "AI drift analysis failed, so ContextForge used deterministic drift detection.",
      },
    };
  }
}

export function isCloudCallAllowed(providerName: ProviderName) {
  return !isCloudProvider(providerName) || getPrivacyMode() === "cloud";
}
