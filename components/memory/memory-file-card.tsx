import { FileCode2, PencilLine } from "lucide-react";

import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { relativeDate } from "@/lib/utils/date";

export function MemoryFileCard({
  title,
  updatedAt,
  preview,
  onEdit,
  rawContent,
  editable,
}: {
  title: string;
  updatedAt: string;
  preview: string;
  onEdit: () => void;
  rawContent: string;
  editable: boolean;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileCode2 className="size-4 text-cyan-200" />
              <h3 className="font-semibold text-white">{title}</h3>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Updated {relativeDate(updatedAt)}
            </p>
          </div>
          <CopyButton value={rawContent} />
        </div>
        <p className="line-clamp-6 text-sm leading-6 text-slate-300">{preview}</p>
        <div className="mt-auto">
          <Button
            variant="secondary"
            className="w-full"
            onClick={onEdit}
            disabled={!editable}
          >
            <PencilLine className="size-4" />
            {editable ? "Edit Memory File" : "Read-Only Demo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
