import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DriftIssue } from "@/lib/memory/schemas";

export function DriftIssueCard({ issue }: { issue: DriftIssue }) {
  const variant =
    issue.severity === "high"
      ? "violet"
      : issue.severity === "medium"
        ? "warning"
        : "muted";

  return (
    <Card className="border-white/8 bg-white/[0.03]">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-200" />
              <h4 className="font-semibold text-white">{issue.title}</h4>
            </div>
            <p className="text-sm leading-6 text-slate-300">{issue.description}</p>
          </div>
          <Badge variant={variant}>{issue.severity}</Badge>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4 text-sm text-slate-300">
          <p className="mb-2 font-medium text-white">Suggested patch</p>
          <p>{issue.suggested_fix}</p>
        </div>
      </CardContent>
    </Card>
  );
}
