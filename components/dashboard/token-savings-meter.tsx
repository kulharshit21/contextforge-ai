import { Badge } from "@/components/ui/badge";

export function TokenSavingsMeter({ savedPercent }: { savedPercent: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-500">
        <span>Estimated reduction</span>
        <Badge variant="emerald">{savedPercent}%</Badge>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400"
          style={{ width: `${Math.min(100, Math.max(0, savedPercent))}%` }}
        />
      </div>
    </div>
  );
}
