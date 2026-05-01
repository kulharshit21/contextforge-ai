import { Bot, Cloud, HardDriveDownload } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ProviderBadge({ provider }: { provider: string }) {
  const normalized = provider.toLowerCase();

  if (normalized === "gemini") {
    return (
      <Badge variant="violet">
        <Cloud className="size-3" />
        Gemini
      </Badge>
    );
  }

  if (normalized === "ollama") {
    return (
      <Badge variant="emerald">
        <HardDriveDownload className="size-3" />
        Ollama
      </Badge>
    );
  }

  return (
    <Badge variant="muted">
      <Bot className="size-3" />
      Mock
    </Badge>
  );
}
