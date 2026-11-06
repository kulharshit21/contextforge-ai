import { NextResponse } from "next/server";
import { z } from "zod";

import { generateProjectExports } from "@/lib/server/projects";

const ExportsPayloadSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = ExportsPayloadSchema.safeParse(await request.json());
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

    const exportsBundle = await generateProjectExports(parsed.data.projectId);
    return NextResponse.json({ exports: exportsBundle });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Export generation failed.",
      },
      { status: 400 },
    );
  }
}
