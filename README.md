# Hono + Prisma 8 + BullMQ + Anvia AI Pipeline

Final assignment for **AI Product Engineering with TypeScript Batch II — Devscale**.

This project implements an asynchronous AI pipeline exposed through a Hono API. A request creates a job in PostgreSQL, the job is queued with BullMQ/Redis, a worker performs a real Anvia model call, and the generated result is persisted back to PostgreSQL.

## Assignment Requirements

The implementation covers the required flow:

- `POST /jobs` — validate input, create a pending job, enqueue a BullMQ job, and return HTTP `202`.
- `GET /jobs` — list jobs with their status and saved results.
- `GET /jobs/:id` — return one job's status and saved result, or `404` when the job does not exist.
- Results that are not ready are returned as `null`.
- The AI pipeline runs in the worker using a real Anvia model call; responses are not mocked.
- Job status is persisted as `PENDING`, `COMPLETED`, or `FAILED`.
- Completed AI results are stored in PostgreSQL and therefore survive an API restart.

## Architecture

```text
Client
  |
  | POST /jobs
  v
Hono API
  |
  +--> PostgreSQL
  |      Job: PENDING
  |
  +--> BullMQ --> Redis
                  |
                  v
               Worker
                  |
                  v
               Anvia
                  |
          +-------+-------+
          |               |
       success          failure
          |               |
          v               v
     JobResult        Job = FAILED
          |
          v
     Job = COMPLETED
```

The API and worker are intentionally separate processes. The API only creates/enqueues the job and returns immediately. The worker consumes the queued job, calls the model, and saves the result.

## Tech Stack

- TypeScript
- Hono
- Prisma 8 RC
- PostgreSQL 16
- BullMQ 6
- Redis 7
- Anvia Core
- Anvia OpenAI adapter
- Zod
- pnpm
- Docker Compose

## Project Structure

```text
hono-prisma/
├── src/
│   ├── generated/prisma/     # Generated Prisma contract
│   ├── llm/                  # Anvia model configuration
│   ├── modules/job/          # Job API routes, service, and schema
│   ├── worker/               # BullMQ queue and worker
│   ├── utils/                # Database utility
│   └── index.ts              # Hono API entry point
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── prisma.config.ts
├── prisma-next.md
└── tsconfig.json
```

## Prerequisites

Install these before starting:

1. **Node.js**
2. **pnpm**
3. **Docker Desktop** with Docker Compose
4. An API key for the OpenAI-compatible provider used by the Anvia adapter

Check the installations:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

## 1. Clone the Repository

```bash
git clone <repository-url>
cd hono-prisma
```

If you already have the project locally, simply open the project root in VS Code and continue from the next step.

## 2. Install Dependencies

Run from the project root:

```bash
pnpm install
```

This installs the dependencies declared in `package.json`. The generated `node_modules/` directory is local-only and is ignored by Git.

## 3. Configure Environment Variables

Create `.env` from `.env.example`.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS / Linux

```bash
cp .env.example .env
```

Then edit `.env`:

```env
DATABASE_URL="postgresql://hono:hono@localhost:55432/hono"
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL="your-base-url-if-required"
```

`DATABASE_URL` matches the PostgreSQL port exposed by `docker-compose.yml`.

`OPENAI_BASE_URL` may be left empty when the configured provider does not require a custom endpoint.

The model configuration is in `src/llm/models.ts`.

**Do not commit `.env`.** It contains credentials and is ignored by `.gitignore`. Commit `.env.example` instead.

## 4. Start PostgreSQL and Redis

The repository includes a Docker Compose configuration for both required services:

```bash
docker compose up -d
```

Services:

| Service | Container | Host port |
|---|---|---:|
| PostgreSQL | `hono-postgres` | `55432` |
| Redis | `hono-redis` | `6380` |

Check their status:

```bash
docker compose ps
```

Expected state: both containers should be running.

To stop them later:

```bash
docker compose down
```

The Compose file uses named volumes, so the PostgreSQL and Redis data can persist between container restarts.

## 5. Initialize the Database

This project uses the Prisma 8 contract workflow.

First emit the current Prisma contract:

```bash
pnpm run contract:emit
```

Then initialize the local PostgreSQL database:

```bash
pnpm run db:init
```

If the database has already been initialized, verify it with:

```bash
pnpm run db:verify
```

## 6. Start the API

Open **Terminal 1** in the project root:

```bash
pnpm run dev
```

The API starts on:

```text
http://localhost:3000
```

Keep this terminal running.

## 7. Start the Worker

Open **Terminal 2** in the same project directory:

```bash
pnpm run worker:dev
```

Keep this terminal running as well.

The worker is required because `POST /jobs` only enqueues the job. The worker consumes the BullMQ job and performs the real AI call.

## 8. API Usage

### POST `/jobs`

Creates a new AI job.

**Request**

```http
POST http://localhost:3000/jobs
Content-Type: application/json
```

```json
{
  "product": "Wireless Earbuds",
  "media": "Instagram",
  "category": "Technology"
}
```

Example using PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/jobs `
  -ContentType "application/json" `
  -Body '{"product":"Wireless Earbuds","media":"Instagram","category":"Technology"}'
```

Expected response: **HTTP `202`** with a job ID and initial `PENDING` status.

```json
{
  "job": {
    "id": "<job-id>",
    "status": "PENDING"
  }
}
```

Copy the returned `job.id` for the next request.

### GET `/jobs`

Lists all jobs with their current status and saved result.

```http
GET http://localhost:3000/jobs
```

For a job that has not completed yet:

```json
{
  "status": "PENDING",
  "result": null
}
```

For a completed job, `result` contains the data saved in PostgreSQL.

### GET `/jobs/:id`

Returns one job by ID:

```http
GET http://localhost:3000/jobs/<job-id>
```

Possible states:

- `PENDING` → `result: null`
- `COMPLETED` → `result` contains the saved AI output
- `FAILED` → `result: null`
- Unknown ID → HTTP `404`

## 9. Test the Full Assignment Flow

Use this sequence to verify the complete system:

1. Start PostgreSQL and Redis:
   ```bash
   docker compose up -d
   ```
2. Initialize or verify PostgreSQL:
   ```bash
   pnpm run contract:emit
   pnpm run db:init
   ```
3. Start the API in Terminal 1:
   ```bash
   pnpm run dev
   ```
4. Start the worker in Terminal 2:
   ```bash
   pnpm run worker:dev
   ```
5. Send `POST /jobs` with a valid JSON body.
6. Copy the returned `job.id`.
7. Call `GET /jobs/<job-id>`.
8. Initially the job may be `PENDING` with `result: null`.
9. After the worker finishes, the job should become `COMPLETED` and contain the saved AI result.
10. If the pipeline fails, the job should become `FAILED` and the result remains `null`.
11. Restart the API and call `GET /jobs/<job-id>` again. A completed result remains available because it is stored in PostgreSQL.

## 10. Available Scripts

| Command | Purpose |
|---|---|
| `pnpm install` | Install project dependencies |
| `pnpm run dev` | Start the Hono API in watch mode |
| `pnpm run worker:dev` | Start the BullMQ worker in watch mode |
| `pnpm run build` | Compile the TypeScript project |
| `pnpm run start` | Start the compiled API |
| `pnpm run contract:emit` | Emit the Prisma contract |
| `pnpm run db:init` | Initialize the local database |
| `pnpm run db:verify` | Verify the initialized database |

## 11. Troubleshooting

### API starts but jobs stay `PENDING`

Make sure the worker is running in a second terminal:

```bash
pnpm run worker:dev
```

Also check that Redis is running:

```bash
docker compose ps
```

### Database connection error

Check that PostgreSQL is running and that `.env` contains:

```env
DATABASE_URL="postgresql://hono:hono@localhost:55432/hono"
```

### AI request fails

Check `OPENAI_API_KEY` and, if applicable, `OPENAI_BASE_URL` in `.env`. Do not put the API key in the repository.

### Port already in use

The default ports are:

- API: `3000`
- PostgreSQL: `55432`
- Redis: `6380`

Stop the conflicting local service or adjust the relevant configuration before starting the project.

## Security

The repository intentionally excludes local/sensitive files:

```gitignore
.env
node_modules/
```

Never commit API keys, database passwords, or other secrets. `.env.example` contains placeholders only.

## Assignment Summary

This project demonstrates the requested asynchronous AI product flow:

```text
Validate input
     ↓
Create PENDING job
     ↓
Enqueue BullMQ job
     ↓
Worker processes real AI request
     ↓
Save result to PostgreSQL
     ↓
COMPLETED / FAILED
     ↓
Read status + saved result through API
```

The project is intended to be reviewed by running the API and worker locally with PostgreSQL and Redis provided through Docker Compose.
