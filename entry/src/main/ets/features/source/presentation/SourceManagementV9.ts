import type { BookSource, SourceCheckHistoryEntry, SourceCheckOutcome, SourceCheckReport, SourceCheckReportStep, SourceDebugLog, SourceGroupCatalogData } from '../application/SourceGateway';
import { httpUrlHostname } from '../../../platform/network/HttpTransportPolicy.ts';


export type SourceV9View = 'list' | 'import' | 'subscriptions' | 'groups' | 'group-detail' | 'login';
export type SourceV9ForegroundPane = 'import' | 'subscriptions' | 'groups';
export type SourceV9ReportTone = 'unverified' | 'partial' | 'content' | 'earlyFailure' | 'deepFailure';
export type SourceV9ListAction =
  'subscriptions' | 'groups' | 'detect' | 'move' | 'delete' | 'export' | 'enable' | 'disable';

/** The four mineral tones are specific to the v9 diagnostic stages. */
export function sourceV9ReportFill(tone: SourceV9ReportTone, scheme: string): string | undefined {
  const night = scheme === 'night';
  switch (tone) {
    case 'content': return scheme === 'night' ? '#3FA374' : '#247551';
    case 'partial': return night ? '#98BA52' : '#7C9C35';
    case 'earlyFailure': return night ? '#E0655B' : '#C24136';
    case 'deepFailure': return night ? '#E09F46' : '#C97A22';
    default: return undefined;
  }
}

export interface SourceV9Scope {
  keyword: string;
  /** Undefined means all groups. An empty value selects ungrouped sources. */
  group?: string;
  category: string;
  status: string;
}

export interface SourceV9Counts {
  all: number;
  enabled: number;
  disabled: number;
  abnormal: number;
}

export interface SourceV9Projection {
  rows: BookSource[];
  counts: SourceV9Counts;
}

export function sourceV9ParentView(view: SourceV9View): SourceV9View | undefined {
  if (view === 'list') return undefined;
  return view === 'group-detail' ? 'groups' : 'list';
}

/** Group detail belongs to the retained group scene. Login uses the platform host. */
export function sourceV9ForegroundPane(view: SourceV9View): SourceV9ForegroundPane | undefined {
  if (view === 'groups' || view === 'group-detail') return 'groups';
  if (view === 'import' || view === 'subscriptions') return view;
  return undefined;
}

export function sourceV9BlocksOuterBackPreview(view: SourceV9View, temporaryInput: boolean): boolean {
  return view !== 'list' || temporaryInput;
}

export function sourceV9Supports(source: BookSource): boolean {
  return source.category === 'novel' || source.category === 'comic';
}

export function sourceV9LatestReport(source: BookSource): SourceCheckReport | undefined {
  const latest = source.checkReports?.[0];
  return latest?.stale === false ? latest.report : undefined;
}

export function sourceV9ReportTone(source: BookSource): SourceV9ReportTone {
  return sourceV9DiagnosticTone(sourceV9LatestReport(source));
}

export function sourceV9DiagnosticTone(report: SourceCheckReport | undefined): SourceV9ReportTone {
  if (report === undefined) return 'unverified';
  const failed = report.steps.find((step: SourceCheckReportStep): boolean =>
    step.executed && (step.status === 'fail' || step.status === 'not_supported'));
  if (failed !== undefined) return failed.level === 'L4' || failed.level === 'L5' ? 'deepFailure' : 'earlyFailure';
  if (report.steps.some((step: SourceCheckReportStep): boolean => step.level === 'L5' && step.status === 'pass')) return 'content';
  return report.steps.some((step: SourceCheckReportStep): boolean =>
    (step.level === 'L2' || step.level === 'L4') && step.status === 'pass') ? 'partial' : 'unverified';
}

export function projectSourceManagementV9(sources: BookSource[], scope: SourceV9Scope): SourceV9Projection {
  const query = scope.keyword.trim().toLowerCase();
  const rows: BookSource[] = [];
  const counts: SourceV9Counts = { all: 0, enabled: 0, disabled: 0, abnormal: 0 };
  for (const source of sources) {
    if (!sourceV9Supports(source) || (scope.category !== 'all' && source.category !== scope.category) ||
      (scope.group !== undefined && (source.group?.trim() ?? '') !== scope.group) ||
      (query.length > 0 && !source.name.toLowerCase().includes(query) && !source.baseUrl.toLowerCase().includes(query))) continue;
    const tone = sourceV9ReportTone(source);
    const abnormal = tone === 'earlyFailure' || tone === 'deepFailure';
    counts.all += 1;
    if (source.enabled) counts.enabled += 1;
    else counts.disabled += 1;
    if (abnormal) counts.abnormal += 1;
    if ((scope.status === '已启用' || scope.status === '启用') && !source.enabled) continue;
    if (scope.status === '已停用' && source.enabled) continue;
    if (scope.status === '异常' && !abnormal) continue;
    if (scope.status === '未检测' && tone !== 'unverified') continue;
    rows.push(source);
  }
  return { rows, counts };
}

/** Core's local catalog overrides the original imported group after a move. */
export function sourceV9GroupRows(sources: BookSource[], catalog: SourceGroupCatalogData | undefined): BookSource[] {
  if (catalog === undefined) return sources;
  const groups = new Map<string, string>();
  for (const group of catalog.groups) groups.set(group.groupId, group.name);
  const membership = new Map<string, string>();
  for (const entry of catalog.memberships) membership.set(entry.sourceId, groups.get(entry.groupId) ?? '');
  return sources.map((source: BookSource): BookSource => {
    const group = membership.get(source.sourceId) ?? '';
    return (source.group ?? '') === group ? source : { ...source, group };
  });
}

export function projectSourceV9Check(source: BookSource, history: SourceCheckHistoryEntry[],
  previous: BookSource | undefined, clearedAt: number, deniedCurrentReport: boolean = false,
  verifiedLogin: boolean = false): BookSource {
  const latest = history[0];
  const reportWasCleared = clearedAt > 0 && latest === undefined;
  let loginState: BookSource['loginState'] = 'unknown';
  if (source.enabled && (source.loginUrl?.trim().length ?? 0) > 0) {
    const denied = latest !== undefined && !latest.stale && latest.report.steps.some((step: SourceCheckReportStep): boolean =>
      step.executed && step.status === 'fail' && sourceV9LoginDenialReason(step.reason));
    if (denied || deniedCurrentReport) loginState = 'expired';
    else if (verifiedLogin) loginState = 'verified';
  }
  return { ...source, checkReports: history,
    checkState: previous?.checkState ?? (reportWasCleared ? 'unchecked' : source.checkState ?? 'unchecked'),
    checkLevels: previous?.checkLevels ?? (reportWasCleared ? [] : source.checkLevels ?? []),
    checkMessage: previous?.checkMessage ?? (reportWasCleared ? undefined : source.checkMessage),
    loginState, lastCheckSummary: reportWasCleared ? undefined : source.lastCheckSummary };
}

export function retainSourceV9Check(source: BookSource, state: BookSource['checkState'],
  levels: string[], message: string, history: SourceCheckHistoryEntry[] | undefined): BookSource {
  return { ...source, checkState: state, checkLevels: levels, checkMessage: message, checkReports: history };
}

function sourceV9LoginDenialReason(reason: string | undefined): boolean {
  return /\blogin\b|\bauthentication\b|登录|鉴权|\b(?:401|403)\b/i.test(reason ?? '');
}

/** Use the failed stage's Core reason or the HTTP evidence from the same request. */
export function sourceV9AuthenticationDenied(outcome: SourceCheckOutcome): boolean {
  if (outcome.available) return false;
  const failed = outcome.report?.steps.find((step: SourceCheckReportStep): boolean => step.executed && step.status === 'fail');
  if (sourceV9LoginDenialReason(failed?.reason) || sourceV9LoginDenialReason(outcome.failureReason)) return true;
  if (failed === undefined) return false;
  return outcome.logs.some((log: SourceDebugLog): boolean =>
    log.sourceId === outcome.sourceId && log.traceId === outcome.traceId && log.step === failed.level &&
    (log.statusCode === 401 || log.statusCode === 403));
}

export function sourceV9CheckStepText(step: SourceCheckReportStep | undefined, currentFailure?: string): string {
  if (step === undefined) return '待检测';
  if (step.status === 'pass') return '通过';
  const status = step.status === 'fail' ? '失败' : step.status === 'blocked' ? '已中止' :
    step.status === 'not_supported' ? '不支持' : step.status === 'cancelled' ? '已取消' : '未请求';
  const prefix = step.level + ':';
  const reason = step.status === 'fail' && currentFailure?.startsWith(prefix) ?
    currentFailure.slice(prefix.length).trim() : step.reason;
  return reason === undefined || reason.length === 0 ? status : `${status} · ${reason}`;
}

export function sourceV9DisplayUrl(url: string): string {
  const host = httpUrlHostname(url);
  if (host === undefined) return '';
  const scheme = /^http:\/\//i.test(url.trim()) ? 'http' : 'https';
  return `${scheme}://${host.includes(':') ? `[${host}]` : host}`;
}
