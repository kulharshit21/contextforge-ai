"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, GitBranch, MessageSquareText, TriangleAlert } from "lucide-react";

import { ContextForgeMark } from "@/components/brand/contextforge-mark";

const nodes = [
  { label: "Chats", icon: MessageSquareText },
  { label: "Git", icon: GitBranch },
  { label: "Errors", icon: TriangleAlert },
  { label: "Docs", icon: FileText },
];

export function PipelineDiagram() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-[0_20px_90px_rgba(14,165,233,0.12)]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {nodes.map(({ label, icon: Icon }, index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <Icon className="mb-3 size-5 text-cyan-200" />
              <p className="font-medium leading-6 text-white">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Durable inputs</p>
            </motion.div>
          ))}
        </div>
        <ArrowRight className="mx-auto hidden size-5 text-slate-500 lg:block" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[26px] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/12 via-violet-400/12 to-emerald-400/12 p-6 text-center"
        >
          <ContextForgeMark className="mx-auto mb-4 size-14" />
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">ContextForge</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Memory Compiler</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Structured memory files, drift detection, and capsule generation from one local-first pipeline.
          </p>
        </motion.div>
        <ArrowRight className="mx-auto hidden size-5 text-slate-500 lg:block" />
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[26px] border border-emerald-400/20 bg-emerald-400/8 p-6"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Output</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Task-Specific Capsule</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Paste-ready context for Cursor, Claude, Copilot, Codex, Gemini, or a local agent.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
