import { NextResponse } from "next/server";
import { z } from "zod";

import { generateProjectCapsule } from "@/lib/server/projects";
import { CapsuleSchema } from "@/lib/memory/schemas";

const CapsulePayloadSchema = z.object({
  projectId: z.string().min(1),
  task: z.string().min(1).max(2000),
  persist: z.boolean().optional(),
  existingCapsule: CapsuleSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = CapsulePayloadSchema.safeParse(await request.json());
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

    const result = await generateProjectCapsule(parsed.data.projectId, parsed.data.task, {
      persist: parsed.data.persist,
      existingCapsule: parsed.data.existingCapsule,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Capsule generation failed.",
      },
      { status: 400 },
    );
  }
}
