import { auditAllMemory } from "../../lib/memory/engine";

export type AuditCommandOptions = {
  verbose?: boolean;
};

export async function runAuditCommand(
  options: AuditCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  const result = await auditAllMemory(workspaceRoot);
  const j = result.journal;

  console.log(
    `OK: ${j.totalRecords} records; ${j.activeRecords} active; integrity chain valid`,
  );

  if (options.verbose) {
    const breakdown = Object.entries(j.kinds)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, count]) => `${k}: ${count}`)
      .join(", ");
    console.log(`Kinds: ${breakdown || "none"}`);
    console.log(`Lock status: ${j.lockStatus}`);
    console.log(`Structured markdown files: ${result.markdown.fileCount}`);
  }
}
