#!/usr/bin/env node
/**
 * Nutri-DataHub CLI & SDK Automation Tool
 * 
 * Commands:
 *   npx tsx scripts/nutri-cli.ts eval <urn> [--writeback] [--explain] [--mode talk_to_data|governance]
 *   npx tsx scripts/nutri-cli.ts contract <urn>
 *   npx tsx scripts/nutri-cli.ts batch [--platform <name>] [--min-score <number>] [--output report.md]
 *   npx tsx scripts/nutri-cli.ts write-back <urn>
 *   npx tsx scripts/nutri-cli.ts export [--format json|markdown] [--output <path>]
 *   npx tsx scripts/nutri-cli.ts ci [--min-score <number>] [--platform <name>]
 */

import { fetchNutriEntity, writeTrustScoreToDataHub } from '../src/services/datahub';
import { calculateTrustScore } from '../src/engine/scoring';
import { generateScoreSummary, extractAllergenWarnings } from '../src/services/llm';
import { chatWithAnalyticsAgent, AgentMode } from '../src/services/agent';
import { DataHubContractEngine } from '../src/services/contracts';
import { APPROVED_SHOWCASE_DATASETS } from '../src/config/approved-catalog';
import * as fs from 'fs';

// ANSI terminal colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function printBanner() {
  console.log(`
${c.cyan}${c.bold}=======================================================
   🥗  NUTRI — DATA NUTRITION FACTS & TRUST SCORE CLI  🥗
=======================================================${c.reset}
`);
}

function scoreColor(score: number): string {
  if (score >= 85) return `${c.green}${c.bold}${score}/100${c.reset}`;
  if (score >= 70) return `${c.yellow}${c.bold}${score}/100${c.reset}`;
  return `${c.red}${c.bold}${score}/100${c.reset}`;
}

async function handleEval(args: string[]) {
  const urn = args[0];
  if (!urn || urn.startsWith('--')) {
    console.error(`${c.red}Error: Missing required dataset URN.${c.reset}`);
    console.log(`Usage: npx tsx scripts/nutri-cli.ts eval <urn> [--writeback] [--explain]`);
    process.exit(1);
  }

  const shouldWriteback = args.includes('--writeback');
  const shouldExplain = args.includes('--explain');
  const modeIndex = args.indexOf('--mode');
  const agentMode: AgentMode = modeIndex !== -1 && args[modeIndex + 1] === 'talk_to_data' ? 'talk_to_data' : 'governance';

  console.log(`${c.dim}Fetching metadata from DataHub for:${c.reset} ${c.bold}${urn}${c.reset}`);
  const entity = await fetchNutriEntity(urn);
  const scoreResult = calculateTrustScore(entity);
  const verdict = await generateScoreSummary(entity, scoreResult);
  const warnings = extractAllergenWarnings(entity);
  const contract = DataHubContractEngine.evaluateContract(entity);

  console.log(`
${c.bold}┌────────────────────────────────────────────────────────┐
│               DATA NUTRITION FACTS                     │
├────────────────────────────────────────────────────────┤${c.reset}
│ ${c.bold}Asset Name:${c.reset}  ${entity.name.padEnd(41)} │
│ ${c.bold}Platform:${c.reset}    ${entity.platform.toUpperCase().padEnd(41)} │
│ ${c.bold}Entity Type:${c.reset} ${entity.entityType.padEnd(41)} │
├────────────────────────────────────────────────────────┤
│ ${c.bold}TRUST SCORE:${c.reset} ${scoreColor(scoreResult.trustScore).padEnd(50)} │
│ ${c.bold}CONTRACT:${c.reset}    ${(contract.status === 'PASSED' ? `${c.green}✔ ${contract.compliancePct}% COMPLIANT` : `${c.yellow}⚠️ ${contract.compliancePct}% COMPLIANT`).padEnd(50)}${c.reset} │
├────────────────────────────────────────────────────────┤
│ ${c.dim}Sub-Scores Breakdown (Weighted 25% each):${c.reset}               │
│  • Freshness:     ${scoreResult.subScores.freshness}% (${scoreResult.breakdown.freshnessDetails})
│  • Completeness:  ${scoreResult.subScores.completeness}% (${scoreResult.breakdown.completenessDetails})
│  • Lineage Depth: ${scoreResult.subScores.lineage}% (${scoreResult.breakdown.lineageDetails})
│  • Test Coverage: ${scoreResult.subScores.testCoverage}% (${scoreResult.breakdown.testCoverageDetails})
├────────────────────────────────────────────────────────┤
│ ${c.bold}Verdict Summary:${c.reset}
│ ${c.dim}${verdict}${c.reset}
├────────────────────────────────────────────────────────┤
│ ${c.bold}Governance & Warnings (${warnings.length}):${c.reset}
${warnings.length > 0 ? warnings.map((w) => `│  ${c.yellow}⚠️  ${w}${c.reset}`).join('\n') : `│  ${c.green}✅ No active warnings.${c.reset}`}
${c.bold}└────────────────────────────────────────────────────────┘${c.reset}
`);

  if (shouldWriteback) {
    console.log(`${c.cyan}Writing Trust Score back to DataHub GMS structured properties...${c.reset}`);
    const synced = await writeTrustScoreToDataHub(urn, scoreResult);
    if (synced) {
      console.log(`${c.green}✅ Persisted nutriTrustScore (${scoreResult.trustScore}) to DataHub.${c.reset}`);
    }
  }

  if (shouldExplain) {
    console.log(`\n${c.cyan}${c.bold}🤖 Analytics Agent Diagnosis & Remediation [Mode: ${agentMode}]:${c.reset}`);
    const explanation = await chatWithAnalyticsAgent(
      entity,
      scoreResult,
      agentMode === 'talk_to_data' ? 'Write safe SQL to preview this dataset' : 'Provide a root-cause breakdown and remediation advice.',
      [],
      agentMode
    );
    console.log(explanation);
  }
}

async function handleContract(args: string[]) {
  const urn = args[0];
  if (!urn) {
    console.error(`${c.red}Error: Missing dataset URN.${c.reset}`);
    process.exit(1);
  }

  const entity = await fetchNutriEntity(urn);
  const contract = DataHubContractEngine.evaluateContract(entity);

  console.log(`
${c.bold}📋 DataHub Contract Compliance Report for: ${entity.name} (${entity.platform.toUpperCase()})${c.reset}
Status: ${contract.status === 'PASSED' ? `${c.green}${c.bold}PASSED (100%)${c.reset}` : `${c.red}${c.bold}FAILED (${contract.compliancePct}% Compliance)${c.reset}`}
Clauses Evaluated: ${contract.totalClauses} (${contract.passedClauses} passed, ${contract.failedClauses} failed)

${c.bold}Clauses Details:${c.reset}
${contract.clauses.map((cl) => `  * [${cl.status === 'PASSED' ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`}] ${c.bold}${cl.name}${c.reset} (${cl.type})
    Expected: ${cl.expected}
    Actual:   ${cl.actual}`).join('\n\n')}
`);
}

async function handleWriteBack(args: string[]) {
  const urn = args[0];
  if (!urn) {
    console.error(`${c.red}Error: Missing dataset URN.${c.reset}`);
    process.exit(1);
  }

  const entity = await fetchNutriEntity(urn);
  const scoreResult = calculateTrustScore(entity);

  console.log(`${c.dim}Persisting Trust Score (${scoreResult.trustScore}/100) to DataHub GMS for URN:${c.reset} ${urn}`);
  const ok = await writeTrustScoreToDataHub(urn, scoreResult);
  if (ok) {
    console.log(`${c.green}✅ Successfully persisted nutri.trustScore and properties to DataHub.${c.reset}`);
  } else {
    console.log(`${c.yellow}⚠️  Completed offline evaluation (DataHub GMS offline).${c.reset}`);
  }
}

async function handleExport(args: string[]) {
  const formatIndex = args.indexOf('--format');
  const format = formatIndex !== -1 ? args[formatIndex + 1]?.toLowerCase() : 'json';

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : `nutri-catalog-export.${format === 'markdown' ? 'md' : 'json'}`;

  console.log(`${c.dim}Auditing all ${APPROVED_SHOWCASE_DATASETS.length} datasets for export...${c.reset}`);

  const records: any[] = [];
  for (const ds of APPROVED_SHOWCASE_DATASETS) {
    const entity = await fetchNutriEntity(ds.urn);
    const score = calculateTrustScore(entity);
    const contract = DataHubContractEngine.evaluateContract(entity);
    records.push({
      urn: ds.urn,
      name: ds.name,
      platform: ds.platform,
      trustScore: score.trustScore,
      subScores: score.subScores,
      contractStatus: contract.status,
      contractCompliancePct: contract.compliancePct,
      needsAttention: score.needsAttention,
      evaluatedAt: new Date(score.evaluatedAt).toISOString(),
    });
  }

  if (format === 'markdown') {
    const md = `# DataHub Nutrition Facts Catalog Export
Generated: ${new Date().toISOString()}

| Platform | Dataset | Trust Score | Freshness | Completeness | Lineage | Test Coverage | Contract |
|---|---|---|---|---|---|---|---|
${records.map((r) => `| \`${r.platform}\` | **${r.name}** | **${r.trustScore}** | ${r.subScores.freshness}% | ${r.subScores.completeness}% | ${r.subScores.lineage}% | ${r.subScores.testCoverage}% | ${r.contractStatus} (${r.contractCompliancePct}%) |`).join('\n')}
`;
    fs.writeFileSync(outputFile, md, 'utf-8');
  } else {
    fs.writeFileSync(outputFile, JSON.stringify(records, null, 2), 'utf-8');
  }

  console.log(`${c.green}✅ Exported ${records.length} records to:${c.reset} ${outputFile}`);
}

async function handleBatch(args: string[]) {
  const platformIndex = args.indexOf('--platform');
  const platformFilter = platformIndex !== -1 ? args[platformIndex + 1]?.toLowerCase() : undefined;

  const minScoreIndex = args.indexOf('--min-score');
  const minScoreFilter = minScoreIndex !== -1 ? parseInt(args[minScoreIndex + 1], 10) : 0;

  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  let datasets = APPROVED_SHOWCASE_DATASETS;
  if (platformFilter && platformFilter !== 'all') {
    datasets = datasets.filter((d) => d.platform.toLowerCase() === platformFilter);
  }

  console.log(`${c.dim}Evaluating ${datasets.length} catalog dataset(s)...${c.reset}\n`);

  const results: any[] = [];
  console.log(`${c.bold}${'Platform'.padEnd(12)} ${'Score'.padEnd(10)} ${'Status'.padEnd(18)} ${'Dataset Name'}${c.reset}`);
  console.log('─'.repeat(70));

  for (const ds of datasets) {
    const entity = await fetchNutriEntity(ds.urn);
    const score = calculateTrustScore(entity);
    const passed = score.trustScore >= minScoreFilter;

    results.push({
      urn: ds.urn,
      name: ds.name,
      platform: ds.platform,
      trustScore: score.trustScore,
      subScores: score.subScores,
      needsAttention: score.needsAttention,
      passed,
    });

    const statusBadge = score.needsAttention
      ? `${c.red}⚠️  NEEDS ATTN${c.reset}`
      : `${c.green}✅ HEALTHY   ${c.reset}`;

    console.log(
      `${ds.platform.toUpperCase().padEnd(12)} ${scoreColor(score.trustScore).padEnd(19)} ${statusBadge.padEnd(27)} ${ds.name}`
    );
  }

  const avgScore = Math.round(results.reduce((acc, r) => acc + r.trustScore, 0) / (results.length || 1));
  console.log('─'.repeat(70));
  console.log(`${c.bold}Catalog Average Trust Score:${c.reset} ${scoreColor(avgScore)} across ${results.length} entities.`);

  if (outputFile) {
    const markdown = `
# DataHub Nutri Catalog Audit Report
*Generated on: ${new Date().toISOString()}*

### Summary Metrics:
* **Total Evaluated:** ${results.length}
* **Average Trust Score:** ${avgScore}/100
* **Healthy Assets (≥70):** ${results.filter((r) => !r.needsAttention).length}
* **Needs Attention (<70):** ${results.filter((r) => r.needsAttention).length}

| Platform | Dataset Name | Trust Score | Freshness | Completeness | Lineage | Test Coverage | Status |
|---|---|---|---|---|---|---|---|
${results.map((r) => `| \`${r.platform}\` | **${r.name}** | **${r.trustScore}** | ${r.subScores.freshness}% | ${r.subScores.completeness}% | ${r.subScores.lineage}% | ${r.subScores.testCoverage}% | ${r.needsAttention ? '⚠️ Needs Attention' : '✅ Healthy'} |`).join('\n')}
    `.trim();

    fs.writeFileSync(outputFile, markdown, 'utf-8');
    console.log(`\n${c.green}✅ Exported Markdown audit report to:${c.reset} ${outputFile}`);
  }
}

async function handleCi(args: string[]) {
  const minScoreIndex = args.indexOf('--min-score');
  const minScore = minScoreIndex !== -1 ? parseInt(args[minScoreIndex + 1], 10) : 70;

  const platformIndex = args.indexOf('--platform');
  const platformFilter = platformIndex !== -1 ? args[platformIndex + 1]?.toLowerCase() : undefined;

  let datasets = APPROVED_SHOWCASE_DATASETS;
  if (platformFilter && platformFilter !== 'all') {
    datasets = datasets.filter((d) => d.platform.toLowerCase() === platformFilter);
  }

  console.log(`${c.bold}Running Nutri CI/CD Quality Gate (Minimum Threshold: ${minScore}/100)...${c.reset}\n`);

  const failures: { name: string; platform: string; score: number; urn: string }[] = [];

  for (const ds of datasets) {
    const entity = await fetchNutriEntity(ds.urn);
    const score = calculateTrustScore(entity);

    if (score.trustScore < minScore) {
      failures.push({
        name: ds.name,
        platform: ds.platform,
        score: score.trustScore,
        urn: ds.urn,
      });
      console.log(` ${c.red}✖ FAIL${c.reset} [${score.trustScore}/${minScore}] ${ds.platform.toUpperCase()}: ${ds.name}`);
    } else {
      console.log(` ${c.green}✔ PASS${c.reset} [${score.trustScore}/${minScore}] ${ds.platform.toUpperCase()}: ${ds.name}`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  if (failures.length > 0) {
    console.error(`\n${c.red}${c.bold}CI/CD QUALITY GATE FAILED!${c.reset}`);
    console.error(`${failures.length} dataset(s) failed the minimum trust threshold of ${minScore}/100.\n`);
    process.exit(1);
  } else {
    console.log(`\n${c.green}${c.bold}CI/CD QUALITY GATE PASSED!${c.reset} All evaluated datasets meet the ${minScore}/100 standard.\n`);
    process.exit(0);
  }
}

async function main() {
  printBanner();
  const command = process.argv[2];
  const restArgs = process.argv.slice(3);

  switch (command) {
    case 'eval':
      await handleEval(restArgs);
      break;
    case 'contract':
      await handleContract(restArgs);
      break;
    case 'write-back':
      await handleWriteBack(restArgs);
      break;
    case 'export':
      await handleExport(restArgs);
      break;
    case 'batch':
      await handleBatch(restArgs);
      break;
    case 'ci':
      await handleCi(restArgs);
      break;
    default:
      console.log(`
Usage:
  npx tsx scripts/nutri-cli.ts <command> [options]

Commands:
  ${c.bold}eval <urn>${c.reset}        Compute Trust Score & facts for a single dataset
                     Options: --writeback, --explain, --mode talk_to_data|governance
  ${c.bold}contract <urn>${c.reset}    Evaluate DataHub Data Contract & SLA compliance
  ${c.bold}write-back <urn>${c.reset}  Persist Trust Score to DataHub Structured Properties
  ${c.bold}export${c.reset}            Export catalog scorecard (--format json|markdown --output <file>)
  ${c.bold}batch${c.reset}             Scan approved catalog datasets (--platform <name>, --output <report.md>)
  ${c.bold}ci${c.reset}                Run CI/CD quality gate enforcement (--min-score 70)
      `);
      break;
  }
}

main().catch((err) => {
  console.error(`${c.red}Nutri CLI Fatal Error:${c.reset}`, err);
  process.exit(1);
});
