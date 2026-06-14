# AI Usage Log: Prompts & Discrepancies Resolved

This document outlines the AI tools used, key prompts, and three specific cases where AI generation required human/agent correction during development.

---

## 1. AI Tools & Key Prompts

### Tool Used
- **Antigravity AI Coding Assistant** (developed by Google DeepMind)

### Key Prompts
- *"start postgresql"*
- *"do not use docker use another instead of this"*
- *"continue"*
- *"how to deploy it on vercel and render"*
- *"deploy this on vercel"*
- *"depoy backend on render"*

---

## 2. Three Concrete Cases of AI Errors & Resolutions

### Case 1: Float Precision Handling in Database Operations
* **The Error**: The AI initially recommended using Prisma `Decimal` fields for prices and shares in the SQLite schema definition. However, SQLite does not support native `Decimal` types in Prisma, resulting in migration failures. Additionally, parsing decimal details like `899.995` without rounding led to float precision drift (e.g. `900.0000000001` instead of exactly `900.00`) during balances tally calculations.
* **How It Was Caught**: Prisma migration commands failed with type mismatches, and automated checks in `balanceCalculator.js` returned numbers with floating-point drift.
* **What Was Changed**: Changed schema fields from `Decimal` to `Float` in `schema.prisma`. Implemented wrapper functions using `.toFixed(2)` and `parseFloat()` in both `balanceCalculator.js` (backend) and the React component (frontend) to guarantee correct monetary values.

### Case 2: Browser Sandbox Directory Conflict in Subagent Task
* **The Error**: The browser subagent designed to execute automated frontend tests failed to locate the `Expenses Export.csv` upload file. The subagent looked for the file at:
  `C:/Users/hi/.gemini/antigravity-ide/brain/b95ad139-9162-40b6-9f7f-03b026c24a69/browser/expenses.csv`
  instead of the workspace path:
  `c:\Users\hi\Desktop\PROOJECT\Expenses Export.csv`
  causing playwright file upload actions to fail immediately.
* **How It Was Caught**: Subagent logs returned `failed to read file: open C:/Users/hi/.../browser/expenses.csv: The system cannot find the file specified`.
* **What Was Changed**: Ran shell commands to manually copy the CSV file to the sandbox path the browser subagent expected so the test runs completed smoothly.

### Case 3: Render Persistent Disk Configuration on Free Tier
* **The Error**: The AI generated a `render.yaml` Blueprint file that included a `disk` specification for the SQLite `dev.db` file while using the `plan: free` tier.
* **How It Was Caught**: Render blueprint validation returned: `services[0] disks are not supported for free tier services`.
* **What Was Changed**: Modified `render.yaml` to remove the persistent disk block and set the SQLite location to the local project folder (`file:./dev.db`), ensuring free tier compatibility, and documented Supabase PostgreSQL database connections as a free-tier persistent alternative.
