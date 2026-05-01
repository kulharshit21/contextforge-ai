import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function MemoryHealthScore({ score }: { score: number }) {
  const variant = score >= 85 ? "emerald" : score >= 65 ? "warning" : "violet";

  return (
    <Badge variant={variant}>
      <ShieldCheck className="size-3" />
      {score}/100
    </Badge>
  );
}
