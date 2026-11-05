# Security Policy

## Supported versions

This is an early-stage pre-1.0 project. We currently review security reports against the latest main branch; there is no published npm package or separate long-term support branch.

## Reporting a vulnerability

**Do not open a public issue containing exploit details, tokens, credentials, or private files.**

Use the repository's **GitHub Security > Report a vulnerability** feature if available. If private vulnerability reporting is not enabled, contact the maintainer through their GitHub profile and request a secure reporting channel without sharing the sensitive details publicly.

Please include a minimal reproduction, versions, affected surface, and potential impact. Do not test against another person's infrastructure or data.

## Current threat model and limitations

- The Next.js dashboard includes local filesystem operations and **does not include multi-user authentication or authorization**. It is for local trusted use, not a public multi-tenant service.
- npm run dev and npm start bind to 127.0.0.1 by default, but local malicious software may still access the service.
- Hosted Vercel mode is intended to show read-only sample data; it must never become shared file hosting without a complete security review.
- Private files, scanned repository metadata, and generated memory may contain sensitive information. Review all exports before distributing them.
- Cloud AI is opt-in. Set CONTEXTFORGE_PRIVACY_MODE=local to avoid intentional Gemini requests and do not paste secrets into notes.
- Keep .env files, tokens, runtime workspaces, and generated .contextforge folders out of version control.

We do not currently promise an incident response time or a security SLA. We aim to acknowledge actionable reports promptly and coordinate fixes before public disclosure.
