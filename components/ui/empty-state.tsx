import { Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed border-white/15 bg-white/[0.03]">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-200">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="max-w-md text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
