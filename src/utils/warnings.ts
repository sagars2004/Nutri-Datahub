import { NutriEntity } from '../types/nutri';

/**
 * Extracts Allergen / Warning flags (PII callouts, governance warnings, assertion failures)
 */
export function extractAllergenWarnings(entity: NutriEntity): string[] {
  const warnings: string[] = [];

  // PII & Sensitive Tags
  const piiTags = entity.tags.filter((t) =>
    /pii|sensitive|confidential|restricted|secret/i.test(t)
  );
  if (piiTags.length > 0) {
    warnings.push(`Contains Sensitive/PII Data (${piiTags.join(', ')})`);
  }

  // Field-level PII Tags
  for (const field of entity.fields) {
    const fieldPii = field.tags.filter((t) => /pii|sensitive/i.test(t));
    if (fieldPii.length > 0) {
      warnings.push(`Column "${field.fieldPath}" flagged with ${fieldPii.join(', ')}`);
    }
  }

  // Assertion failures
  const failedAssertions = entity.assertions.filter((a) => !a.passed);
  for (const fa of failedAssertions) {
    warnings.push(`Failing Quality Check: ${fa.type}`);
  }

  // Governance warnings
  if (entity.owners.length === 0) {
    warnings.push('Unowned Asset (No Owner Assigned)');
  }

  return warnings;
}
