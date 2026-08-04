#!/usr/bin/env node
/**
 * Nutri-DataHub CLI & SDK Automation Tool
 * 
 * Commands:
 *   npx tsx scripts/nutri-cli.ts eval <urn> [--writeback] [--explain]
 *   npx tsx scripts/nutri-cli.ts batch [--platform <name>] [--min-score <number>] [--output report.md]
 *   npx tsx scripts/nutri-cli.ts ci [--min-score <number>] [--platform <name>]
 */

import { fetchNutriEntity, writeTrustScoreToDataHub } from '../src/services/datahub';
import { calculateTrustScore } from '../src/engine/scoring';
import { generateScoreSummary, extractAllergenWarnings } from '../src/services/llm';
import { chatWithAnalyticsAgent } from '../src/services/agent';
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

  console.log(`${c.dim}Fetching metadata from DataHub for:${c.reset} ${c.bold}${urn}${c.reset}`);
  const entity = await fetchNutriEntity(urn);
  const scoreResult = calculateTrustScore(entity);
  const verdict = await generateScoreSummary(entity, scoreResult);
  const warnings = extractAllergenWarnings(entity);

  console.log(`
${c.bold}┌────────────────────────────────────────────────────────┐
│               DATA NUTRITION FACTS                     │
├────────────────────────────────────────────────────────┤${c.reset}
│ ${c.bold}Asset Name:${c.reset}  ${entity.name.padEnd(41)} │
│ ${c.bold}Platform:${c.reset}    ${entity.platform.toUpperCase().padEnd(41)} │
│ ${c.bold}Entity Type:${c.reset} ${entity.entityType.padEnd(41)} │
├────────────────────────────────────────────────────────┤
│ ${c.bold}TRUST SCORE:${c.reset} ${scoreColor(scoreResult.trustScore).padEnd(50)} │
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
      if (scoreResult.needsAttention) {
        console.log(`${c.yellow}⚠️  Attached "nutri:needs-attention" governance tag (<70 threshold).${c.reset}`);
      }
    }
  }

  if (shouldExplain) {
    console.log(`\n${c.cyan}${c.bold}🤖 Analytics Agent Diagnosis & Remediation:${c.reset}`);
    const explanation = await chatWithAnalyticsAgent(
      entity,
      scoreResult,
      'Provide a root-cause breakdown and concrete remediation advice for this score.'
    );
    console.log(explanation);
  }
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
                     Options: --writeback (save to DataHub GMS), --explain (AI diagnosis)
  ${c.bold}batch${c.reset}             Scan approved catalog datasets
                     Options: --platform <name>, --min-score <num>, --output <report.md>
  ${c.bold}ci${c.reset}                Run CI/CD quality gate enforcement
                     Options: --min-score <num> (default: 70), --platform <name>
      `);
      break;
  }
}

main().catch((err) => {
  console.error(`${c.red}Nutri CLI Fatal Error:${c.reset}`, err);
  process.exit(1);
});
