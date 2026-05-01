import Link from "next/link";
import { FolderKanban, House, LayoutDashboard } from "lucide-react";

import { ContextForgeMark } from "@/components/brand/contextforge-mark";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/8 bg-slate-950/85 px-5 py-6 lg:block">
      <div className="flex h-full flex-col gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ContextForgeMark className="size-11" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">ContextForge</p>
              <h1 className="text-lg font-semibold text-white">Project Memory</h1>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            Git remembers what changed. ContextForge remembers why it changed.
          </p>
          <Badge variant="emerald">Local-first MVP</Badge>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">CLI</p>
          <p className="mt-2 font-mono text-sm text-cyan-100">npx contextforge scan</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Generate repo facts locally and upload the JSON into a project if browser access is limited.
          </p>
        </div>
      </div>
    </aside>
  );
}
