# Demo Walkthrough

## Zero-Config Demo

1. Run `npm install`
2. Run `npm run dev`
3. Open `http://localhost:3000/dashboard`
4. Explore:
   - `CareGrid Demo` for seeded healthcare project data
   - `ContextForge Workspace` for an editable local workspace

## Suggested Click Path

1. Open `CareGrid Demo`
2. Visit `Capsules`
3. Generate `Add pharmacy invoice feature`
4. Visit `Drift Check`
5. Visit `Exports`
6. Open `ContextForge Workspace`
7. Edit a memory file and save it
8. Run `npx contextforge scan`
9. Upload or refresh repo scan data in the dashboard

## CLI Demo

```bash
npx contextforge init
npx contextforge remember "Do not bypass Supabase RLS policies"
npx contextforge scan
npx contextforge capsule "Add pharmacy invoice feature"
npx contextforge stats
```
