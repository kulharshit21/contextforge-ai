import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Bug,
  FileWarning,
  GitBranch,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import { CodeBlockWithCopy } from "@/components/dashboard/code-block-with-copy";
import { MarkdownPreview } from "@/components/dashboard/markdown-preview";
import { PipelineDiagram } from "@/components/dashboard/pipeline-diagram";
import { TokenSavingsMeter } from "@/components/dashboard/token-savings-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const problemCards = [
    {
      title: "AI forgets old decisions",
      description: "Architecture tradeoffs and safety constraints vanish between sessions.",
      icon: BrainCircuit,
    },
    {
      title: "Chats become too long",
      description: "Context windows fill up with repeated repo explanations and stale history.",
      icon: FileWarning,
    },
    {
      title: "Same bugs repeat",
      description: "Redirect loops, broken scripts, and unsafe workarounds come back when memory drifts.",
      icon: Bug,
    },
    {
      title: "Tokens are wasted",
      description: "Every new session burns tokens re-reading chats, repo structure, and old decisions.",
      icon: Wallet,
    },
    {
      title: "Different agents need different memory",
      description: "Cursor, Claude, Copilot, Codex, Gemini, and local agents all prefer slightly different context shapes.",
      icon: GitBranch,
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(129,140,248,0.14),_transparent_22%),linear-gradient(180deg,#020617_0%,#020617_45%,#010314_100%)] text-white">
      <section className="mx-auto flex max-w-7xl flex-col gap-12 px-5 py-8 lg:px-8 lg:py-14">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="violet">Local-first AI developer tool</Badge>
            <Badge variant="emerald">₹0-friendly stack</Badge>
          </div>
          <div className="hidden sm:block">
            <Link href="/dashboard" className="text-sm text-slate-300 transition hover:text-white">
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-10 xl:grid-cols-[1.05fr_minmax(0,0.95fr)] xl:items-center">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.45em] text-cyan-200">ContextForge</p>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                AI Project Memory Compiler for coding agents
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                Turn messy chats, bugs, decisions, and repo history into task-specific context capsules for Cursor, Claude, Copilot, Codex, Gemini, and local agents.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Open Dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#cli">View CLI Commands</a>
              </Button>
            </div>

            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              Git remembers what changed. ContextForge remembers why it changed.
            </p>
          </div>

          <PipelineDiagram />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="mb-8 space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Problem</p>
          <h2 className="text-3xl font-semibold text-white">Why AI-assisted projects lose momentum</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {problemCards.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="h-full">
              <CardContent className="space-y-4 px-6 py-6">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-3 text-cyan-200">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-6 text-slate-400">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="grid gap-5 xl:grid-cols-4">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Structured project memory</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              Capture durable knowledge in multi-file markdown memory instead of one giant dump. ContextForge separates project state, architecture, decisions, bugs, failed attempts, setup, contracts, and current tasks.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Task-specific capsules</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              Compress only the relevant memory into a capsule that can be pasted into any coding agent session.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Memory drift detection</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-300">
              Compare saved memory claims with repo facts so agents stop following outdated assumptions.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="grid gap-5 xl:grid-cols-[1.05fr_minmax(0,0.95fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Demo Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sample task</p>
                <p className="mt-2 text-lg font-medium text-white">Add pharmacy invoice feature</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-slate-950/80 p-5">
                <MarkdownPreview
                  content={`## Goal\nAdd pharmacy invoice feature\n\n## Relevant Context\n- Do not bypass Supabase RLS policies.\n- Previous bug: login redirect loop was caused by redirecting before auth hydration settled.\n- Failed attempt: hardcoded role routes caused brittle login behavior.\n- Likely files: \`app/pharmacy/invoices/page.tsx\`, \`lib/pharmacy/invoices.ts\`\n\n## Commands\n- \`npm install\`\n- \`npm run dev\`\n- \`npm run test\``}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estimated savings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <TokenSavingsMeter savedPercent={92} />
              <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <ShieldAlert className="size-4" />
                  Why the capsule matters
                </div>
                Repeatedly pasting raw chats, repo scans, and bug history wastes tokens. ContextForge keeps just the durable context and the mistakes the next agent must avoid.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="cli" className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">CLI</p>
          <h2 className="text-3xl font-semibold text-white">Local-first commands</h2>
          <CodeBlockWithCopy
            code={[
              "npx contextforge init",
              'npx contextforge remember "Do not bypass Supabase RLS policies"',
              "npx contextforge scan",
              'npx contextforge capsule "Add pharmacy invoice feature"',
              "npx contextforge export --all",
            ].join("\n")}
          />
        </div>
      </section>
    </main>
  );
}
