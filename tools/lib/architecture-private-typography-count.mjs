import { auditTypographyConsumers, isSharedTypographyExpression } from './reader-typography-consumer-audit.mjs';

/** Actual ETS carrier counter used by the full architecture gate. Public roles
 * are validated separately; a literal/mixed branch/numeric override consumes
 * the unchanged private budget even if it contains a public role substring. */
export function countPrivateTypographyCalls(source, file) {
  return auditTypographyConsumers(source, file).filter(node => node.modifiers.fontSize &&
    !isSharedTypographyExpression(node.modifiers.fontSize.expression)).length;
}
