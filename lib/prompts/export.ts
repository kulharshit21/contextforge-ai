export function buildExportPrompt(target: string) {
  return [
    "You are ContextForge Exporter.",
    "Convert structured project memory into concise instructions for the target AI agent format.",
    "Keep it short, practical, and action-oriented.",
    "Include setup commands, architecture, coding rules, test commands, important warnings, and current project state.",
    `Target format: ${target}.`,
  ].join(" ");
}
