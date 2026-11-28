import type { SourceManagementStatusKind } from '../application/SourceOrchestrator';
import type { SourceManagementProjection } from '../application/SourceOrchestrator';
import type { BookSource } from '../application/SourceGateway';
import type { SourceV9View } from '../presentation/SourceManagementV9';
import type { ReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import type { SurfaceHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS, readerTransientTextObserver, type ReaderTransientTextObserver } from '../../../ui/feedback/ReaderTransientFeedback';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderRecoveryNotice, type ReaderRecoveryBodyPresentation, type ReaderRecoveryTextAction } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
import { sourceReadLoadingFrame, SOURCE_READ_FAILURE_TITLE } from './SourceReadLoadingVerification';
import { ReaderSourceTextMetrics, type SourceTextLayoutLabel } from '../../../pages/ReaderSourceTextMetrics';
import { sourceVerificationOpening, type SourceVerificationOpening, type SourceProjectionState, type SourceRecoveryBranch, type SourceRecoveryTitleObservation, type SourceImportStatusActionObservation, type SourceRecoveryVerificationFacts } from './SourceManagementVerification';
import { TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';
import type { SourceTextLayoutScope } from './SourceManagementListRow';

type SourceSurfaceTextScope = 'read-empty' | 'read-failed' | 'retained-read-failed' | 'operation-status' | 'operation-recovery' |
  'operation-recovery-body';

interface SourceSurfaceTextFact {
  scope: SourceSurfaceTextScope;
  branch?: string;
  generation?: number;
  statusRevision?: number;
  presentation?: ReaderRecoveryBodyPresentation;
  expansionRevision?: number;
}

interface SourceTransientTextFact {
  scope: 'operation-status' | 'retained-read-failed';
  owner: SourceVerificationOpening;
  readGeneration: number;
  branch?: 'import';
  generation?: number;
}

interface SourceRecoveryBodyAttachment {
  branch: SourceRecoveryBranch;
  generation: number;
  presentation: ReaderRecoveryBodyPresentation;
}

interface SourceManagementRecoveryReadback {
  readonly listReadPending: () => boolean;
  readonly filterHeight: () => number;
  readonly filtersInDefaultState: () => boolean;
  readonly groupClosing: () => boolean;
}

interface SourceManagementRecoveryDiagnostics {
  readonly hasTypographyProbe: () => boolean;
  readonly projectionState: () => SourceProjectionState;
  readonly typographyScope: (scope: 'surface') => SourceTextLayoutScope | undefined;
  readonly footerText: () => SourceTextLayoutLabel[];
}

interface SourceManagementRecoveryNativePort {
  readonly getUIContext: () => UIContext;
  readonly contentFrame: () => SurfaceHorizontalFrame;
  readonly geometry: () => ReaderPageGeometry;
  readonly readerWindowMetricsRevision: () => number;
  readonly overlayBottom: () => number;
}

interface SourceManagementRecoveryPresentationPort {
  readonly reduceMotion: () => boolean;
  readonly groupOpen: () => boolean;
}

interface SourceManagementRecoveryOpeningPort {
  readonly mounted: () => boolean;
  readonly temporaryBackIdentity: () => string;
  readonly verificationOpening: () => string;
  readonly managementBackIsCurrent: (identity: string) => boolean;
  readonly managementOpeningIsCurrent: () => boolean;
  readonly managementInputIsCurrent: () => boolean;
  readonly isInputAllowed: () => boolean;
}

interface SourceManagementRecoveryViewPort {
  readonly v9Pane: () => SourceV9View;
  readonly inputEnabled: () => boolean;
  readonly sources: () => BookSource[];
  readonly operation: () => SourceManagementProjection;
  readonly statusActionGeneration: () => number;
  readonly statusActionLabel: () => string;
  readonly statusKind: () => SourceManagementStatusKind;
  readonly statusMessage: () => string;
}

interface SourceManagementRecoveryActionsPort {
  readonly onContinueOriginal: (generation: number) => void;
  readonly onReconcile: (generation: number) => void;
  readonly onRetryLoad: () => void;
  readonly onStatusAction: (generation: number) => void;
}

export interface SourceManagementRecoveryHost {
  readonly native: SourceManagementRecoveryNativePort;
  readonly presentation: SourceManagementRecoveryPresentationPort;
  readonly opening: SourceManagementRecoveryOpeningPort;
  readonly view: SourceManagementRecoveryViewPort;
  readonly actions: SourceManagementRecoveryActionsPort;
}

export interface SourceManagementRecoveryView {
  readonly host: SourceManagementRecoveryHost;
  readonly readback: SourceManagementRecoveryReadback;
  readonly diagnostics: SourceManagementRecoveryDiagnostics;
}

/** Owns local readback and operation recovery presentation for the current source opening. */
export class SourceManagementRecoveryOwner {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private lastFeedbackIdentity: string = '';
  private lastToastMessage: string = '';
  private verificationImportStatusPending: string = '';
  private verificationImportStatusReadyKey: string = '';
  private readonly verificationSurfaceTextMetrics: Map<string, ReaderSourceTextMetrics> = new Map();
  private readonly verificationSurfaceTextFrameKeys: Map<string, string> = new Map();
  private verificationReadTextMetrics: ReaderSourceTextMetrics | undefined;
  private verificationOperationTextKey: string = '';
  private readonly verificationOperationTextRoles = new Set<string>();
  private verificationRecoveryTitleKey: string = '';
  private verificationRecoveryBodyKey: string = '';
  private verificationRecoveryBodyRevision: number = 0;
  private verificationRecoveryBodyExpanded: SourceRecoveryBodyAttachment | undefined;
  private verificationRecoveryBodyAttachment: SourceRecoveryBodyAttachment | undefined;
  private verificationReadLoadingGeneration: number = 0;

  readonly host: SourceManagementRecoveryHost;
  readonly diagnostics: SourceManagementRecoveryDiagnostics;
  private readonly view: SourceManagementRecoveryView;

  constructor(view: SourceManagementRecoveryView) {
    this.view = view;
    this.host = view.host;
    this.diagnostics = view.diagnostics;
  }

  startReadTypography(): void { this.verificationReadTextMetrics = new ReaderSourceTextMetrics(''); }

  captureInitialFeedback(): void { this.lastFeedbackIdentity = this.feedbackIdentity(); }

  retireTransientFeedback(): void { this.transientFeedback.reset(); }

  retireDiagnosticFacts(): void {
    this.verificationOperationTextKey = '';
    this.verificationOperationTextRoles.clear();
    this.verificationRecoveryBodyKey = '';
    this.verificationRecoveryBodyExpanded = undefined;
    this.verificationRecoveryBodyAttachment = undefined;
  }

  retireTypography(): void {
    this.verificationReadTextMetrics = undefined;
    this.verificationSurfaceTextMetrics.clear();
    this.verificationSurfaceTextFrameKeys.clear();
  }

  recovery(): ReaderRecoveryView { return readerRecoveryView(this.host.view.operation().receipt, this.host.view.operation().readFacts, this.host.view.operation().confirmedParts ?? 0); }

  hasPendingSourceRecovery(): boolean {
    return this.host.view.operation().original?.blocked === true || this.host.view.operation().receipt?.receipt.confirmation === 'unknown';
  }

  sourceListLoading(): boolean {
    return this.host.view.statusKind() === 'loading' || this.view.readback.listReadPending() || this.host.view.operation().receipt?.facts.fact === 'refreshing';
  }

  hasEmptyListReadFailure(): boolean {
    const fact = this.host.view.operation().readFacts?.fact;
    return this.host.view.sources().length === 0 && (fact === 'failed' || fact === 'refreshFailed');
  }

  hasEmptyImportReadbackFailure(): boolean {
    const receipt = this.host.view.operation().receipt;
    return this.host.view.sources().length === 0 && !this.hasPendingSourceRecovery() && !this.sourceListLoading() &&
      !this.hasEmptyListReadFailure() && this.host.view.operation().action === 'import' &&
      this.host.view.operation().importIdentity !== undefined && receipt?.receipt.confirmation === 'confirmed' &&
      receipt.receipt.readback === 'failed' && this.recovery().canRetry;
  }

  private sourceListInputIsCurrent(opening: string): boolean {
    return this.host.opening.managementBackIsCurrent(opening) && this.host.view.inputEnabled() && this.host.opening.isInputAllowed() !== false &&
      !this.host.presentation.groupOpen() && !this.hasPendingSourceRecovery();
  }

  retryEmptyListAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      if (!this.sourceListInputIsCurrent(opening) || this.sourceListLoading()) return;
      if (this.hasEmptyImportReadbackFailure()) {
        if (this.recovery().generation === generation) this.host.actions.onReconcile(generation);
        return;
      }
      const read = this.host.view.operation().readFacts;
      if (!this.hasEmptyListReadFailure() || read === undefined || read.generation !== generation) return;
      if (read.canRetry) this.host.actions.onReconcile(generation);
      else this.host.actions.onRetryLoad();
    };
  }

  retryRetainedListAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      if (!this.sourceListInputIsCurrent(opening) || this.sourceListLoading() || this.host.view.sources().length === 0) return;
      const recovery = this.recovery();
      if (recovery.canRetry && recovery.generation === generation) this.host.actions.onReconcile(generation);
    };
  }

  readPageStateTitle(): string {
    return this.sourceListLoading() ? '正在读取书源' : this.hasEmptyImportReadbackFailure() ? '书源列表待刷新' :
      this.hasEmptyListReadFailure() ? '书源读取失败' : '暂无书源';
  }

  readPageStateMessage(): string {
    return this.sourceListLoading() ? '请稍候' : this.hasEmptyImportReadbackFailure() ?
      '已确认导入，但当前列表尚未核对完成，请刷新列表。' : this.hasEmptyListReadFailure() ?
      '请稍后重试。' : '点击下方「＋ 导入书源」导入书源';
  }

  verificationReadTextScope(): SourceSurfaceTextScope | undefined {
    if (!this.diagnostics.hasTypographyProbe() || this.host.presentation.groupOpen() || this.view.readback.groupClosing() ||
      !this.view.readback.filtersInDefaultState()) return undefined;
    const read = this.host.view.operation().readFacts?.fact;
    const state = this.diagnostics.projectionState();
    if (state === 'empty' && read === 'current' && !this.hasEmptyImportReadbackFailure()) return 'read-empty';
    if (state === 'readFailure' && (read === 'failed' || read === 'refreshFailed')) return 'read-failed';
    if (state === 'rows' && read === 'refreshFailed' && this.recovery().canRetry) return 'retained-read-failed';
    return undefined;
  }

  readPageStateTextOptions(role: 'title' | 'message' | 'retry'): TextOptions | undefined {
    if (!this.host.opening.mounted() || !ReaderUIVerificationProbe.enabled()) return undefined;
    // TextOptions is set when the child mounts, including its initial loading state.
    try { return this.verificationReadTextMetrics?.options(role); }
    catch (_unavailable) { return undefined; }
  }

  private readVerificationPageText(scope: 'read-empty' | 'read-failed'): SourceTextLayoutLabel[] {
    const metrics = this.verificationReadTextMetrics;
    if (metrics === undefined) return [];
    metrics.track('title', this.readPageStateTitle());
    metrics.track('message', this.readPageStateMessage());
    const roles = ['title', 'message'];
    if (scope === 'read-failed') {
      metrics.track('retry', '重试');
      roles.push('retry');
    }
    const state = scope === 'read-empty' ? 'empty' : 'failure';
    const labels = metrics.readTracked(roles);
    for (const label of labels) {
      label.role = label.role === 'retry' ? 'read/retry' : `read/${state}-${label.role}`;
    }
    if (scope === 'read-empty') labels.push(...this.diagnostics.footerText());
    return labels;
  }

  private verificationSurfaceTextKey(scope: SourceSurfaceTextScope, branch?: string): string {
    return branch === undefined ? scope : `${scope}/${branch}`;
  }

  verificationSurfaceTextOptions(scope: SourceSurfaceTextScope, role: string, text: string,
    branch?: string): TextOptions | undefined {
    if (!this.host.opening.mounted() || !this.diagnostics.hasTypographyProbe() || !ReaderUIVerificationProbe.enabled()) return undefined;
    try {
      const key = this.verificationSurfaceTextKey(scope, branch);
      let metrics = this.verificationSurfaceTextMetrics.get(key);
      if (metrics === undefined) {
        metrics = new ReaderSourceTextMetrics('');
        this.verificationSurfaceTextMetrics.set(key, metrics);
      }
      return metrics.track(role, text);
    } catch (_unavailable) { return undefined; }
  }

  scheduleVerificationReadText(): void {
    if (!this.diagnostics.hasTypographyProbe()) return;
    const scope = this.verificationReadTextScope();
    if (scope === undefined) return;
    this.scheduleVerificationSurfaceText((): SourceSurfaceTextFact | undefined => {
      const current = this.verificationReadTextScope();
      return current === scope ? { scope: current } : undefined;
    }, scope === 'retained-read-failed' ? 1 : 3);
  }

  private scheduleVerificationSurfaceText(current: () => SourceSurfaceTextFact | undefined, expectedRoles: number): void {
    try {
      const scope = this.diagnostics.typographyScope('surface');
      const fact = current();
      if (scope === undefined || fact === undefined) return;
      const bucket = this.verificationSurfaceTextKey(fact.scope, fact.branch);
      const key = JSON.stringify([scope, fact, expectedRoles]);
      if (key === this.verificationSurfaceTextFrameKeys.get(bucket)) return;
      const context = this.host.native.getUIContext();
      let allowNextFrame = true;
      const observe = (): void => {
        try {
          if (this.verificationSurfaceTextFrameKeys.get(bucket) !== key ||
            JSON.stringify([this.diagnostics.typographyScope('surface'), current(), expectedRoles]) !== key) return;
          const labels = fact.scope === 'read-empty' || fact.scope === 'read-failed' ? this.readVerificationPageText(fact.scope) :
            this.verificationSurfaceTextMetrics.get(bucket)?.readTracked() ?? [];
          if (allowNextFrame && (labels.length < expectedRoles || labels.some(label =>
            label.lines.length === 0 || fact.scope === 'operation-recovery-body' && !label.complete))) {
            allowNextFrame = false;
            context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
            return;
          }
          ReaderUIVerificationProbe.emit('source.surface-text-layout', 'business', {
            owner: scope.owner, textProjectionRevision: scope.textProjectionRevision,
            filterRevision: scope.filterRevision, readGeneration: scope.readGeneration,
            windowRevision: scope.windowRevision, widthVp: scope.widthVp, heightVp: scope.heightVp,
            density: scope.density, systemFontScale: scope.systemFontScale, fontScale: scope.fontScale,
            rowAnchor: scope.rowAnchor, scope: fact.scope, branch: fact.branch, generation: fact.generation,
            statusRevision: fact.statusRevision, presentation: fact.presentation,
            expansionRevision: fact.expansionRevision, labels,
          });
        } catch (_detached) {}
      };
      context.postFrameCallback(new ReaderPostLayoutFrame(context, observe));
      this.verificationSurfaceTextFrameKeys.set(bucket, key);
    } catch (_detached) {}
  }

  statusListAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      if (this.sourceListInputIsCurrent(opening) && this.host.view.statusActionLabel().length > 0 &&
        this.host.view.statusActionGeneration() === generation) {
        this.observeImportStatusAction('accepted');
        this.host.actions.onStatusAction(generation);
      }
    };
  }

  scheduleImportStatusReadyObservation(): void {
    const opening = this.host.opening.temporaryBackIdentity();
    if (!ReaderUIVerificationProbe.enabled() || this.host.view.v9Pane() !== 'list' || !this.host.opening.managementInputIsCurrent() ||
      !this.host.opening.managementBackIsCurrent(opening) ||
      this.host.view.statusActionLabel().length === 0 || this.verificationImportStatusPending === opening) return;
    this.verificationImportStatusPending = opening;
    try {
      const context = this.host.native.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (this.verificationImportStatusPending !== opening) return;
        this.verificationImportStatusPending = '';
        if (this.host.opening.managementBackIsCurrent(opening)) this.observeImportStatusAction('ready');
      }));
    } catch (_) {
      this.verificationImportStatusPending = '';
    }
  }

  private observeImportStatusAction(phase: 'ready' | 'accepted'): void {
    if (!ReaderUIVerificationProbe.enabled() || !this.host.opening.managementOpeningIsCurrent() ||
      this.host.view.statusActionLabel().length === 0 || this.host.view.operation().action !== 'import' || this.hasPendingSourceRecovery()) return;
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    const receipt = this.host.view.operation().receipt;
    if (owner === undefined || receipt === undefined) return;
    if (phase === 'ready') {
      if (this.host.view.v9Pane() !== 'list' || !this.host.opening.managementInputIsCurrent() ||
        this.host.view.statusActionGeneration() <= 0 || this.host.view.sources().length === 0 || this.sourceListLoading() ||
        receipt.receipt.confirmation !== 'confirmed' || receipt.receipt.readback !== 'succeeded') return;
      const key = JSON.stringify([owner.mounting, owner.generation, receipt.facts.generation, this.host.view.statusActionGeneration()]);
      if (key === this.verificationImportStatusReadyKey) return;
      this.verificationImportStatusReadyKey = key;
    }
    const fixtureUrl = 'https://status-research.reader-phase1.invalid/';
    const fixturePresent = this.host.view.sources().some(source => source.sourceId === fixtureUrl && source.baseUrl === fixtureUrl &&
      source.name === 'Reader Phase 1 Search Return' && !source.enabled && !source.enabledExplore);
    const observation: SourceImportStatusActionObservation = {
      owner, phase, statusRevision: this.host.view.statusActionGeneration(), receiptGeneration: receipt.facts.generation,
      confirmation: receipt.receipt.confirmation, readback: receipt.receipt.readback,
      confirmedParts: this.host.view.operation().confirmedParts ?? 0, fixturePresent, count: this.host.view.sources().length,
    };
    ReaderUIVerificationProbe.emit('source.import-status-action', 'business', observation);
    if (phase === 'ready' && this.diagnostics.hasTypographyProbe()) this.scheduleVerificationOperationText();
  }

  private verificationOperationTextFact(): SourceSurfaceTextFact | undefined {
    if (!ReaderUIVerificationProbe.enabled() || !this.host.opening.managementOpeningIsCurrent()) return undefined;
    const recovery = this.verificationRecoveryFacts();
    if (recovery !== undefined && this.recoveryOverlayVisible()) {
      return { scope: 'operation-recovery', branch: recovery.branch, generation: recovery.generation };
    }
    const receipt = this.host.view.operation().receipt;
    if (this.hasPendingSourceRecovery() || this.host.view.operation().action !== 'import' ||
      this.host.view.statusActionLabel() !== '重新搜索' || this.host.view.statusActionGeneration() <= 0 || this.sourceListLoading() ||
      this.host.view.sources().length === 0 || receipt?.receipt.confirmation !== 'confirmed' || receipt.receipt.readback !== 'succeeded') {
      return undefined;
    }
    return { scope: 'operation-status', branch: 'import', generation: receipt.facts.generation,
      statusRevision: this.host.view.statusActionGeneration() };
  }

  scheduleVerificationOperationText(): void {
    const fact = this.verificationOperationTextFact();
    if (fact === undefined) {
      this.verificationOperationTextKey = '';
      this.verificationOperationTextRoles.clear();
      return;
    }
    this.prepareOperationGlyphs(fact);
    if (this.verificationOperationTextRoles.size > 0) {
      this.scheduleVerificationSurfaceText((): SourceSurfaceTextFact | undefined => this.verificationOperationTextFact(),
        this.verificationOperationTextRoles.size);
    }
    this.scheduleVerificationRecoveryBody();
  }

  private prepareOperationGlyphs(fact: SourceSurfaceTextFact): void {
    const key = JSON.stringify(fact);
    if (this.verificationOperationTextKey === key) return;
    this.verificationOperationTextKey = key;
    this.verificationOperationTextRoles.clear();
    const bucket = this.verificationSurfaceTextKey(fact.scope, fact.branch);
    this.verificationSurfaceTextMetrics.delete(bucket);
    this.verificationSurfaceTextFrameKeys.delete(bucket);
  }

  private operationGlyphOptions(fact: SourceSurfaceTextFact, role: string, label: string): TextOptions | undefined {
    this.prepareOperationGlyphs(fact);
    const options = this.verificationSurfaceTextOptions(fact.scope, role, label, fact.branch);
    if (options === undefined) return undefined;
    this.verificationOperationTextRoles.add(role);
    this.scheduleVerificationOperationText();
    return options;
  }

  statusGlyphOptions(generation: number): TextOptions | undefined {
    const fact = this.verificationOperationTextFact();
    if (fact?.scope !== 'operation-status' || fact.statusRevision !== generation) return undefined;
    return this.operationGlyphOptions(fact, 'operation/action', this.host.view.statusActionLabel());
  }

  recoveryGlyphOptions(branch: SourceRecoveryBranch, generation: number):
    (action: ReaderRecoveryTextAction, label: string) => TextOptions | undefined {
    return (action: ReaderRecoveryTextAction, label: string): TextOptions | undefined => {
      const fact = this.verificationOperationTextFact();
      if (fact?.scope !== 'operation-recovery' || fact.branch !== branch || fact.generation !== generation) return undefined;
      return this.operationGlyphOptions(fact, `recovery/${branch}/${action}`, label);
    };
  }

  private verificationRecoveryBodyFact(attachment: SourceRecoveryBodyAttachment): SourceSurfaceTextFact | undefined {
    const current = this.verificationOperationTextFact();
    const expanded = this.verificationRecoveryBodyExpanded;
    if (attachment.presentation === 'collapsed' || current?.scope !== 'operation-recovery' || current.branch !== attachment.branch ||
      current.generation !== attachment.generation) return undefined;
    const expansion = expanded?.branch === attachment.branch && expanded.generation === attachment.generation;
    if ((attachment.presentation === 'expanded') !== expansion) return undefined;
    return { scope: 'operation-recovery-body', branch: attachment.branch,
      generation: attachment.generation, presentation: attachment.presentation,
      expansionRevision: expansion ? this.verificationRecoveryBodyRevision : undefined };
  }

  private scheduleVerificationRecoveryBody(): void {
    const attachment = this.verificationRecoveryBodyAttachment;
    if (attachment === undefined ||
      JSON.stringify([attachment.branch, attachment.generation]) !== this.verificationRecoveryBodyKey) return;
    this.scheduleVerificationSurfaceText((): SourceSurfaceTextFact | undefined => this.verificationRecoveryBodyFact(attachment), 1);
  }

  recoveryBodyGlyphOptions(branch: SourceRecoveryBranch):
    (generation: number, presentation: ReaderRecoveryBodyPresentation, prefix: string) => TextOptions | undefined {
    return (generation: number, presentation: ReaderRecoveryBodyPresentation, prefix: string): TextOptions | undefined => {
      const attachment: SourceRecoveryBodyAttachment = { branch, generation, presentation };
      const current = this.verificationOperationTextFact();
      if (current?.scope !== 'operation-recovery' || current.branch !== branch || current.generation !== generation) return undefined;
      const bucket = this.verificationSurfaceTextKey('operation-recovery-body', branch);
      const key = JSON.stringify([branch, generation]);
      if (key !== this.verificationRecoveryBodyKey) {
        this.verificationRecoveryBodyKey = key;
        this.verificationSurfaceTextMetrics.delete(bucket);
        this.verificationSurfaceTextFrameKeys.delete(bucket);
      }
      try {
        const metrics = this.verificationSurfaceTextMetrics.get(bucket) ?? new ReaderSourceTextMetrics('');
        this.verificationSurfaceTextMetrics.set(bucket, metrics);
        const options = metrics.track(`recovery/${branch}/message`, prefix, true);
        this.verificationRecoveryBodyAttachment = options !== undefined && this.verificationRecoveryBodyFact(attachment) !== undefined
          ? attachment : undefined;
        if (this.verificationRecoveryBodyAttachment !== undefined) this.scheduleVerificationRecoveryBody();
        return options;
      } catch (_unavailable) { return undefined; }
    };
  }

  recoveryBodyExpansionObserver(branch: SourceRecoveryBranch): (generation: number, expanded: boolean) => void {
    return (generation: number, expanded: boolean): void => {
      const current = this.verificationOperationTextFact();
      const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
      if (owner === undefined || current?.scope !== 'operation-recovery' ||
        current.branch !== branch || current.generation !== generation) return;
      this.verificationRecoveryBodyExpanded = expanded ? { branch, generation, presentation: 'expanded' } : undefined;
      this.verificationRecoveryBodyAttachment = this.verificationRecoveryBodyExpanded;
      const expansionRevision = ++this.verificationRecoveryBodyRevision;
      ReaderUIVerificationProbe.emit('source.recovery-body-state', 'business', {
        owner, branch, generation, phase: expanded ? 'expanded' : 'collapsed', expansionRevision
      });
      if (expanded) this.scheduleVerificationRecoveryBody();
    };
  }

  originalRecoveryView(): ReaderRecoveryView {
    const original = this.host.view.operation().original;
    return { message: original?.message ?? '', visible: original?.blocked === true,
      canRetry: true, generation: original?.generation ?? 0 };
  }

  originalActionIdentities(): string[] {
    const original = this.host.view.operation().original;
    if (original?.blocked !== true) return [];
    return [JSON.stringify([this.host.opening.temporaryBackIdentity(), original.operationId ?? '', original.generation, original.writeStage])];
  }

  originalActionGeneration(identity: string): number { return Number((JSON.parse(identity) as string[])[2]); }

  originalActionCurrent(identity: string, generation: number): boolean {
    return this.host.opening.managementInputIsCurrent() && this.recoveryOverlayVisible() &&
      this.originalActionIdentities().includes(identity) && generation === this.originalActionGeneration(identity) &&
      this.host.view.operation().original?.busy !== true;
  }

  verificationRecoveryFacts(): SourceRecoveryVerificationFacts | undefined {
    const original = this.host.view.operation().original;
    if (original?.blocked === true) {
      return { branch: 'original', generation: original.generation, busy: original.busy === true,
        canReconcile: true, canContinue: original.canRetryOriginal === true };
    }
    const receipt = this.host.view.operation().receipt;
    if (receipt?.receipt.confirmation === 'unknown') {
      return { branch: 'unknown', generation: receipt.facts.generation, busy: this.sourceListLoading(),
        canReconcile: receipt.facts.canRetry, canContinue: false };
    }
    return undefined;
  }

  observeVerificationRecoveryTitle(opening: string, branch: SourceRecoveryBranch, generation: number,
    clipped: boolean | undefined): void {
    if (!ReaderUIVerificationProbe.enabled() || !this.host.opening.managementBackIsCurrent(opening) || !this.recoveryOverlayVisible()) return;
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    const facts = this.verificationRecoveryFacts();
    if (owner === undefined || facts?.branch !== branch || facts.generation !== generation) return;
    const title = clipped === undefined ? 'unmeasured' : clipped ? 'clipped' : 'fits';
    const key = JSON.stringify([owner.mounting, owner.generation, branch, generation, title, this.host.native.readerWindowMetricsRevision()]);
    if (key === this.verificationRecoveryTitleKey) return;
    this.verificationRecoveryTitleKey = key;
    const observation: SourceRecoveryTitleObservation = { owner, branch, generation, title };
    ReaderUIVerificationProbe.emit('source.recovery-title', 'business', observation);
    if (this.diagnostics.hasTypographyProbe()) this.scheduleVerificationOperationText();
  }

  unknownRecoveryTitleObserver(opening: string): (generation: number, clipped: boolean | undefined) => void {
    return (generation: number, clipped: boolean | undefined): void => {
      this.observeVerificationRecoveryTitle(opening, 'unknown', generation, clipped);
    };
  }

  recoveryOverlayBottom(): number { return Math.min(this.host.native.overlayBottom(), this.host.native.geometry().footer.top); }

  recoveryOverlayTop(): number {
    const start = this.host.native.geometry().content.startInset;
    const searchBottom = start + Math.max(44, this.view.readback.filterHeight()) + TOK_SPACE_XS * 2;
    return this.recoveryOverlayBottom() - searchBottom >= 44 ? searchBottom : start;
  }

  recoveryOverlayVisible(): boolean {
    this.host.native.readerWindowMetricsRevision();
    return this.host.opening.managementInputIsCurrent() && !this.host.presentation.groupOpen() && !this.view.readback.groupClosing() &&
      !ReaderWindowCoordinator.metrics().keyboardArea.visible && this.hasPendingSourceRecovery() &&
      this.recoveryOverlayBottom() > this.recoveryOverlayTop();
  }

  unknownReceiptAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      const receipt = this.host.view.operation().receipt;
      if (this.host.opening.managementBackIsCurrent(opening) && this.host.opening.managementInputIsCurrent() && this.recoveryOverlayVisible() &&
        this.host.view.operation().original?.blocked !== true && !this.sourceListLoading() &&
        receipt?.receipt.confirmation === 'unknown' && receipt.facts.canRetry && receipt.facts.generation === generation) {
        this.host.actions.onReconcile(generation);
      }
    };
  }

  feedbackIdentity(): string {
    return `${this.host.view.operation().receipt?.facts.generation ?? 0}:${this.host.view.operation().readFacts?.generation ?? 0}:` +
      `${this.host.view.statusKind()}:${this.host.view.statusMessage()}`;
  }

  private transientTextFact(message: string): SourceTransientTextFact | undefined {
    if (!this.diagnostics.hasTypographyProbe() || !ReaderUIVerificationProbe.enabled() ||
      !this.host.opening.managementOpeningIsCurrent()) return undefined;
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    if (owner === undefined) return undefined;
    const readGeneration = this.host.view.operation().readFacts?.generation ?? 0;
    if (this.verificationReadTextScope() === 'retained-read-failed' && readGeneration > 0) {
      return { scope: 'retained-read-failed', owner, readGeneration };
    }
    const receipt = this.host.view.operation().receipt;
    if (this.host.view.operation().action === 'import' && this.host.view.statusKind() === 'success' &&
      this.host.view.statusMessage() === message && message.startsWith('书源导入完成：') &&
      receipt?.receipt.confirmation === 'confirmed' && receipt.receipt.readback === 'succeeded' &&
      receipt.facts.generation > 0) {
      return { scope: 'operation-status', owner, readGeneration, branch: 'import', generation: receipt.facts.generation };
    }
    return undefined;
  }

  private transientTextObserver(message: string): ReaderTransientTextObserver | undefined {
    const fact = this.transientTextFact(message);
    if (fact === undefined) return undefined;
    const metrics = new ReaderSourceTextMetrics('');
    const role = fact.scope === 'operation-status' ? 'operation/status' : 'read/retained-status';
    const key = JSON.stringify(fact);
    let windowSamplePublishedAt: number | undefined = undefined;
    let stopWindowSamples: (() => void) | undefined = undefined;
    return {
      textOptions: (text: string): TextOptions | undefined => metrics.track(role, text),
      onPublished: (toastGeneration: number, durationMs: number): void => {
        if (fact.scope === 'operation-status' && fact.branch === 'import') {
          windowSamplePublishedAt = ReaderUIVerificationProbe.sourceImportToastPublishedAt(durationMs);
        }
        ReaderUIVerificationProbe.emit('source.transient-feedback', 'business', {
          scope: fact.scope, owner: fact.owner, readGeneration: fact.readGeneration,
          branch: fact.branch, generation: fact.generation, phase: 'published',
          toastGeneration, durationMs,
        });
      },
      onLayout: (toastGeneration: number, hostId: number, durationMs: number): boolean => {
        const current = this.transientTextFact(message);
        const window = this.diagnostics.typographyScope('surface');
        if (JSON.stringify(current) !== key || window === undefined || window.readGeneration !== fact.readGeneration) return false;
        const status = fact.scope === 'operation-status' ? this.verificationOperationTextFact() : undefined;
        if (fact.scope === 'operation-status' && (status?.scope !== 'operation-status' ||
          status.generation !== fact.generation || status.statusRevision === undefined)) return false;
        const labels = metrics.readTracked();
        if (labels.length !== 1 || labels[0].lines.length === 0) return false;
        ReaderUIVerificationProbe.emit('source.transient-text-layout', 'business', {
          owner: window.owner, textProjectionRevision: window.textProjectionRevision,
          filterRevision: window.filterRevision, readGeneration: window.readGeneration,
          windowRevision: window.windowRevision, widthVp: window.widthVp, heightVp: window.heightVp,
          density: window.density, systemFontScale: window.systemFontScale, fontScale: window.fontScale,
          rowAnchor: window.rowAnchor, scope: fact.scope, branch: fact.branch,
          generation: fact.generation, statusRevision: status?.statusRevision,
          toastGeneration, hostId, durationMs, labels,
        });
        if (windowSamplePublishedAt !== undefined) {
          const publishedAt = windowSamplePublishedAt;
          windowSamplePublishedAt = undefined;
          const windowId = ReaderWindowCoordinator.diagnosticWindowId();
          if (windowId !== null) {
            stopWindowSamples = ReaderUIVerificationProbe.sampleSourceImportToastWindow(publishedAt, durationMs,
              windowId, window.windowRevision, (): boolean =>
                ReaderWindowCoordinator.diagnosticWindowId() === windowId &&
                readerTransientTextObserver(toastGeneration, hostId) !== undefined &&
                JSON.stringify(this.transientTextFact(message)) === key);
          }
        }
        return true;
      },
      onRetired: (toastGeneration: number, durationMs: number): void => {
        windowSamplePublishedAt = undefined;
        stopWindowSamples?.();
        stopWindowSamples = undefined;
        ReaderUIVerificationProbe.emit('source.transient-feedback', 'business', {
          scope: fact.scope, owner: fact.owner, readGeneration: fact.readGeneration,
          branch: fact.branch, generation: fact.generation, phase: 'retired',
          toastGeneration, durationMs,
        });
      },
    };
  }

  onMessageChanged(): void {
    this.scheduleImportStatusReadyObservation();
    const identity = this.feedbackIdentity();
    if (!this.host.opening.mounted() || identity === this.lastFeedbackIdentity) return;
    this.lastFeedbackIdentity = identity;
    if (this.sourceListLoading()) {
      this.lastToastMessage = '';
      return;
    }
    if (this.hasPendingSourceRecovery() || this.hasEmptyListReadFailure()) return;
    const message = this.host.view.statusMessage() || (this.recovery().visible ? this.recovery().message : '');
    if (message.length === 0 || message.startsWith('正在') || message === this.lastToastMessage) return;
    this.lastToastMessage = message;
    let textObserver: ReaderTransientTextObserver | undefined;
    try { if (this.diagnostics.hasTypographyProbe()) textObserver = this.transientTextObserver(message); } catch (_) {}
    try {
      this.transientFeedback.show(() => this.host.native.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS, textObserver },
        (): boolean => this.host.opening.mounted());
    } catch (_) {}
  }

  verificationLoadingObserver(): ((ratio: number) => void) | undefined {
    return ReaderUIVerificationProbe.enabled() ? (ratio: number): void => this.observeVerificationReadLoading(ratio) : undefined;
  }

  private observeVerificationReadLoading(ratio: number): void {
    if (!this.host.opening.mounted() || !ReaderUIVerificationProbe.enabled() || this.diagnostics.projectionState() !== 'loading') return;
    const owner = sourceVerificationOpening(this.host.opening.verificationOpening());
    const read = this.host.view.operation().readFacts;
    if (owner === undefined || read === undefined || read.generation <= this.verificationReadLoadingGeneration ||
      (read.fact !== 'loading' && read.fact !== 'refreshing')) return;
    const frame = sourceReadLoadingFrame(this.host.native.getUIContext(),owner,read.generation,ratio);
    if (frame === undefined) return;
    this.verificationReadLoadingGeneration = read.generation;
    ReaderUIVerificationProbe.emit('source.read-loading-frame','probe',frame);
  }
}

export interface SourceManagementRecoveryOwnerSlot { readonly owner: SourceManagementRecoveryOwner; }

@Builder
function SourceRecoveryOriginalRecovery($$: SourceManagementRecoveryOwnerSlot) {
  ForEach($$.owner.originalActionIdentities(), (identity: string) => {
    ReaderRecoveryNotice({ view: $$.owner.originalRecoveryView(), layoutWidthVp: $$.owner.host.native.contentFrame().width, actionLabel: '核对',
      focusIdPrefix: 'reader-source-original', titleId: 'reader-source-recovery-message',
      textLayoutOptions: !$$.owner.diagnostics.hasTypographyProbe() ? undefined :
        $$.owner.recoveryGlyphOptions('original', $$.owner.originalActionGeneration(identity)),
      bodyTextLayoutOptions: !$$.owner.diagnostics.hasTypographyProbe() ? undefined : $$.owner.recoveryBodyGlyphOptions('original'),
      onBodyExpansion: !$$.owner.diagnostics.hasTypographyProbe() ? undefined : $$.owner.recoveryBodyExpansionObserver('original'),
      busy: $$.owner.host.view.operation().original?.busy === true,
      secondaryActionLabel: $$.owner.host.view.operation().original?.canRetryOriginal === true ?
        ($$.owner.host.view.operation().original?.confirmation === 'confirmed' && $$.owner.host.view.operation().original?.writeStage === 'cleanup' ? '继续清理' : '继续') : '',
      onReconcile: (generation: number): void => {
        if ($$.owner.originalActionCurrent(identity, generation)) $$.owner.host.actions.onReconcile(generation);
      },
      onSecondaryAction: (generation: number): void => {
        if ($$.owner.originalActionCurrent(identity, generation) && $$.owner.host.view.operation().original?.canRetryOriginal === true)
          $$.owner.host.actions.onContinueOriginal(generation);
      },
      onTitleMeasured: (generation: number, clipped: boolean | undefined): void => {
        if ($$.owner.originalActionIdentities().includes(identity) && generation === $$.owner.originalActionGeneration(identity)) {
          $$.owner.observeVerificationRecoveryTitle($$.owner.host.opening.temporaryBackIdentity(), 'original', generation, clipped);
        }
      } });
  }, (identity: string): string => identity);
}

@Builder
export function SourceManagementRecoveryBanner($$: SourceManagementRecoveryOwnerSlot) {
  if ($$.owner.recoveryOverlayVisible()) {
    Scroll() {
      Column() {
        if ($$.owner.host.view.operation().original?.blocked === true) { SourceRecoveryOriginalRecovery({ owner: $$.owner }); }
        else if ($$.owner.host.view.operation().receipt?.receipt.confirmation === 'unknown') {
          ReaderRecoveryNotice({ view: $$.owner.recovery(), layoutWidthVp: $$.owner.host.native.contentFrame().width, actionLabel: '核对',
            focusIdPrefix: 'reader-source-unknown', titleId: 'reader-source-recovery-message', busy: $$.owner.sourceListLoading(),
            textLayoutOptions: !$$.owner.diagnostics.hasTypographyProbe() ? undefined :
              $$.owner.recoveryGlyphOptions('unknown', $$.owner.recovery().generation),
            bodyTextLayoutOptions: !$$.owner.diagnostics.hasTypographyProbe() ? undefined : $$.owner.recoveryBodyGlyphOptions('unknown'),
            onBodyExpansion: !$$.owner.diagnostics.hasTypographyProbe() ? undefined : $$.owner.recoveryBodyExpansionObserver('unknown'),
            onReconcile: $$.owner.unknownReceiptAction($$.owner.host.opening.temporaryBackIdentity()),
            onTitleMeasured: $$.owner.unknownRecoveryTitleObserver($$.owner.host.opening.temporaryBackIdentity()) });
        }
      }.width('100%');
    }.id('reader-source-pending-recovery').width($$.owner.host.native.contentFrame().width)
      .constraintSize({ maxHeight: $$.owner.recoveryOverlayBottom() - $$.owner.recoveryOverlayTop() })
      .margin({ left: $$.owner.host.native.contentFrame().left, top: $$.owner.recoveryOverlayTop() })
      .scrollBar(BarState.Auto).clip(true).hitTestBehavior(HitTestMode.Default)
      .onTouch((event: TouchEvent): void => event.stopPropagation());
  }
}

@Builder
export function SourceManagementStatusAction($$: SourceManagementRecoveryOwnerSlot) {
  if ($$.owner.host.view.statusActionLabel().length > 0 && !$$.owner.hasPendingSourceRecovery()) {
    ForEach([$$.owner.host.view.statusActionGeneration()], (generation: number): void => {
      ReaderRecoveryAction({ label: $$.owner.host.view.statusActionLabel(), generation,
        focusId: 'reader-source-status-action',
        textLayoutOptions: !$$.owner.diagnostics.hasTypographyProbe() ? undefined : $$.owner.statusGlyphOptions(generation),
        onReconcile: $$.owner.statusListAction($$.owner.host.opening.temporaryBackIdentity()) });
    }, (generation: number): string => `source-status-action:${generation}`);
  }
}

@Builder
export function SourceManagementRetainedReadFeedback($$: SourceManagementRecoveryOwnerSlot) {
  if (!$$.owner.hasPendingSourceRecovery() && !$$.owner.sourceListLoading() && $$.owner.recovery().canRetry && $$.owner.host.view.sources().length > 0) {
    ReaderRecoveryAction({ label: '刷新列表', generation: $$.owner.recovery().generation,
      focusId: 'reader-source-retained-read-retry',
      textLayoutOptions: $$.owner.verificationReadTextScope() === 'retained-read-failed' ?
        $$.owner.verificationSurfaceTextOptions('retained-read-failed', 'read/retained-retry', '刷新列表') : undefined,
      onReconcile: $$.owner.retryRetainedListAction($$.owner.host.opening.temporaryBackIdentity()) });
  }
  if ($$.owner.sourceListLoading() && $$.owner.host.view.sources().length > 0 && !$$.owner.hasPendingSourceRecovery()) {
    ReaderPageState({ variant: 'inline', padded: false, loading: true,
      loadingProgressId: 'reader-source-loading-progress',
      onLoadingProgressVisible: $$.owner.verificationLoadingObserver(),
      loadingActive: !$$.owner.host.presentation.reduceMotion(), message: $$.owner.host.view.statusMessage() || '正在读取书源' })
      .padding({ top: 12, bottom: 12 });
  }
}

@Builder
export function SourceManagementReadState($$: SourceManagementRecoveryOwnerSlot) {
  ReaderPageState({ title: $$.owner.readPageStateTitle(), message: $$.owner.readPageStateMessage(),
    titleTextId: !$$.owner.diagnostics.hasTypographyProbe() ? '' :
      $$.owner.hasEmptyListReadFailure() && !$$.owner.sourceListLoading() ? SOURCE_READ_FAILURE_TITLE : 'reader-source-text-read-title',
    messageTextId: !$$.owner.diagnostics.hasTypographyProbe() ? '' : 'reader-source-text-read-message',
    titleTextLayoutOptions: $$.owner.readPageStateTextOptions('title'),
    messageTextLayoutOptions: $$.owner.readPageStateTextOptions('message'),
    loading: $$.owner.sourceListLoading(),
    loadingProgressId: 'reader-source-loading-progress',
    onLoadingProgressVisible: $$.owner.verificationLoadingObserver(),
    loadingActive: !$$.owner.host.presentation.reduceMotion(),
    actionLabel: $$.owner.hasEmptyImportReadbackFailure() ? '刷新列表' : $$.owner.hasEmptyListReadFailure() ? '重试' : '',
    actionFocusId: $$.owner.hasEmptyImportReadbackFailure() ? 'reader-source-import-readback-retry' :
      $$.owner.hasEmptyListReadFailure() ? 'reader-source-read-retry' : '',
    actionTextLayoutOptions: $$.owner.readPageStateTextOptions('retry'),
    actionGeneration: $$.owner.hasEmptyImportReadbackFailure() ? $$.owner.recovery().generation : $$.owner.host.view.operation().readFacts?.generation ?? 0,
    onAction: $$.owner.retryEmptyListAction($$.owner.host.opening.temporaryBackIdentity()) });
}
