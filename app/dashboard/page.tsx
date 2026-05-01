import Link from "next/link";
import { ArrowRightCircle, Radar } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats, getProjectSnapshot } from "@/lib/server/projects";
import { isVercel } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const hostedDemo = isVercel();
  const recentProjectIds = stats.recentProjects.map((project) => project.id);
  const snapshots = await Promise.all(
    recentProjectIds.map((projectId) => getProjectSnapshot(projectId)),
  );
  const driftWarnings = snapshots.flatMap((snapshot) => snapshot?.driftIssues.slice(0, 1) ?? []);

  return (
    <AppShell
      title="Dashboard"
      description="See memory health, recent capsules, token savings, and quick actions across your local-first AI workspaces."
    >
      <div className="space-y-6">
        {hostedDemo ? (
          <Card className="border-cyan-400/20 bg-cyan-400/10">
            <CardContent className="px-6 py-4 text-sm leading-6 text-cyan-50">
              This Vercel deployment is running in hosted demo mode. ContextForge uses seeded sample memory here and
              keeps local workspace writes disabled so the dashboard stays safe in production.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Projects"
            value={String(stats.totalProjects)}
            helper="Local workspaces plus demo projects"
            icon="projects"
          />
          <StatCard
            title="Memory Files"
            value={String(stats.totalMemoryFiles)}
            helper="Structured markdown memory documents"
            icon="memory"
          />
          <StatCard
            title="Capsules"
            value={String(stats.totalCapsules)}
            helper="Generated context capsules"
            icon="capsules"
          />
          <StatCard
            title="Estimated Tokens Saved"
            value={stats.estimatedTokensSaved.toLocaleString()}
            helper="Approximate reduction from compressed context"
            icon="tokens"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_minmax(0,0.9fr)]">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div className="space-y-2">
                <CardTitle>Recent Projects</CardTitle>
                <p className="text-sm text-slate-400">Jump back into a workspace without re-explaining the repo.</p>
              </div>
              <Button asChild variant="secondary">
                <Link href="/projects">
                  View all
                  <ArrowRightCircle className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-5 xl:grid-cols-2">
              {stats.recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QuickAction href="/projects" label="Create Project" />
              <QuickAction href="/projects" label="Ingest Chat" />
              <QuickAction href="/projects" label="Generate Capsule" />
              <QuickAction href="/projects" label="Export Agent Files" />
              <QuickAction href="/projects" label="Run Drift Check" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Recent Capsules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.recentCapsules.length ? (
                stats.recentCapsules.map((capsule) => (
                  <div
                    key={`${capsule.fileName}-${capsule.task}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
                  >
                    <p className="font-medium text-white">{capsule.task}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {capsule.estimatedRawTokens} raw tokens → {capsule.estimatedCapsuleTokens} capsule tokens
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No capsules have been saved yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div className="space-y-2">
                <CardTitle>Drift Warnings</CardTitle>
                <p className="text-sm text-slate-400">Current open mismatches between memory and repo facts.</p>
              </div>
              <Radar className="size-5 text-cyan-200" />
            </CardHeader>
            <CardContent className="space-y-3">
              {driftWarnings.length ? (
                driftWarnings.map((issue) => (
                  <div
                    key={`${issue.title}-${issue.severity}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
                  >
                    <p className="font-medium text-white">{issue.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{issue.suggested_fix}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No drift warnings surfaced yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:text-white"
    >
      <span>{label}</span>
      <ArrowRightCircle className="size-4 text-cyan-200" />
    </Link>
  );
}
