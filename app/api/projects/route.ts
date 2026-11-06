import { NextResponse } from "next/server";
import { z } from "zod";

import { createProject, updateProjectSettings } from "@/lib/server/projects";
import {
  PrivacyModeSchema,
  ProviderNameSchema,
} from "@/lib/memory/schemas";

const CreateProjectSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  repoUrl: z.string().max(500).optional(),
  localPathHint: z.string().max(1000).optional(),
});

const UpdateSettingsSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  aiProvider: ProviderNameSchema.optional(),
  privacyMode: PrivacyModeSchema.optional(),
  maxTokenBudget: z.number().int().positive().max(1_000_000).optional(),
  memoryUpdateBehavior: z.enum(["preview_first", "append_with_source", "manual_only"]).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = CreateProjectSchema.safeParse(await request.json());
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

    const project = await createProject({
      ...parsed.data,
      description: parsed.data.description ?? "",
    });
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
    const parsed = UpdateSettingsSchema.safeParse(await request.json());
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

    const project = await updateProjectSettings(parsed.data.projectId, parsed.data);
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
