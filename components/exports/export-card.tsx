"use client";

import { Download } from "lucide-react";

import { MarkdownPreview } from "@/components/dashboard/markdown-preview";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExportCard({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}) {
  function handleDownload() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.split("/").pop() ?? fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="text-base">{fileName}</CardTitle>
          <p className="text-sm text-slate-400">Copy or download this generated agent memory file.</p>
        </div>
        <div className="flex gap-2">
          <CopyButton value={content} />
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download className="size-4" />
            Download
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[360px] overflow-auto rounded-[22px] border border-white/10 bg-slate-950/80 p-4">
          <MarkdownPreview content={content} className="prose-sm" />
        </div>
      </CardContent>
    </Card>
  );
}
