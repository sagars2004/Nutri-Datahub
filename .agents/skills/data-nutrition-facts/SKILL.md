---
name: data-nutrition-facts
description: Query, compute, and enforce DataHub Data Nutrition Facts and Trust Scores (0-100) before writing SQL queries, building dbt models, or generating analytical pipelines.
---

# DataHub Data Nutrition Facts & Trust Score Skill

Use this skill whenever you need to:
1. Validate whether a DataHub catalog dataset is safe, fresh, and well-governed before using it in SQL or code generation.
2. Retrieve the deterministic **Nutri Trust Score (0–100)** and its 4 weighted sub-scores (**Freshness, Completeness, Lineage Depth, Test Coverage**).
3. Diagnose low-trust datasets and generate remediation patches (such as dbt `schema.yml` descriptions and tests).

## How to Query Nutrition Facts

### Option A: Using the CLI
```bash
# Evaluate a single entity
npx tsx scripts/nutri-cli.ts eval "<dataset_urn>" --explain

# Run CI/CD quality gate check
npx tsx scripts/nutri-cli.ts ci --min-score 70
```

### Option B: Using the MCP Tool
When connected via Model Context Protocol (MCP):
* Call `get_data_nutrition_facts(urn)` to retrieve complete facts and column descriptions.
* Call `explain_score(urn, question)` to understand score penalties and get dbt YAML patches.
* Call `write_trust_score(urn)` to persist the score into DataHub GMS structured properties.

### Option C: Using the HTTP API
```bash
curl -s "http://localhost:3000/api/entity?urn=<encoded_urn>"
```

## Trust Score Standards

| Trust Score | Grade | Governance Action |
|---|---|---|
| **85 – 100** | Grade A (Gold) | Safe for production pipelines and executive BI dashboards. |
| **70 – 84** | Grade B (Silver) | Acceptable for internal analytics; monitor assertions. |
| **< 70** | Grade C (Needs Attention) | ⚠️ Flagged with `nutri:needs-attention`. Do NOT generate downstream production models without remediation. |
