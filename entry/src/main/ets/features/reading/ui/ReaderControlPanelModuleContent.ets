import type { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import type { ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { ReaderAppearanceAlignment, ReaderAppearanceFont, ReaderAppearanceFontSlot, ReaderAppearanceIndent,
  ReaderAppearanceMetric, ReaderAppearanceStepDirection, ReaderAppearanceTheme } from '../application/ReaderAppearanceState';
import { readerPageTurnStyle, type ReaderPageTurnStyle, type ReaderScreenDirection, type ReaderScreenTimeout,
  type ReaderSettingsToggleKey, type ReaderWidePageLayout } from '../application/ReaderSettingsState';
import type { ReaderReplacePreview } from '../application/ReaderReplaceQuickGateway';
import type { ReaderControlReplaceDraft, ReaderReplaceRule } from '../application/ReaderReplaceQuickState';
import type { ReaderTtsConfigurationDraft } from '../application/ReaderTtsConfigurationHost';
import type { ReaderTtsTimerMode } from '../application/ReaderTtsState';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { ReaderControlAppearanceContent, type ReaderControlFontOrderPresentation } from './ReaderControlAppearanceContent';
import { ReaderControlAutoPageContent } from './ReaderControlAutoPageContent';
import { ReaderControlDirectoryContent } from './ReaderControlDirectoryContent';
import type { ReaderControlModuleFacts, ReaderControlPreparedModuleProfile } from './ReaderControlMinimumMeasurement';
import type { ReaderControlMotionFrame } from './ReaderControlMotionGeometry';
import { defaultReaderControlIntent, type ReaderControlIntent, type ReaderControlIntentHandler,
  type ReaderControlIntentResult, type ReaderControlPanelFacts } from './ReaderControlPanelNativeContract';
import type { ReaderControlPlaybackProfileReader } from './ReaderControlPlaybackProfile';
import { ReaderControlReplaceContent } from './ReaderControlReplaceContent';
import { ReaderControlSearchContent } from './ReaderControlSearchContent';
import type { ReaderControlLocation, ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { ReaderControlSettingsContent } from './ReaderControlSettingsContent';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';
import type { ReaderControlContentModule, ReaderControlModuleMeasurer } from './ReaderLayoutGeometry';
import type { ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';

export interface ReaderControlPanelModuleGeometry {
  readonly location: () => ReaderControlLocation;
  readonly frame: () => ReaderControlMotionFrame;
  readonly expanded: () => boolean;
  readonly width: () => number;
  readonly height: () => number;
  readonly progress: () => number;
  readonly endpointHeight: (full: boolean) => number;
}

export interface ReaderControlPanelModuleMinimum {
  readonly identity: () => string;
  readonly key: () => string;
  readonly prepared: () => ReaderControlPreparedModuleProfile | undefined;
  readonly bind: (module: ReaderControlContentModule, identity: string, measurer: ReaderControlModuleMeasurer | undefined,
    profileReader?: ReaderControlPlaybackProfileReader) => void;
  readonly factsChanged: (identity: string, facts: ReaderControlModuleFacts) => void;
}

type ReaderControlModuleTemporaryLayer = (active: boolean, kind?: ReaderControlTemporaryInputKind,
  endEditing?: () => void | Promise<void>) => void;
type ReaderControlModuleBookmarkSelection = (bookmarkId: string, chapterIndex: number, chapterOffset: number,
  positionScope?: RemoteReadingPositionScope) => void;

export interface ReaderControlPanelModuleInput {
  readonly active: (module: string) => boolean;
  readonly editorCurrent: (module: 'search' | 'directory' | 'tts') => boolean;
  readonly temporaryLayer: (module: string) => ReaderControlModuleTemporaryLayer;
  readonly editingHost: () => ReaderEditingVisibility;
  readonly listSessionKey: () => string;
  readonly canStepChapter: (delta: number) => boolean;
  readonly requestHome: () => void;
  readonly directoryTab: (tab: string) => void;
  readonly expandReplace: () => void;
  readonly fontReorder: (active: boolean) => void;
  readonly mounted: () => boolean;
  readonly visualEpoch: () => number;
}

export interface ReaderControlPanelModuleLaunch {
  readonly detached: (module: 'tts' | 'autoPage') => boolean;
  readonly visible: (kind: ReaderSessionMorphSourceKind) => void;
  readonly measured: (kind: ReaderSessionMorphSourceKind, left: number, top: number, width: number, height: number) => void;
}

/** Keeps the same module actor through quick/full motion. The panel owns the
 * control session, current native focus, and measured geometry admission. */
export class ReaderControlPanelModuleScene {
  readonly facts: () => ReaderControlPanelFacts;
  readonly geometry: ReaderControlPanelModuleGeometry;
  readonly minimum: ReaderControlPanelModuleMinimum;
  readonly input: ReaderControlPanelModuleInput;
  readonly launch: ReaderControlPanelModuleLaunch;
  private readonly handler: () => ReaderControlIntentHandler;
  private verifiedSearchResultScope: number = 0;
  private verifiedSearchResultCount: number = 0;
  private readonly selectBookmark: ReaderControlModuleBookmarkSelection =
    (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void => {
      this.dispatch({ kind: 'selectBookmark', bookmarkId, chapterIndex, chapterOffset, positionScope });
    };

  constructor(facts: () => ReaderControlPanelFacts, handler: () => ReaderControlIntentHandler,
    geometry: ReaderControlPanelModuleGeometry, minimum: ReaderControlPanelModuleMinimum,
    input: ReaderControlPanelModuleInput, launch: ReaderControlPanelModuleLaunch) {
    this.facts = facts;
    this.handler = handler;
    this.geometry = geometry;
    this.minimum = minimum;
    this.input = input;
    this.launch = launch;
  }

  dispatch(intent: ReaderControlIntent): ReaderControlIntentResult { return this.handler()(intent); }

  bookmarkSelection(): ReaderControlModuleBookmarkSelection | undefined {
    return this.handler() === defaultReaderControlIntent ? undefined : this.selectBookmark;
  }

  observeSearchResultList(scope: number, count: number): void {
    const verification = this.facts().geometry.verification;
    const location = this.geometry.location();
    if (!this.input.mounted() || verification?.observing() !== true ||
      location.level !== 'secondary' || location.module !== 'search' || location.form !== 'quick' ||
      (scope === this.verifiedSearchResultScope && count === this.verifiedSearchResultCount)) return;
    this.verifiedSearchResultScope = scope;
    this.verifiedSearchResultCount = count;
    verification.effect('search-results', 'published', { scope, rowCount: count, form: 'quick', epoch: this.input.visualEpoch() });
  }
}

export interface ReaderControlPanelModuleProps {
  readonly scene: ReaderControlPanelModuleScene;
}

@Builder
export function ReaderControlPanelModuleContent($$: ReaderControlPanelModuleProps) {
  if ($$.scene.geometry.location().module === 'directory') {
    ReaderControlModuleDirectory({ scene: $$.scene });
  } else if ($$.scene.geometry.location().module === 'search') {
    ReaderControlModuleSearch({ scene: $$.scene });
  } else if ($$.scene.geometry.location().module === 'settings') {
    ReaderControlModuleSettings({ scene: $$.scene });
  } else if ($$.scene.geometry.location().module === 'tts') {
    ReaderControlModuleTts({ scene: $$.scene });
  } else if ($$.scene.geometry.location().module === 'autoPage') {
    ReaderControlModuleAutoPage({ scene: $$.scene });
  } else if ($$.scene.geometry.location().module === 'replace') {
    ReaderControlModuleReplace({ scene: $$.scene });
  } else if ($$.scene.geometry.location().module === 'appearance') {
    ReaderControlModuleAppearance({ scene: $$.scene });
  }
}

@Builder
function ReaderControlModuleDirectory($$: ReaderControlPanelModuleProps) {
  ReaderControlDirectoryContent({
    verificationSession: $$.scene.facts().geometry.verification,
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
      $$.scene.minimum.bind('directory', identity, measurer),
    directoryPublication: $$.scene.facts().document.catalog.publication,
    directoryEntriesRevision: $$.scene.facts().document.catalog.revision,
    currentChapterIndex: $$.scene.facts().document.chapterIndex,
    catalogComplete: $$.scene.facts().document.catalog.complete, catalogChapterCount: $$.scene.facts().document.catalog.chapterCount,
    catalogLoading: $$.scene.facts().document.catalog.loading, catalogLoadFailed: $$.scene.facts().document.catalog.loadFailed,
    catalogCurrentPosition: $$.scene.facts().document.catalog.position,
    catalogReadableChapterCount: $$.scene.facts().document.totalChapters,
    catalogReadablePosition: $$.scene.facts().document.readableChapterPosition,
    onRequireCompleteCatalog: (): void => { $$.scene.dispatch({ kind: 'requireCompleteCatalog' }); },
    bookmarkLoadFailed: $$.scene.facts().document.bookmarks.loadFailed,
    bookmarkLoadMessage: $$.scene.facts().document.bookmarks.message,
    bookmarkRecovery: $$.scene.facts().document.bookmarks.recovery,
    onRetryBookmarkLoad: (): void => { $$.scene.dispatch({ kind: 'retryBookmarkLoad' }); },
    chapterDownloadEnabled: $$.scene.facts().document.download.chapterEnabled,
    mangaSearch: $$.scene.facts().document.search.manga,
    chapterStartBookmarkCreationEnabled: $$.scene.facts().document.bookmarks.allowChapterStart,
    progress: $$.scene.geometry.progress(),
    interactionEnabled: $$.scene.input.active('directory'),
    inputCurrent: (): boolean => $$.scene.input.active('directory'),
    editorInputCurrent: (): boolean => $$.scene.input.editorCurrent('directory'),
    onTemporaryLayerChange: $$.scene.input.temporaryLayer('directory'),
    dismissTemporaryRevision: $$.scene.facts().geometry.temporary.dismissRevision,
    availableWidth: $$.scene.geometry.width(), availableHeight: $$.scene.geometry.height(),
    tab: $$.scene.geometry.location().directoryTab,
    sessionKey: $$.scene.input.listSessionKey(), bookmarkIdentity: $$.scene.facts().document.bookmarks.book,
    onTabChange: (tab: string): void => $$.scene.input.directoryTab(tab),
    onSelectChapter: (index: number): void => { $$.scene.dispatch({ kind: 'selectChapter', chapterIndex: index }); },
    onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope,
      directoryTargetProof?: ReaderDirectoryTargetProof): void => {
      $$.scene.dispatch({ kind: 'selectNavigationTarget', chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof });
    },
    onSelectBookmark: $$.scene.bookmarkSelection(),
    onDownloadChapter: (index: number): void => { $$.scene.dispatch({ kind: 'downloadChapter', chapterIndex: index }); },
    onDeleteBookmarks: (times: number[]): void => { $$.scene.dispatch({ kind: 'deleteBookmarks', bookmarkTimes: times }); },
    onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
      $$.scene.dispatch({ kind: 'createChapterStartBookmark', request });
    },
  });
}

@Builder
function ReaderControlModuleSearch($$: ReaderControlPanelModuleProps) {
  ReaderControlSearchContent({ editingHost: $$.scene.input.editingHost(),
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
      $$.scene.minimum.bind('search', identity, measurer),
    fullContentHeight: $$.scene.geometry.endpointHeight(true), quickContentHeight: $$.scene.geometry.endpointHeight(false),
    motionProgress: $$.scene.geometry.progress(),
    availableWidth: $$.scene.geometry.width(),
    availableHeight: $$.scene.geometry.height(),
    interactionEnabled: $$.scene.input.active('search'),
    inputCurrent: (): boolean => $$.scene.input.active('search'),
    dismissTemporaryRevision: $$.scene.facts().geometry.temporary.dismissRevision,
    onTemporaryLayerChange: $$.scene.input.temporaryLayer('search'),
    editorInputCurrent: (): boolean => $$.scene.input.editorCurrent('search'),
    query: $$.scene.facts().document.search.query,
    onlineBook: $$.scene.facts().document.source.id !== 'local' && ($$.scene.facts().document.source.id?.length ?? 0) > 0,
    searchPublication: $$.scene.facts().document.search.publication,
    searchRevision: $$.scene.facts().document.search.revision,
    onBack: (): void => $$.scene.input.requestHome(),
    onQueryChange: (query: string): void => { $$.scene.dispatch({ kind: 'searchQueryChange', query }); },
    onSearch: (): void => { $$.scene.dispatch({ kind: 'search' }); },
    onLoadMore: (): void => { $$.scene.dispatch({ kind: 'searchLoadMore' }); },
    onNeedMore: (): void => { $$.scene.dispatch({ kind: 'searchNeedMore' }); },
    onResultListPublished: (scope: number, count: number): void => $$.scene.observeSearchResultList(scope, count),
    onSelectResult: (result: ReadingContentSearchResult, scope: number, ordinal: number): void => {
      $$.scene.dispatch({ kind: 'searchResultSelect', result, scope, ordinal });
    },
  });
}

@Builder
function ReaderControlModuleSettings($$: ReaderControlPanelModuleProps) {
  ReaderControlSettingsContent({
    fixedIsland: $$.scene.facts().geometry.fixedIsland,
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
      $$.scene.minimum.bind('settings', identity, measurer),
    fullViewportHeight: $$.scene.geometry.endpointHeight(true),
    motionProgress: $$.scene.geometry.progress(),
    availableWidth: $$.scene.geometry.width(),
    availableHeight: $$.scene.geometry.height(),
    interactionEnabled: $$.scene.input.active('settings'),
    inputCurrent: (): boolean => $$.scene.input.active('settings'),
    snapshot: $$.scene.facts().preferences.settings,
    widePageLayoutAvailable: $$.scene.geometry.expanded(), widePageLayout: $$.scene.facts().preferences.widePageLayout,
    onWidePageLayoutChange: (value: ReaderWidePageLayout): void => {
      if ($$.scene.geometry.expanded() && $$.scene.input.active('settings')) $$.scene.dispatch({ kind: 'widePageLayoutChange', value });
    },
    pageTurnSimulationAvailable: $$.scene.facts().preferences.pageTurnSimulationAvailable,
    justifyText: $$.scene.facts().preferences.appearance.alignment === 'justify',
    onJustifyTextChange: (_value: boolean): void => {
      $$.scene.dispatch({ kind: 'appearanceAlignmentRequest', current: $$.scene.facts().preferences.appearance.alignment });
    },
    onPageTurnStyleChange: (style: ReaderPageTurnStyle): void => {
      $$.scene.dispatch({ kind: 'pageTurnStyleChange', style });
    },
    onScreenDirectionChange: (direction: ReaderScreenDirection): void => {
      $$.scene.dispatch({ kind: 'screenDirectionChange', direction });
    },
    onScreenTimeoutChange: (timeout: ReaderScreenTimeout): void => {
      $$.scene.dispatch({ kind: 'screenTimeoutChange', timeout });
    },
    onToggleChange: (key: ReaderSettingsToggleKey, value: boolean): void => {
      $$.scene.dispatch({ kind: 'settingsToggleChange', key, value });
    },
  });
}

@Builder
function ReaderControlModuleTts($$: ReaderControlPanelModuleProps) {
  ReaderControlTtsContent({
    fixedIsland: $$.scene.facts().geometry.fixedIsland,
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined,
      profileReader?: ReaderControlPlaybackProfileReader): void => $$.scene.minimum.bind('tts', identity, measurer, profileReader),
    sourceDetached: $$.scene.launch.detached('tts'),
    sourceHandoffPending: $$.scene.facts().launch.recovering,
    reduceMotion: $$.scene.facts().geometry.reduceMotion,
    waveformActive: $$.scene.geometry.frame().visibility > 0 && !$$.scene.launch.detached('tts') && !$$.scene.facts().geometry.obscured,
    onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => $$.scene.launch.visible(kind),
    dismissTemporaryRevision: $$.scene.facts().geometry.temporary.dismissRevision,
    onTemporaryLayerChange: $$.scene.input.temporaryLayer('tts'),
    fullViewportHeight: $$.scene.geometry.endpointHeight(true),
    motionProgress: $$.scene.geometry.progress(),
    form: $$.scene.geometry.location().form,
    expandedLayout: $$.scene.geometry.expanded(),
    availableWidth: $$.scene.geometry.width(),
    availableHeight: $$.scene.geometry.height(),
    interactionEnabled: $$.scene.input.active('tts'),
    inputCurrent: (): boolean => $$.scene.input.active('tts'),
    editorInputCurrent: (): boolean => $$.scene.input.editorCurrent('tts'),
    state: $$.scene.facts().playback.speech.state,
    timerMode: $$.scene.facts().playback.speech.timerMode,
    timerMinutes: $$.scene.facts().playback.speech.timerMinutes,
    timerSeconds: $$.scene.facts().playback.speech.timerSeconds,
    followHighlight: $$.scene.facts().playback.speech.followHighlight,
    pauseOnInterruption: $$.scene.facts().playback.speech.pauseOnInterruption,
    allowMixing: $$.scene.facts().playback.speech.allowMixing,
    backgroundPlayback: $$.scene.facts().playback.speech.backgroundPlayback,
    keepScreenOn: $$.scene.facts().playback.speech.keepScreenOn,
    failurePolicy: $$.scene.facts().playback.speech.failurePolicy,
    engine: $$.scene.facts().playback.speech.engine,
    httpEngines: $$.scene.facts().playback.speech.httpEngines,
    configurationRecovery: $$.scene.facts().playback.speech.configurationRecovery,
    configurationLoading: $$.scene.facts().playback.speech.configurationLoading,
    configurationLoadFailed: $$.scene.facts().playback.speech.configurationLoadFailed,
    voiceOptions: $$.scene.facts().playback.speech.voiceOptions,
    language: $$.scene.facts().playback.speech.language,
    person: $$.scene.facts().playback.speech.person,
    onToggle: (): void => { $$.scene.dispatch({ kind: 'ttsToggle' }); },
    onStop: (): void => { $$.scene.dispatch({ kind: 'ttsStop' }); },
    onPrevious: (): void => { $$.scene.dispatch({ kind: 'ttsPrevious' }); },
    onNext: (): void => { $$.scene.dispatch({ kind: 'ttsNext' }); },
    onSeek: (sliceIndex: number): void => { $$.scene.dispatch({ kind: 'ttsSeek', sliceIndex }); },
    onRateChange: (rate: number, onDeclined?: () => void): void => { $$.scene.dispatch({ kind: 'ttsRateChange', rate, onDeclined }); },
    onTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode): void => {
      $$.scene.dispatch({ kind: 'ttsTimerChange', minutes, seconds, mode });
    },
    onFollowHighlightChange: (enabled: boolean): void => { $$.scene.dispatch({ kind: 'ttsFollowHighlightChange', enabled }); },
    onPauseOnInterruptionChange: (enabled: boolean): void => {
      $$.scene.dispatch({ kind: 'ttsPauseOnInterruptionChange', enabled });
    },
    onAllowMixingChange: (enabled: boolean): void => { $$.scene.dispatch({ kind: 'ttsAllowMixingChange', enabled }); },
    onBackgroundPlaybackChange: (enabled: boolean): void => { $$.scene.dispatch({ kind: 'ttsBackgroundPlaybackChange', enabled }); },
    onKeepScreenOnChange: (enabled: boolean): void => { $$.scene.dispatch({ kind: 'ttsKeepScreenOnChange', enabled }); },
    onFailurePolicyChange: (policy: 'skip' | 'stop'): void => { $$.scene.dispatch({ kind: 'ttsFailurePolicyChange', policy }); },
    onVoiceChange: (language: string, person: number): void => { $$.scene.dispatch({ kind: 'ttsVoiceChange', language, person }); },
    onVoiceAudition: (language: string, person: number): Promise<void> =>
      ($$.scene.dispatch({ kind: 'ttsVoiceAudition', language, person }) as Promise<void>),
    onAuditionStop: (): void => { $$.scene.dispatch({ kind: 'ttsAuditionStop' }); },
    onEngineChange: (engine: string): Promise<void> => ($$.scene.dispatch({ kind: 'ttsEngineChange', engine }) as Promise<void>),
    onHttpEnginePut: (config: ReaderTtsConfigurationDraft): Promise<void> =>
      ($$.scene.dispatch({ kind: 'ttsHttpEnginePut', config }) as Promise<void>),
    onHttpEngineDelete: (id: number): Promise<void> => ($$.scene.dispatch({ kind: 'ttsHttpEngineDelete', id }) as Promise<void>),
    onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
      width: number, height: number): void => $$.scene.launch.measured(kind, left, top, width, height),
  });
}

@Builder
function ReaderControlModuleAutoPage($$: ReaderControlPanelModuleProps) {
  ReaderControlAutoPageContent({
    fixedIsland: $$.scene.facts().geometry.fixedIsland,
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined,
      profileReader?: ReaderControlPlaybackProfileReader): void => $$.scene.minimum.bind('autoPage', identity, measurer, profileReader),
    sourceDetached: $$.scene.launch.detached('autoPage'),
    sourceHandoffPending: $$.scene.facts().launch.recovering,
    onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => $$.scene.launch.visible(kind),
    fullViewportHeight: $$.scene.geometry.endpointHeight(true),
    expandedLayout: $$.scene.geometry.expanded(), motionProgress: $$.scene.geometry.progress(),
    form: $$.scene.geometry.location().form,
    availableWidth: $$.scene.geometry.width(),
    availableHeight: $$.scene.geometry.height(),
    interactionEnabled: $$.scene.input.active('autoPage'),
    inputCurrent: (): boolean => $$.scene.input.active('autoPage'),
    canPreviousChapter: $$.scene.input.canStepChapter(-1),
    canNextChapter: $$.scene.input.canStepChapter(1),
    status: $$.scene.facts().playback.automatic.status, speedSeconds: $$.scene.facts().playback.automatic.speedSeconds,
    timerMinutes: $$.scene.facts().playback.automatic.timerMinutes, timerSeconds: $$.scene.facts().playback.automatic.timerSeconds,
    timerSummaryText: $$.scene.facts().playback.automatic.timerSummary, followHighlight: $$.scene.facts().playback.automatic.followHighlight,
    onBack: (): void => $$.scene.input.requestHome(),
    onPreviousChapter: (): void => { $$.scene.dispatch({ kind: 'previousChapter' }); },
    onToggleRunning: (): void => { $$.scene.dispatch({ kind: 'autoPageToggle' }); },
    onStop: (): void => { $$.scene.dispatch({ kind: 'autoPageStop' }); },
    onNextChapter: (): void => { $$.scene.dispatch({ kind: 'nextChapter' }); },
    onTimerChange: (minutes: number, seconds: number): void => {
      $$.scene.dispatch({ kind: 'autoPageFullTimerChange', minutes, seconds });
    },
    onSpeedChange: (seconds: number, onDeclined?: () => void): void => {
      $$.scene.dispatch({ kind: 'autoPageFullSpeedChange', seconds, onDeclined });
    },
    onFollowHighlightChange: (enabled: boolean): void => { $$.scene.dispatch({ kind: 'autoPageFollowHighlightChange', enabled }); },
    onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
      width: number, height: number): void => $$.scene.launch.measured(kind, left, top, width, height),
  });
}

@Builder
function ReaderControlModuleReplace($$: ReaderControlPanelModuleProps) {
  ReaderControlReplaceContent({
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
      $$.scene.minimum.bind('replace', identity, measurer),
    fullContentHeight: $$.scene.geometry.endpointHeight(true), quickContentHeight: $$.scene.geometry.endpointHeight(false),
    state: $$.scene.facts().document.replace, motionProgress: $$.scene.geometry.progress(),
    availableWidth: $$.scene.geometry.width(), availableHeight: $$.scene.geometry.height(),
    interactionEnabled: $$.scene.input.active('replace'),
    inputCurrent: (): boolean => $$.scene.input.active('replace'),
    dismissTemporaryRevision: $$.scene.facts().geometry.temporary.dismissRevision,
    retireTemporaryRevision: $$.scene.facts().geometry.temporary.retireRevision,
    onTemporaryLayerChange: $$.scene.input.temporaryLayer('replace'),
    onBack: (): void => $$.scene.input.requestHome(),
    onExpand: (): void => $$.scene.input.expandReplace(),
    onReload: (operationId?: string): Promise<void> => ($$.scene.dispatch({ kind: 'reloadControlReplace', operationId }) as Promise<void>),
    onSave: (draft: ReaderControlReplaceDraft): Promise<void> => ($$.scene.dispatch({ kind: 'saveControlReplace', draft }) as Promise<void>),
    onToggle: (rule: ReaderReplaceRule, value: boolean): Promise<void> =>
      ($$.scene.dispatch({ kind: 'toggleControlReplace', rule, value }) as Promise<void>),
    onDelete: (rule: ReaderReplaceRule): Promise<void> => ($$.scene.dispatch({ kind: 'deleteControlReplace', rule }) as Promise<void>),
    onPreview: (): Promise<ReaderReplacePreview> => ($$.scene.dispatch({ kind: 'previewControlReplace' }) as Promise<ReaderReplacePreview>),
    onImport: (): Promise<void> => ($$.scene.dispatch({ kind: 'importControlReplace' }) as Promise<void>),
    onExport: (): Promise<void> => ($$.scene.dispatch({ kind: 'exportControlReplace' }) as Promise<void>),
  });
}

@Builder
function ReaderControlModuleAppearance($$: ReaderControlPanelModuleProps) {
  ReaderControlAppearanceContent({
    fixedIsland: $$.scene.facts().geometry.fixedIsland,
    verificationSession: $$.scene.facts().geometry.verification,
    minimumIdentity: $$.scene.minimum.identity(), minimumKey: $$.scene.minimum.key(),
    preparedMinimum: $$.scene.minimum.prepared(), preparedMinimumRequired: $$.scene.facts().geometry.minimum.preparedRequired,
    onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => $$.scene.minimum.factsChanged(identity, facts),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
      $$.scene.minimum.bind('appearance', identity, measurer),
    expandedLayout: $$.scene.geometry.expanded(),
    availableWidth: $$.scene.geometry.width(),
    availableHeight: $$.scene.geometry.height(),
    fullContentHeight: $$.scene.geometry.endpointHeight(true),
    interactionEnabled: $$.scene.input.active('appearance'),
    inputCurrent: (): boolean => $$.scene.input.active('appearance'),
    dismissTemporaryRevision: $$.scene.facts().geometry.temporary.dismissRevision,
    onTemporaryLayerChange: $$.scene.input.temporaryLayer('appearance'),
    reduceMotion: $$.scene.facts().geometry.reduceMotion,
    motionProgress: $$.scene.geometry.progress(),
    snapshot: $$.scene.facts().preferences.appearance,
    chineseConversionMode: $$.scene.facts().preferences.conversion.mode,
    pageTurnStyle: readerPageTurnStyle($$.scene.facts().preferences.settings),
    pageTurnSimulationAvailable: $$.scene.facts().preferences.pageTurnSimulationAvailable,
    onThemeChange: (theme: ReaderAppearanceTheme): void => { $$.scene.dispatch({ kind: 'appearanceThemeChange', theme }); },
    onSetDayTheme: (theme: ReaderAppearanceTheme): void => { $$.scene.dispatch({ kind: 'appearanceDayThemeChange', theme }); },
    onSetNightTheme: (theme: ReaderAppearanceTheme): void => { $$.scene.dispatch({ kind: 'appearanceNightThemeChange', theme }); },
    onFontChange: (font: ReaderAppearanceFont): void => { $$.scene.dispatch({ kind: 'appearanceFontChange', font }); },
    onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation =>
      ($$.scene.dispatch({ kind: 'appearanceFontOrderChange', fontOrder }) as ReaderControlFontOrderPresentation),
    onFontReorderActivityChange: (active: boolean): void =>
      $$.scene.input.fontReorder(active),
    onCustomFontImport: (): void => { $$.scene.dispatch({ kind: 'appearanceCustomFontImport' }); },
    onIndentRequest: (indent: ReaderAppearanceIndent): void => { $$.scene.dispatch({ kind: 'appearanceIndentRequest', indent }); },
    onAlignmentRequest: (current: ReaderAppearanceAlignment): void => {
      $$.scene.dispatch({ kind: 'appearanceAlignmentRequest', current });
    },
    onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void => {
      $$.scene.dispatch({ kind: 'appearanceMetricStep', metric, direction });
    },
    chineseConversionIdentity: $$.scene.facts().preferences.conversion.identity,
    onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string): void => {
      $$.scene.dispatch({ kind: 'chineseConversionChange', mode, identity });
    },
    onPageTurnStyleChange: (style: ReaderPageTurnStyle): void => {
      $$.scene.dispatch({ kind: 'pageTurnStyleChange', style });
    },
  });
}
