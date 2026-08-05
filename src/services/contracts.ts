import { NutriEntity, NutriAssertion } from '../types/nutri';

export type ContractStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'NO_CONTRACT';

export interface ContractClause {
  id: string;
  type: 'SCHEMA' | 'FRESHNESS' | 'VOLUME' | 'QUALITY' | 'CUSTOM_SQL';
  name: string;
  expected: string;
  actual: string;
  status: 'PASSED' | 'FAILED';
  lastEvaluatedAt?: number;
}

export interface DataContractReport {
  entityUrn: string;
  entityName: string;
  status: ContractStatus;
  totalClauses: number;
  passedClauses: number;
  failedClauses: number;
  compliancePct: number;
  clauses: ContractClause[];
  contractViolations: string[];
}

/**
 * DataHub Data Contracts & Assertions Evaluator
 */
export class DataHubContractEngine {
  /**
   * Evaluates an entity against DataHub contract specifications
   */
  public static evaluateContract(entity: NutriEntity): DataContractReport {
    const clauses: ContractClause[] = [];
    const violations: string[] = [];

    // 1. Freshness SLA Clause
    if (entity.lastModifiedTimestamp) {
      const hoursAgo = (Date.now() - entity.lastModifiedTimestamp) / (3600 * 1000);
      const isFresh = hoursAgo <= 48; // Standard 48h SLA

      const clause: ContractClause = {
        id: 'sla_freshness',
        type: 'FRESHNESS',
        name: 'SLA Freshness Contract',
        expected: 'Updated within 48 hours',
        actual: `Updated ${Math.round(hoursAgo)} hours ago`,
        status: isFresh ? 'PASSED' : 'FAILED',
        lastEvaluatedAt: entity.lastModifiedTimestamp,
      };
      clauses.push(clause);
      if (!isFresh) {
        violations.push(`SLA Breach: Dataset updated ${Math.round(hoursAgo)}h ago (SLA: 48h)`);
      }
    }

    // 2. Schema Contract Clause (Required Documentation & Ownership)
    const undocumentedFields = entity.fields.filter(
      (f) => (!f.description || f.description.trim().length === 0) && f.glossaryTerms.length === 0
    );
    const hasCompleteSchema = undocumentedFields.length === 0 && entity.owners.length > 0;

    clauses.push({
      id: 'schema_governance',
      type: 'SCHEMA',
      name: 'Schema Governance Contract',
      expected: 'All columns documented + active owner assigned',
      actual: `${entity.fields.length - undocumentedFields.length}/${entity.fields.length} columns documented, ${entity.owners.length} owners`,
      status: hasCompleteSchema ? 'PASSED' : 'FAILED',
    });

    if (!hasCompleteSchema) {
      if (undocumentedFields.length > 0) {
        violations.push(`Schema Violation: ${undocumentedFields.length} columns lack documentation`);
      }
      if (entity.owners.length === 0) {
        violations.push('Governance Violation: No dataset owner assigned');
      }
    }

    // 3. Quality Assertions Clauses (DataHub Native Assertions)
    for (const assertion of entity.assertions) {
      const clause: ContractClause = {
        id: `assertion_${assertion.urn}`,
        type: this.mapAssertionType(assertion.type),
        name: `${assertion.type} Assertion`,
        expected: 'Assertion expression evaluates to TRUE',
        actual: assertion.passed ? 'Passing' : 'Failing / Check Breached',
        status: assertion.passed ? 'PASSED' : 'FAILED',
      };
      clauses.push(clause);

      if (!assertion.passed) {
        violations.push(`Contract Failure: Quality check "${assertion.type}" failed in DataHub`);
      }
    }

    const passedClauses = clauses.filter((c) => c.status === 'PASSED').length;
    const failedClauses = clauses.filter((c) => c.status === 'FAILED').length;
    const compliancePct = clauses.length > 0
      ? Math.round((passedClauses / clauses.length) * 100)
      : 100;

    let status: ContractStatus = 'PASSED';
    if (clauses.length === 0) {
      status = 'NO_CONTRACT';
    } else if (failedClauses > 0) {
      status = 'FAILED';
    }

    return {
      entityUrn: entity.urn,
      entityName: entity.name,
      status,
      totalClauses: clauses.length,
      passedClauses,
      failedClauses,
      compliancePct,
      clauses,
      contractViolations: violations,
    };
  }

  private static mapAssertionType(type: string): ContractClause['type'] {
    const upper = type.toUpperCase();
    if (upper.includes('FRESH')) return 'FRESHNESS';
    if (upper.includes('VOL') || upper.includes('ROW')) return 'VOLUME';
    if (upper.includes('SQL')) return 'CUSTOM_SQL';
    if (upper.includes('SCHEMA')) return 'SCHEMA';
    return 'QUALITY';
  }
}
