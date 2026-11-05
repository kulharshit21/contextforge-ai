import { repairAllMemory } from "@/lib/memory/engine";

export type RepairCommandOptions = {
  breakLock?: boolean;
};

export async function runRepairCommand(
  options: RepairCommandOptions = {},
  workspaceRoot = process.cwd(),
) {
  const result = await repairAllMemory(workspaceRoot, options.breakLock);
  if (result.corruptLines > 0) {
    console.log(
      `Repaired: recovered ${result.validRecords} valid records, trimmed ${result.corruptLines} corrupt lines. Backup created at: ${result.backupPath}`,
    );
  } else {
    console.log(`OK: storage clean (${result.validRecords} valid records, no corrupt lines)`);
  }
}
