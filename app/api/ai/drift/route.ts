import { NextResponse } from "next/server";
import { z } from "zod";

import { runProjectDriftCheck } from "@/lib/server/projects";

const DriftPayloadSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = DriftPayloadSchema.safeParse(await request.json());
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

    const result = await runProjectDriftCheck(parsed.data.projectId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Drift check failed.",
      },
      { status: 400 },
    );
  }
}
