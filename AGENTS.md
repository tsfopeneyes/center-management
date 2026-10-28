# AGENTS & CODEX RULES

## Project Rules
1. **Framework:** React + Vite + TailwindCSS + Supabase.
2. **Local First:** Work and verify on local server (`http://localhost:1000`) using `npm run dev`. Keep SCI Center on port 1000 and SCI Challenge on port 2000; do not silently switch to another port.
3. **Deployment:** Only deploy to Firebase Hosting (`npx firebase-tools deploy --only hosting`) when explicitly instructed by the user.
4. **RPC Fallbacks:** Always provide direct Supabase table fallbacks whenever invoking database RPC functions.
5. **Database Safety:** Never delete or reset production data or raw logs. A user request to implement, fix, or continue project work includes authorization for necessary non-destructive production database changes within that task; do not request separate approval for each change. Use a reviewed migration with a dry-run or equivalent impact check, verify the target and scope, and preserve a recovery path. Destructive changes require specific user authorization and verification of the exact scope and recovery path.
6. **Database Change Notice:** Before every database modification, explicitly tell the user which tables, views, records, or settings will change, what the change does, and its scope. This notice is required even when the task already authorizes the change. Analysis-only requests do not authorize new surveys, data collection, or architecture changes; use existing data and preserve the current structure unless the user explicitly requests otherwise.
