// DEBUG-only component fixture. All rows, JSON and diagnostics are in memory.
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { SourceToolsPage } from '../features/source/ui/SourceToolsPage';
import type { BookSource, SourceDebugLog } from '../features/source/application/SourceGateway';
import type { SourceToolsSnapshot, SourceBatchCheckProgress, SourceBatchCheckResult, SourceToolsSelection } from '../features/source/application/SourceToolsOrchestrator';
import { ReaderPageState } from '../ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import { readerWindowMetrics } from '../ui/foundation/ReaderWindowEnvironment';
import { projectCommitReadback, projectOperationFacts } from '../app/ReaderOperationFacts';
import { projectPersistedReceipt } from '../app/ReaderPersistedReceiptProjection';

export type SourceToolsFixtureScenario = 'content' | 'loading' | 'empty' | 'read-error' |
  'read-empty-error' | 'unknown' | 'original-unknown' | 'original-cleanup' | 'running' |
  'editor-readback-failed' | 'editor-unknown' | 'unknown-empty' | 'running-empty';

export interface SourceToolsFixtureCase {
  value: SourceToolsFixtureScenario;
  title: string;
}

export const SOURCE_TOOLS_FIXTURE_SCENARIOS: SourceToolsFixtureCase[] = [
  { value: 'loading', title: '工具 · 读取中' },
  { value: 'empty', title: '工具 · 空列表' },
  { value: 'read-error', title: '工具 · 保留列表读取失败' },
  { value: 'read-empty-error', title: '工具 · 空列表读取失败' },
  { value: 'unknown', title: '工具 · 回执待核对' },
  { value: 'original-unknown', title: '工具 · 原操作待核对' },
  { value: 'original-cleanup', title: '工具 · 原操作待清理' },
  { value: 'running', title: '工具 · 检测与停止' },
  { value: 'editor-readback-failed', title: '工具 · 编辑已确认回读失败' },
  { value: 'editor-unknown', title: '工具 · 编辑回执待核对' },
  { value: 'unknown-empty', title: '工具 · 空列表待核对' },
  { value: 'running-empty', title: '工具 · 首条结果前停止' },
];

const emptyToolsFixtureSnapshot = (): SourceToolsSnapshot => {
  return { sources: [], sourceListRevision: 0, selectionRevision: 0, selectedSourceIds: [], selectedSourceCount: 0,
    editorSourceId: '', editorRevision: 0, editorText: '', debugSourceId: '', debugKey: '内存测试关键词', checkMode: 'search', checkDepth: 2,
    debugLogs: [], batchCheck: { phase: 'idle', total: 0, completed: 0, passed: 0, failed: 0, errors: 0,
      currentIndex: 0, currentSourceId: '', currentSourceName: '', results: [] },
    editorReadback: undefined, editorOperation: undefined, busy: false, statusMessage: '', statusEvent: 'state' };
};

interface SourceToolsFixtureObservation {
  kind: string;
  scenario: SourceToolsFixtureScenario;
  generation: number;
  sourceId: string;
  actualWidthVp: number;
  actualHeightVp: number;
  systemFontScale: number;
  intentCount: number;
  busy: boolean;
  editorRevision: number;
  sourceCount: number;
  selectedCount: number;
  batchPhase: string;
  readFact: string;
  confirmation: string;
  operationGeneration: number;
  editorConfirmation: string;
  editorReadback: string;
  editorFact: string;
  editorCanRetry: boolean;
}

@Component
export struct ReaderSourceToolsStructureFixture {
  @Prop @Watch('onParentFontsChanged') fontsReady: boolean = false;
  @Prop scenario: SourceToolsFixtureScenario = 'content';
  onBack: () => void = (): void => {};
  onAction: (kind: string) => void = (_kind: string): void => {};
  // Forward the real child keyboard-Back port under this scene identity.
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  @StorageLink('readerWindowMetricsRevision') @Watch('onMetricsChanged') private metricsRevision: number = 0;
  @State private fixtureGeneration: number = 0;
  @State private snapshot: SourceToolsSnapshot = emptyToolsFixtureSnapshot();
  private mounted: boolean = false;
  private intentCount: number = 0;
  private actualWidth: number = 0;
  private actualHeight: number = 0;
  private childBackIdentity: string = '';

  aboutToAppear(): void {
    this.mounted = true;
    this.fixtureGeneration += 1;
    this.snapshot = this.createSnapshot();
    if (this.current(this.fixtureGeneration)) this.record('mounted');
  }

  aboutToDisappear(): void {
    this.retireChildBack();
    this.mounted = false;
    this.fixtureGeneration += 1;
  }

  private onParentFontsChanged(): void {
    this.retireChildBack();
    this.fixtureGeneration += 1;
  }

  private bindChildBack(generation: number, handler: (() => boolean) | undefined, identity: string): void {
    if (!this.current(generation)) return;
    this.childBackIdentity = handler === undefined ? '' : identity;
    this.onTemporaryBackBridge(handler === undefined ? undefined :
      (): boolean => this.current(generation) && handler(), identity);
  }

  private retireChildBack(): void {
    const identity = this.childBackIdentity;
    this.childBackIdentity = '';
    if (identity.length > 0) this.onTemporaryBackBridge(undefined, identity);
  }

  private debugBuild(): boolean { return DEBUG === true && BUILD_MODE_NAME === 'debug'; }
  private current(generation: number): boolean {
    return this.mounted && this.debugBuild() && this.fontsReady && generation === this.fixtureGeneration;
  }

  private createSnapshot(): SourceToolsSnapshot {
    const sources: BookSource[] = [];
    const count = this.scenario === 'loading' || this.scenario === 'empty' ||
      this.scenario === 'read-empty-error' || this.scenario === 'unknown-empty' ? 0 : 12;
    for (let index = 0; index < count; index += 1) {
      const sourceId = `fixture-tools-${index}.example.invalid`;
      sources.push({ sourceId, name: `${index + 1} · 长名称书源与内存工具验证 / Long Fixture Source`,
        baseUrl: `https://${sourceId}`, enabled: index % 3 !== 0, enabledExplore: index % 2 === 0,
        category: index % 2 === 0 ? 'novel' : 'comic', group: index % 2 === 0 ? '内存分组 A' : '内存分组 B',
        sourceVersion: 'fixture-v1', checkState: index % 3 === 0 ? 'failed' : 'passed' });
    }
    const snapshot = emptyToolsFixtureSnapshot();
    snapshot.sources = sources;
    snapshot.sourceListRevision = 1;
    snapshot.selectedSourceIds = sources.slice(0, 3).map((source: BookSource): string => source.sourceId);
    snapshot.selectedSourceCount = snapshot.selectedSourceIds.length;
    snapshot.selectionRevision = 1;
    snapshot.debugSourceId = sources[0]?.sourceId ?? '';
    if (sources.length > 0) {
      snapshot.debugLogs = this.sampleLogs(sources[0].sourceId);
      snapshot.batchCheck = this.sampleProgress(sources.slice(0, 3));
    }
    if (this.scenario === 'loading') {
      snapshot.busy = true;
      snapshot.statusMessage = '内存夹具：正在读取书源工具数据…';
      snapshot.readFacts = projectOperationFacts<BookSource[]>({ phase: 'loading', generation: this.fixtureGeneration });
    }
    if (this.scenario === 'empty') {
      snapshot.readFacts = projectOperationFacts<BookSource[]>({
        phase: 'succeeded', value: sources, generation: this.fixtureGeneration });
    }
    if (this.scenario === 'read-error' || this.scenario === 'read-empty-error') {
      snapshot.readFacts = projectOperationFacts<BookSource[]>({
        phase: 'failed',
        value: this.scenario === 'read-error' ? sources : undefined,
        generation: this.fixtureGeneration, canRetry: true,
        message: '内存夹具：读取失败，重试仅记录当前读取代次。' });
      snapshot.statusEvent = 'feedback';
      snapshot.statusMessage = this.scenario === 'read-error' ?
        '内存夹具：书源刷新失败，已保留现有列表' : '内存夹具：书源读取失败，请稍后重试';
    }
    if (this.scenario === 'unknown' || this.scenario === 'unknown-empty') {
      snapshot.receipt = projectPersistedReceipt<BookSource[]>({
        confirmation: 'unknown', readback: 'failed', value: sources, canRetry: true,
        generation: this.fixtureGeneration,
        message: '内存夹具：原回执待核对，核对仅记录当前代次。'.repeat(8) });
    }
    if (this.scenario === 'original-unknown' || this.scenario === 'original-cleanup') {
      snapshot.original = { generation: this.fixtureGeneration, busy: false, blocked: true, canRetryOriginal: true,
        confirmation: this.scenario === 'original-cleanup' ? 'confirmed' : 'unknown',
        writeStage: this.scenario === 'original-cleanup' ? 'cleanup' : 'core',
        label: '内存原操作', method: 'fixture.memory', operationId: `tools-fixture-${this.fixtureGeneration}`,
        message: '内存夹具：原操作仍需核对，继续仅记录当前身份及代次。'.repeat(8) };
    }
    if (this.scenario === 'running' || this.scenario === 'running-empty') {
      snapshot.busy = true;
      snapshot.batchCheck = this.pendingProgress('running', sources.slice(0, 3), this.scenario === 'running-empty' ? 0 : 1);
    }
    if (this.scenario === 'editor-readback-failed' || this.scenario === 'editor-unknown') {
      const confirmation = this.scenario === 'editor-unknown' ? 'unknown' : 'confirmed';
      const message = `内存夹具：${projectCommitReadback(confirmation, 'failed').message}；草稿保留供核对`;
      const projection = projectPersistedReceipt<BookSource[]>({
        confirmation, readback: 'failed', value: sources,
        generation: this.fixtureGeneration, canRetry: true, message });
      snapshot.editorSourceId = sources[0].sourceId;
      snapshot.editorRevision = 1;
      snapshot.editorText = this.editorJson(sources[0]);
      snapshot.editorReadback = projection.receipt;
      snapshot.editorOperation = projection.facts;
      snapshot.receipt = projection;
      snapshot.statusMessage = message;
      snapshot.statusEvent = 'feedback';
    }
    return snapshot;
  }

  private sampleLogs(sourceId: string): SourceDebugLog[] {
    return [{ state: 0, timestampMs: 1, sourceId, traceId: 'fixture-trace',
      message: '内存样例：很长的中文检测说明与 English diagnostic details；没有网络请求。' },
    { state: -1, timestampMs: 2, sourceId, traceId: 'fixture-trace',
      message: '内存失败行，只验证布局与可访问性，不代表真实书源失败。' },
    { state: 1, timestampMs: 3, sourceId, traceId: 'fixture-trace',
      message: '内存完成行；未执行 Core 或 Host。' }];
  }

  private sampleProgress(sources: BookSource[]): SourceBatchCheckProgress {
    const results: SourceBatchCheckResult[] = sources.map((source: BookSource, index: number): SourceBatchCheckResult => ({
      sourceId: source.sourceId, sourceName: source.name, state: index % 3 === 0 ? 'passed' : index % 3 === 1 ? 'failed' : 'error',
      levelsPassed: index % 3 === 0 ? ['search', 'detail'] : [], message: '内存检查结果样例；没有真实检测或网络。',
      durationMs: index + 1, traceId: `fixture-check-${index}` }));
    return { phase: 'completed', total: results.length, completed: results.length,
      passed: results.filter((result: SourceBatchCheckResult): boolean => result.state === 'passed').length,
      failed: results.filter((result: SourceBatchCheckResult): boolean => result.state === 'failed').length,
      errors: results.filter((result: SourceBatchCheckResult): boolean => result.state === 'error').length,
      currentIndex: results.length, currentSourceId: '', currentSourceName: '', results };
  }

  private pendingProgress(phase: 'running' | 'stopping', sources: BookSource[], completed: number = 1): SourceBatchCheckProgress {
    const progress = this.sampleProgress(sources);
    progress.phase = phase;
    progress.completed = Math.min(completed, sources.length);
    progress.passed = progress.completed;
    progress.failed = 0;
    progress.errors = 0;
    progress.currentIndex = Math.min(progress.completed + 1, sources.length);
    progress.currentSourceId = sources[progress.currentIndex - 1]?.sourceId ?? '';
    progress.currentSourceName = sources[progress.currentIndex - 1]?.name ?? '';
    progress.results = progress.results.slice(0, progress.completed);
    return progress;
  }

  private stopCheck(generation: number): void {
    if (!this.current(generation) || this.snapshot.batchCheck.phase !== 'running') return;
    const next = this.copySnapshot();
    const selected = next.sources.filter((source: BookSource): boolean => next.selectedSourceIds.includes(source.sourceId));
    if (this.scenario === 'running-empty') {
      const stopped = this.pendingProgress('stopping', selected, 0);
      stopped.phase = 'stopped';
      stopped.currentIndex = 0;
      stopped.currentSourceId = '';
      stopped.currentSourceName = '';
      next.batchCheck = stopped;
      next.busy = false;
    } else {
      next.batchCheck = this.pendingProgress('stopping', selected);
    }
    this.snapshot = next;
    this.action(generation, 'stop-memory');
  }

  private record(kind: string, sourceId: string = ''): void {
    const observation: SourceToolsFixtureObservation = { kind, scenario: this.scenario, generation: this.fixtureGeneration, sourceId,
      actualWidthVp: this.actualWidth, actualHeightVp: this.actualHeight,
      systemFontScale: readerWindowMetrics().systemFontScale, intentCount: this.intentCount,
      busy: this.snapshot.busy, editorRevision: this.snapshot.editorRevision,
      sourceCount: this.snapshot.sources.length, selectedCount: this.snapshot.selectedSourceCount,
      batchPhase: this.snapshot.batchCheck.phase, readFact: this.snapshot.readFacts?.fact ?? 'none',
      confirmation: this.snapshot.original?.confirmation ?? this.snapshot.receipt?.receipt.confirmation ?? 'none',
      operationGeneration: this.snapshot.original?.generation ?? this.snapshot.receipt?.facts.generation ??
        this.snapshot.readFacts?.generation ?? 0,
      editorConfirmation: this.snapshot.editorReadback?.confirmation ?? 'none',
      editorReadback: this.snapshot.editorReadback?.readback ?? 'none',
      editorFact: this.snapshot.editorOperation?.fact ?? 'none',
      editorCanRetry: this.snapshot.editorOperation?.canRetry ?? false };
    hilog.info(0x5244, 'ReaderPageStructure', 'READER_SOURCE_TOOLS_FIXTURE %{public}s', JSON.stringify(observation));
  }

  private action(generation: number, kind: string, sourceId: string = ''): void {
    if (!this.current(generation)) return;
    this.intentCount += 1; this.record(kind, sourceId); this.onAction(`source-tools-fixture:${kind}`);
  }

  private existingSource(sourceId: string): BookSource | undefined {
    return this.snapshot.sources.find((source: BookSource): boolean => source.sourceId === sourceId);
  }

  private copySnapshot(): SourceToolsSnapshot {
    const value = this.snapshot;
    return { sources: value.sources, original: value.original, receipt: value.receipt,
      readFacts: value.readFacts, confirmedParts: value.confirmedParts,
      sourceListRevision: value.sourceListRevision, selectionRevision: value.selectionRevision,
      selectedSourceIds: value.selectedSourceIds, selectedSourceCount: value.selectedSourceCount,
      editorSourceId: value.editorSourceId, editorRevision: value.editorRevision, editorText: value.editorText,
      debugSourceId: value.debugSourceId, debugKey: value.debugKey,
      checkMode: value.checkMode, checkDepth: value.checkDepth, debugLogs: value.debugLogs,
      batchCheck: value.batchCheck, editorReadback: value.editorReadback, editorOperation: value.editorOperation,
      busy: value.busy, statusMessage: value.statusMessage, statusEvent: value.statusEvent };
  }

  private rowEnabled(value: BookSource, enabled: boolean): BookSource {
    return { sourceId: value.sourceId, name: value.name, baseUrl: value.baseUrl,
      enabled, enabledExplore: value.enabledExplore, group: value.group,
      sourceVersion: value.sourceVersion, category: value.category, loginUrl: value.loginUrl,
      checkState: value.checkState, checkLevels: value.checkLevels, checkMessage: value.checkMessage,
      checkReports: value.checkReports, lastCheckSummary: value.lastCheckSummary };
  }

  private selection(generation: number, sourceIds: string[]): void {
    if (!this.current(generation) || sourceIds.some((id: string): boolean => this.existingSource(id) === undefined)) return;
    const selected = sourceIds.filter((id: string, index: number): boolean => sourceIds.indexOf(id) === index);
    const next = this.copySnapshot();
    next.selectedSourceIds = selected; next.selectedSourceCount = selected.length;
    next.selectionRevision += 1;
    this.snapshot = next;
    this.action(generation, 'selection');
  }

  private toggleSelection(generation: number, sourceId: string): void {
    if (!this.current(generation) || this.existingSource(sourceId) === undefined) return;
    this.selection(generation, this.snapshot.selectedSourceIds.includes(sourceId) ?
      this.snapshot.selectedSourceIds.filter((id: string): boolean => id !== sourceId) : this.snapshot.selectedSourceIds.concat([sourceId]));
  }

  private acceptsSelection(generation: number, selection: SourceToolsSelection): boolean {
    const selected = this.snapshot.selectedSourceIds;
    return this.current(generation) && selection.sourceListRevision === this.snapshot.sourceListRevision &&
      selection.selectionRevision === this.snapshot.selectionRevision && selection.sourceIds.length > 0 &&
      selection.sourceIds.length === selected.length &&
      selection.sourceIds.every((id: string, index: number): boolean => id === selected[index] && this.existingSource(id) !== undefined);
  }

  private editorIsCurrent(generation: number, revision: number): boolean {
    return this.current(generation) && revision === this.snapshot.editorRevision &&
      this.existingSource(this.snapshot.editorSourceId) !== undefined;
  }

  private editorAction(generation: number, revision: number, kind: string): void {
    if (!this.editorIsCurrent(generation, revision) || this.snapshot.busy) return;
    if (this.snapshot.editorReadback !== undefined) {
      if (kind !== 'reconcile-editor-memory' || this.snapshot.editorOperation?.canRetry !== true) return;
      const message = '内存夹具：正在读取已保存书源；尚未产生读取回执';
      const projection = projectPersistedReceipt<BookSource[]>({
        confirmation: this.snapshot.editorReadback.confirmation, readback: 'reading',
        value: this.snapshot.sources, generation: this.snapshot.editorOperation.generation + 1, canRetry: false, message });
      const next = this.copySnapshot();
      next.busy = true;
      next.editorReadback = projection.receipt;
      next.editorOperation = projection.facts;
      next.receipt = projection;
      next.statusMessage = message;
      next.statusEvent = 'state';
      this.snapshot = next;
    }
    if (kind === 'save-editor-memory') {
      // Keep the accepted memory intent pending until this scene exits.
      const next = this.copySnapshot();
      next.busy = true;
      this.snapshot = next;
    }
    this.action(generation, kind);
  }

  private idsAction(generation: number, kind: string, selection: SourceToolsSelection): void {
    if (!this.acceptsSelection(generation, selection)) return;
    this.action(generation, kind);
  }

  private setEnabled(generation: number, selection: SourceToolsSelection, enabled: boolean): void {
    if (!this.acceptsSelection(generation, selection)) return;
    const sourceIds = selection.sourceIds;
    const next = this.copySnapshot();
    next.sources = this.snapshot.sources.map((source: BookSource): BookSource =>
      sourceIds.includes(source.sourceId) ? this.rowEnabled(source, enabled) : source);
    next.sourceListRevision += 1;
    this.snapshot = next;
    this.action(generation, enabled ? 'enable-memory' : 'disable-memory');
  }

  private openEditor(generation: number, sourceId: string): void {
    const source = this.existingSource(sourceId);
    if (!this.current(generation) || source === undefined) return;
    const next = this.copySnapshot();
    next.editorSourceId = sourceId; next.editorText = this.editorJson(source); next.editorRevision += 1;
    this.snapshot = next;
    this.action(generation, 'open-editor', sourceId);
  }

  private editorJson(source: BookSource): string {
    return JSON.stringify({ bookSourceUrl: source.sourceId, bookSourceName: source.name,
      bookSourceGroup: source.group, bookSourceType: source.category === 'comic' ? 2 : 0,
      enabled: source.enabled, enabledExplore: source.enabledExplore }, undefined, 2);
  }

  private editorText(generation: number, text: string, revision: number): void {
    if (!this.editorIsCurrent(generation, revision) || this.snapshot.editorReadback !== undefined) return;
    const next = this.copySnapshot(); next.editorText = text; this.snapshot = next;
    this.action(generation, 'editor-draft', this.snapshot.editorSourceId);
  }

  private cancelEditor(generation: number, revision: number): void {
    if (!this.editorIsCurrent(generation, revision) || this.snapshot.editorReadback !== undefined) return;
    const next = this.copySnapshot(); next.editorSourceId = ''; next.editorText = ''; next.editorRevision += 1; this.snapshot = next;
    this.action(generation, 'cancel-editor');
  }

  private checkSelection(generation: number, mode: 'search' | 'explore', depth: number): void {
    if (!this.current(generation) || !Number.isInteger(depth) || depth < 2 || depth > 5) return;
    const next = this.copySnapshot(); next.checkMode = mode; next.checkDepth = depth; this.snapshot = next;
    this.action(generation, 'check-parameters');
  }

  private debugKey(generation: number, value: string): void {
    if (!this.current(generation)) return;
    const next = this.copySnapshot(); next.debugKey = value; this.snapshot = next;
    this.action(generation, 'debug-key');
  }

  private debugSource(generation: number, sourceId: string): void {
    if (!this.current(generation) || this.existingSource(sourceId) === undefined) return;
    const next = this.copySnapshot(); next.debugSourceId = sourceId; next.debugLogs = this.sampleLogs(sourceId);
    this.snapshot = next;
    this.action(generation, 'debug-memory', sourceId);
  }

  private checkSources(generation: number, selection: SourceToolsSelection): void {
    if (!this.acceptsSelection(generation, selection)) return;
    const sourceIds = selection.sourceIds;
    const next = this.copySnapshot();
    next.batchCheck = this.sampleProgress(this.snapshot.sources.filter((source: BookSource): boolean => sourceIds.includes(source.sourceId)));
    this.snapshot = next;
    this.action(generation, 'check-memory');
  }

  private back(generation: number): void {
    if (!this.current(generation)) return;
    this.action(generation, 'back-to-menu'); this.onBack();
  }

  private observeArea(generation: number, area: Area): void {
    if (!this.current(generation)) return;
    const width = readerPageAreaLength(area.width), height = readerPageAreaLength(area.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 ||
      (width === this.actualWidth && height === this.actualHeight)) return;
    this.actualWidth = width; this.actualHeight = height; this.record('actual-area');
  }

  private onMetricsChanged(): void { if (this.current(this.fixtureGeneration)) this.record('window-metrics'); }

  private reconcile(generation: number, operationGeneration: number): void {
    if (!this.current(generation)) return;
    const editor = this.snapshot.editorOperation;
    if (this.snapshot.editorSourceId.length > 0 && editor?.generation === operationGeneration && editor.canRetry) {
      this.editorAction(generation, this.snapshot.editorRevision, 'reconcile-editor-memory');
      return;
    }
    if (this.snapshot.editorSourceId.length > 0) return;
    this.action(generation, 'reconcile-memory');
  }

  @Builder
  private fontPreparationState() {
    ReaderPageState({ title: this.debugBuild() ? '生产字体准备中' : '当前构建不提供组件验证',
      loading: this.debugBuild() });
  }

  build() {
    if (this.current(this.fixtureGeneration)) {
      ForEach([this.fixtureGeneration], (generation: number): void => {
        SourceToolsPage({ snapshot: this.snapshot,
          isOpeningCurrent: (): boolean => this.current(generation),
          isInputAllowed: (): boolean => this.current(generation),
          onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void =>
            this.bindChildBack(generation, handler, identity),
          onBack: (): void => this.back(generation),
          onExportAll: (): void => this.action(generation, 'export-all-memory'),
          onExportSelected: (selection: SourceToolsSelection): void => this.idsAction(generation, 'export-selected-memory', selection),
          onCheckSelected: (selection: SourceToolsSelection): void => this.checkSources(generation, selection),
          onStopCheck: (): void => this.stopCheck(generation),
          onCheckSelectionChanged: (mode: 'search' | 'explore', depth: number): void => this.checkSelection(generation, mode, depth),
          onSetSelectedEnabled: (selection: SourceToolsSelection, enabled: boolean): void => this.setEnabled(generation, selection, enabled),
          onDeleteSelected: (selection: SourceToolsSelection): void => this.idsAction(generation, 'delete-memory-intent', selection),
          onOpenEditor: (id: string): void => this.openEditor(generation, id),
          onEditorDraftChanged: (text: string, revision: number): void => this.editorText(generation, text, revision),
          onSaveEditor: (revision: number): void => this.editorAction(generation, revision, 'save-editor-memory'),
          onReconcileEditor: (revision: number): void => this.editorAction(generation, revision, 'reconcile-editor-memory'),
          onCancelEditor: (revision: number): void => this.cancelEditor(generation, revision),
          onDebugKeyChanged: (text: string): void => this.debugKey(generation, text),
          onDebugSource: (id: string): void => this.debugSource(generation, id),
          onSelectAll: (): void => this.selection(generation, this.snapshot.sources.map((source: BookSource): string => source.sourceId)),
          onClearSelection: (): void => this.selection(generation, []),
          onToggleSelection: (id: string): void => this.toggleSelection(generation, id),
          onReconcile: (revision: number): void => this.reconcile(generation, revision),
          onContinueOriginal: (_revision: number): void => this.action(generation, 'continue-memory'),
        }).width('100%').height('100%').id('reader-source-tools-structure-fixture')
          .onAreaChange((_old: Area, area: Area): void => this.observeArea(generation, area));
      }, (generation: number): string => `source-tools-fixture-${generation}`);
    } else { this.fontPreparationState(); }
  }
}
