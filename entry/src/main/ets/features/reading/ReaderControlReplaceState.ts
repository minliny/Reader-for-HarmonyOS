import { copyReaderReplaceRule, type ReaderReplaceRule } from './ReaderReplaceQuickState';

export interface ReaderControlReplaceState {
  sessionKey: string;
  defaultScope: string;
  revision: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  rules: ReaderReplaceRule[];
  mutationPending: boolean;
  errorMessage: string;
  writeUncertain: boolean;
  canonicalReloadRequired: boolean;
}

export interface ReaderControlReplaceTicket { sessionKey: string; revision: number; }

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

export function createReaderControlReplaceState(sessionKey: string = '', bookTitle: string = '',
  sourceId: string = ''): ReaderControlReplaceState {
  // Existing Core scope is an OR of book/source tokens, not a composite ID.
  // Never parse sessionKey or widen one local book to the shared local origin.
  const scopes: string[] = [];
  if (bookTitle.trim().length > 0) scopes.push(bookTitle.trim());
  if (sourceId.trim().length > 0 && sourceId !== 'local' && sourceId !== bookTitle.trim()) scopes.push(sourceId);
  return { sessionKey, defaultScope: scopes.join(';'), revision: 0, status: 'idle', rules: [], mutationPending: false,
    errorMessage: '', writeUncertain: false, canonicalReloadRequired: false };
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

function copyState(state: ReaderControlReplaceState): ReaderControlReplaceState {
  return { sessionKey: state.sessionKey, defaultScope: state.defaultScope, revision: state.revision, status: state.status,
    rules: state.rules, mutationPending: state.mutationPending,
    errorMessage: state.errorMessage, writeUncertain: state.writeUncertain,
    canonicalReloadRequired: state.canonicalReloadRequired };
}

export function readerControlReplaceTicket(state: ReaderControlReplaceState): ReaderControlReplaceTicket {
  return { sessionKey: state.sessionKey, revision: state.revision };
}

export function readerControlReplaceTicketCurrent(state: ReaderControlReplaceState,
  ticket: ReaderControlReplaceTicket): boolean {
  return state.sessionKey === ticket.sessionKey && state.revision === ticket.revision;
}

export function beginReaderControlReplaceLoad(state: ReaderControlReplaceState): ReaderControlReplaceState {
  if (state.mutationPending) throw new Error('替换规则正在保存，请等待完成');
  const next = copyState(state);
  next.revision += 1;
  next.status = 'loading';
  next.errorMessage = '';
  return next;
}

export function admitReaderControlReplaceLoad(state: ReaderControlReplaceState,
  ticket: ReaderControlReplaceTicket, rules: ReaderReplaceRule[]): ReaderControlReplaceState {
  if (!readerControlReplaceTicketCurrent(state, ticket) || state.mutationPending) return state;
  const next = copyState(state);
  next.rules = orderedReaderControlReplaceRules(rules);
  next.status = 'ready';
  next.errorMessage = '';
  // A fresh read supplies current facts, not proof that an uncertain write failed.
  // The UI leaves its old editor on reload and requires a new explicit action.
  next.writeUncertain = false;
  next.canonicalReloadRequired = false;
  return next;
}

export function beginReaderControlReplaceMutation(state: ReaderControlReplaceState): ReaderControlReplaceState {
  if (state.mutationPending || state.writeUncertain || state.canonicalReloadRequired || state.status !== 'ready') {
    throw new Error('请先完成或重新核对当前替换规则操作');
  }
  const next = copyState(state);
  next.revision += 1; // Invalidates every older list read too.
  next.mutationPending = true;
  next.errorMessage = '';
  return next;
}

export function admitReaderControlReplaceRule(state: ReaderControlReplaceState,
  ticket: ReaderControlReplaceTicket, rule: ReaderReplaceRule): ReaderControlReplaceState {
  if (!readerControlReplaceTicketCurrent(state, ticket)) return state;
  const rules = state.rules.filter((item: ReaderReplaceRule): boolean => item.id !== rule.id);
  rules.push(rule);
  return admitMutation(state, rules);
}

export function admitReaderControlReplaceDeletion(state: ReaderControlReplaceState,
  ticket: ReaderControlReplaceTicket, id: number): ReaderControlReplaceState {
  if (!readerControlReplaceTicketCurrent(state, ticket)) return state;
  return admitMutation(state, state.rules.filter((item: ReaderReplaceRule): boolean => item.id !== id));
}

/** Confirmed import changes the canonical collection; caller must now load it. */
export function admitReaderControlReplaceImport(state: ReaderControlReplaceState,
  ticket: ReaderControlReplaceTicket): ReaderControlReplaceState {
  if (!readerControlReplaceTicketCurrent(state, ticket)) return state;
  const next = copyState(state);
  next.mutationPending = false;
  next.status = 'idle';
  next.errorMessage = '';
  next.writeUncertain = false;
  next.canonicalReloadRequired = true;
  return next;
}

function admitMutation(state: ReaderControlReplaceState, rules: ReaderReplaceRule[]): ReaderControlReplaceState {
  const next = copyState(state);
  next.rules = orderedReaderControlReplaceRules(rules);
  next.mutationPending = false;
  next.status = 'ready';
  next.errorMessage = '';
  next.writeUncertain = false;
  return next;
}

export function failReaderControlReplaceRequest(state: ReaderControlReplaceState,
  ticket: ReaderControlReplaceTicket, message: string, writeUncertain: boolean = false): ReaderControlReplaceState {
  if (!readerControlReplaceTicketCurrent(state, ticket)) return state;
  const next = copyState(state);
  next.mutationPending = false;
  next.status = state.rules.length > 0 && !writeUncertain && !state.writeUncertain &&
    !state.canonicalReloadRequired ? 'ready' : 'error';
  next.errorMessage = message;
  next.writeUncertain = writeUncertain || state.writeUncertain;
  return next;
}

export function createReaderControlReplaceDraft(rule?: ReaderReplaceRule, order: number = 0,
  defaultScope: string = ''): ReaderControlReplaceDraft {
  return { original: rule === undefined ? undefined : copyReaderReplaceRule(rule),
    name: rule?.name ?? '', pattern: rule?.pattern ?? '', replacement: rule?.replacement ?? '',
    group: rule?.group ?? '', scope: rule === undefined ? defaultScope : (rule.scope ?? ''), excludeScope: rule?.excludeScope ?? '',
    scopeTitle: rule?.scopeTitle ?? false, scopeSource: rule?.scopeSource ?? false,
    scopeContent: rule?.scopeContent ?? true, isEnabled: rule?.isEnabled ?? true,
    isRegex: rule?.isRegex ?? true, timeoutMillisecond: rule?.timeoutMillisecond ?? 3000,
    order: rule?.order ?? order };
}
