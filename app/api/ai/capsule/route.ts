import { NextResponse } from "next/server";

import { generateProjectCapsule } from "@/lib/server/projects";
import type { Capsule } from "@/lib/memory/schemas";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
      task: string;
      persist?: boolean;
      existingCapsule?: Capsule;
    };

    const result = await generateProjectCapsule(payload.projectId, payload.task, {
      persist: payload.persist,
      existingCapsule: payload.existingCapsule,
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
