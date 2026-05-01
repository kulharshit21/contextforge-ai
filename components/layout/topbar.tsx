import { Shield } from "lucide-react";

import { ProviderBadge } from "@/components/providers/provider-badge";
import { Badge } from "@/components/ui/badge";
import { getPreferredProvider, getPrivacyMode, isDemoMode } from "@/lib/utils/env";

export function Topbar({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const provider = getPreferredProvider();
  const privacyMode = getPrivacyMode();
  const demoMode = isDemoMode();

  return (
    <header className="border-b border-white/8 bg-slate-950/80 px-5 py-4 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={privacyMode === "local" ? "emerald" : "violet"}>
            <Shield className="size-3" />
            {privacyMode.toUpperCase()}
          </Badge>
          <ProviderBadge provider={provider} />
          {demoMode ? <Badge variant="warning">Demo mode</Badge> : null}
        </div>
      </div>
    </header>
  );
}
