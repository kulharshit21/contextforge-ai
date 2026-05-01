import { createDeterministicCapsule } from "@/lib/memory/capsule";
import { calculateMemoryHealthScore } from "@/lib/memory/drift";
import { MEMORY_FILE_DEFINITIONS } from "@/lib/memory/engine";
import type {
  DriftIssue,
  MemoryFile,
  MemoryFileKey,
  MemoryItem,
  ProjectRecord,
  RepoScan,
} from "@/lib/memory/schemas";

const DEMO_DATE = "2026-05-01T10:15:00.000Z";
export const DEMO_PROJECT_ID = "demo-healthcare";

function fileDefinition(key: MemoryFileKey) {
  return MEMORY_FILE_DEFINITIONS.find((definition) => definition.key === key)!;
}

function makeItem(
  type: string,
  title: string,
  content: string,
  related_files: string[] = [],
  tags: string[] = [],
): MemoryItem {
  return {
    id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-demo`,
    type,
    title,
    content,
    source: "demo-seed",
    confidence: 0.92,
    created_at: DEMO_DATE,
    updated_at: DEMO_DATE,
    related_files,
    tags,
  };
}

function makeMemoryFile(
  key: MemoryFileKey,
  summary: string,
  items: MemoryItem[],
): MemoryFile {
  const definition = fileDefinition(key);
  return {
    file_key: key,
    title: definition.title,
    purpose: definition.purpose,
    summary,
    version: 1,
    updated_at: DEMO_DATE,
    items,
  };
}

export const demoProjectRecord: ProjectRecord = {
  id: DEMO_PROJECT_ID,
  name: "CareGrid Demo",
  description:
    "Healthcare collaboration app with patient, doctor, hospital, and pharmacy roles on Supabase.",
  repoUrl: "",
  localPathHint: "",
  workspaceRoot: "demo://caregrid",
  stack: ["Next.js", "TypeScript", "Supabase", "Tailwind CSS"],
  editable: false,
  createdAt: DEMO_DATE,
  updatedAt: DEMO_DATE,
  settings: {
    aiProvider: "mock",
    privacyMode: "local",
    geminiApiKey: "",
    ollamaUrl: "http://localhost:11434",
    maxTokenBudget: 6000,
    memoryUpdateBehavior: "preview_first",
  },
};

export const demoMemoryFiles: MemoryFile[] = [
  makeMemoryFile(
    "PROJECT_STATE",
    "CareGrid has patient, doctor, hospital, and pharmacy role flows backed by Supabase Auth and Postgres. Pharmacy invoice work is partially implemented and needs a durable capsule before the next AI session.",
    [
      makeItem(
        "project_state",
        "Role-based healthcare dashboard is live",
        "The app currently supports patient, doctor, hospital, and pharmacy roles with Supabase Auth and a shared role-aware dashboard shell.",
        ["app/dashboard/page.tsx", "lib/auth/role-router.ts"],
        ["roles", "dashboard"],
      ),
      makeItem(
        "project_state",
        "Pharmacy invoice feature is mid-build",
        "Invoice creation UI exists, but final inventory reconciliation and printable invoice summaries still need to be finished.",
        ["app/pharmacy/invoices/page.tsx", "lib/pharmacy/invoices.ts"],
        ["invoice", "pharmacy"],
      ),
    ],
  ),
  makeMemoryFile(
    "ARCHITECTURE",
    "Frontend uses Next.js App Router, Supabase powers auth and persistence, and role routing is centralized to avoid duplicate guard logic.",
    [
      makeItem(
        "architecture",
        "Supabase handles auth and data",
        "Auth, profiles, inventory, prescriptions, and invoice records all live in Supabase. The frontend should never bypass RLS assumptions with direct admin access.",
        ["supabase/migrations/001_initial_schema.sql", "lib/supabase/server.ts"],
        ["supabase", "auth", "rls"],
      ),
    ],
  ),
  makeMemoryFile(
    "FEATURES",
    "Completed features include login, role dashboards, and prescription workflows. Pharmacy invoicing remains in progress.",
    [
      makeItem(
        "features",
        "Pharmacy invoice flow started",
        "The pharmacy can draft invoice line items from prescribed medicines, but PDF export and stock adjustments are still pending.",
        ["app/pharmacy/invoices/page.tsx"],
        ["feature", "invoice"],
      ),
    ],
  ),
  makeMemoryFile(
    "DECISIONS",
    "Role handling and auth enforcement are centralized. Durable safety decisions should stay visible to every agent.",
    [
      makeItem(
        "decisions",
        "Do not bypass Supabase RLS policies",
        "All reads and writes must respect RLS. If a privileged operation is needed, build an audited server path instead of bypassing policy checks in the client.",
        ["lib/supabase/server.ts", "supabase/migrations/002_rls_policies.sql"],
        ["rls", "security"],
      ),
    ],
  ),
  makeMemoryFile(
    "BUGS_AND_FIXES",
    "Known bugs are documented with causes and repeat-prevention advice.",
    [
      makeItem(
        "bugs_and_fixes",
        "Login redirect loop",
        "A redirect loop happened when role detection ran before the Supabase session finished hydrating. The fix was to gate redirects behind a settled auth state.",
        ["app/login/page.tsx", "components/auth/auth-guard.tsx"],
        ["auth", "bug"],
      ),
    ],
  ),
  makeMemoryFile(
    "FAILED_ATTEMPTS",
    "Failed paths are intentionally preserved so AI sessions do not retry them.",
    [
      makeItem(
        "failed_attempts",
        "Hardcoded role routes",
        "A previous attempt hardcoded per-role route maps in multiple components, which made login redirects brittle and caused route drift. Keep routing centralized.",
        ["lib/auth/role-router.ts", "app/login/page.tsx"],
        ["routing", "lesson"],
      ),
    ],
  ),
  makeMemoryFile(
    "API_CONTRACTS",
    "CareGrid exposes role-aware invoice and prescription APIs over Supabase data.",
    [
      makeItem(
        "api_contracts",
        "Invoice payload includes patient, pharmacy, items, and totals",
        "Invoice records require patient_id, pharmacy_id, line_items[], subtotal, tax_amount, and grand_total. Only pharmacy users can create or edit invoice drafts.",
        ["lib/pharmacy/invoices.ts", "supabase/migrations/001_initial_schema.sql"],
        ["api", "invoice"],
      ),
    ],
  ),
  makeMemoryFile(
    "ENV_AND_SETUP",
    "Standard local workflow uses npm and Supabase env vars.",
    [
      makeItem(
        "env_and_setup",
        "Standard setup commands",
        "Run npm install, then npm run dev. Tests use npm run test. Required env vars include NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        [".env.example", "package.json"],
        ["setup"],
      ),
    ],
  ),
  makeMemoryFile(
    "CODING_RULES",
    "Rules emphasize security, consistency, and role-aware routing.",
    [
      makeItem(
        "coding_rules",
        "Centralize role logic",
        "Do not scatter role checks across pages. Keep role routing and gate logic in shared auth helpers so future changes stay consistent.",
        ["lib/auth/role-router.ts"],
        ["roles"],
      ),
    ],
  ),
  makeMemoryFile(
    "CURRENT_TASKS",
    "The active task centers on completing pharmacy invoicing without reintroducing routing bugs.",
    [
      makeItem(
        "current_tasks",
        "Finish pharmacy invoice workflow",
        "Complete invoice totals, stock reconciliation, and the printable invoice view while keeping auth guards stable.",
        ["app/pharmacy/invoices/page.tsx", "lib/pharmacy/invoices.ts"],
        ["invoice", "active"],
      ),
    ],
  ),
];

export const demoRepoScan: RepoScan = {
  workspace_root: "demo://caregrid",
  framework: "Next.js",
  package_manager: "npm",
  scripts: {
    dev: "next dev",
    build: "next build",
    test: "vitest",
  },
  app_routes: [
    "app/page.tsx",
    "app/dashboard/page.tsx",
    "app/pharmacy/invoices/page.tsx",
    "app/login/page.tsx",
  ],
  api_routes: ["app/api/invoices/route.ts", "app/api/auth/session/route.ts"],
  library_files: ["lib/pharmacy/invoices.ts", "lib/auth/role-router.ts"],
  database_migrations: ["supabase/migrations/001_initial_schema.sql"],
  env_examples: [".env.example"],
  test_files: ["tests/auth-guard.test.tsx"],
  readme_summary:
    "CareGrid is a Supabase-backed healthcare coordination app with patient, doctor, hospital, and pharmacy experiences.",
  branch: "demo",
  commit_hash: "demo-hash",
  recent_commits: [],
  files_inspected: [
    "package.json",
    "app/pharmacy/invoices/page.tsx",
    "lib/pharmacy/invoices.ts",
    "lib/auth/role-router.ts",
  ],
  warnings: [],
  totals: {
    file_count: 4,
    bytes_read: 13284,
  },
  scanned_at: DEMO_DATE,
};

export const demoDriftIssues: DriftIssue[] = [
  {
    severity: "medium",
    title: "Memory still references npm run dev:api",
    description:
      "ENV_AND_SETUP notes still mention an API-specific dev command, but the latest package scripts only expose a single Next.js dev server.",
    suggested_fix:
      "Update ENV_AND_SETUP.md to use npm run dev and remove the outdated npm run dev:api command reference.",
    evidence: ["Package scripts: dev, build, test"],
    status: "open",
  },
  {
    severity: "low",
    title: "Old note still mentions hardcoded role routes",
    description:
      "The failed attempt is still relevant, but the current architecture summary should explicitly say the shared role router replaced that pattern.",
    suggested_fix:
      "Add a short note to ARCHITECTURE.md confirming role routing now lives in a shared helper.",
    evidence: ["Failed attempt: Hardcoded role routes"],
    status: "open",
  },
];

export const demoCapsule = createDeterministicCapsule(
  "Add pharmacy invoice feature",
  demoMemoryFiles,
  demoRepoScan,
);

export const demoExports = {
  "AGENTS.md": "# AGENTS.md\n\nDemo export generated in mock mode.",
  "CLAUDE.md": "# CLAUDE.md\n\nDemo export generated in mock mode.",
};

export const demoProjectHealthScore = calculateMemoryHealthScore(demoDriftIssues);
