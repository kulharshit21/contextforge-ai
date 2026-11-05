# Changelog

This project follows the general structure of Keep a Changelog. Versions below are milestones, not proof that an npm package has been published.

## Unreleased

- Hardened Python agent memory engine (`contextforge-memory`):
  - Stale lock detection with PID liveness verification across Windows, Linux, and macOS.
  - Added `repair` CLI command to recover from stale locks and safely truncate corrupted trailing records with automatic timestamped `.bak` backups.
  - Added `--break-lock` flag to `save` and `repair` for forced recovery of abandoned writer locks.
  - Enhanced `audit` command with `--verbose` kind breakdown and lock status reporting.
  - Added UTF-8 BOM (`utf-8-sig`) handling and empty line tolerance for cross-platform resilience.
  - Strengthened secret detection with AWS access keys, GitHub PATs, Slack tokens, JWTs, and Bearer tokens.
  - Added instruction-injection screening against prompt overrides and jailbreak attempts.
  - Added input sanitization against control characters and multiline injection in evidence source fields.
  - Prevented symlink traversal across storage directories and lock files.
  - Added 6 new unit tests covering crash recovery, stale locks, injection prevention, and cross-platform formatting.
- Clarified CLI installation and project maturity in documentation.
- Added contributor/security guidelines and review templates.
- Added CLI integration testing to CI.
- Improved CLI failure exit codes and error handling.
- Prevented repeat capsule generation from overwriting same-day results.
- Added project import validation and duplicate-project protection.
- Default local dashboard binding changed to loopback.

## 0.1.0 — Initial MVP (source repository)

- Local structured project memory, repo scans, capsule generation, drift checks, and agent exports.
- Next.js dashboard with seeded demo data.
- Mock, Gemini, and Ollama provider integration code.

No stable API or public npm release is promised at this stage.
