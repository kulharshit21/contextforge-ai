import { Save } from "lucide-react";

import { MarkdownPreview } from "@/components/dashboard/markdown-preview";
import { TokenSavingsMeter } from "@/components/dashboard/token-savings-meter";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Capsule } from "@/lib/memory/schemas";

export function CapsuleViewer({
  markdown,
  capsule,
  onSave,
  isSaving,
}: {
  markdown: string;
  capsule: Capsule;
  onSave: () => void;
  isSaving?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle>Generated Capsule</CardTitle>
          <p className="text-sm text-slate-400">
            Paste-ready context for your next coding agent session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={markdown} label="Copy Capsule" />
          <Button variant="outline" onClick={onSave} disabled={isSaving}>
            <Save className="size-4" />
            {isSaving ? "Saving..." : "Save Capsule"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <TokenSavingsMeter savedPercent={capsule.saved_percent} />
        <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5">
          <MarkdownPreview content={markdown} />
        </div>
      </CardContent>
    </Card>
  );
}
