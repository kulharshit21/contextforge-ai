import { NextResponse } from "next/server";
import { z } from "zod";

import { MemoryFileKeySchema } from "@/lib/memory/schemas";
import { updateProjectMemoryFile } from "@/lib/server/projects";

// Runtime validation is required: a TypeScript-only union does not stop a
// request body with a traversal value such as "../../CLAUDE" from reaching
// filesystem path construction.
const MemoryWritePayloadSchema = z.object({
  projectId: z.string().min(1),
  fileKey: MemoryFileKeySchema,
  content: z.string(),
});

export async function PUT(request: Request) {
  try {
    const parsed = MemoryWritePayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `Invalid request: ${parsed.error.issues
            .map((issue) => issue.message)
            .join("; ")}`,
        },
        { status: 400 },
      );
    }

    const file = await updateProjectMemoryFile(
      parsed.data.projectId,
      parsed.data.fileKey,
      parsed.data.content,
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
