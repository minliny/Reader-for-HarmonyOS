import type { ReaderControlTemporaryInputKind, ReaderControlLocation, ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import type { ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';
import type { ReaderControlVerificationOrigin, ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import type { ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import type { ReaderAppearanceAlignment, ReaderAppearanceFont, ReaderAppearanceFontSlot, ReaderAppearanceIndent, ReaderAppearanceMetric, ReaderAppearanceSnapshot, ReaderAppearanceStepDirection, ReaderAppearanceTheme } from '../application/ReaderAppearanceState';
import type { ReaderPageTurnStyle, ReaderScreenDirection, ReaderScreenTimeout, ReaderSettingsSnapshot, ReaderSettingsToggleKey, ReaderWidePageLayout } from '../application/ReaderSettingsState';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import type { ReaderTtsConfigurationDraft } from '../application/ReaderTtsConfigurationHost';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import type { ReaderSessionMorphSourceMeasurement, ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';
import type { ReaderTtsState, ReaderTtsTimerMode } from '../application/ReaderTtsState';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import type { ReaderReplacePreview } from '../application/ReaderReplaceQuickGateway';
import type { ReaderControlReplaceState } from '../presentation/ReaderControlReplaceState';
import type { ReaderReplaceRule, ReaderControlReplaceDraft } from '../application/ReaderReplaceQuickState';
import type { ReaderControlLayoutSnapshot, ReaderControlContentMeasurer } from './ReaderLayoutGeometry';
import type { ReaderControlFontOrderPresentation } from './ReaderControlPresentationCoordinator';
import type { ReaderControlPage } from './ReaderControlRouting';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';

export interface ReaderControlGeometrySnapshot<Receipt, Theme> {
  readonly directSheet: boolean;
  readonly fixedIsland: boolean;
  readonly allowsTextSelection: boolean;
  readonly fontScale: number;
  readonly theme: Theme;
  readonly layout: ReaderControlLayoutSnapshot;
  readonly reduceMotion: boolean;
  readonly verification: ReaderControlVerificationSession | undefined;
  readonly inputEnabled: boolean;
  readonly obscured: boolean;
  readonly openRevision: number;
  readonly minimum: {
    readonly receipt: Receipt | undefined;
    readonly preparedRequired: boolean;
    readonly identity: string;
    readonly committedIdentity: string;
    readonly requestLocation: ReaderControlLocation | undefined;
    readonly ownerKey: string;
    readonly environmentKey: string;
    readonly key: string;
    readonly ready: boolean;
    readonly metricsRevision: number;
  };
  readonly temporary: {
    readonly dismissRevision: number;
    readonly retireRevision: number;
    readonly layer: ReaderControlTemporaryInputKind;
  };
}

export interface ReaderControlLaunchSnapshot<LaunchProfile> {
  readonly sample: ReaderSessionLaunchSample | undefined;
  readonly generation: number;
  readonly sourceMinimum: LaunchProfile | undefined;
  readonly sourceKind: ReaderSessionMorphSourceKind;
  readonly ownsControls: boolean;
  readonly topBarOffsetY: number;
  readonly dockOffsetY: number;
  readonly recovering: boolean;
}

/** The measured source pose stays valid only for its mounted launch generation. */
export interface ReaderControlLaunchSource<PlaybackReceipt> {
  readonly generation: number;
  readonly kind: ReaderSessionMorphSourceKind;
  readonly minimum: PlaybackReceipt | undefined;
  readonly motionProgress: number;
  readonly width: number;
  readonly height: number;
  readonly fullHeight: number;
  readonly waveform: ReaderTtsWaveformSample;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly current: () => boolean;
}

export interface ReaderControlDocumentSnapshot<SearchPublication> {
  readonly bookTitle: string;
  readonly chapterTitle: string;
  readonly source: {
    readonly id: string;
    readonly bookId: string;
    readonly name: string;
  };
  readonly progressPercent: number;
  readonly totalChapters: number;
  readonly readableChapterPosition: number;
  readonly chapterIndex: number;
  readonly bookmarks: {
    readonly allowChapterStart: boolean;
    readonly loadFailed: boolean;
    readonly message: string;
    readonly recovery: ReadingDirectoryRecovery;
    readonly book: ReaderBookIdentity | undefined;
    readonly pageStatus: 'unknown' | 'empty' | 'bookmarked';
    readonly pageEnabled: boolean;
  };
  readonly catalog: {
    readonly publication: ReaderDirectoryDataPublication | undefined;
    readonly revision: number;
    readonly complete: boolean;
    readonly loading: boolean;
    readonly loadFailed: boolean;
    readonly chapterCount: number;
    readonly position: number;
    readonly defaultEntries: LocalReadingTocEntry[];
  };
  readonly search: {
    readonly query: string;
    readonly revision: number;
    readonly publication: SearchPublication;
    readonly manga: boolean;
  };
  readonly replace: ReaderControlReplaceState;
  readonly recovery: {
    readonly available: boolean;
    readonly identity: string;
  };
  readonly download: {
    readonly chapterEnabled: boolean;
    readonly bookEnabled: boolean;
    readonly bookActive: boolean;
  };
  readonly allowChapterRefresh: boolean;
}

export interface ReaderControlPreferencesSnapshot {
  readonly brightness: {
    readonly percent: number;
    readonly automatic: boolean;
    readonly revision: number;
  };
  readonly appearance: ReaderAppearanceSnapshot;
  readonly conversion: {
    readonly identity: string;
    readonly mode: ReaderChineseConversionMode;
  };
  readonly settings: ReaderSettingsSnapshot;
  readonly widePageLayout: ReaderWidePageLayout;
  readonly pageTurnSimulationAvailable: boolean;
}

export interface ReaderControlPlaybackSnapshot {
  readonly automatic: {
    readonly status: ReaderAutoPageStatus;
    readonly speedSeconds: number;
    readonly timerMinutes: number;
    readonly timerSeconds: number;
    readonly timerSummary: string;
    readonly followHighlight: boolean;
  };
  readonly speech: {
    readonly state: ReaderTtsState;
    readonly timerMode: ReaderTtsTimerMode;
    readonly timerMinutes: number;
    readonly timerSeconds: number;
    readonly followHighlight: boolean;
    readonly pauseOnInterruption: boolean;
    readonly allowMixing: boolean;
    readonly backgroundPlayback: boolean;
    readonly keepScreenOn: boolean;
    readonly failurePolicy: 'skip' | 'stop';
    readonly engine: string;
    readonly httpEngines: ReaderHttpTtsConfig[];
    readonly configurationRecovery: ReaderRecoveryView;
    readonly configurationLoading: boolean;
    readonly configurationLoadFailed: boolean;
    readonly voiceOptions: ReaderTtsVoiceOption[];
    readonly language: string;
    readonly person: number;
  };
}

export interface ReaderControlPanelFacts<Receipt, Theme, LaunchProfile, SearchPublication> {
  readonly geometry: ReaderControlGeometrySnapshot<Receipt, Theme>;
  readonly launch: ReaderControlLaunchSnapshot<LaunchProfile>;
  readonly document: ReaderControlDocumentSnapshot<SearchPublication>;
  readonly preferences: ReaderControlPreferencesSnapshot;
  readonly playback: ReaderControlPlaybackSnapshot;
}

/** Native actions deliver synchronously. Promise and font-plan results belong to their existing owner. */
export type ReaderControlIntent<ProfileReader, ModuleFacts, PlaybackReceipt> =
  | { readonly kind: 'launchSourceReady'; readonly generation: number }
  | { readonly kind: 'launchSource'; readonly source: ReaderControlLaunchSource<PlaybackReceipt> }
  | { readonly kind: 'sessionLaunchShellMeasured'; readonly topExit: number; readonly dockExit: number }
  | { readonly kind: 'inputCurrent' }
  | { readonly kind: 'minimumReceiptCurrent'; readonly key: string }
  | { readonly kind: 'minimumMeasurerReady'; readonly identity: string; readonly measurer: ReaderControlContentMeasurer | undefined; readonly profileReader?: ProfileReader; readonly facts?: ModuleFacts; readonly factsGeometryKey?: string }
  | { readonly kind: 'sessionRequest'; readonly next: ReaderControlSessionState; readonly origin: ReaderControlVerificationOrigin }
  | { readonly kind: 'playbackProfileSelected'; readonly receipt: PlaybackReceipt }
  | { readonly kind: 'temporaryLayerChange'; readonly active: boolean; readonly layer?: ReaderControlTemporaryInputKind }
  | { readonly kind: 'visualSessionChange'; readonly state: ReaderControlSessionState }
  | { readonly kind: 'inputActivity' }
  | { readonly kind: 'backdropRegionsChange'; readonly regions: ReaderControlBackdropRect[]; readonly ready: boolean }
  | { readonly kind: 'requireCompleteCatalog' }
  | { readonly kind: 'retryBookmarkLoad' }
  | { readonly kind: 'togglePageBookmark' }
  | { readonly kind: 'exitReading' }
  | { readonly kind: 'dismiss' }
  | { readonly kind: 'sourceSwitch'; readonly focusId?: string }
  | { readonly kind: 'openRecovery'; readonly identity: string }
  | { readonly kind: 'refreshChapter' }
  | { readonly kind: 'openBookInfo' }
  | { readonly kind: 'downloadBook' }
  | { readonly kind: 'pageChange'; readonly page: ReaderControlPage; readonly origin: ReaderControlVerificationOrigin }
  | { readonly kind: 'moduleSelect'; readonly module: string }
  | { readonly kind: 'selectChapter'; readonly chapterIndex: number }
  | { readonly kind: 'selectNavigationTarget'; readonly chapterIndex: number; readonly chapterOffsetScalar: number; readonly positionScope?: RemoteReadingPositionScope; readonly directoryTargetProof?: ReaderDirectoryTargetProof }
  | { readonly kind: 'selectBookmark'; readonly bookmarkId: string; readonly chapterIndex: number; readonly chapterOffset: number; readonly positionScope?: RemoteReadingPositionScope }
  | { readonly kind: 'downloadChapter'; readonly chapterIndex: number }
  | { readonly kind: 'deleteBookmarks'; readonly bookmarkTimes: number[] }
  | { readonly kind: 'createChapterStartBookmark'; readonly request: ReaderDirectoryChapterStartBookmarkRequest }
  | { readonly kind: 'previousChapter' }
  | { readonly kind: 'nextChapter' }
  | { readonly kind: 'progressChange'; readonly percent: number }
  | { readonly kind: 'brightnessCancel' }
  | { readonly kind: 'brightnessChange'; readonly percent: number }
  | { readonly kind: 'brightnessAuto' }
  | { readonly kind: 'searchQueryChange'; readonly query: string }
  | { readonly kind: 'search' }
  | { readonly kind: 'searchLoadMore' }
  | { readonly kind: 'searchNeedMore' }
  | { readonly kind: 'searchResultSelect'; readonly result: ReadingContentSearchResult; readonly scope: number; readonly ordinal: number }
  | { readonly kind: 'autoPageToggle' }
  | { readonly kind: 'autoPageStop' }
  | { readonly kind: 'autoPageSlowDown' }
  | { readonly kind: 'autoPageSpeedUp' }
  | { readonly kind: 'autoPageFullTimerChange'; readonly minutes: number; readonly seconds: number }
  | { readonly kind: 'autoPageFullSpeedChange'; readonly seconds: number; readonly onDeclined?: () => void }
  | { readonly kind: 'autoPageFollowHighlightChange'; readonly enabled: boolean }
  | { readonly kind: 'openReplace' }
  | { readonly kind: 'reloadControlReplace'; readonly operationId?: string }
  | { readonly kind: 'saveControlReplace'; readonly draft: ReaderControlReplaceDraft }
  | { readonly kind: 'toggleControlReplace'; readonly rule: ReaderReplaceRule; readonly value: boolean }
  | { readonly kind: 'deleteControlReplace'; readonly rule: ReaderReplaceRule }
  | { readonly kind: 'previewControlReplace' }
  | { readonly kind: 'importControlReplace' }
  | { readonly kind: 'exportControlReplace' }
  | { readonly kind: 'appearanceThemeChange'; readonly theme: ReaderAppearanceTheme }
  | { readonly kind: 'appearanceDayThemeChange'; readonly theme: ReaderAppearanceTheme }
  | { readonly kind: 'appearanceNightThemeChange'; readonly theme: ReaderAppearanceTheme }
  | { readonly kind: 'appearanceFontChange'; readonly font: ReaderAppearanceFont }
  | { readonly kind: 'appearanceFontOrderChange'; readonly fontOrder: ReaderAppearanceFontSlot[] }
  | { readonly kind: 'appearanceFontReorderActivityChange'; readonly active: boolean }
  | { readonly kind: 'appearanceMotionActivityChange'; readonly active: boolean }
  | { readonly kind: 'appearanceCustomFontImport' }
  | { readonly kind: 'appearanceIndentRequest'; readonly indent: ReaderAppearanceIndent }
  | { readonly kind: 'appearanceAlignmentRequest'; readonly current: ReaderAppearanceAlignment }
  | { readonly kind: 'appearanceMetricStep'; readonly metric: ReaderAppearanceMetric; readonly direction: ReaderAppearanceStepDirection }
  | { readonly kind: 'chineseConversionChange'; readonly mode: ReaderChineseConversionMode; readonly identity?: string }
  | { readonly kind: 'settingsToggleChange'; readonly key: ReaderSettingsToggleKey; readonly value: boolean }
  | { readonly kind: 'widePageLayoutChange'; readonly value: ReaderWidePageLayout }
  | { readonly kind: 'screenDirectionChange'; readonly direction: ReaderScreenDirection }
  | { readonly kind: 'screenTimeoutChange'; readonly timeout: ReaderScreenTimeout }
  | { readonly kind: 'pageTurnStyleChange'; readonly style: ReaderPageTurnStyle }
  | { readonly kind: 'ttsToggle' }
  | { readonly kind: 'ttsStop' }
  | { readonly kind: 'ttsPrevious' }
  | { readonly kind: 'ttsNext' }
  | { readonly kind: 'ttsSeek'; readonly sliceIndex: number }
  | { readonly kind: 'ttsRateChange'; readonly rate: number; readonly onDeclined?: () => void }
  | { readonly kind: 'ttsTimerChange'; readonly minutes: number; readonly seconds: number; readonly mode?: ReaderTtsTimerMode }
  | { readonly kind: 'ttsFollowHighlightChange'; readonly enabled: boolean }
  | { readonly kind: 'ttsPauseOnInterruptionChange'; readonly enabled: boolean }
  | { readonly kind: 'ttsAllowMixingChange'; readonly enabled: boolean }
  | { readonly kind: 'ttsBackgroundPlaybackChange'; readonly enabled: boolean }
  | { readonly kind: 'ttsKeepScreenOnChange'; readonly enabled: boolean }
  | { readonly kind: 'ttsFailurePolicyChange'; readonly policy: 'skip' | 'stop' }
  | { readonly kind: 'ttsVoiceAudition'; readonly language: string; readonly person: number }
  | { readonly kind: 'ttsAuditionStop' }
  | { readonly kind: 'ttsVoiceChange'; readonly language: string; readonly person: number }
  | { readonly kind: 'ttsConfigurationOpen' }
  | { readonly kind: 'ttsEngineChange'; readonly engine: string }
  | { readonly kind: 'ttsHttpEnginePut'; readonly config: ReaderTtsConfigurationDraft }
  | { readonly kind: 'ttsHttpEngineDelete'; readonly id: number }
  | { readonly kind: 'sessionMorphSourceMeasured'; readonly measurement: ReaderSessionMorphSourceMeasurement };

export type ReaderControlIntentResult = void | boolean | Promise<void> | Promise<ReaderReplacePreview> | ReaderControlFontOrderPresentation;
export type ReaderControlIntentHandler<ProfileReader, ModuleFacts, PlaybackReceipt> =
  (intent: ReaderControlIntent<ProfileReader, ModuleFacts, PlaybackReceipt>) => ReaderControlIntentResult;

export function defaultReaderControlIntent<ProfileReader, ModuleFacts, PlaybackReceipt>(
  intent: ReaderControlIntent<ProfileReader, ModuleFacts, PlaybackReceipt>,
): ReaderControlIntentResult {
  switch (intent.kind) {
    case 'autoPageFullSpeedChange': intent.onDeclined?.(); return;
    case 'reloadControlReplace': return Promise.resolve();
    case 'saveControlReplace': return Promise.resolve();
    case 'toggleControlReplace': return Promise.resolve();
    case 'deleteControlReplace': return Promise.resolve();
    case 'previewControlReplace': return Promise.reject<ReaderReplacePreview>(new Error('当前章节预览尚未就绪'));
    case 'importControlReplace': return Promise.resolve();
    case 'exportControlReplace': return Promise.resolve();
    case 'appearanceFontOrderChange':
      return { displayed: Promise.resolve(false), retire: (): void => {}, current: (): boolean => false };
    case 'ttsRateChange': intent.onDeclined?.(); return;
    case 'ttsVoiceAudition': return Promise.resolve();
    case 'ttsEngineChange': return Promise.resolve();
    case 'ttsHttpEnginePut': return Promise.resolve();
    case 'ttsHttpEngineDelete': return Promise.resolve();
    default: return;
  }
}

export type ReaderControlFactWatch =
  | 'placement'
  | 'launch'
  | 'runtimeInput'
  | 'openRevision'
  | 'minimumIdentity'
  | 'minimumCommit'
  | 'measure'
  | 'minimumMetrics'
  | 'receipt'
  | 'playbackMinimum'
  | 'minimumAvailability'
  | 'temporaryLayer'
  | 'minimumFacts'
  | 'layout'
  | 'bookmark'
  | 'brightness'
  | 'recovery';

/** Delivers the native Panel's former one-way resets in declaration order.
 * A watch may write the linked session synchronously. Any such observer reads
 * the facts already delivered for that step, including the unchanged owner
 * witnesses, while rendering uses the published immutable frame. */
export class ReaderControlFactDelivery<Receipt, Theme, LaunchProfile, SearchPublication> {
  private staged: ReaderControlPanelFacts<Receipt, Theme, LaunchProfile, SearchPublication> | undefined = undefined;

  active(): ReaderControlPanelFacts<Receipt, Theme, LaunchProfile, SearchPublication> | undefined { return this.staged; }

  deliver(previous: ReaderControlPanelFacts<Receipt, Theme, LaunchProfile, SearchPublication>,
    next: ReaderControlPanelFacts<Receipt, Theme, LaunchProfile, SearchPublication>,
    watch: (event: ReaderControlFactWatch) => void): void {
    const geometry = {
      ...previous.geometry, minimum: { ...previous.geometry.minimum }, temporary: { ...previous.geometry.temporary },
    };
    const launch = { ...previous.launch };
    const document = {
      ...previous.document, source: { ...previous.document.source }, bookmarks: { ...previous.document.bookmarks },
      catalog: { ...previous.document.catalog }, search: { ...previous.document.search },
      recovery: { ...previous.document.recovery }, download: { ...previous.document.download },
    };
    const preferences = { ...previous.preferences, brightness: { ...previous.preferences.brightness }, conversion: { ...previous.preferences.conversion } };
    const playback = { ...previous.playback, automatic: { ...previous.playback.automatic }, speech: { ...previous.playback.speech } };
    const current = { geometry, launch, document, preferences, playback };
    const outer = this.staged;
    this.staged = current;
    try {
      if (current.geometry.allowsTextSelection !== next.geometry.allowsTextSelection) {
        current.geometry.allowsTextSelection = next.geometry.allowsTextSelection;
        watch('placement');
      }
      current.geometry.fontScale = next.geometry.fontScale;
      if (current.launch.sample !== next.launch.sample) {
        current.launch.sample = next.launch.sample;
        watch('launch');
      }
      if (current.launch.generation !== next.launch.generation) {
        current.launch.generation = next.launch.generation;
        watch('launch');
      }
      if (current.launch.sourceMinimum !== next.launch.sourceMinimum) {
        current.launch.sourceMinimum = next.launch.sourceMinimum;
        watch('launch');
      }
      current.launch.sourceKind = next.launch.sourceKind;
      current.launch.ownsControls = next.launch.ownsControls;
      current.launch.topBarOffsetY = next.launch.topBarOffsetY;
      current.launch.dockOffsetY = next.launch.dockOffsetY;
      if (current.launch.recovering !== next.launch.recovering) {
        current.launch.recovering = next.launch.recovering;
        watch('runtimeInput');
      }
      current.geometry.theme = next.geometry.theme;
      if (current.geometry.inputEnabled !== next.geometry.inputEnabled) {
        current.geometry.inputEnabled = next.geometry.inputEnabled;
        watch('runtimeInput');
      }
      if (current.geometry.obscured !== next.geometry.obscured) {
        current.geometry.obscured = next.geometry.obscured;
        watch('runtimeInput');
      }
      if (current.geometry.openRevision !== next.geometry.openRevision) {
        current.geometry.openRevision = next.geometry.openRevision;
        watch('openRevision');
      }
      if (current.geometry.minimum.identity !== next.geometry.minimum.identity) {
        current.geometry.minimum.identity = next.geometry.minimum.identity;
        watch('minimumIdentity');
      }
      if (current.geometry.minimum.committedIdentity !== next.geometry.minimum.committedIdentity) {
        current.geometry.minimum.committedIdentity = next.geometry.minimum.committedIdentity;
        watch('minimumCommit');
      }
      if (current.geometry.minimum.requestLocation !== next.geometry.minimum.requestLocation) {
        current.geometry.minimum.requestLocation = next.geometry.minimum.requestLocation;
        watch('measure');
      }
      current.geometry.minimum.ownerKey = next.geometry.minimum.ownerKey;
      if (current.geometry.minimum.environmentKey !== next.geometry.minimum.environmentKey) {
        current.geometry.minimum.environmentKey = next.geometry.minimum.environmentKey;
        watch('minimumMetrics');
      }
      current.geometry.minimum.preparedRequired = next.geometry.minimum.preparedRequired;
      if (current.geometry.minimum.receipt !== next.geometry.minimum.receipt) {
        current.geometry.minimum.receipt = next.geometry.minimum.receipt;
        watch('receipt');
      }
      if (current.geometry.minimum.key !== next.geometry.minimum.key) {
        current.geometry.minimum.key = next.geometry.minimum.key;
        watch('playbackMinimum');
      }
      if (current.geometry.minimum.metricsRevision !== next.geometry.minimum.metricsRevision) {
        current.geometry.minimum.metricsRevision = next.geometry.minimum.metricsRevision;
        watch('minimumMetrics');
      }
      if (current.geometry.minimum.ready !== next.geometry.minimum.ready) {
        current.geometry.minimum.ready = next.geometry.minimum.ready;
        watch('minimumAvailability');
      }
      // The old native Watch passed its property name to the numeric generation
      // guard in dismissMoreMenu. The revision still reaches the child modules.
      current.geometry.temporary.dismissRevision = next.geometry.temporary.dismissRevision;
      current.geometry.temporary.retireRevision = next.geometry.temporary.retireRevision;
      if (current.geometry.temporary.layer !== next.geometry.temporary.layer) {
        current.geometry.temporary.layer = next.geometry.temporary.layer;
        watch('temporaryLayer');
      }
      current.document.bookTitle = next.document.bookTitle;
      if (current.document.chapterTitle !== next.document.chapterTitle) {
        current.document.chapterTitle = next.document.chapterTitle;
        watch('measure');
      }
      if (current.document.source.id !== next.document.source.id) {
        current.document.source.id = next.document.source.id;
        watch('minimumFacts');
      }
      current.document.source.bookId = next.document.source.bookId;
      current.document.source.name = next.document.source.name;
      current.document.progressPercent = next.document.progressPercent;
      if (current.document.totalChapters !== next.document.totalChapters) {
        current.document.totalChapters = next.document.totalChapters;
        watch('measure');
      }
      if (current.document.readableChapterPosition !== next.document.readableChapterPosition) {
        current.document.readableChapterPosition = next.document.readableChapterPosition;
        watch('minimumFacts');
      }
      if (current.geometry.layout !== next.geometry.layout) {
        current.geometry.layout = next.geometry.layout;
        watch('layout');
      }
      if (current.document.catalog.revision !== next.document.catalog.revision) {
        current.document.catalog.revision = next.document.catalog.revision;
        watch('minimumFacts');
      }
      if (current.document.catalog.complete !== next.document.catalog.complete) {
        current.document.catalog.complete = next.document.catalog.complete;
        watch('minimumFacts');
      }
      if (current.document.catalog.loading !== next.document.catalog.loading) {
        current.document.catalog.loading = next.document.catalog.loading;
        watch('minimumFacts');
      }
      if (current.document.catalog.loadFailed !== next.document.catalog.loadFailed) {
        current.document.catalog.loadFailed = next.document.catalog.loadFailed;
        watch('minimumFacts');
      }
      if (current.document.catalog.chapterCount !== next.document.catalog.chapterCount) {
        current.document.catalog.chapterCount = next.document.catalog.chapterCount;
        watch('minimumFacts');
      }
      if (current.document.catalog.position !== next.document.catalog.position) {
        current.document.catalog.position = next.document.catalog.position;
        watch('minimumFacts');
      }
      if (current.document.chapterIndex !== next.document.chapterIndex) {
        current.document.chapterIndex = next.document.chapterIndex;
        watch('minimumFacts');
      }
      current.document.bookmarks.allowChapterStart = next.document.bookmarks.allowChapterStart;
      current.document.download.chapterEnabled = next.document.download.chapterEnabled;
      current.document.search.manga = next.document.search.manga;
      if (current.document.bookmarks.loadFailed !== next.document.bookmarks.loadFailed) {
        current.document.bookmarks.loadFailed = next.document.bookmarks.loadFailed;
        watch('minimumFacts');
      }
      if (current.document.bookmarks.message !== next.document.bookmarks.message) {
        current.document.bookmarks.message = next.document.bookmarks.message;
        watch('minimumFacts');
      }
      current.document.bookmarks.recovery = next.document.bookmarks.recovery;
      if (current.document.search.query !== next.document.search.query) {
        current.document.search.query = next.document.search.query;
        watch('minimumFacts');
      }
      if (current.document.search.revision !== next.document.search.revision) {
        current.document.search.revision = next.document.search.revision;
        watch('minimumFacts');
      }
      current.preferences.brightness.percent = next.preferences.brightness.percent;
      current.preferences.brightness.automatic = next.preferences.brightness.automatic;
      current.geometry.directSheet = next.geometry.directSheet;
      current.geometry.fixedIsland = next.geometry.fixedIsland;
      if (current.document.bookmarks.pageStatus !== next.document.bookmarks.pageStatus) {
        current.document.bookmarks.pageStatus = next.document.bookmarks.pageStatus;
        watch('bookmark');
      }
      current.document.bookmarks.pageEnabled = next.document.bookmarks.pageEnabled;
      if (current.preferences.brightness.revision !== next.preferences.brightness.revision) {
        current.preferences.brightness.revision = next.preferences.brightness.revision;
        watch('brightness');
      }
      if (current.playback.automatic.status !== next.playback.automatic.status) {
        current.playback.automatic.status = next.playback.automatic.status;
        watch('minimumFacts');
      }
      current.playback.automatic.speedSeconds = next.playback.automatic.speedSeconds;
      current.playback.automatic.timerMinutes = next.playback.automatic.timerMinutes;
      current.playback.automatic.timerSeconds = next.playback.automatic.timerSeconds;
      if (current.playback.automatic.timerSummary !== next.playback.automatic.timerSummary) {
        current.playback.automatic.timerSummary = next.playback.automatic.timerSummary;
        watch('minimumFacts');
      }
      current.playback.automatic.followHighlight = next.playback.automatic.followHighlight;
      if (current.document.replace !== next.document.replace) {
        current.document.replace = next.document.replace;
        watch('minimumFacts');
      }
      if (current.preferences.appearance !== next.preferences.appearance) {
        current.preferences.appearance = next.preferences.appearance;
        watch('minimumFacts');
      }
      current.preferences.conversion.identity = next.preferences.conversion.identity;
      if (current.preferences.conversion.mode !== next.preferences.conversion.mode) {
        current.preferences.conversion.mode = next.preferences.conversion.mode;
        watch('minimumFacts');
      }
      if (current.preferences.settings !== next.preferences.settings) {
        current.preferences.settings = next.preferences.settings;
        watch('minimumFacts');
      }
      current.preferences.widePageLayout = next.preferences.widePageLayout;
      current.preferences.pageTurnSimulationAvailable = next.preferences.pageTurnSimulationAvailable;
      if (current.playback.speech.state !== next.playback.speech.state) {
        current.playback.speech.state = next.playback.speech.state;
        watch('minimumFacts');
      }
      if (current.playback.speech.timerMode !== next.playback.speech.timerMode) {
        current.playback.speech.timerMode = next.playback.speech.timerMode;
        watch('minimumFacts');
      }
      if (current.playback.speech.timerMinutes !== next.playback.speech.timerMinutes) {
        current.playback.speech.timerMinutes = next.playback.speech.timerMinutes;
        watch('minimumFacts');
      }
      if (current.playback.speech.timerSeconds !== next.playback.speech.timerSeconds) {
        current.playback.speech.timerSeconds = next.playback.speech.timerSeconds;
        watch('minimumFacts');
      }
      current.playback.speech.followHighlight = next.playback.speech.followHighlight;
      current.playback.speech.pauseOnInterruption = next.playback.speech.pauseOnInterruption;
      if (current.playback.speech.allowMixing !== next.playback.speech.allowMixing) {
        current.playback.speech.allowMixing = next.playback.speech.allowMixing;
        watch('minimumFacts');
      }
      current.playback.speech.backgroundPlayback = next.playback.speech.backgroundPlayback;
      current.playback.speech.keepScreenOn = next.playback.speech.keepScreenOn;
      if (current.playback.speech.failurePolicy !== next.playback.speech.failurePolicy) {
        current.playback.speech.failurePolicy = next.playback.speech.failurePolicy;
        watch('minimumFacts');
      }
      if (current.playback.speech.engine !== next.playback.speech.engine) {
        current.playback.speech.engine = next.playback.speech.engine;
        watch('minimumFacts');
      }
      if (current.playback.speech.httpEngines !== next.playback.speech.httpEngines) {
        current.playback.speech.httpEngines = next.playback.speech.httpEngines;
        watch('minimumFacts');
      }
      current.playback.speech.configurationRecovery = next.playback.speech.configurationRecovery;
      current.playback.speech.configurationLoading = next.playback.speech.configurationLoading;
      current.playback.speech.configurationLoadFailed = next.playback.speech.configurationLoadFailed;
      if (current.playback.speech.voiceOptions !== next.playback.speech.voiceOptions) {
        current.playback.speech.voiceOptions = next.playback.speech.voiceOptions;
        watch('minimumFacts');
      }
      if (current.playback.speech.language !== next.playback.speech.language) {
        current.playback.speech.language = next.playback.speech.language;
        watch('minimumFacts');
      }
      if (current.playback.speech.person !== next.playback.speech.person) {
        current.playback.speech.person = next.playback.speech.person;
        watch('minimumFacts');
      }
      if (current.geometry.reduceMotion !== next.geometry.reduceMotion) {
        current.geometry.reduceMotion = next.geometry.reduceMotion;
        watch('layout');
      }
      current.document.recovery.available = next.document.recovery.available;
      if (current.document.recovery.identity !== next.document.recovery.identity) {
        current.document.recovery.identity = next.document.recovery.identity;
        watch('recovery');
      }
      current.document.allowChapterRefresh = next.document.allowChapterRefresh;
      current.document.download.bookEnabled = next.document.download.bookEnabled;
      current.document.download.bookActive = next.document.download.bookActive;
    } finally {
      this.staged = outer;
    }
  }
}
