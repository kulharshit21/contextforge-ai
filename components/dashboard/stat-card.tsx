"use client";

import { motion } from "framer-motion";
import { FileStack, FolderKanban, Sparkles, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

const statIcons = {
  projects: FolderKanban,
  memory: FileStack,
  capsules: Sparkles,
  tokens: Wallet,
} as const;

export type StatCardIcon = keyof typeof statIcons;

export function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: StatCardIcon;
}) {
  const Icon = statIcons[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="flex items-start justify-between gap-4 px-6 py-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{title}</p>
            <p className="text-3xl font-semibold text-white">{value}</p>
            <p className="text-sm text-slate-400">{helper}</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-3 text-cyan-200">
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
