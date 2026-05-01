import { AppShell } from "@/components/layout/app-shell";
import { ProjectsClient } from "@/components/projects/projects-client";
import { listProjects } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <AppShell
      title="Projects"
      description="Create local workspaces, browse seeded demo data, and keep structured AI memory consistent across sessions."
    >
      <ProjectsClient projects={projects} />
    </AppShell>
  );
}
