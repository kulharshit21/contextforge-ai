import { AppShell } from "@/components/layout/app-shell";
import { ProjectsClient } from "@/components/projects/projects-client";
import { Card, CardContent } from "@/components/ui/card";
import { listProjects } from "@/lib/server/projects";
import { isVercel } from "@/lib/utils/env";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();
  const hostedDemo = isVercel();

  return (
    <AppShell
      title="Projects"
      description="Create local workspaces, browse seeded demo data, and keep structured AI memory consistent across sessions."
    >
      <div className="space-y-6">
        {hostedDemo ? (
          <Card className="border-cyan-400/20 bg-cyan-400/10">
            <CardContent className="px-6 py-4 text-sm leading-6 text-cyan-50">
              This deployment is read-only demo mode on Vercel. Seeded projects render safely here, and editable
              workspaces stay available when you run ContextForge locally.
            </CardContent>
          </Card>
        ) : null}

        <ProjectsClient projects={projects} />
      </div>
    </AppShell>
  );
}
