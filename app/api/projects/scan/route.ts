import { NextResponse } from "next/server";
import { z } from "zod";

import { runProjectScan, saveUploadedRepoScan } from "@/lib/server/projects";

const ScanSavePayloadSchema = z.object({
  projectId: z.string().min(1),
  // The scan JSON is shape-validated downstream by RepoScanSchema.parse;
  // here we only require the field to exist and be an object.
  scanJson: z.record(z.string(), z.unknown()),
});

const ScanRunPayloadSchema = z.object({
  projectId: z.string().min(1),
});

// An uploaded scan is buffered and re-serialized to repo-scan.json; cap the
// payload so one request cannot exhaust memory on the local machine.
const MAX_SCAN_JSON_CHARS = 2_000_000;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_SCAN_JSON_CHARS) {
      return NextResponse.json(
        { error: `Request body too large (${contentLength} bytes; limit ${MAX_SCAN_JSON_CHARS}).` },
        { status: 413 },
      );
    }

    const parsed = ScanSavePayloadSchema.safeParse(await request.json());
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

    const serializedLength = JSON.stringify(parsed.data.scanJson).length;
    if (serializedLength > MAX_SCAN_JSON_CHARS) {
      return NextResponse.json(
        { error: `Scan JSON too large (${serializedLength} characters; limit ${MAX_SCAN_JSON_CHARS}).` },
        { status: 400 },
      );
    }

    const scan = await saveUploadedRepoScan(parsed.data.projectId, parsed.data.scanJson);
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
    const parsed = ScanRunPayloadSchema.safeParse(await request.json());
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

    const scan = await runProjectScan(parsed.data.projectId);
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
