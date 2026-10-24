<div align="center">

<img src="./docs/images/repolens-logo.svg" alt="RepoLens" width="230" />

<br />

# RepoLens

### Evidence-first security reviews for public GitHub repositories

RepoLens combines **Trivy** and **Semgrep** findings with optional, clearly labeled **Gemini** triage. Scanner output stays the source of truth; AI helps explain and prioritize it.

<br />

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Google ADK](https://img.shields.io/badge/Agent-Google_ADK-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://github.com/google/agent-development-kit)
[![React + TypeScript](https://img.shields.io/badge/UI-React_+_TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker Compose](https://img.shields.io/badge/Run-Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

**Scan a repository · inspect evidence · prioritize the next fix**

<img src="./docs/images/hero-banner.svg" alt="RepoLens: evidence-backed scanner findings and clearly labeled AI assistance" width="100%" />

<br />

[Product tour](#product-tour) · [Quick start](#prerequisites) · [Architecture](#architecture-and-data-flow) · [API](#using-the-api) · [Security](#security-and-privacy)

</div>

---

## At a glance

- **Who it is for:** developers and security engineers who need a readable first pass over a public repository.
- **What it does:** runs Trivy and Semgrep, normalizes the results, redacts likely secrets, stores a report, and presents it in a filterable dashboard.
- **Where AI fits:** Google ADK + Gemini can summarize and prioritize the bounded scanner findings. AI suggestions are identified as unverified and do not modify scanner findings or their severities.
- **Without an API key:** RepoLens still runs in scanner-only mode.

> RepoLens is an aid for triage, not a replacement for security review. Scanner coverage and regex-based secret redaction have limits; check the evidence and validate fixes in your own environment.

## Product tour

### Dashboard walkthrough

![Animated RepoLens dashboard walkthrough. Frames use illustrative sample audit data, not a live scan recording.](./docs/images/repolens-demo.gif)

*The dashboard and finding previews below use illustrative sample values to show the current interface.*

<p align="center">
  <img src="./docs/images/dashboard-overview.png" alt="RepoLens security overview with audit history, risk metrics, and scanner findings" width="49%" />
  <img src="./docs/images/finding-details.png" alt="RepoLens finding detail with code evidence and remediation" width="49%" />
</p>

---

## What makes RepoLens useful

Security scanners can return a lot of output with little prioritization. AI-only code review can also produce convincing claims without proof. RepoLens keeps evidence collection and AI assistance separate:

1. **Established scanners find issues.** Trivy checks vulnerabilities, secrets, and misconfigurations. Semgrep runs static analysis rules.
2. **Findings share one report format.** The API provides severity, scanner, rule/advisory IDs, file location, evidence, remediation, and provenance where available.
3. **Likely secrets are redacted.** Evidence snippets are scrubbed and bounded before storage or AI enrichment.
4. **AI assists with triage.** If configured, a Google ADK agent receives only a bounded findings snapshot through read-only tools and returns a summary with up to five prioritized actions.
5. **Unavailable tools are visible.** A missing or failed scanner is reported as unavailable or errored; it is not silently described as a clean scan.

Gemini use is optional and may consume quota or incur charges depending on the selected model and the user's current Google account terms. RepoLens does not currently report token or cost usage. The agent receives no more than 30 findings per request; evidence is redacted and bounded by `MAX_SNIPPET_BYTES` (2,048 bytes by default).

## Capabilities

- 🔗 **Repository intake** — HTTPS GitHub `owner/repo` URLs, shallow clone, size and time limits, and commit SHA capture.
- 🛡️ **Security scanners** — Trivy filesystem checks for vulnerabilities, secrets, and misconfigurations; Semgrep `auto` ruleset for SAST.
- 🧾 **One normalized report** — Consistent severity, scanner status, tech-stack hints, rule IDs, location, evidence, and provenance.
- 🔒 **Evidence privacy** — Heuristic secret redaction, bounded evidence snippets, and temporary checkout cleanup.
- ✨ **Optional AI triage** — Gemini summary and prioritized actions, with scanner-only fallback if AI is missing or unavailable.
- 🖥️ **Interactive dashboard** — Audit history, severity filters, scanner status, expandable findings, evidence, remediation, and demo labels.
- 📦 **Portable reports** — PostgreSQL JSONB + Markdown persistence, with JSON and Markdown downloads.
- 🐳 **Local deployment** — Docker Compose runs PostgreSQL, the API, Trivy, Semgrep, and the Nginx-hosted frontend.

---

## Architecture and data flow

![Animated RepoLens architecture and data flow: GitHub URL validation, bounded clone, parallel Trivy and Semgrep scans, normalization and redaction, optional Gemini triage, PostgreSQL persistence, dashboard, and exports](./docs/images/repolens-flow.gif)

**Flow:** GitHub URL → validation and bounded clone → Trivy + Semgrep → normalized, redacted findings → optional Gemini summary → PostgreSQL → dashboard and JSON/Markdown exports.

AI enrichment is optional. If it is disabled or unavailable, scanner findings still flow to the report. The [branded SVG flow](./docs/images/architecture-flow.svg) is available for a static overview.

## Built with

🐍 **Python 3.11+** · ⚡ **FastAPI** · 🧠 **Google ADK + Gemini** · 🔍 **Trivy + Semgrep** · 🗄️ **PostgreSQL + psycopg3** · ⚛️ **React + TypeScript + Vite** · 🐳 **Docker Compose + Nginx**

The agent uses read-only tools over a sanitized report snapshot; Gemini is configurable and optional.

---

## Prerequisites

### Docker quick start (recommended)

- Docker Engine or Docker Desktop with the Compose plugin
- A local PostgreSQL password for Compose
- A Google AI Studio API key only if you want Gemini enrichment

```bash
cd agents/repolens
cp .env.example .env
```

Set `POSTGRES_PASSWORD` in `.env`. Leave `GOOGLE_API_KEY` blank for scanner-only mode, or add your own key for AI enrichment. Then start the services:

```bash
docker compose up --build
```

- 🖥️ **Dashboard:** [http://localhost:5173](http://localhost:5173) (also port `3000`)
- ⚡ **API docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- 💚 **Health:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

The Compose stack starts PostgreSQL, the FastAPI backend, and the Nginx frontend. The backend waits for the database, initializes the schema, and seeds an illustrative demo report by default. **Demo findings are sample data, not scanner output.** Submit a public GitHub URL in the dashboard to run a real scan.

Stop the stack with `Ctrl+C`. The named PostgreSQL volume persists between runs. To remove the persisted database volume as well, use `docker compose down -v` (this deletes local audit data).

### Local development setup

Local mode requires Python 3.11+, Node.js 18+, PostgreSQL 14+, and Git. Install Trivy and Semgrep for live scanner results; without them, RepoLens records the scanners as unavailable. Configure `.env` with a local database URL and optional Google API key.

Create the local database and user (adjust credentials for your machine):

```bash
psql -U postgres -c "CREATE USER repolens WITH PASSWORD 'your_local_password';"
psql -U postgres -c "CREATE DATABASE repolens OWNER repolens;"
```

Install and start the backend:

```bash
cd agents/repolens
python3.11 -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to use the password you chose, then initialize the schema and run the API:

```bash
psql -U repolens -d repolens -f db/schema.sql
uvicorn backend.main:app --reload --port 8000
```

In a second terminal, install and run the frontend:

```bash
cd agents/repolens/frontend
npm ci
npm run dev
```

Vite serves the UI at [http://localhost:5173](http://localhost:5173) and proxies `/api` calls to FastAPI on port `8000`.

### Optional: seed the illustrative demo report

When using the local setup, initialize the database and run:

```bash
cd agents/repolens
python scripts/seed_demo.py
```

The seed is idempotent. It marks the report `is_demo=true`; the dashboard identifies the report as illustrative. It does not run Trivy or Semgrep.

---

## Configuration

All settings are loaded from environment variables or the project `.env` file. The checked-in `.env.example` contains placeholders only.

- 🗄️ `DATABASE_URL` — PostgreSQL URL; defaults to `postgresql://repolens:changeme@localhost:5432/repolens`. Compose provides the backend’s internal URL.
- 🐘 `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — Compose database settings (`repolens`, **must set**, `repolens`). Never commit a real password.
- ✨ `GOOGLE_API_KEY` — Optional Google AI Studio key. Leave empty for scanner-only mode.
- 🧠 `GEMINI_MODEL` — Gemini model name; defaults to `gemini-2.0-flash`.
- 📦 `MAX_REPO_SIZE_MB` — Maximum checkout size; defaults to `100`. Size is sampled during cloning and checked again at completion.
- ⏱️ `SCAN_TIMEOUT_SECONDS` — Clone timeout in seconds; defaults to `300`. Each scanner also applies a timeout.
- ✂️ `MAX_SNIPPET_BYTES` — Maximum evidence bytes per finding before AI context preparation; defaults to `2048`.
- 🪵 `LOG_LEVEL` — `debug`, `info`, `warning`, or `error`; defaults to `info`.
- 🌱 `SEED_DEMO` — Compose entrypoint seeds the illustrative report by default; set `false` to skip it.

For the default Compose connection string, choose a `POSTGRES_PASSWORD` without URL-reserved characters. If you set `DATABASE_URL` yourself and its password contains special characters, URL-encode them. The Docker and local run commands below specify the Uvicorn bind address and port directly.

---

## Using the API

The full interactive schema is served at `/docs` while the API is running.

- 💚 `GET /api/health` — API, database, and Gemini configuration status.
- 🗂️ `GET /api/audits` — List up to 20 recent audits.
- 🔎 `GET /api/audits/{audit_id}` — Read an audit and full JSON report.
- 🚀 `POST /api/scans` — Validate, scan, optionally enrich, and persist an audit.
- 📥 `GET /api/audits/{audit_id}/report?format=json` — Download JSON (default).
- 📝 `GET /api/audits/{audit_id}/report?format=markdown` — Download Markdown.

Start a scan:

```bash
curl -X POST http://localhost:8000/api/scans \
  -H 'Content-Type: application/json' \
  -d '{"repository_url":"https://github.com/OWASP/NodeGoat"}'
```

The endpoint runs synchronously and returns after the scan is complete:

```json
{
  "audit_id": 1,
  "status": "completed",
  "message": "Scan completed. 5 findings."
}
```

Common error responses include `422` for an invalid URL or a repository that cannot be scanned within configured limits, `500` for an unexpected scan error, and `503` when persistence is unavailable.

The finding count above is an example response shape, not a promise about results for that repository. Scanner output depends on the repository contents, scanner versions, and rules available at scan time. Retrieve or export an audit with:

```bash
curl http://localhost:8000/api/audits/1
curl 'http://localhost:8000/api/audits/1/report?format=markdown' -o report.md
```

### Finding model

Each finding includes a **title**, normalized **severity**, **category**, originating **scanner**, and report-local `finding_id`. Where the scanner provides them, reports also include a rule/CVE/CWE reference, file and line location, redacted evidence, remediation guidance, and source link. `provenance` distinguishes `scanner` findings from `ai_suggestion` entries.

AI summaries and prioritized actions are separate report fields; they do not overwrite scanner evidence or severity.

---

## Testing and development checks

From the project directory, run the Python unit suite:

```bash
cd agents/repolens
pytest -v
```

The unit tests cover URL validation, scanner-output normalization, secret redaction, agent fallback/tool behavior, database operations with mocks, demo seeding, and model serialization. They are designed to run without live PostgreSQL, scanner binaries, or Gemini credentials.

Check and build the frontend:

```bash
cd agents/repolens/frontend
npm ci
npm run typecheck
npm run build
```

For a full manual check, start PostgreSQL and the API, open the dashboard, scan a public repository, inspect a finding and scanner status, then download both report formats. A missing scanner should display as unavailable rather than as a clean scan.

---

## Security and privacy

- **Repository scope:** only HTTPS `github.com/owner/repo` URLs are accepted; private repositories and authenticated GitHub access are not implemented.
- **No repository execution:** RepoLens shallow-clones source and invokes scanners. It does not run repository scripts, install project dependencies, or execute build systems.
- **Process invocation:** Git and scanner commands are passed as argument arrays with `shell=False`.
- **Resource limits:** clone size is sampled during transfer and checked once more at completion; cloning and scanner processes have timeouts. A sampling interval means disk use can briefly cross the configured size before the next check stops the process.
- **Temporary checkout:** the cloned repository is removed when scanning exits, including on failure.
- **Secret handling:** regex-based redaction masks common secret patterns in evidence. This is a best-effort safeguard, not a guarantee that every secret format will be detected.
- **Gemini data flow:** when enabled, Gemini receives a bounded snapshot of normalized findings and scanner metadata, not the repository checkout. Gemini processes that data under Google's API terms.
- **Persistence:** audit reports, including normalized evidence snippets, are stored in PostgreSQL until the operator removes them.
- **Access control:** the API has no authentication or user isolation. Do not expose it to the public internet without adding authentication, authorization, and deployment protections.
- **Secrets:** keep `.env`, API keys, and database credentials out of version control. The `.env.example` file is for placeholders only.

---

## Known limitations

- Only public GitHub repositories are supported; GitHub Enterprise, other Git hosts, and private repositories are not supported.
- The scan request is synchronous. Large or complex repositories may take several minutes and can exceed reverse-proxy/client timeouts.
- A clone size check runs periodically, so the configured limit is not an instantaneous filesystem quota.
- Local development requires PostgreSQL. There is no SQLite or in-memory API persistence mode.
- Scanner coverage depends on the installed Trivy and Semgrep versions and their available rules/databases.
- Secret redaction uses patterns and may miss unfamiliar credential formats or redact non-secret text.
- Gemini may be unavailable due to account, region, quota, network, or model availability. In those cases, scanner reporting continues without AI enrichment.
- No authentication, multi-user access control, historical diffing, or background job queue is included.
- Windows has not been verified.

## Roadmap

- [ ] Add background scan jobs and progress reporting.
- [ ] Add SARIF export for code-scanning workflows.
- [ ] Compare findings across commits and repeated scans.
- [ ] Add authenticated private-repository support with a least-privilege GitHub integration.
- [ ] Add integration tests against PostgreSQL and pinned scanner versions in CI.
- [ ] Add configurable retention and audit deletion controls.

## Contributing

RepoLens lives in `agents/repolens/` and follows the parent repository's contribution rules. Keep changes scoped to this project, document setup and limitations, and use the PR checklist in the repository root. Never commit `.env` files, credentials, or private repository data.

See the [repository contribution guide](../../CONTRIBUTING.md) and [agent project index](../README.md).

## License

RepoLens is contributed under the parent repository's [MIT License](../../LICENSE).
