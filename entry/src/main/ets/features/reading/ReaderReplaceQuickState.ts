/**
 * Core-owned replacement rule shape admitted by `replace-rule.list`.
 *
 * Quick Replace never manufactures the Figma sample rows. Every visible row
 * is a decoded Core rule and retains its canonical identity for persistence.
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

export type ReaderReplaceQuickHiddenReason =
  | 'notLoaded'
  | 'invalidResponse'
  | 'loadFailed';

export type ReaderReplaceQuickHiddenState = {
  kind: 'hidden';
  reason: ReaderReplaceQuickHiddenReason;
};

export type ReaderReplaceQuickReadyState = {
  kind: 'ready';
  /** Quick access contains at most the first three canonical rules. */
  rules: ReaderReplaceRule[];
  /** Core can derive a bounded before/after view from its raw chapter cache. */
  previewAvailable: true;
  /** The reader routes to the existing full rules-management surface. */
  fullManagementAvailable: true;
};

export type ReaderReplaceQuickState = ReaderReplaceQuickHiddenState | ReaderReplaceQuickReadyState;

export function createHiddenReaderReplaceQuickState(
  reason: ReaderReplaceQuickHiddenReason = 'notLoaded',
): ReaderReplaceQuickHiddenState {
  return { kind: 'hidden', reason };
}

/**
 * Creates the reader's bounded Quick Replace projection.
 *
 * Rules are ordered by the canonical `order` field (then id), and the panel
 * exposes at most three real rules. A valid empty list is still ready so the
 * visible entry can open an honest empty state; transport/decoding failures
 * continue to use the hidden state.
 */
export function createReaderReplaceQuickState(rules: ReaderReplaceRule[]): ReaderReplaceQuickState {
  const ordered = rules.map((rule: ReaderReplaceRule): ReaderReplaceRule => copyReaderReplaceRule(rule));
  ordered.sort((left: ReaderReplaceRule, right: ReaderReplaceRule): number => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id - right.id;
  });
  return {
    kind: 'ready',
    rules: ordered.slice(0, 3),
    previewAvailable: true,
    fullManagementAvailable: true,
  };
}

/** Applies a confirmed Core update without optimistic or synthetic state. */
export function replaceConfirmedReaderReplaceRule(
  state: ReaderReplaceQuickState,
  confirmedRule: ReaderReplaceRule,
): ReaderReplaceQuickState {
  if (state.kind !== 'ready') {
    return state;
  }
  const rules: ReaderReplaceRule[] = [];
  let replaced = false;
  for (const rule of state.rules) {
    if (rule.id === confirmedRule.id) {
      rules.push(copyReaderReplaceRule(confirmedRule));
      replaced = true;
    } else {
      rules.push(copyReaderReplaceRule(rule));
    }
  }
  if (!replaced) {
    return state;
  }
  return createReaderReplaceQuickState(rules);
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
