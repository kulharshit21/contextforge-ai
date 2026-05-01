"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowRightCircle,
  Database,
  FileJson,
  RefreshCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { CapsuleViewer } from "@/components/capsules/capsule-viewer";
import { CodeBlockWithCopy } from "@/components/dashboard/code-block-with-copy";
import { DriftIssueCard } from "@/components/dashboard/drift-issue-card";
import { MemoryHealthScore } from "@/components/dashboard/memory-health-score";
import { MarkdownPreview } from "@/components/dashboard/markdown-preview";
import { ExportCard } from "@/components/exports/export-card";
import { MemoryFileCard } from "@/components/memory/memory-file-card";
import { ProviderBadge } from "@/components/providers/provider-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Capsule, DriftIssue, MemoryFile, ProjectSettings, RepoScan } from "@/lib/memory/schemas";

type ProjectDetailProps = {
  project: {
    id: string;
    name: string;
    description: string;
    stack: string[];
    editable: boolean;
    localPathHint: string;
    settings: ProjectSettings;
  };
  memoryFiles: Array<
    MemoryFile & {
      rawContent: string;
    }
  >;
  capsules: Array<{
    id: string;
    fileName: string;
    task: string;
    createdAt: string;
    markdown: string;
    estimatedRawTokens: number;
    estimatedCapsuleTokens: number;
    savedPercent: number;
  }>;
  exportsList: Array<{
    id: string;
    fileName: string;
    content: string;
  }>;
  driftIssues: DriftIssue[];
  repoScan: RepoScan;
  overview: {
    summary: string;
    recentDecisions: MemoryFile["items"];
    knownBugs: MemoryFile["items"];
    pendingTasks: MemoryFile["items"];
  };
  memoryHealthScore: number;
  providerWarning?: string;
};

type SettingsValues = ProjectSettings & {
  name: string;
  description: string;
};

export function ProjectDetailClient({
  project,
  memoryFiles,
  capsules,
  exportsList,
  driftIssues,
  repoScan,
  overview,
  memoryHealthScore,
  providerWarning,
}: ProjectDetailProps) {
  const [selectedFile, setSelectedFile] = useState<(typeof memoryFiles)[number] | null>(null);
  const [editingRaw, setEditingRaw] = useState("");
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [task, setTask] = useState("Add pharmacy invoice feature");
  const [generatedCapsule, setGeneratedCapsule] = useState<Capsule | null>(
    capsules[0]
      ? {
          goal: capsules[0].task,
          summary: "Previously generated capsule",
          relevant_context: [],
          files_likely_needed: [],
          files_to_avoid: [],
          previous_errors_to_remember: [],
          commands_to_run: [],
          agent_prompt: capsules[0].markdown,
          estimated_raw_tokens: capsules[0].estimatedRawTokens,
          estimated_capsule_tokens: capsules[0].estimatedCapsuleTokens,
          saved_percent: capsules[0].savedPercent,
        }
      : null,
  );
  const [generatedMarkdown, setGeneratedMarkdown] = useState(capsules[0]?.markdown ?? "");
  const [isGeneratingCapsule, setIsGeneratingCapsule] = useState(false);
  const [isSavingCapsule, setIsSavingCapsule] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMode, setChatMode] = useState("Full extraction");
  const [extractedChat, setExtractedChat] = useState<Record<string, unknown> | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPersistingExtraction, setIsPersistingExtraction] = useState(false);
  const [uploadedRepoScan, setUploadedRepoScan] = useState<string>("");
  const [repoScanPreview, setRepoScanPreview] = useState(JSON.stringify(repoScan, null, 2));
  const [isUploadingScan, setIsUploadingScan] = useState(false);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [currentDriftIssues, setCurrentDriftIssues] = useState(driftIssues);
  const [isRunningDrift, setIsRunningDrift] = useState(false);
  const [generatedExports, setGeneratedExports] = useState(exportsList);
  const [isGeneratingExports, setIsGeneratingExports] = useState(false);

  const settingsForm = useForm<SettingsValues>({
    defaultValues: {
      name: project.name,
      description: project.description,
      aiProvider: project.settings.aiProvider,
      privacyMode: project.settings.privacyMode,
      geminiApiKey: project.settings.geminiApiKey,
      ollamaUrl: project.settings.ollamaUrl,
      maxTokenBudget: project.settings.maxTokenBudget,
      memoryUpdateBehavior: project.settings.memoryUpdateBehavior,
    },
  });

  const mostRecentCapsule = useMemo(() => capsules[0] ?? null, [capsules]);

  function openEditor(file: (typeof memoryFiles)[number]) {
    setSelectedFile(file);
    setEditingRaw(file.rawContent);
  }

  async function saveFileEdits() {
    if (!selectedFile) {
      return;
    }

    setIsSavingFile(true);
    try {
      const response = await fetch("/api/memory", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          fileKey: selectedFile.file_key,
          content: editingRaw,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save memory file.");
      }

      toast.success("Memory file updated.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save memory file.");
    } finally {
      setIsSavingFile(false);
    }
  }

  async function handleGenerateCapsule() {
    setIsGeneratingCapsule(true);
    try {
      const response = await fetch("/api/ai/capsule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          task,
        }),
      });

      if (!response.ok) {
        throw new Error("Capsule generation failed.");
      }

      const payload = await response.json();
      setGeneratedCapsule(payload.capsule);
      setGeneratedMarkdown(payload.markdown);
      toast.success("Capsule generated.");
      if (payload.providerWarning) {
        toast.message(payload.providerWarning);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Capsule generation failed.");
    } finally {
      setIsGeneratingCapsule(false);
    }
  }

  async function handleSaveCapsule() {
    if (!generatedCapsule) {
      return;
    }

    setIsSavingCapsule(true);
    try {
      const response = await fetch("/api/ai/capsule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          task,
          persist: true,
          existingCapsule: generatedCapsule,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save capsule.");
      }

      toast.success("Capsule saved.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save capsule.");
    } finally {
      setIsSavingCapsule(false);
    }
  }

  async function handleExtractChat(persist = false) {
    setIsExtracting(!persist);
    setIsPersistingExtraction(persist);

    try {
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          text: chatText,
          mode: chatMode,
          persist,
          extracted: persist ? extractedChat : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Chat extraction failed.");
      }

      const payload = await response.json();
      if (persist) {
        toast.success("Extracted memory saved.");
        window.location.reload();
      } else {
        setExtractedChat(payload.extracted ?? payload);
        toast.success("Extraction preview ready.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat extraction failed.");
    } finally {
      setIsExtracting(false);
      setIsPersistingExtraction(false);
    }
  }

  async function handleRepoJsonUpload() {
    setIsUploadingScan(true);
    try {
      const parsed = JSON.parse(uploadedRepoScan || repoScanPreview);
      const response = await fetch("/api/projects/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          scanJson: parsed,
        }),
      });

      if (!response.ok) {
        throw new Error("Repo scan upload failed.");
      }

      toast.success("Repo scan JSON saved.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Repo scan upload failed.");
    } finally {
      setIsUploadingScan(false);
    }
  }

  async function handleRunLocalScan() {
    setIsRunningScan(true);
    try {
      const response = await fetch("/api/projects/scan", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Local scan failed.");
      }

      toast.success("Project scan refreshed.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Local scan failed.");
    } finally {
      setIsRunningScan(false);
    }
  }

  async function handleRunDrift() {
    setIsRunningDrift(true);
    try {
      const response = await fetch("/api/ai/drift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Drift check failed.");
      }

      const payload = await response.json();
      setCurrentDriftIssues(payload.issues);
      toast.success("Drift analysis refreshed.");
      if (payload.providerWarning) {
        toast.message(payload.providerWarning);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drift check failed.");
    } finally {
      setIsRunningDrift(false);
    }
  }

  async function handleGenerateExports() {
    setIsGeneratingExports(true);
    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          all: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Export generation failed.");
      }

      const payload = await response.json();
      setGeneratedExports(
        Object.entries<string>(payload.exports).map(([fileName, content]) => ({
          id: fileName,
          fileName,
          content,
        })),
      );
      toast.success("Exports generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export generation failed.");
    } finally {
      setIsGeneratingExports(false);
    }
  }

  async function handleSaveSettings(values: SettingsValues) {
    try {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          ...values,
        }),
      });

      if (!response.ok) {
        throw new Error("Settings update failed.");
      }

      toast.success("Project settings updated.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings update failed.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 px-6 py-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <MemoryHealthScore score={memoryHealthScore} />
              <ProviderBadge provider={project.settings.aiProvider} />
              <Badge variant={project.settings.privacyMode === "local" ? "emerald" : "violet"}>
                {project.settings.privacyMode.toUpperCase()}
              </Badge>
              <Badge variant={project.editable ? "default" : "warning"}>
                {project.editable ? "Editable workspace" : "Demo project"}
              </Badge>
            </div>
            <p className="max-w-4xl text-sm leading-7 text-slate-300">{overview.summary}</p>
            {providerWarning ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{providerWarning}</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Metric title="Memory files" value={String(memoryFiles.length)} />
            <Metric title="Saved capsules" value={String(capsules.length)} />
            <Metric title="Repo scripts" value={String(Object.keys(repoScan.scripts).length)} />
            <Metric title="Drift warnings" value={String(currentDriftIssues.length)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="memory">Memory Files</TabsTrigger>
          <TabsTrigger value="capsules">Capsules</TabsTrigger>
          <TabsTrigger value="chat">Chat Ingest</TabsTrigger>
          <TabsTrigger value="scan">Repo Scan</TabsTrigger>
          <TabsTrigger value="drift">Drift Check</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-5 xl:grid-cols-3">
            <InfoColumn
              title="Recent Decisions"
              items={overview.recentDecisions.map((item) => ({
                title: item.title,
                content: item.content,
              }))}
            />
            <InfoColumn
              title="Known Bugs"
              items={overview.knownBugs.map((item) => ({
                title: item.title,
                content: item.content,
              }))}
            />
            <InfoColumn
              title="Pending Tasks"
              items={overview.pendingTasks.map((item) => ({
                title: item.title,
                content: item.content,
              }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="memory">
          <div className="grid gap-5 xl:grid-cols-2">
            {memoryFiles.map((file) => (
              <MemoryFileCard
                key={file.file_key}
                title={file.title}
                updatedAt={file.updated_at}
                preview={file.summary}
                rawContent={file.rawContent}
                editable={project.editable}
                onEdit={() => openEditor(file)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="capsules">
          <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Generate a context capsule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task">What are you trying to do?</Label>
                  <Textarea
                    id="task"
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    className="min-h-[160px]"
                  />
                </div>
                <Button className="w-full" onClick={handleGenerateCapsule} disabled={isGeneratingCapsule}>
                  <Sparkles className="size-4" />
                  {isGeneratingCapsule ? "Generating..." : "Generate Capsule"}
                </Button>
                {mostRecentCapsule ? (
                  <div className="rounded-[22px] border border-white/10 bg-slate-950/75 p-4 text-sm text-slate-300">
                    <p className="font-medium text-white">Latest saved capsule</p>
                    <p className="mt-2">{mostRecentCapsule.task}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {generatedCapsule ? (
              <CapsuleViewer
                capsule={generatedCapsule}
                markdown={generatedMarkdown}
                onSave={handleSaveCapsule}
                isSaving={isSavingCapsule}
              />
            ) : (
              <EmptyState
                title="No capsule generated yet"
                description="Describe the task, generate a capsule, and ContextForge will compress the relevant memory into a paste-ready prompt."
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="chat">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_minmax(0,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Ingest AI chat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chatText">Paste chat text or markdown</Label>
                  <Textarea
                    id="chatText"
                    value={chatText}
                    onChange={(event) => setChatText(event.target.value)}
                    className="min-h-[320px]"
                    placeholder="Paste Cursor, Claude, Codex, or ChatGPT output here..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chatMode">Extraction mode</Label>
                  <select
                    id="chatMode"
                    value={chatMode}
                    onChange={(event) => setChatMode(event.target.value)}
                    className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                  >
                    <option>Full extraction</option>
                    <option>Bugs only</option>
                    <option>Decisions only</option>
                    <option>Features only</option>
                    <option>Setup/env only</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => handleExtractChat(false)} disabled={isExtracting}>
                    {isExtracting ? "Extracting..." : "Run Extraction"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleExtractChat(true)}
                    disabled={!extractedChat || isPersistingExtraction}
                  >
                    {isPersistingExtraction ? "Saving..." : "Save Accepted Items"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extraction preview</CardTitle>
              </CardHeader>
              <CardContent>
                {extractedChat ? (
                  <pre className="max-h-[540px] overflow-auto rounded-[22px] border border-white/10 bg-slate-950/85 p-4 text-sm leading-6 text-cyan-100">
                    {JSON.stringify(extractedChat, null, 2)}
                  </pre>
                ) : (
                  <EmptyState
                    title="No extracted memory yet"
                    description="Run extraction first, inspect the categorized output, and then persist it into the right memory files."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scan">
          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>CLI-first repo scan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlockWithCopy code="npx contextforge scan" />
                <p className="text-sm leading-6 text-slate-400">
                  Browser sessions cannot scan arbitrary local repos directly, so ContextForge supports a CLI-first scan flow and optional server-side scans from a local path hint.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={handleRunLocalScan} disabled={isRunningScan || !project.editable}>
                    <RefreshCcw className="size-4" />
                    {isRunningScan ? "Scanning..." : "Run Local Path Scan"}
                  </Button>
                  <Badge variant="muted">
                    {project.localPathHint ? `Path hint: ${project.localPathHint}` : "No local path hint"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload repo summary JSON</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  <Upload className="size-4 text-cyan-200" />
                  Paste or upload the `.contextforge/repo-scan.json` generated by the CLI.
                </div>
                <Textarea
                  value={uploadedRepoScan || repoScanPreview}
                  onChange={(event) => {
                    setUploadedRepoScan(event.target.value);
                    setRepoScanPreview(event.target.value);
                  }}
                  className="min-h-[360px] font-mono text-xs"
                />
                <Button onClick={handleRepoJsonUpload} disabled={isUploadingScan || !project.editable}>
                  <Database className="size-4" />
                  {isUploadingScan ? "Saving..." : "Save Repo Summary"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="drift">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">Memory vs repo mismatch report</h3>
                <p className="text-sm text-slate-400">
                  Catch stale commands, deleted files, outdated framework assumptions, and unsafe memory drift before the next AI session does.
                </p>
              </div>
              <Button variant="secondary" onClick={handleRunDrift} disabled={isRunningDrift}>
                <ArrowRightCircle className="size-4" />
                {isRunningDrift ? "Checking..." : "Run Drift Check"}
              </Button>
            </div>

            {currentDriftIssues.length ? (
              <div className="grid gap-4">
                {currentDriftIssues.map((issue) => (
                  <DriftIssueCard key={`${issue.title}-${issue.severity}`} issue={issue} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No drift warnings right now"
                description="Run another repo scan after major refactors so this view stays meaningful."
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="exports">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">Agent exports</h3>
                <p className="text-sm text-slate-400">
                  Generate concise memory instructions for AGENTS.md, Claude, Gemini, Cursor, Copilot, and the future MCP manifest.
                </p>
              </div>
              <Button onClick={handleGenerateExports} disabled={isGeneratingExports}>
                <FileJson className="size-4" />
                {isGeneratingExports ? "Generating..." : "Generate Exports"}
              </Button>
            </div>

            {generatedExports.length ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {generatedExports.map((item) => (
                  <ExportCard key={item.id} fileName={item.fileName} content={item.content} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No exports yet"
                description="Generate the export bundle to create agent-ready files and a structured memory JSON snapshot."
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Project settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={settingsForm.handleSubmit(handleSaveSettings)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">Project name</Label>
                    <Input id="settings-name" {...settingsForm.register("name", { required: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-provider">AI provider</Label>
                    <select
                      id="settings-provider"
                      {...settingsForm.register("aiProvider")}
                      className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                    >
                      <option value="mock">Mock</option>
                      <option value="ollama">Ollama</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-description">Description</Label>
                  <Textarea id="settings-description" {...settingsForm.register("description", { required: true })} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="settings-privacy">Privacy mode</Label>
                    <select
                      id="settings-privacy"
                      {...settingsForm.register("privacyMode")}
                      className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                    >
                      <option value="local">Local</option>
                      <option value="cloud">Cloud</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-budget">Max token budget</Label>
                    <Input
                      id="settings-budget"
                      type="number"
                      {...settingsForm.register("maxTokenBudget", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="settings-gemini">Gemini API key</Label>
                    <Input id="settings-gemini" {...settingsForm.register("geminiApiKey")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-ollama">Ollama URL</Label>
                    <Input id="settings-ollama" {...settingsForm.register("ollamaUrl")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-behavior">Memory update behavior</Label>
                  <select
                    id="settings-behavior"
                    {...settingsForm.register("memoryUpdateBehavior")}
                    className="flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white"
                  >
                    <option value="preview_first">Preview first</option>
                    <option value="append_with_source">Append with source markers</option>
                    <option value="manual_only">Manual only</option>
                  </select>
                </div>

                <Button type="submit" className="w-full sm:w-fit">
                  Save Settings
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedFile)} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="w-[min(96vw,1100px)]">
          <DialogHeader>
            <DialogTitle>{selectedFile?.title}</DialogTitle>
            <DialogDescription>
              Edit the structured markdown directly. ContextForge validates the frontmatter before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 xl:grid-cols-[0.95fr_minmax(0,1.05fr)]">
            <Textarea
              value={editingRaw}
              onChange={(event) => setEditingRaw(event.target.value)}
              className="min-h-[520px] font-mono text-xs"
            />
            <div className="min-h-[520px] overflow-auto rounded-[24px] border border-white/10 bg-slate-950/80 p-5">
              <MarkdownPreview content={editingRaw} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSelectedFile(null)}>
              Close
            </Button>
            <Button onClick={saveFileEdits} disabled={isSavingFile}>
              {isSavingFile ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; content: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.content}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">No items yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
