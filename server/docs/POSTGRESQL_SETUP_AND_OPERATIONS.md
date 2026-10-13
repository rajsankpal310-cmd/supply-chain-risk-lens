# NEXUS-CFR — PostgreSQL Production & Development Operations Manual

## 1. Overview & Architecture

NEXUS-CFR operates on a **PostgreSQL** relational database backend managed via **Prisma ORM**. All operational records—including Organizations, Users, Firms, Transactions, Supply Chain Relationships, Predictions, Simulations, Scenarios, Deadlocks, Recommendations, Optimization Runs, Alerts, Reports, and Ingestion Batches—are persistently stored and isolated per tenant organization.

---

## 2. Environment Configuration

The application database connection is completely driven by environment variables. No credentials, hosts, passwords, or connection strings are hardcoded into source code.

### Required Environment Variable

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require"
```

- **Local Development**:
  ```env
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexuscfr?schema=public"
  ```
- **Hosted Cloud Providers (Neon, Supabase, Render, Railway, AWS RDS)**:
  ```env
  DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require"
  ```

> **Security Rule**: Real credentials must never be committed to Git. `.env` and `server/.env` are strictly included in `.gitignore`. Placeholders are documented in `.env.example` and `server/.env.example`.

---

## 3. Local Development Setup

To run NEXUS-CFR with PostgreSQL locally:

1. **Install and Start PostgreSQL**:
   - Verify PostgreSQL service is active (`Get-Service *postgres*` on Windows or `systemctl status postgresql` on Linux).
   - Ensure PostgreSQL is listening on port `5432`.

2. **Create the Database**:
   ```sql
   CREATE DATABASE nexuscfr;
   ```

3. **Configure Environment Variables**:
   - Copy `server/.env.example` to `server/.env`.
   - Update `DATABASE_URL` with your local PostgreSQL credentials.

4. **Generate Prisma Client**:
   ```bash
   cd server
   npm run db:generate
   ```

5. **Apply Database Migrations**:
   ```bash
   npm run db:migrate
   ```

6. **Seed Initial Reference & Multi-Tenant Data (Optional)**:
   ```bash
   npm run db:seed
   ```

7. **Start the Backend**:
   ```bash
   npm run dev
   ```

8. **Start the Frontend**:
   ```bash
   cd ..
   npm run dev
   ```

---

## 4. Prisma Migrations Guide

NEXUS-CFR follows version-controlled, reproducible SQL migrations located in `server/prisma/migrations/`.

### Applying Migrations

- **In Development** (creates migration if schema changes):
  ```bash
  npx prisma migrate dev
  ```
- **In Production / CI/CD** (applies existing migrations safely without schema drifting):
  ```bash
  npx prisma migrate deploy
  ```

### Critical Safety Invariant

> ⚠️ **CRITICAL WARNING**: **NEVER RUN `prisma migrate reset` AGAINST PRODUCTION OR LIVE DATABASES.**
> `prisma migrate reset` drops all tables, schemas, and persistently stored user records. Only use `prisma migrate deploy` in live environments.

---

## 5. Live Database Health Check

The backend exposes authenticated and unauthenticated health check endpoints that verify live database connectivity without leaking connection strings or credentials:

- **`GET /health`** & **`GET /api/health`**
- **Response Format**:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "latencyMs": 2,
    "environment": "development",
    "timestamp": "2026-10-06T12:00:00.000Z"
  }
  ```

---

## 6. Backup & Recovery Procedures

### Creating a Database Backup
```bash
# Export full database schema and data to compressed custom format
pg_dump -U postgres -h localhost -p 5432 -F c -b -v -f nexuscfr_backup_$(date +%Y%m%d_%H%M%S).dump nexuscfr
```

### Restoring from a Backup
```bash
# Restore into existing or fresh database
pg_restore -U postgres -h localhost -p 5432 -d nexuscfr -v nexuscfr_backup.dump
```

---

## 7. Data Provenance & Ingestion Lifecycle

When datasets or invoices (CSV/XLSX) are uploaded:
1. **Validation & Normalization**: Schema detection, semantic and business validation via `PipelineOrchestrator`.
2. **Deduplication**: Exact and fuzzy duplicate checking against existing PostgreSQL records under the tenant's `organizationId`.
3. **Audit Provenance**: Creation of an `ImportBatch` row recording `sourceType`, `sourceName`, `recordCount`, `acceptedCount`, `duplicateCount`, and `qualityReport`.
4. **Persistent Transaction Ingestion**: Validated records are inserted into `Transaction` table linked by `batchId`.
5. **Dynamic Risk Propagation**: Counterparty resolution and firm risk scores (`recalculateFirmRisk`) trigger immediately.
