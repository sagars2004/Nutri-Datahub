# 🥗 Nutri — DataHub Trust Score & Nutrition Label Generator

> **DataHub Hackathon 2026 Submission**  
> *A nutrition-label-style Trust Score generator for DataHub catalog entities.*

---

## 📌 Overview

**Nutri** transforms raw, complex data metadata into a scannable, standardized **FDA-Style "Data Nutrition Facts" Label** for DataHub catalog entities (datasets, dashboards, charts, and data jobs).

Just as nutrition labels help consumers evaluate food quality at a glance, Nutri helps data engineers, analytics engineers, and business analysts instantly assess asset health, governance completeness, and lineage depth before consuming data.

---

## ✨ Key Features

1. **Deterministic Pure-Function Scoring Engine**:
   - **0–100 Trust Score**: 100% rules-based, objective, reproducible score.
   - **Freshness Sub-Score (% DV)**: Linear age decay vs expected cadence and staleness limits.
   - **Completeness Sub-Score (% DV)**: Column documentation coverage ratio + governance metadata presence (owners, domains, glossary terms).
   - **Lineage Depth Sub-Score (% DV)**: Edge connectedness and cross-platform lineage diversity.
   - **Test Coverage Sub-Score (% DV)**: DataHub quality assertion presence and pass rates.
   - **Auto-Flagging**: Automatically triggers `NEEDS ATTENTION` status and applies tag `nutri:needs-attention` when Trust Score < 70.

2. **LLM Plain-Language Explanation & Anti-Hallucination Layer**:
   - Integrated with **Google Gemini 2.5 Flash** via `@google/genai`.
   - **1-Sentence Verdict**: Plain-English verdict highlighting primary asset strength and main score bottleneck.
   - **PRD Anti-Hallucination Guardrail**: Automatically marks ungrounded columns as `Undocumented / Needs Description` — never invents false documentation.
   - **Allergen & Warning Callout Banner**: Extracts PII tags, failing quality checks, and unowned asset warnings into scannable warning banners.

3. **DataHub GraphQL Read & Write-Back Pipeline**:
   - Queries DataHub GMS (`http://localhost:8080/api/graphql`) to fetch asset metadata.
   - Persists 5 structured properties back to GMS:
     - `nutriTrustScore`
     - `nutriFreshnessScore`
     - `nutriCompletenessScore`
     - `nutriLineageScore`
     - `nutriTestCoverageScore`
   - Auto-attaches `urn:li:tag:nutri:needs-attention` when score falls below threshold (<70).

4. **Interactive Next.js Web App & Catalog Explorer**:
   - **Dropdown Catalog Selector**: Browse and inspect showcase assets (Snowflake, dbt, Postgres).
   - **Custom URN Inspector**: Type/paste any DataHub URN to inspect trust score.
   - **Real-Time Methodology Controls**: Custom weight sliders ("FDA Standard" 25/25/25/25, "Freshness Heavy", "Governance Heavy").
   - **Batch Catalog Inspector**: 1-click audit scanning and persisting scores across the entire catalog.

---

## 📁 Example Artifacts & Output Snippets (For Judges)

Judges can inspect and evaluate Nutri's output quality without running any code by viewing pre-generated sample artifacts in the [`examples/`](examples) folder:

- 📊 [**Catalog Audit Report (Markdown)**](examples/catalog-audit-report.md) — Full catalog audit scan of 18 assets with scores, sub-scores, and status badges.
- 📜 [**Catalog Audit Scorecard (JSON)**](examples/catalog-audit-scorecard.json) — Structured JSON catalog scorecard export.
- ⚡ [**Talk-to-Data SQL Generation**](examples/talk-to-data-sql.sql) — Grounded SQL query output with data nutrition safety warning headers.
- 🔄 [**DataHub Writeback GraphQL Payload**](examples/datahub-writeback-payload.json) — Mutation payload for writing 5 structured properties and applying `nutri:needs-attention` tags in DataHub GMS.
- 🔧 [**dbt Governance Remediation Patch**](examples/dbt-remediation-patch.yml) — Automatically generated dbt `schema.yml` patch to document columns and boost completeness scores.
- 📋 [**Data Contract Compliance SLA Report**](examples/contract-compliance-report.json) — Automated SLA contract audit report with clause evaluation breakdown.

---

## 🛠️ Architecture & Technology Stack

- **Frontend / Framework**: Next.js 14 (App Router), React, Vanilla CSS Design System (`src/styles/nutri-label.css`).
- **Metadata Integration**: DataHub GMS GraphQL API (`http://localhost:8080/api/graphql`).
- **LLM Synthesis**: Google Gemini 2.5 Flash (`@google/genai`).
- **Testing**: Vitest (`npx vitest run`) + TypeScript (`npx tsc --noEmit`).

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Docker & OrbStack (or Docker Desktop)
- Node.js 18+ and `npm`

### 2. Environment Setup
Create a `.env.local` file in the project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key
DATAHUB_GMS_URL=http://localhost:8080
DATAHUB_GRAPHQL_URL=http://localhost:8080/api/graphql
```

### 3. Run DataHub Local Quickstart (OrbStack/Docker)
```bash
# Verify DataHub GMS is running on http://localhost:8080
python3 -m datahub docker quickstart
```

### 4. Install Dependencies & Run Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

```bash
# Run unit & integration test suite
npm test

# Run TypeScript compilation check
npx tsc --noEmit
```

---

## ⚙️ Scoring Methodology & Customization

Scoring weights and threshold parameters are externalized in `src/config/nutri-config.json`:

```json
{
  "freshnessWeight": 0.25,
  "completenessWeight": 0.25,
  "lineageWeight": 0.25,
  "testCoverageWeight": 0.25,
  "needsAttentionThreshold": 70
}
```

Users can adjust these weights in real-time in the web UI or via custom configuration payloads.
