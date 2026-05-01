import { CopyButton } from "@/components/ui/copy-button";

export function CodeBlockWithCopy({
  code,
  language = "bash",
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/95">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-xs uppercase tracking-[0.3em] text-slate-500">{language}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-7 text-cyan-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
