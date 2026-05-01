export function buildCapsulePrompt(task: string) {
  return [
    "You are ContextForge.",
    "Generate a compact task-specific context capsule for an AI coding agent.",
    "Use only relevant memory.",
    "The capsule must reduce token usage and prevent repeated mistakes.",
    "Include goal, context, files likely needed, files to avoid, previous errors, commands to run, and a paste-ready agent prompt.",
    "Do not include irrelevant history.",
    "Do not hallucinate files.",
    "If confidence is low, say what is uncertain.",
    `Task: ${task}`,
  ].join(" ");
}
