import { NextResponse } from "next/server";

import { createProject, updateProjectSettings } from "@/lib/server/projects";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name: string;
      description: string;
      repoUrl?: string;
      localPathHint?: string;
    };

    const project = await createProject(payload);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create project.",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId: string;
      name?: string;
      description?: string;
      aiProvider?: "gemini" | "ollama" | "mock";
      privacyMode?: "local" | "cloud";
      geminiApiKey?: string;
      ollamaUrl?: string;
      maxTokenBudget?: number;
      memoryUpdateBehavior?: "preview_first" | "append_with_source" | "manual_only";
    };

    const project = await updateProjectSettings(payload.projectId, payload);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update project settings.",
      },
      { status: 400 },
    );
  }
}
