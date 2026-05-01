# Sample Capsule

## Goal

Add pharmacy invoice feature

## Relevant Context

- Roles: patient, doctor, hospital, pharmacy
- Backend: Supabase
- Security rule: do not bypass RLS
- Previous bug: login redirect loop caused by redirecting before auth hydration settled
- Failed attempt: hardcoded role routes caused brittle navigation

## Files Likely Needed

- `app/pharmacy/invoices/page.tsx`
- `lib/pharmacy/invoices.ts`

## Commands

- `npm install`
- `npm run dev`

## Why This Is A Demo Artifact

This file is a portable, commit-safe example of ContextForge output. It replaces committing live `.contextforge/` runtime artifacts from a local machine.
