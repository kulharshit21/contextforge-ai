import { NextResponse } from "next/server";
import { z } from "zod";

import { ingestProjectChat } from "@/lib/server/projects";

// Bounded, runtime-validated request body: `text` feeds one provider call per
// 12k chunk, so an unbounded string once allowed an unauthenticated caller to
// trigger thousands of model calls; `persist` must be a real boolean.
const IngestPayloadSchema = z.object({
  projectId: z.string().min(1),
  text: z.string().max(200_000).optional(),
  mode: z.string().max(100).optional(),
  persist: z.boolean().optional(),
  extracted: z.unknown().optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = IngestPayloadSchema.safeParse(await request.json());
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

    const result = await ingestProjectChat(parsed.data.projectId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Chat extraction failed.",
      },
      { status: 400 },
    );
  }
}
