import type { BookSource } from '../application/SourceGateway';
import type { JsonObject } from '@reader/core-harmony';

/** Identity fields already owned by the source journey's normal page opening. */
export interface SourceVerificationOpening {
  readonly mounting: number;
  readonly generation: number;
}

export interface SourceVerificationOriginalControl {
  readonly blocked: boolean;
  readonly generation: number;
  readonly operationId?: string;
  readonly canRetryOriginal: boolean;
  readonly busy: boolean;
}

export interface SourceVerificationReceiptControl {
  readonly confirmation: string;
  readonly generation: number;
  readonly canRetry: boolean;
}

export interface SourceVerificationControl {
  readonly branch: 'original' | 'unknown' | 'row';
  readonly control: 'reconcile' | 'continue' | 'login';
  readonly generation: number;
  readonly blocked: boolean;
  readonly canContinue: boolean;
  readonly sourceAnchor?: number;
  readonly loginEligible?: true;
}

export function sourceVerificationOpening(identity: string): SourceVerificationOpening | undefined {
  if (identity.length === 0) return undefined;
  try {
    const values = JSON.parse(identity) as Object[];
    if (values.length !== 4 || values[3] !== 'source' ||
      !Number.isSafeInteger(values[1]) || !Number.isSafeInteger(values[2])) return undefined;
    return { mounting: values[1] as number, generation: values[2] as number };
  } catch (_) {
    return undefined;
  }
}

export type SourceProjectionTrigger = 'mount' | 'owner-update' | 'edit' | 'clear' | 'status' | 'category' | 'group' | 'v9-return';
export type SourceProjectionState = 'rows' | 'filteredEmpty' | 'empty' | 'loading' | 'readFailure' | 'recovery';

export type SourceV9ListReturnView = 'groups' | 'batch';

export interface SourceV9ListTransitionObservation {
  readonly owner: SourceVerificationOpening;
  readonly revision: number;
  readonly view: SourceV9ListReturnView;
  readonly phase: 'enter' | 'return';
  readonly filterMatchesDeparture?: boolean;
}

export function sourceVerificationStatus(status: string): string {
  if (status === '已启用' || status === '启用') return 'enabled';
  if (status === '已停用') return 'disabled';
  if (status === '异常') return 'error';
  return status === '未检测' ? 'unchecked' : 'all';
}

export type SourceRecoveryBranch = 'original' | 'unknown';
export interface SourceRecoveryVerificationFacts {
  readonly branch: SourceRecoveryBranch;
  readonly generation: number;
  readonly busy: boolean;
  readonly canReconcile: boolean;
  readonly canContinue: boolean;
}

export interface SourceRecoveryTitleObservation {
  readonly owner: SourceVerificationOpening;
  readonly branch: SourceRecoveryBranch;
  readonly generation: number;
  readonly title: 'clipped' | 'fits' | 'unmeasured';
}

export interface SourceImportStatusActionObservation {
  readonly owner: SourceVerificationOpening;
  readonly phase: 'ready' | 'accepted';
  readonly statusRevision: number;
  readonly receiptGeneration: number;
  readonly confirmation: string;
  readonly readback: string;
  readonly confirmedParts: number;
  readonly fixturePresent: boolean;
  readonly count: number;
}

export interface SourceProjectionObservation {
  readonly owner: SourceVerificationOpening;
  readonly trigger: SourceProjectionTrigger;
  readonly textProjectionRevision: number;
  readonly filterRevision: number;
  readonly queryLength: number;
  readonly status: string;
  readonly category: string;
  readonly allGroups: boolean;
  readonly groupIndex: number;
  readonly count: number;
  readonly projected: number;
  readonly firstAnchor: number;
  readonly readGeneration: number;
  readonly readFact: string;
  readonly state: SourceProjectionState;
  readonly rowActions?: SourceRowActionsObservation;
  readonly recovery?: SourceRecoveryVerificationFacts;
}

export interface SourceRowActionsObservation {
  readonly anchor: number;
  readonly checkState: 'unchecked' | 'checking' | 'passed' | 'failed';
}

export interface SourceScrollObservation {
  readonly owner: SourceVerificationOpening;
  readonly trigger: string;
  readonly filterRevision: number;
  readonly itemIndex: number;
  readonly anchor: number;
  readonly lastAnchor: number;
  readonly itemYVp: number;
  readonly offsetVp: number;
  readonly atEnd: boolean;
  readonly viewportWidthVp: number;
  readonly viewportHeightVp: number;
  readonly layoutMatchesSaved: boolean;
  readonly filterMatchesSaved: boolean;
}

/** Keep entity equality within one process without publishing book-source identifiers. */
export class SourceVerificationAnchors {
  private static readonly anchors: Map<string, number> = new Map<string, number>();
  static identify(sourceId: string): number {
    if (sourceId.length === 0) return 0;
    const resident = SourceVerificationAnchors.anchors.get(sourceId);
    if (resident !== undefined) return resident;
    const next = SourceVerificationAnchors.anchors.size + 1;
    SourceVerificationAnchors.anchors.set(sourceId, next);
    return next;
  }
}

const PUBLIC_TOGGLE_SOURCE_URL: string = 'https://source-01.reader-phase1.invalid/';
const PUBLIC_ROW_ACTION_SOURCE_URL: string = 'https://row-actions.reader-phase1.invalid/';
export const PUBLIC_OFFLINE_DETECT_SOURCE_URL: string = 'https://offline-detect.reader-phase1.invalid/';
const PUBLIC_OFFLINE_DETECT_SOURCE_NAME: string = 'Reader Phase 1 Offline Detect';
const PUBLIC_OFFLINE_DETECT_GROUP: string = 'Phase1 Offline Detect';
export const OFFLINE_DETECT_CORE_REASON: string =
  'L2: cannot build search request: cannot auto-build searchRequest: source.searchUrl is empty';

export function sourceVerificationOfflineDetectFixture(source: BookSource, raw: JsonObject): boolean {
  return source.sourceId === PUBLIC_OFFLINE_DETECT_SOURCE_URL && source.baseUrl === PUBLIC_OFFLINE_DETECT_SOURCE_URL &&
    source.name === PUBLIC_OFFLINE_DETECT_SOURCE_NAME && source.group === PUBLIC_OFFLINE_DETECT_GROUP &&
    !source.enabled && !source.enabledExplore && (source.sourceVersion?.length ?? 0) > 0 &&
    raw['bookSourceUrl'] === PUBLIC_OFFLINE_DETECT_SOURCE_URL && raw['bookSourceName'] === PUBLIC_OFFLINE_DETECT_SOURCE_NAME &&
    raw['bookSourceGroup'] === PUBLIC_OFFLINE_DETECT_GROUP && raw['bookSourceType'] === 0 &&
    raw['enabled'] === false && raw['enabledExplore'] === false && Object.keys(raw).length === 6;
}

export interface SourceOfflineDetectIdentity {
  readonly owner: SourceVerificationOpening;
  readonly anchor: number;
  readonly readGeneration: number;
  readonly definition: 'missing-search-url';
  readonly reportVersion: number;
}

export interface SourceOfflineDetectAdmission extends SourceOfflineDetectIdentity {
  readonly sequence: number;
}

export function sourceVerificationOfflineDetectIdentity(source: BookSource | undefined,
  owner: SourceVerificationOpening | undefined, readGeneration: number): SourceOfflineDetectIdentity | undefined {
  const reportVersion = source?.offlineDetectReportVersion;
  if (source === undefined || owner === undefined || !Number.isSafeInteger(readGeneration) || readGeneration <= 0 ||
    (reportVersion !== 1 && reportVersion !== 2) || source.checkState !== 'unchecked') return undefined;
  return { owner, anchor: SourceVerificationAnchors.identify(source.sourceId), readGeneration,
    definition: 'missing-search-url', reportVersion };
}

/** Admit only the reserved, uncredentialed source from the public test catalog. */
export function sourceVerificationToggleAnchor(source: BookSource | undefined): number {
  return source !== undefined && isReservedToggleSource(source) ? SourceVerificationAnchors.identify(source.sourceId) : 0;
}

function isReservedToggleSource(source: BookSource): boolean {
  return source.sourceId === PUBLIC_TOGGLE_SOURCE_URL && source.baseUrl === PUBLIC_TOGGLE_SOURCE_URL &&
    source.name === 'Phase1 Source 01' && source.group === 'Phase1 Group A' && !source.enabledExplore &&
    source.loginUrl === undefined;
}

/** Observe only the original disabled, idle public fixture when isolated by normal filters. */
export function sourceVerificationReservedTypographyRow(catalogCount: number, projected: BookSource[],
  query: string, status: string, category: string, group: string): string {
  if (catalogCount <= 1 || projected.length !== 1 || query !== 'source-01.reader-phase1.invalid' ||
    status !== '未检测' || category !== 'all' || group !== '全部分组') return '';
  const source = projected[0];
  return isReservedToggleSource(source) && !source.enabled && source.category === 'novel' &&
    (source.checkState === undefined || source.checkState === 'unchecked') ? source.sourceId : '';
}

/** The public row used for read-only native measurements of the action labels. */
export function sourceVerificationRowActions(source: BookSource | undefined): SourceRowActionsObservation | undefined {
  if (source === undefined || source.sourceId !== PUBLIC_ROW_ACTION_SOURCE_URL ||
    source.baseUrl !== PUBLIC_ROW_ACTION_SOURCE_URL || source.loginUrl !== PUBLIC_ROW_ACTION_SOURCE_URL + 'login' ||
    source.name !== 'Reader Phase 1 Row Actions' || source.group !== 'Phase1 Group A' ||
    source.category !== 'novel' || source.enabled || source.enabledExplore) return undefined;
  return { anchor: SourceVerificationAnchors.identify(source.sourceId), checkState: source.checkState ?? 'unchecked' };
}

/** Select the one recovery control owned by the current original or unknown receipt. */
export function sourceVerificationRecoveryControl(control: 'reconcile' | 'continue', generation: number,
  original: SourceVerificationOriginalControl | undefined,
  receipt: SourceVerificationReceiptControl | undefined): SourceVerificationControl | undefined {
  if (!Number.isSafeInteger(generation) || generation <= 0 ||
    (control !== 'reconcile' && control !== 'continue')) return undefined;
  if (original?.blocked === true && original.generation === generation &&
    (original.operationId?.length ?? 0) > 0 && original.busy !== true &&
    (control === 'reconcile' || original.canRetryOriginal === true)) {
    return { branch: 'original', control, generation, blocked: true,
      canContinue: original.canRetryOriginal === true };
  }
  if (control === 'reconcile' && original?.blocked !== true && receipt?.confirmation === 'unknown' &&
    receipt.generation === generation && receipt.canRetry === true) {
    return { branch: 'unknown', control, generation, blocked: false, canContinue: false };
  }
  return undefined;
}

/** Admit Login only for the current exact public row and before its external page opens. */
export function sourceVerificationRowLoginControl(source: BookSource | undefined, loginUrl: string,
  blocked: boolean, receiptConfirmation: string | undefined): SourceVerificationControl | undefined {
  const row = sourceVerificationRowActions(source);
  if (row === undefined || row.checkState !== 'unchecked' || source?.loginUrl !== loginUrl ||
    loginUrl.trim().length === 0 || blocked || receiptConfirmation === 'unknown') return undefined;
  return { branch: 'row', control: 'login', generation: 0, blocked: false, canContinue: false,
    sourceAnchor: row.anchor, loginEligible: true };
}

export interface SourceToggleReadyObservation {
  readonly phase: 'ready';
  readonly owner: SourceVerificationOpening;
  readonly anchor: number;
  readonly enabled: boolean;
  readonly filterRevision: number;
  readonly readGeneration: number;
}

export interface SourceToggleObservationIdentity {
  readonly owner: SourceVerificationOpening;
  readonly anchor: number;
  readonly toggleSeq: number;
  readonly requestedEnabled: boolean;
}

export interface SourceToggleSettledObservation extends SourceToggleObservationIdentity {
  readonly phase: 'settled';
  readonly confirmation: 'confirmed' | 'unknown' | 'undispatched';
  readonly readback: 'succeeded' | 'failed';
  readonly observedEnabled?: boolean;
}

export interface SourceGeometryObservation {
  readonly owner: SourceVerificationOpening;
  readonly expanded: boolean;
  readonly footerStacked: boolean;
  readonly fontScale: number;
  readonly viewportWidthVp: number;
  readonly viewportHeightVp: number;
  readonly headerHeightVp: number;
  readonly footerHeightVp: number;
  readonly headerTopVp: number;
  readonly footerTopVp: number;
  readonly listStartInsetVp: number;
  readonly listEndInsetVp: number;
  readonly groupHostTopVp: number;
  readonly groupHostBottomVp: number;
  readonly groupHostLeftVp: number;
  readonly groupHostRightVp: number;
}

export interface SourceOverlayObservation {
  readonly owner: SourceVerificationOpening;
  readonly phase: string;
  readonly overlay: 'group' | 'ime';
  readonly selectionId?: string;
}
