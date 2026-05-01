import path from "node:path";

import { analyzeMemoryDrift, extractMemoryFromChat, generateCapsuleFromMemory } from "@/lib/ai";
import {
  DEMO_PROJECT_ID,
  demoCapsule,
  demoDriftIssues,
  demoExports,
  demoMemoryFiles,
  demoProjectHealthScore,
  demoProjectRecord,
  demoRepoScan,
} from "@/lib/demo/data";
import { createDeterministicCapsule, renderCapsuleMarkdown } from "@/lib/memory/capsule";
import { calculateMemoryHealthScore } from "@/lib/memory/drift";
import {
  appendMemoryItem,
  getConfigPath,
  initWorkspace,
  listSavedCapsules,
  listSavedExports,
  loadMemoryFile,
  loadMemoryFiles,
  mergeExtractedMemory,
  readRepoScan,
  saveCapsule,
  saveExport,
  saveMemoryFileRaw,
  writeRepoScan,
} from "@/lib/memory/engine";
import { generateExports } from "@/lib/memory/export";
import {
  ProjectRecordSchema,
  type Capsule,
  type MemoryFileKey,
  type ProjectRecord,
  type ProjectSettings,
} from "@/lib/memory/schemas";
import { scanRepository } from "@/lib/repo/scanner";
import { isoNow } from "@/lib/utils/date";
import { isDemoMode } from "@/lib/utils/env";
import { ensureDir, pathExists, readJsonIfExists, writeJsonPretty } from "@/lib/utils/fs";
import { slugify } from "@/lib/utils/slug";

const WORKSPACE_INDEX_PATH = path.join(process.cwd(), "workspaces", "projects.json");
const STARTER_PROJECT_ID = "starter-local";
const STARTER_WORKSPACE_ROOT = path.join(
  process.cwd(),
  "workspaces",
  "contextforge-starter",
);

type StoredProjectIndex = {
  projects: ProjectRecord[];
};

const STARTER_PROJECT_RECORD: ProjectRecord = {
  id: STARTER_PROJECT_ID,
  name: "ContextForge Workspace",
  description:
    "Editable local-first starter workspace for testing memory files, capsules, and exports without any cloud dependencies.",
  repoUrl: "https://github.com/kulharshit21/contextforge-ai",
  localPathHint: process.cwd(),
  workspaceRoot: STARTER_WORKSPACE_ROOT,
  stack: ["Next.js", "TypeScript", "Tailwind CSS", "Supabase", "CLI"],
  editable: true,
  createdAt: isoNow(),
  updatedAt: isoNow(),
  settings: {
    aiProvider: "mock",
    privacyMode: "local",
    geminiApiKey: "",
    ollamaUrl: "http://localhost:11434",
    maxTokenBudget: 6000,
    memoryUpdateBehavior: "preview_first",
  },
};

async function ensureProjectIndex() {
  await ensureDir(path.dirname(WORKSPACE_INDEX_PATH));

  if (!(await pathExists(WORKSPACE_INDEX_PATH))) {
    await writeJsonPretty(WORKSPACE_INDEX_PATH, {
      projects: [STARTER_PROJECT_RECORD],
    } satisfies StoredProjectIndex);
  }

  const stored =
    (await readJsonIfExists<StoredProjectIndex>(WORKSPACE_INDEX_PATH)) ?? {
      projects: [],
    };

  const hasStarter = stored.projects.some((project) => project.id === STARTER_PROJECT_ID);
  if (!hasStarter) {
    stored.projects.unshift(STARTER_PROJECT_RECORD);
    await writeJsonPretty(WORKSPACE_INDEX_PATH, stored);
  }

  return stored.projects.map((project) => ProjectRecordSchema.parse(project));
}

async function writeProjectIndex(projects: ProjectRecord[]) {
  await writeJsonPretty(WORKSPACE_INDEX_PATH, { projects });
}

async function ensureStarterWorkspace() {
  await initWorkspace(STARTER_WORKSPACE_ROOT, "ContextForge Workspace");
  const projectState = await loadMemoryFile(STARTER_WORKSPACE_ROOT, "PROJECT_STATE");
  if (projectState.items.length > 0) {
    return;
  }

  await appendMemoryItem(STARTER_WORKSPACE_ROOT, "PROJECT_STATE", {
    type: "project_state",
    title: "ContextForge foundation is scaffolded",
    content:
      "The repository now contains the Next.js app shell, the CLI entrypoint, memory engine utilities, and the provider abstraction needed for a local-first MVP.",
    source: "starter-seed",
    confidence: 0.95,
    related_files: ["app/page.tsx", "cli/index.ts", "lib/memory/engine.ts"],
    tags: ["starter", "mvp"],
  });

  await appendMemoryItem(STARTER_WORKSPACE_ROOT, "DECISIONS", {
    type: "decisions",
    title: "Local markdown remains the source of truth",
    content:
      "Supabase is optional sync and dashboard persistence, but the durable source of truth is the markdown memory under .contextforge/.",
    source: "starter-seed",
    confidence: 0.94,
    related_files: [".contextforge/PROJECT_STATE.md", "lib/memory/engine.ts"],
    tags: ["memory", "local-first"],
  });

  await appendMemoryItem(STARTER_WORKSPACE_ROOT, "BUGS_AND_FIXES", {
    type: "bugs_and_fixes",
    title: "Avoid cloud calls in local privacy mode",
    content:
      "When privacy mode is local, Gemini must not receive repo context. The app should prefer Ollama or the mock provider and surface a clear warning.",
    source: "starter-seed",
    confidence: 0.97,
    related_files: ["lib/ai/index.ts", "app/api/ai/capsule/route.ts"],
    tags: ["privacy", "provider"],
  });

  await appendMemoryItem(STARTER_WORKSPACE_ROOT, "ENV_AND_SETUP", {
    type: "env_and_setup",
    title: "Primary local workflow",
    content:
      "Use npm install, npm run dev, npm run lint, and npm run typecheck during development. Supabase and Gemini keys are optional.",
    source: "starter-seed",
    confidence: 0.96,
    related_files: ["package.json", ".env.example"],
    tags: ["setup"],
  });

  await appendMemoryItem(STARTER_WORKSPACE_ROOT, "CURRENT_TASKS", {
    type: "current_tasks",
    title: "Complete dashboard flows",
    content:
      "Landing page, dashboard, project detail tabs, chat ingest, capsule generation, exports, and drift checks need to feel cohesive and production-ready.",
    source: "starter-seed",
    confidence: 0.89,
    related_files: ["app/dashboard/page.tsx", "app/projects/[id]/page.tsx"],
    tags: ["ui", "active"],
  });

  try {
    const scan = await scanRepository(process.cwd());
    await writeRepoScan(STARTER_WORKSPACE_ROOT, {
      ...scan,
      workspace_root: process.cwd(),
    });
  } catch {
    // The starter workspace still works even if scanning fails during first boot.
  }
}

async function getStoredProjects() {
  const projects = await ensureProjectIndex();
  await ensureStarterWorkspace();
  return projects;
}

async function findProjectRecord(projectId: string) {
  const projects = await getStoredProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

function buildProjectOverview(memoryFiles: Awaited<ReturnType<typeof loadMemoryFiles>>) {
  const currentState = memoryFiles.find((file) => file.file_key === "PROJECT_STATE");
  const decisions = memoryFiles.find((file) => file.file_key === "DECISIONS");
  const bugs = memoryFiles.find((file) => file.file_key === "BUGS_AND_FIXES");
  const tasks = memoryFiles.find((file) => file.file_key === "CURRENT_TASKS");

  return {
    summary: currentState?.summary ?? "",
    recentDecisions: decisions?.items.slice(0, 4) ?? [],
    knownBugs: bugs?.items.slice(0, 4) ?? [],
    pendingTasks: tasks?.items.slice(0, 4) ?? [],
  };
}

export async function listProjects() {
  const storedProjects = await getStoredProjects();
  const projectCards = await Promise.all(
    storedProjects.map(async (project) => {
      const memoryFiles = await loadMemoryFiles(project.workspaceRoot);
      const repoScan = await readRepoScan(project.workspaceRoot);
      const driftIssues = calculateMemoryHealthScore(
        (await analyzeMemoryDrift(project.workspaceRoot, memoryFiles, repoScan, project.settings.aiProvider))
          .issues,
      );
      const capsules = await listSavedCapsules(project.workspaceRoot);

      return {
        ...project,
        memoryHealthScore: driftIssues,
        capsulesCount: capsules.length,
        lastUpdated: memoryFiles
          .map((file) => file.updated_at)
          .sort()
          .at(-1) ?? project.updatedAt,
      };
    }),
  );

  if (!isDemoMode()) {
    return projectCards;
  }

  return [
    {
      ...demoProjectRecord,
      memoryHealthScore: demoProjectHealthScore,
      capsulesCount: 1,
      lastUpdated: demoProjectRecord.updatedAt,
    },
    ...projectCards,
  ];
}

export async function getProjectSnapshot(projectId: string) {
  if (projectId === DEMO_PROJECT_ID && isDemoMode()) {
    return {
      project: demoProjectRecord,
      memoryFiles: demoMemoryFiles,
      repoScan: demoRepoScan,
      driftIssues: demoDriftIssues,
      capsules: [
        {
          id: "demo-capsule",
          fileName: "demo-capsule.md",
          task: "Add pharmacy invoice feature",
          createdAt: demoProjectRecord.updatedAt,
          markdown: renderCapsuleMarkdown("Add pharmacy invoice feature", demoCapsule),
          estimatedRawTokens: demoCapsule.estimated_raw_tokens,
          estimatedCapsuleTokens: demoCapsule.estimated_capsule_tokens,
          savedPercent: demoCapsule.saved_percent,
        },
      ],
      exports: Object.entries(demoExports).map(([fileName, content]) => ({
        id: fileName,
        fileName,
        content,
      })),
      overview: {
        summary: demoMemoryFiles.find((file) => file.file_key === "PROJECT_STATE")?.summary ?? "",
        recentDecisions: demoMemoryFiles.find((file) => file.file_key === "DECISIONS")?.items ?? [],
        knownBugs: demoMemoryFiles.find((file) => file.file_key === "BUGS_AND_FIXES")?.items ?? [],
        pendingTasks: demoMemoryFiles.find((file) => file.file_key === "CURRENT_TASKS")?.items ?? [],
      },
      memoryHealthScore: demoProjectHealthScore,
    };
  }

  const project = await findProjectRecord(projectId);
  if (!project) {
    return null;
  }

  const memoryFiles = await loadMemoryFiles(project.workspaceRoot);
  const repoScan = await readRepoScan(project.workspaceRoot);
  const driftAnalysis = await analyzeMemoryDrift(
    project.workspaceRoot,
    memoryFiles,
    repoScan,
    project.settings.aiProvider,
  );
  const capsules = await listSavedCapsules(project.workspaceRoot);
  const exportsList = await listSavedExports(project.workspaceRoot);
  const overview = buildProjectOverview(memoryFiles);
  const memoryHealthScore = calculateMemoryHealthScore(driftAnalysis.issues);

  return {
    project,
    memoryFiles,
    repoScan,
    driftIssues: driftAnalysis.issues,
    capsules,
    exports: exportsList,
    overview,
    memoryHealthScore,
    providerWarning: driftAnalysis.provider.warning,
  };
}

export async function createProject(input: {
  name: string;
  description: string;
  repoUrl?: string;
  localPathHint?: string;
}) {
  const projects = await getStoredProjects();
  const slug = slugify(input.name);
  const workspaceRoot = path.join(process.cwd(), "workspaces", slug);
  await initWorkspace(workspaceRoot, input.name);

  const project: ProjectRecord = {
    id: slug,
    name: input.name,
    description: input.description,
    repoUrl: input.repoUrl ?? "",
    localPathHint: input.localPathHint ?? "",
    workspaceRoot,
    stack: ["Next.js", "TypeScript", "Supabase"],
    editable: true,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    settings: {
      aiProvider: "mock",
      privacyMode: "local",
      geminiApiKey: "",
      ollamaUrl: "http://localhost:11434",
      maxTokenBudget: 6000,
      memoryUpdateBehavior: "preview_first",
    },
  };

  await writeProjectIndex([...projects, project]);
  return project;
}

export async function updateProjectSettings(
  projectId: string,
  settings: Partial<ProjectSettings> & {
    name?: string;
    description?: string;
  },
) {
  const projects = await getStoredProjects();
  const nextProjects = projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    return {
      ...project,
      name: settings.name ?? project.name,
      description: settings.description ?? project.description,
      updatedAt: isoNow(),
      settings: {
        ...project.settings,
        ...settings,
      },
    };
  });

  await writeProjectIndex(nextProjects);
  const updated = nextProjects.find((project) => project.id === projectId) ?? null;

  if (updated) {
    await writeJsonPretty(getConfigPath(updated.workspaceRoot), {
      projectName: updated.name,
      privacyMode: updated.settings.privacyMode,
      provider: updated.settings.aiProvider,
      maxTokenBudget: updated.settings.maxTokenBudget,
      memoryUpdateBehavior: updated.settings.memoryUpdateBehavior,
      ollamaUrl: updated.settings.ollamaUrl,
    });
  }

  return updated;
}

export async function updateProjectMemoryFile(
  projectId: string,
  fileKey: MemoryFileKey,
  rawContent: string,
) {
  const project = await findProjectRecord(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  if (!project.editable) {
    throw new Error("Demo projects are read-only.");
  }

  return saveMemoryFileRaw(project.workspaceRoot, fileKey, rawContent);
}

export async function saveUploadedRepoScan(projectId: string, scanJson: unknown) {
  const project = await findProjectRecord(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  return writeRepoScan(project.workspaceRoot, scanJson);
}

export async function runProjectScan(projectId: string) {
  const project = await findProjectRecord(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const targetRoot = project.localPathHint || process.cwd();
  const scan = await scanRepository(targetRoot);
  return writeRepoScan(project.workspaceRoot, {
    ...scan,
    workspace_root: targetRoot,
  });
}

export async function ingestProjectChat(
  projectId: string,
  payload: {
    text?: string;
    mode?: string;
    persist?: boolean;
    extracted?: unknown;
  },
) {
  const project = await findProjectRecord(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  if (payload.extracted) {
    const parsed = payload.extracted;
    if (payload.persist) {
      await mergeExtractedMemory(project.workspaceRoot, parsed as never, "chat-ingest");
    }
    return parsed;
  }

  const extraction = await extractMemoryFromChat(
    payload.text ?? "",
    payload.mode ?? "Full extraction",
    project.settings.aiProvider,
  );

  if (payload.persist) {
    await mergeExtractedMemory(project.workspaceRoot, extraction.extracted, "chat-ingest");
  }

  return extraction;
}

export async function generateProjectCapsule(
  projectId: string,
  task: string,
  options?: {
    persist?: boolean;
    existingCapsule?: Capsule;
  },
) {
  const snapshot = await getProjectSnapshot(projectId);
  if (!snapshot) {
    throw new Error("Project not found.");
  }

  if ("workspaceRoot" in snapshot.project && snapshot.project.id === DEMO_PROJECT_ID) {
    return {
      capsule: demoCapsule,
      markdown: renderCapsuleMarkdown(task, demoCapsule),
      providerWarning: "Demo mode uses the mock provider and seeded capsule data.",
    };
  }

  const { capsule, provider } = options?.existingCapsule
    ? {
        capsule: options.existingCapsule,
        provider: { warning: undefined },
      }
    : await generateCapsuleFromMemory(
        task,
        snapshot.memoryFiles,
        snapshot.repoScan,
        snapshot.project.settings.aiProvider,
      );

  const markdown = renderCapsuleMarkdown(task, capsule);

  if (options?.persist) {
    await saveCapsule(snapshot.project.workspaceRoot, task, capsule);
  }

  return {
    capsule,
    markdown,
    providerWarning: provider.warning,
  };
}

export async function runProjectDriftCheck(projectId: string) {
  const snapshot = await getProjectSnapshot(projectId);
  if (!snapshot) {
    throw new Error("Project not found.");
  }

  if (snapshot.project.id === DEMO_PROJECT_ID) {
    return {
      issues: demoDriftIssues,
      score: demoProjectHealthScore,
    };
  }

  const analysis = await analyzeMemoryDrift(
    snapshot.project.workspaceRoot,
    snapshot.memoryFiles,
    snapshot.repoScan,
    snapshot.project.settings.aiProvider,
  );
  return {
    issues: analysis.issues,
    score: calculateMemoryHealthScore(analysis.issues),
    providerWarning: analysis.provider.warning,
  };
}

export async function generateProjectExports(projectId: string) {
  const snapshot = await getProjectSnapshot(projectId);
  if (!snapshot) {
    throw new Error("Project not found.");
  }

  const latestCapsule =
    snapshot.capsules[0] && "markdown" in snapshot.capsules[0]
      ? createDeterministicCapsule(
          snapshot.capsules[0].task,
          snapshot.memoryFiles,
          snapshot.repoScan,
        )
      : null;

  const bundle = generateExports({
    projectName: snapshot.project.name,
    projectDescription: snapshot.project.description,
    memoryFiles: snapshot.memoryFiles,
    repoScan: snapshot.repoScan,
    latestCapsule,
    driftIssues: snapshot.driftIssues,
  });

  if (snapshot.project.id !== DEMO_PROJECT_ID) {
    await Promise.all(
      Object.entries(bundle).map(([target, content]) =>
        saveExport(snapshot.project.workspaceRoot, target, content),
      ),
    );
  }

  return bundle;
}

export async function getDashboardStats() {
  const projects = await listProjects();
  const snapshots = await Promise.all(
    projects.map((project) => getProjectSnapshot(project.id)),
  );
  const validSnapshots = snapshots.filter(
    (snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot),
  );

  return {
    totalProjects: projects.length,
    totalMemoryFiles: validSnapshots.reduce(
      (total, snapshot) => total + snapshot.memoryFiles.length,
      0,
    ),
    totalCapsules: validSnapshots.reduce(
      (total, snapshot) => total + snapshot.capsules.length,
      0,
    ),
    estimatedTokensSaved: validSnapshots.reduce(
      (total, snapshot) =>
        total +
        snapshot.capsules.reduce(
          (capsuleTotal, capsule) => capsuleTotal + (capsule.estimatedRawTokens - capsule.estimatedCapsuleTokens),
          0,
        ),
      0,
    ),
    driftWarnings: validSnapshots.reduce(
      (total, snapshot) => total + snapshot.driftIssues.length,
      0,
    ),
    recentProjects: projects.slice(0, 4),
    recentCapsules: validSnapshots.flatMap((snapshot) => snapshot.capsules).slice(0, 5),
  };
}
