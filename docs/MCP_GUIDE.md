# DataHub Nutri Model Context Protocol (MCP) Server Integration Guide

Nutri provides a standardized **Model Context Protocol (MCP)** server that exposes DataHub dataset health, trust scores, lineage quality, and metadata writeback capabilities to AI assistants like **Cursor**, **Claude Desktop**, and **Claude Code**.

---

## 1. Quick Setup for Cursor IDE

Add the Nutri MCP server to your Cursor configuration file at `~/.cursor/mcp.json` or in your project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nutri-datahub": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/Users/sagarsahu/Desktop/Projects/Nutri-Datahub/scripts/mcp-server.ts"
      ],
      "env": {
        "DATAHUB_GRAPHQL_URL": "http://localhost:8080/api/graphql"
      }
    }
  }
}
```

---

## 2. Quick Setup for Claude Desktop

Add the server to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "nutri-datahub": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/Users/sagarsahu/Desktop/Projects/Nutri-Datahub/scripts/mcp-server.ts"
      ],
      "env": {
        "DATAHUB_GRAPHQL_URL": "http://localhost:8080/api/graphql"
      }
    }
  }
}
```

---

## 3. Web & HTTP JSON-RPC Endpoint

If you are building a web agent or using HTTP-based MCP clients, Nutri exposes an HTTP endpoint at:
```http
POST http://localhost:3000/api/mcp
```

### Available Tools:

1. **`get_data_nutrition_facts`**
   - Input: `{ "urn": "urn:li:dataset:(...)" }`
   - Returns: Trust Score (0–100), Freshness, Completeness, Lineage, Test Coverage breakdowns, column descriptions, and allergen/PII warnings.

2. **`search_catalog_datasets`**
   - Input: `{ "query": "order", "platform": "snowflake" }`
   - Returns: Matching approved catalog assets.

3. **`write_trust_score`**
   - Input: `{ "urn": "urn:li:dataset:(...)" }`
   - Returns: Success status of persisting `nutriTrustScore` structured property and `nutri:needs-attention` tag into DataHub GMS.

4. **`explain_score`**
   - Input: `{ "urn": "urn:li:dataset:(...)", "question": "How do I reach 90+?" }`
   - Returns: Detailed root-cause breakdown and actionable remediation plan.
