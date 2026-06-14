# Decision Log: Architectural & System Choices

This document logs the key technical decisions made during the design and implementation of the Shared Expenses application.

---

## 1. Local Database Choice: SQLite (via Prisma ORM)
* **Context**: The assignment initially requested PostgreSQL.
* **Options Considered**:
  1. *Local Dockerized PostgreSQL*: Required setting up Docker local images and matching system ports.
  2. *SQLite*: Lightweight, file-based database that requires zero local configuration or external processes.
* **Decision**: Chose **SQLite**. Due to system constraints on PostgreSQL port availability locally, SQLite was used to make the setup fully portable. 
* **Trade-off Resolution**: SQLite lacks native support for `Decimal` (mapped to `Float` with Javascript rounding `.toFixed(2)` to prevent float precision drift) and `Json` (mapped to `String` with `JSON.stringify`/`JSON.parse` helper hooks in the controllers).

---

## 2. Import Handling: Staging Dashboard instead of Strict Rejection
* **Context**: Ingesting a CSV with 18+ logical anomalies.
* **Options Considered**:
  1. *Fail-Fast*: Stop parsing and fail the entire upload on the first warning.
  2. *Silent Auto-Fix*: Silently rewrite anomalies and apply them.
  3. *Approval Staging Dashboard*: Process clean rows immediately, but place rows with logical warnings/conflicts into a temporary dashboard where group admins can inspect, resolve options, and manually approve or reject them.
* **Decision**: Chose the **Approval Staging Dashboard**. This provides a robust audit trail, gives admins absolute control over data integrity, and prevents single bad rows from blocking the import of clean expenses.

---

## 3. CSV Member Resolution: Auto-Register Unknown Users
* **Context**: The CSV lists names (e.g. Aisha, Rohan, Priya, Meera, Dev, Sam) which may not be registered in the app when the CSV is uploaded.
* **Options Considered**:
  1. *Strict validation error*: Block the row and demand the user registers every member manually.
  2. *Auto-Registration*: Dynamically register missing users with a temporary password (`password123`) and their name as the prefix for a generated email (`name@example.com`).
* **Decision**: Chose **Auto-Registration**. This ensures the database doesn't crash on foreign key constraint failures and bootstraps the members instantly so debt calculations work immediately after upload.

---

## 4. Deployment Model: Vercel Blueprint and Render blueprint.yaml
* **Context**: Configuring Render and Vercel hosting.
* **Options Considered**:
  1. *Manual web interface setups*: Document every single setting (port, environment variables, directories) and require the user to configure them manually.
  2. *Vercel link + Render blueprint.yaml*: Pre-define project configurations in a `render.yaml` Blueprint file for Render and use standard Vercel configuration files.
* **Decision**: Chose **Vercel link + Render blueprint.yaml**. By providing a declarative `render.yaml` specification, deployment is automated with a single approval click. We adapted this for the Free Tier by removing the disk mount constraints when free plans didn't support Render's disk mount service.
