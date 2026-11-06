# GEMINI.md

ContextForge compiles project memory for coding agents.

## Focus

- Preserve durable reasoning: decisions, bugs, failed attempts, and current tasks.
- Keep generated exports concise and practical.
- Use local/mock or Ollama paths when privacy mode is `local`.

## Useful Commands

The CLI is installed from a source checkout (`npm ci` + `npm link`; see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)). There is no published npm package, so `npx contextforge` does not work.

- `contextforge init`
- `contextforge scan`
- `contextforge capsule "task"`
- `contextforge export --all`
- `contextforge doctor`
