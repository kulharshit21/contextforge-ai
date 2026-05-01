import Link from "next/link";
import { ArrowUpRight, FolderGit2 } from "lucide-react";

import { MemoryHealthScore } from "@/components/dashboard/memory-health-score";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { relativeDate } from "@/lib/utils/date";

export function ProjectCard({
  project,
}: {
  project: {
    id: string;
    name: string;
    description: string;
    stack: string[];
    lastUpdated: string;
    memoryHealthScore: number;
    capsulesCount: number;
    editable: boolean;
  };
}) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group h-full transition hover:-translate-y-1 hover:border-cyan-400/25">
        <CardContent className="flex h-full flex-col gap-5 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-3 text-cyan-200">
                  <FolderGit2 className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{project.name}</h3>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    Updated {relativeDate(project.lastUpdated)}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-400">{project.description}</p>
            </div>
            <ArrowUpRight className="size-4 text-slate-500 transition group-hover:text-cyan-200" />
          </div>
          <div className="flex flex-wrap gap-2">
            {project.stack.map((item) => (
              <Badge key={item} variant="muted">
                {item}
              </Badge>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between text-sm text-slate-400">
            <div className="space-y-1">
              <p>{project.capsulesCount} capsules</p>
              <p>{project.editable ? "Editable workspace" : "Demo project"}</p>
            </div>
            <MemoryHealthScore score={project.memoryHealthScore} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
