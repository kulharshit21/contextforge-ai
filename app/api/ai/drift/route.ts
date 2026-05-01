import { NextResponse } from "next/server";

import { runProjectDriftCheck } from "@/lib/server/projects";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
    };

    const result = await runProjectDriftCheck(payload.projectId);
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
