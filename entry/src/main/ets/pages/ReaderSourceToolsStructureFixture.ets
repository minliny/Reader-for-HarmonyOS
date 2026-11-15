// DEBUG-only component fixture. All rows, JSON and diagnostics are in memory.
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { SourceToolsPage } from '../features/source/ui/SourceToolsPage';
import type { BookSource, SourceDebugLog } from '../features/source/application/SourceGateway';
import type { SourceToolsSnapshot, SourceBatchCheckProgress, SourceBatchCheckResult, SourceToolsSelection } from '../features/source/application/SourceToolsOrchestrator';
import { ReaderPageState } from '../ui/feedback/ReaderPageState';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import { readerWindowMetrics } from '../ui/foundation/ReaderWindowEnvironment';

const emptyToolsFixtureSnapshot = (): SourceToolsSnapshot => {
  return { sources: [], sourceListRevision: 0, selectionRevision: 0, selectedSourceIds: [], selectedSourceCount: 0,
    editorSourceId: '', editorRevision: 0, editorText: '', debugSourceId: '', debugKey: '内存测试关键词', checkMode: 'search', checkDepth: 2,
    debugLogs: [], batchCheck: { phase: 'idle', total: 0, completed: 0, passed: 0, failed: 0, errors: 0,
      currentIndex: 0, currentSourceId: '', currentSourceName: '', results: [] },
    editorReadback: undefined, editorOperation: undefined, busy: false, statusMessage: '', statusEvent: 'state' };
};

interface SourceToolsFixtureObservation {
  kind: string;
  generation: number;
  sourceId: string;
  actualWidthVp: number;
  actualHeightVp: number;
  systemFontScale: number;
  intentCount: number;
  busy: boolean;
  editorRevision: number;
}

@Component
export struct ReaderSourceToolsStructureFixture {
  @Prop @Watch('onParentFontsChanged') fontsReady: boolean = false;
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
    for (let index = 0; index < 12; index += 1) {
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
    snapshot.debugSourceId = sources[0].sourceId;
    snapshot.debugLogs = this.sampleLogs(sources[0].sourceId);
    snapshot.batchCheck = this.sampleProgress(sources.slice(0, 3));
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

  private record(kind: string, sourceId: string = ''): void {
    const observation: SourceToolsFixtureObservation = { kind, generation: this.fixtureGeneration, sourceId,
      actualWidthVp: this.actualWidth, actualHeightVp: this.actualHeight,
      systemFontScale: readerWindowMetrics().systemFontScale, intentCount: this.intentCount,
      busy: this.snapshot.busy, editorRevision: this.snapshot.editorRevision };
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
    const text = JSON.stringify({ bookSourceUrl: source.sourceId, bookSourceName: source.name,
      bookSourceGroup: source.group, bookSourceType: source.category === 'comic' ? 2 : 0,
      enabled: source.enabled, enabledExplore: source.enabledExplore }, undefined, 2);
    const next = this.copySnapshot();
    next.editorSourceId = sourceId; next.editorText = text; next.editorRevision += 1;
    this.snapshot = next;
    this.action(generation, 'open-editor', sourceId);
  }

  private editorText(generation: number, text: string, revision: number): void {
    if (!this.editorIsCurrent(generation, revision)) return;
    const next = this.copySnapshot(); next.editorText = text; this.snapshot = next;
    this.action(generation, 'editor-draft', this.snapshot.editorSourceId);
  }

  private cancelEditor(generation: number, revision: number): void {
    if (!this.editorIsCurrent(generation, revision)) return;
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
          onStopCheck: (): void => this.action(generation, 'stop-memory'),
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
          onReconcile: (_revision: number): void => this.action(generation, 'reconcile-memory'),
          onContinueOriginal: (_revision: number): void => this.action(generation, 'continue-memory'),
        }).width('100%').height('100%').id('reader-source-tools-structure-fixture')
          .onAreaChange((_old: Area, area: Area): void => this.observeArea(generation, area));
      }, (generation: number): string => `source-tools-fixture-${generation}`);
    } else { this.fontPreparationState(); }
  }
}
