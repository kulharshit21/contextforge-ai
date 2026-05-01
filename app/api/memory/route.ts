import { NextResponse } from "next/server";

import { updateProjectMemoryFile } from "@/lib/server/projects";

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
      fileKey:
        | "PROJECT_STATE"
        | "ARCHITECTURE"
        | "FEATURES"
        | "DECISIONS"
        | "BUGS_AND_FIXES"
        | "FAILED_ATTEMPTS"
        | "API_CONTRACTS"
        | "ENV_AND_SETUP"
        | "CODING_RULES"
        | "CURRENT_TASKS";
      content: string;
    };

    const file = await updateProjectMemoryFile(
      payload.projectId,
      payload.fileKey,
      payload.content,
    );
    return NextResponse.json({ file });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update memory file.",
      },
      { status: 400 },
    );
  }
}
