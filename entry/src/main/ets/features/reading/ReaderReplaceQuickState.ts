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
  scopeContent: boolean;
  excludeScope?: string;
  isEnabled: boolean;
  isRegex: boolean;
  timeoutMillisecond: number;
  order: number;
};

export type ReaderReplaceQuickHiddenReason =
  | 'notLoaded'
  | 'insufficientRules'
  | 'unnamedVisibleRule'
  | 'invalidResponse'
  | 'loadFailed';

export type ReaderReplaceQuickHiddenState = {
  kind: 'hidden';
  reason: ReaderReplaceQuickHiddenReason;
};

export type ReaderReplaceQuickReadyState = {
  kind: 'ready';
  /** Three rows are visible; a fourth real row may continue below the clip. */
  rules: ReaderReplaceRule[];
  /** Raw pre-processing chapter text is not available at this boundary. */
  previewAvailable: false;
  /** No Figma Full Replace production page exists yet. */
  fullManagementAvailable: false;
};

export type ReaderReplaceQuickState = ReaderReplaceQuickHiddenState | ReaderReplaceQuickReadyState;

export function createHiddenReaderReplaceQuickState(
  reason: ReaderReplaceQuickHiddenReason = 'notLoaded',
): ReaderReplaceQuickHiddenState {
  return { kind: 'hidden', reason };
}

/**
 * Creates the only Figma-admitted visible state.
 *
 * The inspected Quick panel has three fully visible rows and no empty,
 * loading, partial-list, invalid-name, or error visual. Consequently fewer
 * than three real named rules fail closed and render no panel. Rules are
 * ordered by the canonical `order` field (then id), and at most one clipped
 * continuation row is retained because that is the source frame structure.
 */
export function createReaderReplaceQuickState(rules: ReaderReplaceRule[]): ReaderReplaceQuickState {
  const ordered = rules.map((rule: ReaderReplaceRule): ReaderReplaceRule => copyReaderReplaceRule(rule));
  ordered.sort((left: ReaderReplaceRule, right: ReaderReplaceRule): number => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id - right.id;
  });
  if (ordered.length < 3) {
    return createHiddenReaderReplaceQuickState('insufficientRules');
  }
  for (let index = 0; index < 3; index += 1) {
    if (ordered[index].name.trim().length === 0) {
      return createHiddenReaderReplaceQuickState('unnamedVisibleRule');
    }
  }
  return {
    kind: 'ready',
    rules: ordered.slice(0, 4),
    previewAvailable: false,
    fullManagementAvailable: false,
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
  if (rule.scope !== undefined) {
    copy.scope = rule.scope;
  }
  if (rule.excludeScope !== undefined) {
    copy.excludeScope = rule.excludeScope;
  }
  return copy;
}
