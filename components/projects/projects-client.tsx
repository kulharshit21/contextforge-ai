"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectCardRecord = {
  id: string;
  name: string;
  description: string;
  stack: string[];
  lastUpdated: string;
  memoryHealthScore: number;
  capsulesCount: number;
  editable: boolean;
};

type CreateProjectValues = {
  name: string;
  description: string;
  repoUrl: string;
  localPathHint: string;
};

export function ProjectsClient({ projects }: { projects: ProjectCardRecord[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm<CreateProjectValues>({
    defaultValues: {
      name: "",
      description: "",
      repoUrl: "",
      localPathHint: "",
    },
  });

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      `${project.name} ${project.description} ${project.stack.join(" ")}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [projects, query]);

  async function onSubmit(values: CreateProjectValues) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Project creation failed.");
      }

      toast.success("Project created.");
      reset();
      setOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project creation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, stacks, or memory health..."
            className="pl-10"
          />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a local project workspace</DialogTitle>
              <DialogDescription>
                ContextForge will initialize an editable `.contextforge/` memory workspace under `workspaces/`.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input id="name" {...register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repoUrl">Repo URL</Label>
                <Input id="repoUrl" {...register("repoUrl")} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localPathHint">Local path hint</Label>
                <Input
                  id="localPathHint"
                  {...register("localPathHint")}
                  placeholder="Optional, used for local repo scans"
                />
              </div>
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Workspace"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredProjects.length ? (
        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No projects matched"
          description="Try a different search term, or create a fresh local workspace for ContextForge memory files."
        />
      )}
    </div>
  );
}
