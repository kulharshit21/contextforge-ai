import { NextResponse } from "next/server";

import { runProjectScan, saveUploadedRepoScan } from "@/lib/server/projects";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
      scanJson: unknown;
    };

    const scan = await saveUploadedRepoScan(payload.projectId, payload.scanJson);
    return NextResponse.json({ scan });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save repo scan JSON.",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
    };

    const scan = await runProjectScan(payload.projectId);
    return NextResponse.json({ scan });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to refresh repo scan.",
      },
      { status: 400 },
    );
  }
}
