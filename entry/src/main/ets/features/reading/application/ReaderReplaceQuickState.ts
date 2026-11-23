/**
 * Core-owned replacement rule shape admitted by `replace-rule.list`.
 *
 * Both control forms retain the rule's canonical identity for persistence.
 */
export type ReaderReplaceRule = {
  id: number;
  name: string;
  group?: string;
  pattern: string;
  replacement: string;
  scope?: string;
  scopeTitle: boolean;
  /** Optional for legacy snapshots; current Core also supports source-import rules. */
  scopeSource?: boolean;
  scopeContent: boolean;
  excludeScope?: string;
  isEnabled: boolean;
  isRegex: boolean;
  timeoutMillisecond: number;
  order: number;
};

export interface ReaderControlReplaceDraft {
  original: ReaderReplaceRule | undefined;
  name: string;
  pattern: string;
  replacement: string;
  group: string;
  scope: string;
  excludeScope: string;
  scopeTitle: boolean;
  scopeSource: boolean;
  scopeContent: boolean;
  isEnabled: boolean;
  isRegex: boolean;
  timeoutMillisecond: number;
  order: number;
}

export function orderedReaderControlReplaceRules(rules: ReaderReplaceRule[]): ReaderReplaceRule[] {
  const ids = new Set<number>();
  const ordered: ReaderReplaceRule[] = [];
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error('Core returned duplicate replacement rule identity');
    ids.add(rule.id);
    ordered.push(copyReaderReplaceRule(rule));
  }
  return ordered.sort((a: ReaderReplaceRule, b: ReaderReplaceRule): number => a.order - b.order || a.id - b.id);
}

export function copyReaderReplaceRule(rule: ReaderReplaceRule): ReaderReplaceRule {
  const copy: ReaderReplaceRule = {
    id: rule.id,
    name: rule.name,
    pattern: rule.pattern,
    replacement: rule.replacement,
    scopeTitle: rule.scopeTitle,
    scopeContent: rule.scopeContent,
    isEnabled: rule.isEnabled,
    isRegex: rule.isRegex,
    timeoutMillisecond: rule.timeoutMillisecond,
    order: rule.order,
  };
  if (rule.group !== undefined) {
    copy.group = rule.group;
  }
  if (rule.scopeSource !== undefined) {
    copy.scopeSource = rule.scopeSource;
  }
  if (rule.scope !== undefined) {
    copy.scope = rule.scope;
  }
  if (rule.excludeScope !== undefined) {
    copy.excludeScope = rule.excludeScope;
  }
  return copy;
}
