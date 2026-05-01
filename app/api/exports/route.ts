import { NextResponse } from "next/server";

import { generateProjectExports } from "@/lib/server/projects";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
    };

    const exportsBundle = await generateProjectExports(payload.projectId);
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
