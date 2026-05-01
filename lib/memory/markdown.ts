import matter from "gray-matter";

import { formatDateTime } from "@/lib/utils/date";

import { MemoryFileSchema, type MemoryFile, type MemoryItem } from "./schemas";

function renderItem(item: MemoryItem) {
  const relatedFiles = item.related_files.length
    ? item.related_files.join(", ")
    : "none recorded";
  const tags = item.tags.length ? item.tags.join(", ") : "none";

  return [
    `### ${item.title}`,
    `- ID: \`${item.id}\``,
    `- Type: \`${item.type}\``,
    `- Source: \`${item.source}\``,
    `- Confidence: ${(item.confidence * 100).toFixed(0)}%`,
    `- Related files: ${relatedFiles}`,
    `- Tags: ${tags}`,
    `- Updated: ${formatDateTime(item.updated_at)}`,
    "",
    item.content.trim(),
    "",
  ].join("\n");
}

export function renderMemoryFile(file: MemoryFile) {
  const body = [
    `# ${file.title}`,
    "",
    file.purpose,
    "",
    "## Summary",
    "",
    file.summary.trim() || "No summary yet.",
    "",
    "## Durable Entries",
    "",
    file.items.length
      ? file.items
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((item) => renderItem(item))
          .join("\n")
      : "_No durable entries yet. Use ContextForge CLI or the dashboard to add project memory._",
  ].join("\n");

  return matter.stringify(body, {
    file_key: file.file_key,
    title: file.title,
    purpose: file.purpose,
    summary: file.summary,
    version: file.version,
    updated_at: file.updated_at,
    items: file.items,
  });
}

export function parseMemoryFile(raw: string) {
  const parsed = matter(raw);

  return MemoryFileSchema.parse({
    ...parsed.data,
    summary:
      typeof parsed.data.summary === "string"
        ? parsed.data.summary
        : parsed.content.split("## Durable Entries")[0]?.trim() ?? "",
    items: Array.isArray(parsed.data.items) ? parsed.data.items : [],
    updated_at:
      typeof parsed.data.updated_at === "string"
        ? parsed.data.updated_at
        : new Date().toISOString(),
  });
}
