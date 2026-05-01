import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { renderMemoryFile } from "@/lib/memory/markdown";
import { getProjectSnapshot } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const snapshot = await getProjectSnapshot(id);

  if (!snapshot) {
    notFound();
  }

  const memoryFiles = snapshot.memoryFiles.map((file) => ({
    ...file,
    rawContent: renderMemoryFile(file),
  }));

  return (
    <AppShell
      title={snapshot.project.name}
      description={snapshot.project.description}
    >
      <ProjectDetailClient
        project={{
          id: snapshot.project.id,
          name: snapshot.project.name,
          description: snapshot.project.description,
          stack: snapshot.project.stack,
          editable: snapshot.project.editable,
          localPathHint: snapshot.project.localPathHint,
          settings: snapshot.project.settings,
        }}
        memoryFiles={memoryFiles}
        capsules={snapshot.capsules}
        exportsList={snapshot.exports}
        driftIssues={snapshot.driftIssues}
        repoScan={snapshot.repoScan}
        overview={snapshot.overview}
        memoryHealthScore={snapshot.memoryHealthScore}
        providerWarning={snapshot.providerWarning}
      />
    </AppShell>
  );
}
