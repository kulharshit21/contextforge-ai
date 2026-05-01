import { NextResponse } from "next/server";

import { ingestProjectChat } from "@/lib/server/projects";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
      text?: string;
      mode?: string;
      persist?: boolean;
      extracted?: unknown;
    };

    const result = await ingestProjectChat(payload.projectId, payload);
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
