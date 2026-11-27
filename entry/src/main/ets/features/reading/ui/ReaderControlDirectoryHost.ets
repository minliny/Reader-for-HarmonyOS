import type { ReaderReadingControlInteractionHost } from './ReaderReadingControlInteractionHost';
import type { ReaderReadingPlaybackFlowHost } from './ReaderReadingPlaybackFlowHost';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ReaderAutoPageState } from './ReaderAutoPageState';
import { formatReaderAutoPageFullTimerSummary, type ReaderAutoPageFullConfiguration } from './ReaderAutoPageFullState';
import { readerControlThemeStyle } from './ReaderControlThemeStyle';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingPageChromeHost } from './ReaderReadingPageChromeHost';
import type { ReadingChromeRenderSnapshot, ReadingOverlayRenderSnapshot,
  ReadingPageTurnRenderSnapshot, ReadingSessionRenderSnapshot } from './ReaderReadingSurfaceHost';
import vibrator from '@ohos.vibrator';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type { ReaderReadingProgressHost } from './ReaderReadingProgressHost';
import type { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import type { ReaderBrightnessSession } from './ReaderBrightnessSession';
import type { ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import type { ReaderReadingContentMutationHost } from './ReaderReadingContentMutationHost';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import { admitReaderControlVisualSnapshot } from './ReaderControlVisualHostPort';
import type { ReaderControlNavigationIntent } from './ReaderControlPresentationCoordinator';
import { readerControlHostCloseCommitted, readerControlHostClosing, readerControlHostPage, readerControlHostVisible } from './ReaderControlHostSession';
import type { ReaderControlGeometryHost } from './ReaderControlGeometryHost';
import type { ReaderReadingPreferencesHost } from './ReaderReadingPreferencesHost';
import type { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import type { ReaderControlReplacePanel } from '../presentation/ReaderControlReplacePanel';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import type { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import type { ReaderControlMeasuredProfileReader, ReaderControlModuleFacts, ReaderControlPresentationReceipt } from './ReaderControlMinimumMeasurement';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import type { ReaderSessionCapsuleState } from './ReaderSessionCapsuleModel';
import type { ReaderControlPlaybackProfileReceipt, ReaderControlPlaybackLaunchProfile } from './ReaderControlPlaybackProfile';
import type { ReaderControlVerificationOrigin, ReaderControlVerificationSession } from './ReaderControlVerificationSession';
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
import type { ReaderControlFontOrderPresentation } from './ReaderControlAppearanceContent';
import type { ReaderControlPage } from './ReaderControlRouting';
import type { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';
import type { ReaderControlLocation } from './ReaderControlSessionState';
import type { ReaderControlThemeStyle } from './ReaderControlThemeStyle';
import { copyReaderControlSessionState, createReaderControlSessionState, readerControlContentLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import { ReaderControlPanel } from './ReaderControlPanel';

export interface ReaderControlPanelRenderFacts {
  readonly directSheetRedesign: boolean;
  readonly fixedIsland: boolean;
  readonly bodySelectionPossible: boolean;
  readonly sessionFontScale: number;
  readonly controlThemeStyle: ReaderControlThemeStyle;
  readonly launchSample: ReaderSessionLaunchSample | undefined;
  readonly launchGeneration: number;
  readonly launchSourceMinimum: ReaderControlPlaybackLaunchProfile | undefined;
  readonly launchSourceKind: ReaderSessionMorphSourceKind;
  readonly launchBusinessStatus: ReaderSessionCapsuleState;
  readonly launchDesiredPlaying: boolean;
  readonly launchStageOpacity: number;
  readonly launchOwnsControls: boolean;
  readonly launchRecovering: boolean;
  readonly launchInteractionEnabled: boolean;
  readonly launchSourceTtsState: ReaderTtsState;
  readonly launchSourceAutoStatus: ReaderAutoPageStatus;
  readonly launchCountdown: number;
  readonly recoveryAvailable: boolean;
  readonly recoveryIdentity: string;
  readonly bookTitle: string;
  readonly chapterTitle: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly progressPercent: number;
  readonly totalChapters: number;
  readonly readableChapterPosition: number;
  readonly pageBookmarkStatus: 'unknown' | 'empty' | 'bookmarked';
  readonly pageBookmarkEnabled: boolean;
  readonly layout: ReaderControlLayoutSnapshot;
  readonly presentationReceipt: ReaderControlPresentationReceipt | undefined;
  readonly preparedMinimumRequired: boolean;
  readonly minimumIdentity: string;
  readonly minimumCommittedIdentity: string;
  readonly minimumRequestLocation: ReaderControlLocation | undefined;
  readonly minimumOwnerKey: string;
  readonly minimumEnvironmentKey: string;
  readonly minimumKey: string;
  readonly minimumReady: boolean;
  readonly minimumMetricsRevision: number;
  readonly inputEnabled: boolean;
  readonly controlObscured: boolean;
  readonly controlOpenRevision: number;
  readonly dismissTemporaryRevision: number;
  readonly retireTemporaryRevision: number;
  readonly temporaryLayerKind: ReaderControlTemporaryInputKind;
  readonly directoryEntriesRevision: number;
  readonly catalogComplete: boolean;
  readonly catalogLoading: boolean;
  readonly catalogLoadFailed: boolean;
  readonly catalogChapterCount: number;
  readonly catalogCurrentPosition: number;
  readonly currentChapterIndex: number;
  readonly chapterStartBookmarkCreationEnabled: boolean;
  readonly chapterDownloadEnabled: boolean;
  readonly bookmarkLoadFailed: boolean;
  readonly bookmarkLoadMessage: string;
  readonly bookmarkRecovery: ReadingDirectoryRecovery;
  readonly searchQuery: string;
  readonly searchRevision: number;
  readonly brightnessPercent: number;
  readonly brightnessAutomatic: boolean;
  readonly brightnessRevision: number;
  readonly autoPageStatus: ReaderAutoPageStatus;
  readonly autoPageSpeedSeconds: number;
  readonly autoPageTimerMinutes: number;
  readonly autoPageTimerSeconds: number;
  readonly autoPageTimerSummaryText: string;
  readonly autoPageFollowHighlight: boolean;
  readonly controlReplaceState: ReaderControlReplaceState;
  readonly ttsConfigurationRecovery: ReaderRecoveryView;
  readonly ttsConfigurationLoading: boolean;
  readonly ttsConfigurationLoadFailed: boolean;
  readonly appearanceSnapshot: ReaderAppearanceSnapshot;
  readonly chineseConversionMode: ReaderChineseConversionMode;
  readonly settingsSnapshot: ReaderSettingsSnapshot;
  readonly widePageLayout: ReaderWidePageLayout;
  readonly pageTurnSimulationAvailable: boolean;
  readonly ttsState: ReaderTtsState;
  readonly ttsTimerMode: ReaderTtsTimerMode;
  readonly ttsTimerMinutes: number;
  readonly ttsTimerSeconds: number;
  readonly ttsFollowHighlight: boolean;
  readonly ttsPauseOnInterruption: boolean;
  readonly ttsAllowMixing: boolean;
  readonly ttsBackgroundPlayback: boolean;
  readonly ttsKeepScreenOn: boolean;
  readonly ttsFailurePolicy: 'skip' | 'stop';
  readonly ttsEngine: string;
  readonly ttsHttpEngines: ReaderHttpTtsConfig[];
  readonly ttsVoiceOptions: ReaderTtsVoiceOption[];
  readonly ttsLanguage: string;
  readonly ttsPerson: number;
  readonly reduceMotion: boolean;
  readonly sourceBookId: string;
  readonly bookDownloadEnabled: boolean;
  readonly bookDownloadActive: boolean;
  readonly chapterRefreshEnabled: boolean;
  readonly chineseConversionIdentity: string;
}

export interface ReaderControlPanelCommands {
  readonly onLaunchSourceReady: (generation: number) => void;
  readonly onLaunchToggle: () => void;
  readonly onSessionLaunchShellMeasured: (topExit: number, dockExit: number) => void;
  readonly onOpenRecovery: (identity: string) => void;
  readonly onTogglePageBookmark: () => void;
  readonly minimumReceiptCurrent?: (key: string) => boolean;
  readonly onPlaybackProfileSelected: (receipt: ReaderControlPlaybackProfileReceipt) => void;
  readonly onMinimumMeasurerReady: (identity: string, measurer: ReaderControlContentMeasurer | undefined,
    profileReader?: ReaderControlMeasuredProfileReader, facts?: ReaderControlModuleFacts, factsGeometryKey?: string) => void;
  readonly verificationSession: ReaderControlVerificationSession | undefined;
  readonly onSessionRequest: ((next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin) => void) | undefined;
  readonly inputCurrent: (() => boolean) | undefined;
  readonly onVisualSessionChange: (state: ReaderControlSessionState) => void;
  readonly onTemporaryLayerChange: (active: boolean, kind?: ReaderControlTemporaryInputKind) => void;
  readonly onTtsConfigurationOpen: () => void;
  readonly onInputActivity: () => void;
  readonly onBackdropRegionsChange: (regions: ReaderControlBackdropRect[], ready: boolean) => void;
  readonly directoryPublication: ReaderDirectoryDataPublication | undefined;
  readonly onRequireCompleteCatalog: () => void;
  readonly onRetryBookmarkLoad: () => void;
  readonly searchPublication: ReaderContentSearchPublication;
  readonly onSessionMorphSourceMeasured: (measurement: ReaderSessionMorphSourceMeasurement) => void;
  readonly onExitReading: () => void;
  readonly onDismiss: () => void;
  readonly onSourceSwitch: (focusId?: string) => void;
  readonly onRefreshChapter: () => void;
  readonly onDownloadBook: () => void;
  readonly onOpenBookInfo: () => void;
  readonly onPageChange: (page: ReaderControlPage, origin: ReaderControlVerificationOrigin) => void;
  readonly onModuleSelect: (module: string) => void;
  readonly onSelectChapter: (chapterIndex: number) => void;
  readonly onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void;
  readonly onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined;
  readonly bookmarkIdentity: ReaderBookIdentity | undefined;
  readonly onDownloadChapter: (chapterIndex: number) => void;
  readonly onDeleteBookmarks: (bookmarkTimes: number[]) => void;
  readonly onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void;
  readonly onPreviousChapter: () => void;
  readonly onNextChapter: () => void;
  readonly onProgressChange: (percent: number) => void;
  readonly onBrightnessChange: (percent: number) => void;
  readonly onBrightnessAuto: () => void;
  readonly onBrightnessCancel: () => void;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onSearch: () => void;
  readonly onSearchLoadMore: () => void;
  readonly onSearchNeedMore: () => void;
  readonly onSearchResultSelect: (result: ReadingContentSearchResult, scope: number, ordinal: number) => void;
  readonly onAutoPageToggle: () => void;
  readonly onAutoPageStop: () => void;
  readonly onAutoPageSlowDown: () => void;
  readonly onAutoPageSpeedUp: () => void;
  readonly onAutoPageFullTimerChange: (minutes: number, seconds: number) => void;
  readonly onAutoPageFullSpeedChange: (seconds: number, onDeclined?: () => void) => void;
  readonly onAutoPageFollowHighlightChange: (enabled: boolean) => void;
  readonly onOpenReplace: () => void;
  readonly onReloadControlReplace: (operationId?: string) => Promise<void>;
  readonly onSaveControlReplace: (draft: ReaderControlReplaceDraft) => Promise<void>;
  readonly onToggleControlReplace: (rule: ReaderReplaceRule, value: boolean) => Promise<void>;
  readonly onDeleteControlReplace: (rule: ReaderReplaceRule) => Promise<void>;
  readonly onPreviewControlReplace: () => Promise<ReaderReplacePreview>;
  readonly onImportControlReplace: () => Promise<void>;
  readonly onExportControlReplace: () => Promise<void>;
  readonly onAppearanceThemeChange: (theme: ReaderAppearanceTheme) => void;
  readonly onAppearanceDayThemeChange: (theme: ReaderAppearanceTheme) => void;
  readonly onAppearanceNightThemeChange: (theme: ReaderAppearanceTheme) => void;
  readonly onAppearanceFontChange: (font: ReaderAppearanceFont) => void;
  readonly onAppearanceFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]) => ReaderControlFontOrderPresentation;
  readonly onAppearanceFontReorderActivityChange: (active: boolean) => void;
  readonly onAppearanceCustomFontImport: () => void;
  readonly onAppearanceIndentRequest: (indent: ReaderAppearanceIndent) => void;
  readonly onAppearanceAlignmentRequest: (current: ReaderAppearanceAlignment) => void;
  readonly onAppearanceMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void;
  readonly onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string) => void;
  readonly onSettingsToggleChange: (key: ReaderSettingsToggleKey, value: boolean) => void;
  readonly onWidePageLayoutChange: (value: ReaderWidePageLayout) => void;
  readonly onScreenDirectionChange: (direction: ReaderScreenDirection) => void;
  readonly onScreenTimeoutChange: (timeout: ReaderScreenTimeout) => void;
  readonly onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void;
  readonly onTtsToggle: () => void;
  readonly onTtsStop: () => void;
  readonly onTtsPrevious: () => void;
  readonly onTtsNext: () => void;
  readonly onTtsSeek: (sliceIndex: number) => void;
  readonly onTtsRateChange: (rate: number, onDeclined?: () => void) => void;
  readonly onTtsTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode) => void;
  readonly onTtsFollowHighlightChange: (enabled: boolean) => void;
  readonly onTtsPauseOnInterruptionChange: (enabled: boolean) => void;
  readonly onTtsAllowMixingChange: (enabled: boolean) => void;
  readonly onTtsBackgroundPlaybackChange: (enabled: boolean) => void;
  readonly onTtsKeepScreenOnChange: (enabled: boolean) => void;
  readonly onTtsFailurePolicyChange: (policy: 'skip' | 'stop') => void;
  readonly onTtsVoiceChange: (language: string, person: number) => void;
  readonly onTtsVoiceAudition: (language: string, person: number) => Promise<void>;
  readonly onTtsAuditionStop: () => void;
  readonly onTtsEngineChange: (engine: string) => Promise<void>;
  readonly onTtsHttpEnginePut: (config: ReaderTtsConfigurationDraft) => Promise<void>;
  readonly onTtsHttpEngineDelete: (id: number) => Promise<void>;
}

@Observed
export class ReaderControlPanelFrame {
  @Track readonly directSheetRedesign: boolean;
  @Track readonly fixedIsland: boolean;
  @Track readonly bodySelectionPossible: boolean;
  @Track readonly sessionFontScale: number;
  @Track readonly controlThemeStyle: ReaderControlThemeStyle;
  @Track readonly launchSample: ReaderSessionLaunchSample | undefined;
  @Track readonly launchGeneration: number;
  @Track readonly launchSourceMinimum: ReaderControlPlaybackLaunchProfile | undefined;
  @Track readonly launchSourceKind: ReaderSessionMorphSourceKind;
  @Track readonly launchBusinessStatus: ReaderSessionCapsuleState;
  @Track readonly launchDesiredPlaying: boolean;
  @Track readonly launchStageOpacity: number;
  @Track readonly launchOwnsControls: boolean;
  @Track readonly launchRecovering: boolean;
  @Track readonly launchInteractionEnabled: boolean;
  @Track readonly launchSourceTtsState: ReaderTtsState;
  @Track readonly launchSourceAutoStatus: ReaderAutoPageStatus;
  @Track readonly launchCountdown: number;
  @Track readonly recoveryAvailable: boolean;
  @Track readonly recoveryIdentity: string;
  @Track readonly bookTitle: string;
  @Track readonly chapterTitle: string;
  @Track readonly sourceId: string;
  @Track readonly sourceName: string;
  @Track readonly progressPercent: number;
  @Track readonly totalChapters: number;
  @Track readonly readableChapterPosition: number;
  @Track readonly pageBookmarkStatus: 'unknown' | 'empty' | 'bookmarked';
  @Track readonly pageBookmarkEnabled: boolean;
  @Track readonly layout: ReaderControlLayoutSnapshot;
  @Track readonly presentationReceipt: ReaderControlPresentationReceipt | undefined;
  @Track readonly preparedMinimumRequired: boolean;
  @Track readonly minimumIdentity: string;
  @Track readonly minimumCommittedIdentity: string;
  @Track readonly minimumRequestLocation: ReaderControlLocation | undefined;
  @Track readonly minimumOwnerKey: string;
  @Track readonly minimumEnvironmentKey: string;
  @Track readonly minimumKey: string;
  @Track readonly minimumReady: boolean;
  @Track readonly minimumMetricsRevision: number;
  @Track readonly inputEnabled: boolean;
  @Track readonly controlObscured: boolean;
  @Track readonly controlOpenRevision: number;
  @Track readonly dismissTemporaryRevision: number;
  @Track readonly retireTemporaryRevision: number;
  @Track readonly temporaryLayerKind: ReaderControlTemporaryInputKind;
  @Track readonly directoryEntriesRevision: number;
  @Track readonly catalogComplete: boolean;
  @Track readonly catalogLoading: boolean;
  @Track readonly catalogLoadFailed: boolean;
  @Track readonly catalogChapterCount: number;
  @Track readonly catalogCurrentPosition: number;
  @Track readonly currentChapterIndex: number;
  @Track readonly chapterStartBookmarkCreationEnabled: boolean;
  @Track readonly chapterDownloadEnabled: boolean;
  @Track readonly bookmarkLoadFailed: boolean;
  @Track readonly bookmarkLoadMessage: string;
  @Track readonly bookmarkRecovery: ReadingDirectoryRecovery;
  @Track readonly searchQuery: string;
  @Track readonly searchRevision: number;
  @Track readonly brightnessPercent: number;
  @Track readonly brightnessAutomatic: boolean;
  @Track readonly brightnessRevision: number;
  @Track readonly autoPageStatus: ReaderAutoPageStatus;
  @Track readonly autoPageSpeedSeconds: number;
  @Track readonly autoPageTimerMinutes: number;
  @Track readonly autoPageTimerSeconds: number;
  @Track readonly autoPageTimerSummaryText: string;
  @Track readonly autoPageFollowHighlight: boolean;
  @Track readonly controlReplaceState: ReaderControlReplaceState;
  @Track readonly ttsConfigurationRecovery: ReaderRecoveryView;
  @Track readonly ttsConfigurationLoading: boolean;
  @Track readonly ttsConfigurationLoadFailed: boolean;
  @Track readonly appearanceSnapshot: ReaderAppearanceSnapshot;
  @Track readonly chineseConversionMode: ReaderChineseConversionMode;
  @Track readonly settingsSnapshot: ReaderSettingsSnapshot;
  @Track readonly widePageLayout: ReaderWidePageLayout;
  @Track readonly pageTurnSimulationAvailable: boolean;
  @Track readonly ttsState: ReaderTtsState;
  @Track readonly ttsTimerMode: ReaderTtsTimerMode;
  @Track readonly ttsTimerMinutes: number;
  @Track readonly ttsTimerSeconds: number;
  @Track readonly ttsFollowHighlight: boolean;
  @Track readonly ttsPauseOnInterruption: boolean;
  @Track readonly ttsAllowMixing: boolean;
  @Track readonly ttsBackgroundPlayback: boolean;
  @Track readonly ttsKeepScreenOn: boolean;
  @Track readonly ttsFailurePolicy: 'skip' | 'stop';
  @Track readonly ttsEngine: string;
  @Track readonly ttsHttpEngines: ReaderHttpTtsConfig[];
  @Track readonly ttsVoiceOptions: ReaderTtsVoiceOption[];
  @Track readonly ttsLanguage: string;
  @Track readonly ttsPerson: number;
  @Track readonly reduceMotion: boolean;
  @Track readonly sourceBookId: string;
  @Track readonly bookDownloadEnabled: boolean;
  @Track readonly bookDownloadActive: boolean;
  @Track readonly chapterRefreshEnabled: boolean;
  @Track readonly chineseConversionIdentity: string;

  constructor(facts: ReaderControlPanelRenderFacts) {
    this.directSheetRedesign = facts.directSheetRedesign;
    this.fixedIsland = facts.fixedIsland;
    this.bodySelectionPossible = facts.bodySelectionPossible;
    this.sessionFontScale = facts.sessionFontScale;
    this.controlThemeStyle = facts.controlThemeStyle;
    this.launchSample = facts.launchSample;
    this.launchGeneration = facts.launchGeneration;
    this.launchSourceMinimum = facts.launchSourceMinimum;
    this.launchSourceKind = facts.launchSourceKind;
    this.launchBusinessStatus = facts.launchBusinessStatus;
    this.launchDesiredPlaying = facts.launchDesiredPlaying;
    this.launchStageOpacity = facts.launchStageOpacity;
    this.launchOwnsControls = facts.launchOwnsControls;
    this.launchRecovering = facts.launchRecovering;
    this.launchInteractionEnabled = facts.launchInteractionEnabled;
    this.launchSourceTtsState = facts.launchSourceTtsState;
    this.launchSourceAutoStatus = facts.launchSourceAutoStatus;
    this.launchCountdown = facts.launchCountdown;
    this.recoveryAvailable = facts.recoveryAvailable;
    this.recoveryIdentity = facts.recoveryIdentity;
    this.bookTitle = facts.bookTitle;
    this.chapterTitle = facts.chapterTitle;
    this.sourceId = facts.sourceId;
    this.sourceName = facts.sourceName;
    this.progressPercent = facts.progressPercent;
    this.totalChapters = facts.totalChapters;
    this.readableChapterPosition = facts.readableChapterPosition;
    this.pageBookmarkStatus = facts.pageBookmarkStatus;
    this.pageBookmarkEnabled = facts.pageBookmarkEnabled;
    this.layout = facts.layout;
    this.presentationReceipt = facts.presentationReceipt;
    this.preparedMinimumRequired = facts.preparedMinimumRequired;
    this.minimumIdentity = facts.minimumIdentity;
    this.minimumCommittedIdentity = facts.minimumCommittedIdentity;
    this.minimumRequestLocation = facts.minimumRequestLocation;
    this.minimumOwnerKey = facts.minimumOwnerKey;
    this.minimumEnvironmentKey = facts.minimumEnvironmentKey;
    this.minimumKey = facts.minimumKey;
    this.minimumReady = facts.minimumReady;
    this.minimumMetricsRevision = facts.minimumMetricsRevision;
    this.inputEnabled = facts.inputEnabled;
    this.controlObscured = facts.controlObscured;
    this.controlOpenRevision = facts.controlOpenRevision;
    this.dismissTemporaryRevision = facts.dismissTemporaryRevision;
    this.retireTemporaryRevision = facts.retireTemporaryRevision;
    this.temporaryLayerKind = facts.temporaryLayerKind;
    this.directoryEntriesRevision = facts.directoryEntriesRevision;
    this.catalogComplete = facts.catalogComplete;
    this.catalogLoading = facts.catalogLoading;
    this.catalogLoadFailed = facts.catalogLoadFailed;
    this.catalogChapterCount = facts.catalogChapterCount;
    this.catalogCurrentPosition = facts.catalogCurrentPosition;
    this.currentChapterIndex = facts.currentChapterIndex;
    this.chapterStartBookmarkCreationEnabled = facts.chapterStartBookmarkCreationEnabled;
    this.chapterDownloadEnabled = facts.chapterDownloadEnabled;
    this.bookmarkLoadFailed = facts.bookmarkLoadFailed;
    this.bookmarkLoadMessage = facts.bookmarkLoadMessage;
    this.bookmarkRecovery = facts.bookmarkRecovery;
    this.searchQuery = facts.searchQuery;
    this.searchRevision = facts.searchRevision;
    this.brightnessPercent = facts.brightnessPercent;
    this.brightnessAutomatic = facts.brightnessAutomatic;
    this.brightnessRevision = facts.brightnessRevision;
    this.autoPageStatus = facts.autoPageStatus;
    this.autoPageSpeedSeconds = facts.autoPageSpeedSeconds;
    this.autoPageTimerMinutes = facts.autoPageTimerMinutes;
    this.autoPageTimerSeconds = facts.autoPageTimerSeconds;
    this.autoPageTimerSummaryText = facts.autoPageTimerSummaryText;
    this.autoPageFollowHighlight = facts.autoPageFollowHighlight;
    this.controlReplaceState = facts.controlReplaceState;
    this.ttsConfigurationRecovery = facts.ttsConfigurationRecovery;
    this.ttsConfigurationLoading = facts.ttsConfigurationLoading;
    this.ttsConfigurationLoadFailed = facts.ttsConfigurationLoadFailed;
    this.appearanceSnapshot = facts.appearanceSnapshot;
    this.chineseConversionMode = facts.chineseConversionMode;
    this.settingsSnapshot = facts.settingsSnapshot;
    this.widePageLayout = facts.widePageLayout;
    this.pageTurnSimulationAvailable = facts.pageTurnSimulationAvailable;
    this.ttsState = facts.ttsState;
    this.ttsTimerMode = facts.ttsTimerMode;
    this.ttsTimerMinutes = facts.ttsTimerMinutes;
    this.ttsTimerSeconds = facts.ttsTimerSeconds;
    this.ttsFollowHighlight = facts.ttsFollowHighlight;
    this.ttsPauseOnInterruption = facts.ttsPauseOnInterruption;
    this.ttsAllowMixing = facts.ttsAllowMixing;
    this.ttsBackgroundPlayback = facts.ttsBackgroundPlayback;
    this.ttsKeepScreenOn = facts.ttsKeepScreenOn;
    this.ttsFailurePolicy = facts.ttsFailurePolicy;
    this.ttsEngine = facts.ttsEngine;
    this.ttsHttpEngines = facts.ttsHttpEngines;
    this.ttsVoiceOptions = facts.ttsVoiceOptions;
    this.ttsLanguage = facts.ttsLanguage;
    this.ttsPerson = facts.ttsPerson;
    this.reduceMotion = facts.reduceMotion;
    this.sourceBookId = facts.sourceBookId;
    this.bookDownloadEnabled = facts.bookDownloadEnabled;
    this.bookDownloadActive = facts.bookDownloadActive;
    this.chapterRefreshEnabled = facts.chapterRefreshEnabled;
    this.chineseConversionIdentity = facts.chineseConversionIdentity;
  }
}

/** The native two-way link becomes the authoritative writer once it mounts.
 * A route can still commit control ownership before the first native frame. */
export interface ReaderControlDirectoryLifecycle {
  readonly publish: (session: ReaderControlSessionState) => void;
  readonly preferences: () => ReaderReadingPreferencesHost;
  readonly geometry: () => ReaderControlGeometryHost;
  readonly verification: () => ReaderControlVerificationSession;
  readonly openRevision: () => number;
  readonly cancelAutomaticStart: () => void;
  readonly scheduleSpeechFollow: () => void;
  readonly publishClosing: (closing: boolean) => void;
  readonly windowOwnedByControl: () => boolean;
  readonly preparation: () => ReaderPageTurnPreparationHost;
  readonly search: () => ReaderContentSearchPublication;
  readonly bumpSearchRevision: () => void;
  readonly replace: () => ReaderControlReplacePanel;
  readonly preparePage: (page: ReaderControlPage) => void;
  readonly resetSearch: () => void;
  readonly canResumeReading: () => boolean;
  readonly resumeAutomatic: () => void;
}

/** Keeps session admission and the sparse native visual sample in the same owner.
 * The visual sample is consulted by Back and close without invalidating paper. */
export class ReaderControlDirectorySession {
  private session: ReaderControlSessionState;
  private visual: ReaderControlSessionState = createReaderControlSessionState();
  private nativeWrite: ((session: ReaderControlSessionState) => void) | undefined = undefined;
  private observedPage: ReaderControlPage = 'home';
  private observedModule: string = 'home';
  private closeRevision: number = 0;
  private visit: number = 0;
  private readonly lifecycle: ReaderControlDirectoryLifecycle;

  constructor(initial: ReaderControlSessionState, lifecycle: ReaderControlDirectoryLifecycle) {
    this.session = initial;
    this.lifecycle = lifecycle;
  }

  read(): ReaderControlSessionState { return this.session; }
  visualSession(): ReaderControlSessionState { return this.visual; }
  visitRevision(): number { return this.visit; }

  beginMount(): void {
    this.copyVisual(this.session);
    this.closeRevision = 0;
    this.observedPage = 'home';
    this.observedModule = 'home';
  }

  copyVisual(session: ReaderControlSessionState): void { this.visual = copyReaderControlSessionState(session); }

  admitVisual(session: ReaderControlSessionState): void {
    admitReaderControlVisualSnapshot(session, {
      presentedForWindow: (): boolean => this.lifecycle.windowOwnedByControl(),
      capture: (snapshot: ReaderControlSessionState): void => { this.visual = snapshot; },
      closing: (closing: boolean): void => this.lifecycle.publishClosing(closing),
      chromeOwnerChanged: (): void => this.lifecycle.preferences().applyWindowPolicyForChromeOwner(),
    });
  }

  acceptMeasuredVisit(location: ReaderControlLocation, intent: ReaderControlNavigationIntent, source: ReaderControlSessionState,
    session: ReaderControlSessionState, clearIntent: () => void): ReaderControlPage | undefined {
    const previous = this.observedModule;
    this.visit = intent.moduleVisitRevision;
    this.observedModule = location.level === 'secondary' ? location.module : 'home';
    clearIntent();
    this.lifecycle.verification().accept(intent.verificationOrigin, source, session, this.lifecycle.openRevision());
    this.request(session);
    return previous === this.observedModule ? undefined : readerControlHostPage(this.session);
  }

  connect(write: (session: ReaderControlSessionState) => void): () => void {
    this.nativeWrite = write;
    return (): void => {
      if (this.nativeWrite === write) this.nativeWrite = undefined;
    };
  }

  request(session: ReaderControlSessionState): void {
    if (this.nativeWrite !== undefined) this.nativeWrite(session);
    else if (this.session !== session) this.admit(session);
  }

  admit(session: ReaderControlSessionState): void {
    this.session = session;
    this.lifecycle.publish(session);
    this.applySession();
  }

  private applySession(): void {
    const host = this.lifecycle;
    const geometry = host.geometry();
    geometry.fontOrder.reconcile();
    host.verification().observeHostState(this.session, host.openRevision());
    if (readerControlHostVisible(this.session)) host.cancelAutomaticStart();
    else host.scheduleSpeechFollow();
    this.copyVisual(this.session);
    host.publishClosing(readerControlHostClosing(this.session));
    host.preferences().applyWindowPolicyForChromeOwner();
    if (readerControlHostVisible(this.session)) host.preparation().suspend();
    const page = readerControlHostPage(this.session);
    const previous = this.observedPage;
    if (page !== previous) {
      this.observedPage = page;
      if ((previous === 'quickSearch' || previous === 'fullSearch') &&
        page !== 'quickSearch' && page !== 'fullSearch' && host.search().retirePresentation()) host.bumpSearchRevision();
      if (previous === 'quickReplace' && page !== 'quickReplace') host.replace().advancePanel();
    }
    const location = readerControlContentLocation(this.session);
    const module = location.level === 'secondary' ? location.module : 'home';
    if (module !== this.observedModule) {
      this.visit += 1;
      this.observedModule = module;
      host.preparePage(page);
    }
    geometry.minimum.invalidateLayout();
    if (!readerControlHostCloseCommitted(this.session, this.closeRevision)) return;
    this.closeRevision = this.session.closeRevision;
    geometry.invalidateBackdrop();
    // A native drag may land without a control-dismiss command.
    geometry.hideKeyboardIfVisible();
    geometry.dismissTemporaryLayers();
    host.search().cancel();
    host.replace().advancePanel();
    host.resetSearch();
    if (host.canResumeReading()) {
      host.preparation().drain();
      host.resumeAutomatic();
    }
  }
}

@Component
export struct ReaderControlDirectoryHost {
  owner!: ReaderControlDirectorySession;
  commands!: ReaderControlPanelCommands;
  @ObjectLink frame: ReaderControlPanelFrame;
  @State @Watch('onNativeControlSessionChanged') private controlSession: ReaderControlSessionState = createReaderControlSessionState();
  private detach: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.controlSession = this.owner.read();
    this.detach = this.owner.connect((session: ReaderControlSessionState): void => { this.controlSession = session; });
  }

  aboutToDisappear(): void {
    this.detach?.();
    this.detach = undefined;
  }

  private onNativeControlSessionChanged(): void {
    if (this.detach !== undefined) this.owner.admit(this.controlSession);
  }

  build() {
    ReaderControlPanel({
      directSheetRedesign: this.frame.directSheetRedesign,
      fixedIsland: this.frame.fixedIsland,
      bodySelectionPossible: this.frame.bodySelectionPossible,
      sessionFontScale: this.frame.sessionFontScale,
      controlThemeStyle: this.frame.controlThemeStyle,
      launchSample: this.frame.launchSample,
      launchGeneration: this.frame.launchGeneration,
      launchSourceMinimum: this.frame.launchSourceMinimum,
      launchSourceKind: this.frame.launchSourceKind,
      launchBusinessStatus: this.frame.launchBusinessStatus,
      launchDesiredPlaying: this.frame.launchDesiredPlaying,
      launchStageOpacity: this.frame.launchStageOpacity,
      launchOwnsControls: this.frame.launchOwnsControls,
      launchRecovering: this.frame.launchRecovering,
      onLaunchSourceReady: this.commands.onLaunchSourceReady,
      launchInteractionEnabled: this.frame.launchInteractionEnabled,
      launchSourceTtsState: this.frame.launchSourceTtsState,
      launchSourceAutoStatus: this.frame.launchSourceAutoStatus,
      launchCountdown: this.frame.launchCountdown,
      onLaunchToggle: this.commands.onLaunchToggle,
      onSessionLaunchShellMeasured: this.commands.onSessionLaunchShellMeasured,
      recoveryAvailable: this.frame.recoveryAvailable,
      recoveryIdentity: this.frame.recoveryIdentity,
      onOpenRecovery: this.commands.onOpenRecovery,
      bookTitle: this.frame.bookTitle,
      chapterTitle: this.frame.chapterTitle,
      sourceId: this.frame.sourceId,
      sourceName: this.frame.sourceName,
      progressPercent: this.frame.progressPercent,
      totalChapters: this.frame.totalChapters,
      readableChapterPosition: this.frame.readableChapterPosition,
      pageBookmarkStatus: this.frame.pageBookmarkStatus,
      pageBookmarkEnabled: this.frame.pageBookmarkEnabled,
      onTogglePageBookmark: this.commands.onTogglePageBookmark,
      layout: this.frame.layout,
      presentationReceipt: this.frame.presentationReceipt,
      preparedMinimumRequired: this.frame.preparedMinimumRequired,
      minimumIdentity: this.frame.minimumIdentity,
      minimumCommittedIdentity: this.frame.minimumCommittedIdentity,
      minimumRequestLocation: this.frame.minimumRequestLocation,
      minimumOwnerKey: this.frame.minimumOwnerKey,
      minimumEnvironmentKey: this.frame.minimumEnvironmentKey,
      minimumKey: this.frame.minimumKey,
      minimumReady: this.frame.minimumReady,
      minimumReceiptCurrent: this.commands.minimumReceiptCurrent,
      minimumMetricsRevision: this.frame.minimumMetricsRevision,
      onPlaybackProfileSelected: this.commands.onPlaybackProfileSelected,
      onMinimumMeasurerReady: this.commands.onMinimumMeasurerReady,
      controlSession: $controlSession,
      verificationSession: this.commands.verificationSession,
      onSessionRequest: this.commands.onSessionRequest,
      inputEnabled: this.frame.inputEnabled,
      inputCurrent: this.commands.inputCurrent,
      controlObscured: this.frame.controlObscured,
      controlOpenRevision: this.frame.controlOpenRevision,
      dismissTemporaryRevision: this.frame.dismissTemporaryRevision,
      retireTemporaryRevision: this.frame.retireTemporaryRevision,
      temporaryLayerKind: this.frame.temporaryLayerKind,
      onVisualSessionChange: this.commands.onVisualSessionChange,
      onTemporaryLayerChange: this.commands.onTemporaryLayerChange,
      onTtsConfigurationOpen: this.commands.onTtsConfigurationOpen,
      onInputActivity: this.commands.onInputActivity,
      onBackdropRegionsChange: this.commands.onBackdropRegionsChange,
      directoryPublication: this.commands.directoryPublication,
      directoryEntriesRevision: this.frame.directoryEntriesRevision,
      catalogComplete: this.frame.catalogComplete,
      catalogLoading: this.frame.catalogLoading,
      catalogLoadFailed: this.frame.catalogLoadFailed,
      catalogChapterCount: this.frame.catalogChapterCount,
      catalogCurrentPosition: this.frame.catalogCurrentPosition,
      onRequireCompleteCatalog: this.commands.onRequireCompleteCatalog,
      currentChapterIndex: this.frame.currentChapterIndex,
      chapterStartBookmarkCreationEnabled: this.frame.chapterStartBookmarkCreationEnabled,
      chapterDownloadEnabled: this.frame.chapterDownloadEnabled,
      bookmarkLoadFailed: this.frame.bookmarkLoadFailed,
      bookmarkLoadMessage: this.frame.bookmarkLoadMessage,
      bookmarkRecovery: this.frame.bookmarkRecovery,
      onRetryBookmarkLoad: this.commands.onRetryBookmarkLoad,
      searchQuery: this.frame.searchQuery,
      searchPublication: this.commands.searchPublication,
      searchRevision: this.frame.searchRevision,
      brightnessPercent: this.frame.brightnessPercent,
      brightnessAutomatic: this.frame.brightnessAutomatic,
      brightnessRevision: this.frame.brightnessRevision,
      autoPageStatus: this.frame.autoPageStatus,
      autoPageSpeedSeconds: this.frame.autoPageSpeedSeconds,
      autoPageTimerMinutes: this.frame.autoPageTimerMinutes,
      autoPageTimerSeconds: this.frame.autoPageTimerSeconds,
      autoPageTimerSummaryText: this.frame.autoPageTimerSummaryText,
      autoPageFollowHighlight: this.frame.autoPageFollowHighlight,
      controlReplaceState: this.frame.controlReplaceState,
      ttsConfigurationRecovery: this.frame.ttsConfigurationRecovery,
      ttsConfigurationLoading: this.frame.ttsConfigurationLoading,
      ttsConfigurationLoadFailed: this.frame.ttsConfigurationLoadFailed,
      appearanceSnapshot: this.frame.appearanceSnapshot,
      chineseConversionMode: this.frame.chineseConversionMode,
      settingsSnapshot: this.frame.settingsSnapshot,
      widePageLayout: this.frame.widePageLayout,
      pageTurnSimulationAvailable: this.frame.pageTurnSimulationAvailable,
      ttsState: this.frame.ttsState,
      ttsTimerMode: this.frame.ttsTimerMode,
      ttsTimerMinutes: this.frame.ttsTimerMinutes,
      ttsTimerSeconds: this.frame.ttsTimerSeconds,
      ttsFollowHighlight: this.frame.ttsFollowHighlight,
      ttsPauseOnInterruption: this.frame.ttsPauseOnInterruption,
      ttsAllowMixing: this.frame.ttsAllowMixing,
      ttsBackgroundPlayback: this.frame.ttsBackgroundPlayback,
      ttsKeepScreenOn: this.frame.ttsKeepScreenOn,
      ttsFailurePolicy: this.frame.ttsFailurePolicy,
      ttsEngine: this.frame.ttsEngine,
      ttsHttpEngines: this.frame.ttsHttpEngines,
      ttsVoiceOptions: this.frame.ttsVoiceOptions,
      ttsLanguage: this.frame.ttsLanguage,
      ttsPerson: this.frame.ttsPerson,
      reduceMotion: this.frame.reduceMotion,
      onSessionMorphSourceMeasured: this.commands.onSessionMorphSourceMeasured,
      onExitReading: this.commands.onExitReading,
      onDismiss: this.commands.onDismiss,
      sourceBookId: this.frame.sourceBookId,
      onSourceSwitch: this.commands.onSourceSwitch,
      onRefreshChapter: this.commands.onRefreshChapter,
      bookDownloadEnabled: this.frame.bookDownloadEnabled,
      bookDownloadActive: this.frame.bookDownloadActive,
      onDownloadBook: this.commands.onDownloadBook,
      onOpenBookInfo: this.commands.onOpenBookInfo,
      chapterRefreshEnabled: this.frame.chapterRefreshEnabled,
      onPageChange: this.commands.onPageChange,
      onModuleSelect: this.commands.onModuleSelect,
      onSelectChapter: this.commands.onSelectChapter,
      onSelectNavigationTarget: this.commands.onSelectNavigationTarget,
      onSelectBookmark: this.commands.onSelectBookmark,
      bookmarkIdentity: this.commands.bookmarkIdentity,
      onDownloadChapter: this.commands.onDownloadChapter,
      onDeleteBookmarks: this.commands.onDeleteBookmarks,
      onCreateChapterStartBookmark: this.commands.onCreateChapterStartBookmark,
      onPreviousChapter: this.commands.onPreviousChapter,
      onNextChapter: this.commands.onNextChapter,
      onProgressChange: this.commands.onProgressChange,
      onBrightnessChange: this.commands.onBrightnessChange,
      onBrightnessAuto: this.commands.onBrightnessAuto,
      onBrightnessCancel: this.commands.onBrightnessCancel,
      onSearchQueryChange: this.commands.onSearchQueryChange,
      onSearch: this.commands.onSearch,
      onSearchLoadMore: this.commands.onSearchLoadMore,
      onSearchNeedMore: this.commands.onSearchNeedMore,
      onSearchResultSelect: this.commands.onSearchResultSelect,
      onAutoPageToggle: this.commands.onAutoPageToggle,
      onAutoPageStop: this.commands.onAutoPageStop,
      onAutoPageSlowDown: this.commands.onAutoPageSlowDown,
      onAutoPageSpeedUp: this.commands.onAutoPageSpeedUp,
      onAutoPageFullTimerChange: this.commands.onAutoPageFullTimerChange,
      onAutoPageFullSpeedChange: this.commands.onAutoPageFullSpeedChange,
      onAutoPageFollowHighlightChange: this.commands.onAutoPageFollowHighlightChange,
      onOpenReplace: this.commands.onOpenReplace,
      onReloadControlReplace: this.commands.onReloadControlReplace,
      onSaveControlReplace: this.commands.onSaveControlReplace,
      onToggleControlReplace: this.commands.onToggleControlReplace,
      onDeleteControlReplace: this.commands.onDeleteControlReplace,
      onPreviewControlReplace: this.commands.onPreviewControlReplace,
      onImportControlReplace: this.commands.onImportControlReplace,
      onExportControlReplace: this.commands.onExportControlReplace,
      onAppearanceThemeChange: this.commands.onAppearanceThemeChange,
      onAppearanceDayThemeChange: this.commands.onAppearanceDayThemeChange,
      onAppearanceNightThemeChange: this.commands.onAppearanceNightThemeChange,
      onAppearanceFontChange: this.commands.onAppearanceFontChange,
      onAppearanceFontOrderChange: this.commands.onAppearanceFontOrderChange,
      onAppearanceFontReorderActivityChange: this.commands.onAppearanceFontReorderActivityChange,
      onAppearanceCustomFontImport: this.commands.onAppearanceCustomFontImport,
      onAppearanceIndentRequest: this.commands.onAppearanceIndentRequest,
      onAppearanceAlignmentRequest: this.commands.onAppearanceAlignmentRequest,
      onAppearanceMetricStep: this.commands.onAppearanceMetricStep,
      chineseConversionIdentity: this.frame.chineseConversionIdentity,
      onChineseConversionChange: this.commands.onChineseConversionChange,
      onSettingsToggleChange: this.commands.onSettingsToggleChange,
      onWidePageLayoutChange: this.commands.onWidePageLayoutChange,
      onScreenDirectionChange: this.commands.onScreenDirectionChange,
      onScreenTimeoutChange: this.commands.onScreenTimeoutChange,
      onPageTurnStyleChange: this.commands.onPageTurnStyleChange,
      onTtsToggle: this.commands.onTtsToggle,
      onTtsStop: this.commands.onTtsStop,
      onTtsPrevious: this.commands.onTtsPrevious,
      onTtsNext: this.commands.onTtsNext,
      onTtsSeek: this.commands.onTtsSeek,
      onTtsRateChange: this.commands.onTtsRateChange,
      onTtsTimerChange: this.commands.onTtsTimerChange,
      onTtsFollowHighlightChange: this.commands.onTtsFollowHighlightChange,
      onTtsPauseOnInterruptionChange: this.commands.onTtsPauseOnInterruptionChange,
      onTtsAllowMixingChange: this.commands.onTtsAllowMixingChange,
      onTtsBackgroundPlaybackChange: this.commands.onTtsBackgroundPlaybackChange,
      onTtsKeepScreenOnChange: this.commands.onTtsKeepScreenOnChange,
      onTtsFailurePolicyChange: this.commands.onTtsFailurePolicyChange,
      onTtsVoiceChange: this.commands.onTtsVoiceChange,
      onTtsVoiceAudition: this.commands.onTtsVoiceAudition,
      onTtsAuditionStop: this.commands.onTtsAuditionStop,
      onTtsEngineChange: this.commands.onTtsEngineChange,
      onTtsHttpEnginePut: this.commands.onTtsHttpEnginePut,
      onTtsHttpEngineDelete: this.commands.onTtsHttpEngineDelete,
    });
  }
}

export interface ReaderNativeControlActors {
  readonly interaction: ReaderReadingControlInteractionHost;
  readonly playback: ReaderReadingPlaybackFlowHost;
  readonly replace: ReaderControlReplacePanel;
  readonly session: ReaderControlDirectorySession;
  readonly geometry: ReaderControlGeometryHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly progress: ReaderReadingProgressHost;
  readonly turnInput: ReaderPageTurnInputHost;
  readonly brightness: ReaderBrightnessSession;
  readonly preferences: ReaderReadingPreferencesHost;
  readonly mutation: ReaderReadingContentMutationHost;
  readonly speech: ReaderReadingSpeechHost;
  readonly bookmarks: ReaderBookmarkInteractionHost;
  readonly auxiliary: ReaderAuxiliarySessionHost;
}

export interface ReaderNativeControlActions {
  readonly bookmarkEnabled: () => boolean;
  readonly verification: ReaderControlVerificationSession;
  readonly windowMetricsRevision: () => number;
  readonly openBookInfo: () => void;
  readonly bookmarkIdentity: ReaderBookIdentity | undefined;
  readonly deleteBookmarks: (times: number[]) => void;
  readonly createBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void;
  readonly searchPublication: ReaderContentSearchPublication;
  readonly reduceMotion: () => boolean;
}

export function readerNativeControlCommands(actors: ReaderNativeControlActors, other: ReaderNativeControlActions): ReaderControlPanelCommands {
  return {
    onLaunchSourceReady: (generation: number): void => actors.auxiliary.onSourceReady(generation),
    onLaunchToggle: (): void => actors.auxiliary.toggleSessionCapsule(),
    onSessionLaunchShellMeasured: (topExit: number, dockExit: number): void => {
      actors.auxiliary.noteShellExitDistances(topExit, dockExit);
    },
    onOpenRecovery: (identity: string): void => actors.recovery.open(identity),
    onTogglePageBookmark: (): void => {
      if (other.bookmarkEnabled()) {
        actors.bookmarks.toggle();
      }
    },
    minimumReceiptCurrent: (key: string): boolean => actors.geometry.receiptCurrent(key),
    onPlaybackProfileSelected: (receipt: ReaderControlPlaybackProfileReceipt): void =>
      actors.geometry.acceptPlaybackProfile(receipt, other.windowMetricsRevision()),
    onMinimumMeasurerReady: (identity: string, measurer: ReaderControlContentMeasurer | undefined,
      profileReader?: ReaderControlMeasuredProfileReader, facts?: ReaderControlModuleFacts, factsGeometryKey?: string): void =>
      actors.geometry.bind(identity, measurer, profileReader, facts, factsGeometryKey),
    verificationSession: other.verification,
    onSessionRequest: (next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): void =>
      actors.interaction.requestControlSession(next, origin),
    inputCurrent: (): boolean => actors.interaction.isControlInputEnabled() && actors.auxiliary.sessionLaunchAllowsControlInput(),
    onVisualSessionChange: (state: ReaderControlSessionState): void => actors.session.admitVisual(state),
    onTemporaryLayerChange: (active: boolean, kind?: ReaderControlTemporaryInputKind): void => actors.geometry.onTemporaryLayerChanged(active, kind),
    onTtsConfigurationOpen: (): void => actors.speech.retryTtsConfigurationMetadataOnOpen(),
    onInputActivity: (): void => actors.interaction.onControlInputActivity(),
    onBackdropRegionsChange: (regions: ReaderControlBackdropRect[], ready: boolean): void => actors.geometry.acceptBackdropRegions(regions, ready),
    directoryPublication: actors.directory.publication,
    onRequireCompleteCatalog: (): void => actors.turnInput.requestCatalog(),
    onRetryBookmarkLoad: (): void => actors.directory.loadBookmarks(),
    searchPublication: other.searchPublication,
    onSessionMorphSourceMeasured: (measurement: ReaderSessionMorphSourceMeasurement): void =>
      actors.auxiliary.admitSessionMorphSourceMeasurement(measurement),
    onExitReading: (): void => actors.progress.beginExit(),
    onDismiss: (): void => actors.interaction.hideControl(),
    onSourceSwitch: (focusId?: string): void => {
      actors.interaction.switchSource(focusId);
    },
    onRefreshChapter: (): void => actors.interaction.refreshCurrentChapter(),
    onDownloadBook: (): void => actors.directory.requestDownload(),
    onOpenBookInfo: (): void => other.openBookInfo(),
    onPageChange: (page: ReaderControlPage, origin: ReaderControlVerificationOrigin): void => actors.interaction.setControlPage(page, origin),
    onModuleSelect: (_module: string): void => {},
    onSelectChapter: (chapterIndex: number): void => actors.directory.selectChapter(chapterIndex),
    onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number,
      positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void =>
      actors.directory.selectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
    onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void =>
      actors.directory.selectBookmarkAnchor(chapterIndex, chapterOffset, positionScope),
    bookmarkIdentity: other.bookmarkIdentity,
    onDownloadChapter: (chapterIndex: number): void => actors.directory.requestDownload(chapterIndex),
    onDeleteBookmarks: (bookmarkTimes: number[]): void => { other.deleteBookmarks(bookmarkTimes); },
    onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
      { other.createBookmark(request); },
    onPreviousChapter: (): void => actors.directory.step(-1),
    onNextChapter: (): void => actors.directory.step(1),
    onProgressChange: (percent: number): void => actors.directory.seek(percent),
    onBrightnessChange: (percent: number): void => actors.brightness.setManual(percent),
    onBrightnessAuto: (): void => actors.brightness.toggleAutomatic(),
    onBrightnessCancel: (): void => actors.brightness.cancel(),
    onSearchQueryChange: (query: string): void => actors.interaction.updateQuickSearchQuery(query),
    onSearch: (): void => actors.interaction.runQuickSearch(),
    onSearchLoadMore: (): void => actors.interaction.loadMoreQuickSearch(false),
    onSearchNeedMore: (): void => actors.interaction.loadMoreQuickSearch(true),
    onSearchResultSelect: (result: ReadingContentSearchResult, scope: number, ordinal: number): void =>
      actors.interaction.selectSearchResult(result, scope, ordinal),
    onAutoPageToggle: (): void => actors.playback.toggleAutoPage(),
    onAutoPageStop: (): void => actors.playback.stopAutoPage(),
    onAutoPageSlowDown: (): void => actors.playback.changeAutoPageSpeed(2),
    onAutoPageSpeedUp: (): void => actors.playback.changeAutoPageSpeed(-2),
    onAutoPageFullTimerChange: (minutes: number, seconds: number): void =>
      actors.playback.auto.setSessionTimer(minutes, seconds),
    onAutoPageFullSpeedChange: (seconds: number, onDeclined?: () => void): void =>
      actors.playback.setAutoPageSpeed(seconds, onDeclined),
    onAutoPageFollowHighlightChange: (enabled: boolean): void =>
      actors.playback.auto.setFollowHighlight(enabled),
    onOpenReplace: (): void => actors.interaction.openQuickReplace(),
    onReloadControlReplace: (operationId?: string): Promise<void> => actors.replace.reload(true, operationId),
    onSaveControlReplace: (draft: ReaderControlReplaceDraft): Promise<void> => actors.replace.save(draft),
    onToggleControlReplace: (rule: ReaderReplaceRule, value: boolean): Promise<void> =>
      actors.replace.toggle(rule, value),
    onDeleteControlReplace: (rule: ReaderReplaceRule): Promise<void> => actors.replace.delete(rule),
    onPreviewControlReplace: (): Promise<ReaderReplacePreview> => actors.replace.preview(),
    onImportControlReplace: (): Promise<void> => actors.interaction.importControlReplace(),
    onExportControlReplace: (): Promise<void> => actors.interaction.exportControlReplace(),
    onAppearanceThemeChange: (theme: ReaderAppearanceTheme): void =>
      actors.preferences.changeAppearanceTheme(theme),
    onAppearanceDayThemeChange: (theme: ReaderAppearanceTheme): void =>
      actors.preferences.changeAppearanceDayTheme(theme),
    onAppearanceNightThemeChange: (theme: ReaderAppearanceTheme): void =>
      actors.preferences.changeAppearanceNightTheme(theme),
    onAppearanceFontChange: (font: ReaderAppearanceFont): void => actors.preferences.changeAppearanceFont(font),
    onAppearanceFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation =>
      actors.geometry.fontOrder.request(fontOrder),
    onAppearanceFontReorderActivityChange: (active: boolean): void => {
      if (active && !other.reduceMotion()) {
        try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
        catch (_) {}
      }
    },
    onAppearanceCustomFontImport: (): void => actors.preferences.importReaderCustomFont(),
    onAppearanceIndentRequest: (indent: ReaderAppearanceIndent): void =>
      actors.preferences.changeAppearanceIndent(indent),
    onAppearanceAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
      actors.preferences.toggleAppearanceAlignment(current),
    onAppearanceMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
      actors.preferences.stepAppearanceMetric(metric, direction),
    onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string): void =>
      actors.mutation.dispatchChineseConversionAction(mode, identity),
    onSettingsToggleChange: (key: ReaderSettingsToggleKey, value: boolean): void =>
      actors.preferences.changeReaderSetting(key, value),
    onWidePageLayoutChange: (value: ReaderWidePageLayout): void => actors.preferences.changeWidePageLayout(value),
    onScreenDirectionChange: (direction: ReaderScreenDirection): void =>
      actors.preferences.changeReaderScreenDirection(direction),
    onScreenTimeoutChange: (timeout: ReaderScreenTimeout): void =>
      actors.preferences.changeReaderScreenTimeout(timeout),
    onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
      actors.preferences.changeReaderPageTurnStyle(style),
    onTtsToggle: (): void => actors.speech.toggleTts(),
    onTtsStop: (): void => actors.speech.stopTts(),
    onTtsPrevious: (): void => actors.speech.previousTtsUtterance(),
    onTtsNext: (): void => actors.speech.nextTtsUtterance(),
    onTtsSeek: (sliceIndex: number): void => actors.speech.seekTtsUtterance(sliceIndex),
    onTtsRateChange: (rate: number, onDeclined?: () => void): void => actors.speech.changeTtsRate(rate, onDeclined),
    onTtsTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode): void =>
      actors.speech.changeTtsTimer(minutes, seconds, mode),
    onTtsFollowHighlightChange: (enabled: boolean): void => actors.speech.changeTtsFollowHighlight(enabled),
    onTtsPauseOnInterruptionChange: (enabled: boolean): void =>
      actors.speech.changeTtsPauseOnInterruption(enabled),
    onTtsAllowMixingChange: (enabled: boolean): void => actors.speech.changeTtsAllowMixing(enabled),
    onTtsBackgroundPlaybackChange: (enabled: boolean): void => actors.speech.changeTtsBackgroundPlayback(enabled),
    onTtsKeepScreenOnChange: (enabled: boolean): void => actors.speech.changeTtsKeepScreenOn(enabled),
    onTtsFailurePolicyChange: (policy: 'skip' | 'stop'): void => actors.speech.changeTtsFailurePolicy(policy),
    onTtsVoiceChange: (language: string, person: number): void => actors.speech.changeTtsVoice(language, person),
    onTtsVoiceAudition: (language: string, person: number): Promise<void> => actors.speech.auditionReaderTtsVoice(language, person),
    onTtsAuditionStop: (): void => actors.speech.stopReaderTtsAudition(),
    onTtsEngineChange: (engine: string): Promise<void> => actors.speech.changeTtsEngine(engine),
    onTtsHttpEnginePut: (config: ReaderTtsConfigurationDraft): Promise<void> => actors.speech.saveHttpTtsEngine(config),
    onTtsHttpEngineDelete: (id: number): Promise<void> => actors.speech.deleteHttpTtsEngine(id),
  };
}

export interface ReaderNativeControlFrameRoute {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly bookId: string;
  readonly bookTitle: string;
  readonly chapterCount: number;
}

export interface ReaderNativeControlFrameInput {
  readonly route: () => ReaderNativeControlFrameRoute;
  readonly chrome: () => ReadingChromeRenderSnapshot;
  readonly overlay: () => ReadingOverlayRenderSnapshot;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly session: () => ReadingSessionRenderSnapshot;
  readonly mount: ReaderReadingMountHost;
  readonly geometry: ReaderControlGeometryHost;
  readonly pageChrome: ReaderReadingPageChromeHost;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly bookmark: ReaderBookmarkInteractionHost;
  readonly auxiliary: ReaderAuxiliarySessionHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly mutation: ReaderReadingContentMutationHost;
  readonly brightness: ReaderBrightnessSession;
  readonly selectionPossible: () => boolean;
  readonly systemFontScale: () => number;
  readonly appScheme: () => string;
  readonly windowMetricsRevision: () => number;
  readonly readableTocCount: () => number;
  readonly currentReadablePosition: () => number;
  readonly currentChapter: () => number;
  readonly controlInputEnabled: () => boolean;
  readonly controlObscured: () => boolean;
  readonly chapterStartBookmarkEnabled: () => boolean;
  readonly bookmarkMessage: () => string;
  readonly bookmarkRecovery: () => ReadingDirectoryRecovery;
  readonly automaticState: () => Readonly<ReaderAutoPageState>;
  readonly automaticConfiguration: () => Readonly<ReaderAutoPageFullConfiguration>;
  readonly reducedMotion: () => boolean;
  readonly offlineOperationActive: () => boolean;
  readonly refreshEnabled: () => boolean;
}

/** Projects the accepted mounted session into the legacy Panel's native frame.
 * The stable directory provider is retained across the close transition. */
export function readerNativeControlFrame(input: ReaderNativeControlFrameInput): ReaderControlPanelFrame {
    const facts: ReaderControlPanelRenderFacts = {
      directSheetRedesign: true,
      fixedIsland: true,
      bodySelectionPossible: input.selectionPossible(),
      sessionFontScale: input.systemFontScale(),
      controlThemeStyle: readerControlThemeStyle(input.appScheme()),
      launchSample: input.overlay().sessionLaunch?.sample,
      launchGeneration: input.overlay().sessionLaunch?.generation ?? 0,
      launchSourceMinimum: input.auxiliary.sourceMinimum,
      launchSourceKind: input.overlay().sessionLaunch?.geometry.kind ?? 'quickAutoPage',
      launchBusinessStatus: input.auxiliary.sessionLaunchBusinessStatus(),
      launchDesiredPlaying: input.overlay().sessionLaunch?.desiredPlaying ?? true,
      launchStageOpacity: input.overlay().sessionLaunchStageOpacity,
      launchOwnsControls: input.overlay().sessionLaunch?.ownership === 'stage',
      launchRecovering: input.overlay().sessionLaunch?.ownership === 'handoffPending',
      launchInteractionEnabled: !input.projection().pageTurnInputOwned && input.overlay().sessionLaunch?.ownership === 'stage',
      launchSourceTtsState: input.auxiliary.sourceTtsState,
      launchSourceAutoStatus: input.auxiliary.sourceAutoStatus,
      launchCountdown: input.automaticState().remainingSeconds,
      recoveryAvailable: input.recovery.hasContent(),
      recoveryIdentity: input.recovery.overlayId(),
      bookTitle: input.route().bookTitle,
      chapterTitle: input.chrome().chapterTitle,
      sourceId: input.route().sourceId,
      sourceName: input.route().sourceName,
      progressPercent: input.pageChrome.controlProgress(),
      totalChapters: input.mount.entryCatalogNavigation?.readableChapterCount ?? input.readableTocCount(),
      readableChapterPosition: input.currentReadablePosition(),
      pageBookmarkStatus: input.bookmark.controlStatus(input.projection().bookmarkPresentationRevision + input.projection().pageTurnRenderRevision),
      pageBookmarkEnabled: input.bookmark.controlEnabled(input.projection().bookmarkPresentationRevision + input.projection().pageTurnRenderRevision),
      layout: input.geometry.layout(input.windowMetricsRevision()),
      presentationReceipt: input.chrome().controlPresentationReceipt,
      preparedMinimumRequired: true,
      minimumIdentity: input.geometry.identity(),
      minimumCommittedIdentity: input.geometry.committedIdentity(),
      minimumRequestLocation: input.geometry.requestLocation(),
      minimumOwnerKey: input.geometry.ownerKey(),
      minimumEnvironmentKey: input.geometry.environmentKey(),
      minimumKey: input.geometry.layout(input.windowMetricsRevision()).minimumKey,
      minimumReady: input.chrome().controlMinimumReady,
      minimumMetricsRevision: ReaderWindowCoordinator.metrics().revision,
      inputEnabled: input.controlInputEnabled() && input.auxiliary.sessionLaunchAllowsControlInput(),
      controlObscured: input.controlObscured(),
      controlOpenRevision: input.chrome().controlOpenRevision,
      dismissTemporaryRevision: input.chrome().dismissControlTemporaryRevision,
      retireTemporaryRevision: input.chrome().retireControlTemporaryRevision,
      temporaryLayerKind: input.chrome().controlTemporaryLayerPresented,
      directoryEntriesRevision: input.directory.publishDirectory(readerControlHostVisible(input.chrome().controlSession)),
      catalogComplete: !input.mount.entryCatalogPending,
      catalogLoading: input.session().entryCatalogLoading,
      catalogLoadFailed: input.session().entryCatalogLoadFailed,
      catalogChapterCount: input.mount.entryCatalogNavigation?.chapterCount ?? input.chrome().tocEntries.length,
      catalogCurrentPosition: input.directory.catalogPosition(),
      currentChapterIndex: input.currentChapter(),
      chapterStartBookmarkCreationEnabled: input.chapterStartBookmarkEnabled(),
      chapterDownloadEnabled: input.route().sourceId !== 'local',
      bookmarkLoadFailed: input.chrome().controlBookmarkLoadFailed,
      bookmarkLoadMessage: input.bookmarkMessage(),
      bookmarkRecovery: input.bookmarkRecovery(),
      searchQuery: input.chrome().quickSearchQuery,
      searchRevision: input.chrome().quickSearchRevision,
      brightnessPercent: input.chrome().brightnessPercent,
      brightnessAutomatic: input.brightness.automatic(),
      brightnessRevision: input.chrome().brightnessRevision,
      autoPageStatus: input.automaticState().status,
      autoPageSpeedSeconds: input.automaticState().speedSeconds,
      autoPageTimerMinutes: input.automaticConfiguration().timerMinutes,
      autoPageTimerSeconds: input.automaticConfiguration().timerSeconds,
      autoPageTimerSummaryText: formatReaderAutoPageFullTimerSummary(input.automaticConfiguration()),
      autoPageFollowHighlight: input.automaticConfiguration().followHighlight,
      controlReplaceState: input.chrome().controlReplaceState,
      ttsConfigurationRecovery: input.overlay().ttsConfigurationRecovery,
      ttsConfigurationLoading: input.overlay().ttsConfigurationLoading,
      ttsConfigurationLoadFailed: input.overlay().ttsConfigurationLoadFailed,
      appearanceSnapshot: input.chrome().appearanceSnapshot,
      chineseConversionMode: input.chrome().chineseConversionMode,
      settingsSnapshot: input.chrome().readerSettingsSnapshot,
      widePageLayout: input.chrome().readerSettingsSnapshot.widePageLayout ?? 'spread',
      pageTurnSimulationAvailable: !input.projection().bookTurnRuntimeFailed,
      ttsState: input.session().ttsState,
      ttsTimerMode: input.session().ttsTimerMode,
      ttsTimerMinutes: input.session().ttsTimerMinutes,
      ttsTimerSeconds: input.session().ttsTimerSeconds,
      ttsFollowHighlight: input.session().ttsFollowHighlight,
      ttsPauseOnInterruption: input.session().ttsPauseOnInterruption,
      ttsAllowMixing: input.session().ttsAllowMixing,
      ttsBackgroundPlayback: input.session().ttsBackgroundPlayback,
      ttsKeepScreenOn: input.session().ttsKeepScreenOn,
      ttsFailurePolicy: input.session().ttsFailurePolicy,
      ttsEngine: input.session().ttsEngine,
      ttsHttpEngines: input.session().ttsHttpEngines,
      ttsVoiceOptions: input.session().ttsVoiceOptions,
      ttsLanguage: input.session().ttsLanguage,
      ttsPerson: input.session().ttsPerson,
      reduceMotion: input.reducedMotion(),
      sourceBookId: input.route().bookId,
      bookDownloadEnabled: input.route().sourceId !== 'local' && (input.mount.entryCatalogNavigation?.readableChapterCount ?? input.route().chapterCount) > 0 && !input.offlineOperationActive(),
      bookDownloadActive: input.offlineOperationActive(),
      chapterRefreshEnabled: input.refreshEnabled(),
      chineseConversionIdentity: input.mutation.chineseConversionIdentity(),
    };
    return new ReaderControlPanelFrame(facts);
  }
