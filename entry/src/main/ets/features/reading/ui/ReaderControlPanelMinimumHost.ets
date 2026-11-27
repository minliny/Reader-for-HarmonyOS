import type { UIContext } from '@ohos.arkui.UIContext';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { readerReadingTopBarHeight } from '../../../ui/chrome/ReaderReadingTopBar';
import { prepareReaderFontFamily, registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import {
  TYPE_READER_CONTROL_BOOK_TITLE, TYPE_READER_CONTROL_CHAPTER_SOURCE, TYPE_READER_CONTROL_SOURCE_ACTION,
  TYPE_READER_CONTROL_CHAPTER_TITLE, TYPE_READER_CONTROL_HEADER_UI, TYPE_READER_CONTROL_HEADER_INTER,
  TYPE_READER_CONTROL_COLLAPSE_UI, TYPE_READER_CONTROL_COLLAPSE_INTER,
  TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL, TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL,
  TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL,
} from '../../../ui/foundation/ReaderTypography';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import { readerControlAppearanceMinimumFacts } from './ReaderControlAppearanceMinimum';
import { readerControlAutoPageMinimumFacts } from './ReaderControlAutoPageMinimum';
import { readerControlDirectoryMinimumFacts } from './ReaderControlDirectoryMinimum';
import { readerControlDirectorySnapshot } from './ReaderControlDirectoryModel';
import {
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT,
  READER_CONTROL_HOME_PROGRESS_ROW_HEIGHT, READER_CONTROL_HOME_QUICK_ACTION_HEIGHT,
  READER_CONTROL_HOME_SECTION_GAP, READER_CONTROL_TOP_BAR_HEIGHT,
} from './ReaderControlGeometry';
import { readerControlHeaderRole, readerControlHeaderTitle } from './ReaderControlHeaderGeometry';
import { readerControlIsDirectSheet } from './ReaderControlHostSession';
import {
  measureReaderControlMinimum, readerControlModuleFactsDisplayEqual, readerControlModuleFactsGeometryKey,
  type ReaderControlHomeFormProfile, type ReaderControlMeasuredProfile, type ReaderControlMeasuredProfileReader,
  type ReaderControlModuleFacts, type ReaderControlPreparedModuleProfile, type ReaderControlPresentationReceipt,
} from './ReaderControlMinimumMeasurement';
import { readerControlMotionBounds } from './ReaderControlMotionGeometry';
import type { ReaderControlIntent, ReaderControlIntentResult, ReaderControlPanelFacts } from './ReaderControlPanelNativeContract';
import { readerControlPlaybackProfileMatches, type ReaderControlPlaybackProfileData,
  type ReaderControlPlaybackProfileReader, type ReaderControlPlaybackProfileReceipt } from './ReaderControlPlaybackProfile';
import { readerControlReplaceMinimumFacts } from './ReaderControlReplaceMinimum';
import { readerControlSearchMinimumFacts } from './ReaderControlSearchMinimum';
import { readerControlContentLocation, type ReaderControlLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import { readerControlSettingsMinimumFacts } from './ReaderControlSettingsMinimum';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { readerControlTtsMinimumFacts } from './ReaderControlTtsMinimum';
import {
  READER_FULL_PANEL_TOP, type ReaderControlLayoutSnapshot, type ReaderControlCandidateMinimum,
  type ReaderControlCandidateWidths, type ReaderControlContentModule, type ReaderControlModuleMeasurer,
} from './ReaderLayoutGeometry';

export interface ReaderControlPanelMinimumView {
  readonly facts: () => ReaderControlPanelFacts;
  readonly uiContext: () => UIContext;
  readonly mounted: () => boolean;
  readonly mountGeneration: () => number;
  readonly semanticSession: () => ReaderControlSessionState;
  readonly contentLocation: () => ReaderControlLocation;
  readonly currentDirectoryEntries: () => LocalReadingTocEntry[];
  readonly directSheetClosing: () => boolean;
  readonly contentMotionProgress: () => number;
  readonly bookmarkPillHeight: () => number;
  readonly currentOwnerScope: () => string;
  readonly captureControlGuard: () => () => boolean;
  readonly onIntent: (intent: ReaderControlIntent) => ReaderControlIntentResult;
  readonly admitVisibleLocation: (location: ReaderControlLocation) => void;
  readonly layoutChanged: () => void;
  readonly retireTemporaryInput: () => void;
  readonly brightnessDragInvalid: () => boolean;
  readonly cancelBrightnessDrag: () => void;
  readonly syncProgressInput: () => void;
  readonly refreshLaunchSample: () => void;
  readonly confirmLaunchSourceReady: () => void;
}

/** Keeps a measured minimum with the mounted module, owner and font/metrics
 * generation that admitted it. The panel continues to own native motion and
 * the lexical control session. */
export class ReaderControlPanelMinimumHost {
  private readonly view: ReaderControlPanelMinimumView;
  private moduleMinimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private moduleMinimumProfileReader: ReaderControlPlaybackProfileReader | undefined = undefined;
  private moduleMinimumIdentity: string = '';
  private moduleMinimumModule: string = '';
  private minimumFontsReady: boolean = false;
  private readonly minimumProfiles: Map<string, ReaderControlMeasuredProfile> = new Map();
  private minimumProfileTicket: string = '';
  private minimumFactsSignature: string = '';
  private adoptedPresentationGeometry: string = '';
  private minimumOwnerFactsSignature: string = '';
  private minimumOwnerFacts: ReaderControlModuleFacts | undefined = undefined;
  private publishedMinimumFacts: ReaderControlModuleFacts | undefined = undefined;
  private localMinimumFacts: ReaderControlModuleFacts | undefined = undefined;
  private preparedInputSource: ReaderControlPreparedModuleProfile | undefined = undefined;
  private preparedInputScope: string = '';
  private preparedInputProfile: ReaderControlPreparedModuleProfile | undefined = undefined;
  private directoryMinimumFactsCache: ReaderControlModuleFacts | undefined = undefined;
  private directoryMinimumEntries: LocalReadingTocEntry[] | undefined = undefined;
  private directoryMinimumBook: ReaderBookIdentity | undefined = undefined;
  private directoryMinimumInputs: string = '';
  private directSheetReceipt: ReaderControlPresentationReceipt | undefined = undefined;
  private diagnosticMinimumIdentity: string = '';
  private diagnosticMinimumModule: string = '';
  private diagnosticMinimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private diagnosticBindGeneration: number = 0;
  private diagnosticReadyEvents: number = 0;
  private readonly minimumProfileReader: ReaderControlMeasuredProfileReader =
    (key: string): ReaderControlMeasuredProfile | undefined => this.minimumProfiles.get(key);

  constructor(view: ReaderControlPanelMinimumView) { this.view = view; }

  registerFonts(): void {
    registerReaderFonts(this.view.uiContext().getFont());
  }

  prepareFonts(): void {
    const lifecycle = this.view.mountGeneration();
    const families: string[] = [TYPE_READER_CONTROL_BOOK_TITLE.fontFamily,
      TYPE_READER_CONTROL_CHAPTER_SOURCE.fontFamily, TYPE_READER_CONTROL_SOURCE_ACTION.fontFamily,
      TYPE_READER_CONTROL_CHAPTER_TITLE.fontFamily,
      TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL.fontFamily,
      TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontFamily,
      TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL.fontFamily,
      TYPE_READER_CONTROL_HEADER_UI.fontFamily, TYPE_READER_CONTROL_HEADER_INTER.fontFamily,
      TYPE_READER_CONTROL_COLLAPSE_UI.fontFamily, TYPE_READER_CONTROL_COLLAPSE_INTER.fontFamily];
    void Promise.all(families.map((family: string): Promise<void> => prepareReaderFontFamily(family)))
      .then((): void => {
        if (!this.view.mounted() || lifecycle !== this.view.mountGeneration()) return;
        this.minimumFontsReady = true;
        this.publishMinimumMeasurer();
      }).catch((): void => {});
  }

  retireFontsAndMeasurers(): void {
    this.view.onIntent({ kind: 'minimumMeasurerReady', identity: this.view.facts().geometry.minimum.identity, measurer: undefined });
    this.minimumFontsReady = false;
    this.minimumProfiles.clear();
  }

  retireDirectSheetReceipt(): void { this.directSheetReceipt = undefined; }

  private minimumModule(): ReaderControlContentModule {
    const location = this.view.facts().geometry.minimum.preparedRequired ? this.view.facts().geometry.minimum.requestLocation ?? readerControlContentLocation(this.view.semanticSession()) : this.view.contentLocation();
    return location.level === 'secondary' ? location.module : 'home';
  }

  private minimumHeaderInter(module: ReaderControlContentModule): boolean {
    return readerControlHeaderRole(module) === 'plainInter';
  }

  private minimumTitle(module: ReaderControlContentModule, tab: string): string {
    return readerControlHeaderTitle(module, tab);
  }

  private defaultMinimumFacts(): ReaderControlModuleFacts {
    const module = this.minimumModule();
    const location = this.view.facts().geometry.minimum.requestLocation ?? readerControlContentLocation(this.view.semanticSession());
    if (module === 'directory') {
      const inputs = JSON.stringify([this.view.facts().geometry.minimum.identity, location.directoryTab, this.view.facts().document.chapterIndex,
        this.view.facts().document.catalog.complete, this.view.facts().document.catalog.chapterCount, this.view.facts().document.catalog.loading, this.view.facts().document.catalog.loadFailed,
        this.view.facts().document.catalog.position, this.view.facts().document.totalChapters, this.view.facts().document.readableChapterPosition, this.view.facts().document.search.manga,
        this.view.facts().document.bookmarks.loadFailed, this.view.facts().document.bookmarks.message]);
      if (this.directoryMinimumFactsCache !== undefined && this.directoryMinimumEntries === this.view.currentDirectoryEntries() &&
        this.directoryMinimumBook === this.view.facts().document.bookmarks.book && this.directoryMinimumInputs === inputs) {
        return this.directoryMinimumFactsCache;
      }
      const snapshot = readerControlDirectorySnapshot(this.view.currentDirectoryEntries(), location.directoryTab, '', true,
        this.view.facts().document.chapterIndex, this.view.facts().document.bookmarks.book, { complete: this.view.facts().document.catalog.complete,
          chapterCount: this.view.facts().document.catalog.chapterCount, loading: this.view.facts().document.catalog.loading, loadFailed: this.view.facts().document.catalog.loadFailed,
          currentPosition: this.view.facts().document.catalog.position, readableChapterCount: this.view.facts().document.totalChapters,
          readablePosition: this.view.facts().document.readableChapterPosition }, this.view.facts().document.search.manga);
      const facts: ReaderControlModuleFacts = { module: module, directory: readerControlDirectoryMinimumFacts({ snapshot: snapshot,
        tab: location.directoryTab, catalogComplete: this.view.facts().document.catalog.complete,
        bookmarkLoadFailed: this.view.facts().document.bookmarks.loadFailed, bookmarkLoadMessage: this.view.facts().document.bookmarks.message }) };
      this.directoryMinimumEntries = this.view.currentDirectoryEntries();
      this.directoryMinimumBook = this.view.facts().document.bookmarks.book;
      this.directoryMinimumInputs = inputs;
      this.directoryMinimumFactsCache = facts;
      return facts;
    }
    if (module === 'search') {
      const state = this.view.facts().document.search.publication.stateAt(this.view.facts().document.search.revision);
      return { module: module, search: readerControlSearchMinimumFacts({ query: this.view.facts().document.search.query, state: state,
        onlineBook: this.view.facts().document.source.id !== 'local' && (this.view.facts().document.source.id?.length ?? 0) > 0,
        resultScope: this.view.facts().document.search.publication.resultScrollScopeFor(state), retainedLoadMoreFailure: false }) };
    }
    if (module === 'settings') return { module: module, settings: readerControlSettingsMinimumFacts() };
    if (module === 'appearance') return { module: module, appearance: readerControlAppearanceMinimumFacts({
      snapshot: this.view.facts().preferences.appearance, chineseConversionMode: this.view.facts().preferences.conversion.mode }) };
    if (module === 'tts') return { module: module, tts: readerControlTtsMinimumFacts({ state: this.view.facts().playback.speech.state,
      timerMode: this.view.facts().playback.speech.timerMode, timerMinutes: this.view.facts().playback.speech.timerMinutes, timerSeconds: this.view.facts().playback.speech.timerSeconds,
      failurePolicy: this.view.facts().playback.speech.failurePolicy, allowMixing: this.view.facts().playback.speech.allowMixing, engine: this.view.facts().playback.speech.engine,
      httpEngines: this.view.facts().playback.speech.httpEngines, voiceOptions: this.view.facts().playback.speech.voiceOptions, language: this.view.facts().playback.speech.language,
      person: this.view.facts().playback.speech.person, ratePreview: -1, serviceTab: '' }) };
    if (module === 'autoPage') return { module: module, autoPage: readerControlAutoPageMinimumFacts({
      status: this.view.facts().playback.automatic.status, timerSummary: this.view.facts().playback.automatic.timerSummary }) };
    if (module === 'replace') return { module: module, replace: readerControlReplaceMinimumFacts({
      state: this.view.facts().document.replace, localError: '', layer: '', temporaryTitle: '', full: location.form === 'full' }) };
    return { module: 'home', home: { chapterTitle: this.view.facts().document.chapterTitle, totalChapters: this.view.facts().document.totalChapters } };
  }

  presentedHomeChapterTitle(): string {
    return this.view.facts().geometry.minimum.preparedRequired ? this.view.facts().geometry.minimum.receipt?.facts?.home?.chapterTitle ?? '' : this.view.facts().document.chapterTitle;
  }

  presentedHomeTotalChapters(): number {
    return this.view.facts().geometry.minimum.preparedRequired ? this.view.facts().geometry.minimum.receipt?.facts?.home?.totalChapters ?? 0 : this.view.facts().document.totalChapters;
  }

  currentLayout(): ReaderControlLayoutSnapshot {
    const receipt = this.paintedPresentationReceipt();
    return this.view.facts().geometry.minimum.preparedRequired && receipt !== undefined && receipt.ownerKey === this.view.facts().geometry.minimum.ownerKey ? receipt.layout : this.view.facts().geometry.layout;
  }

  private paintedPresentationReceipt(): ReaderControlPresentationReceipt | undefined {
    return this.view.directSheetClosing() ? this.directSheetReceipt ?? this.view.facts().geometry.minimum.receipt : this.view.facts().geometry.minimum.receipt;
  }

  currentMinimumKey(): string {
    return this.view.facts().geometry.minimum.preparedRequired ? this.paintedPresentationReceipt()?.key ?? '' : this.view.facts().geometry.minimum.key;
  }

  currentMinimumIdentity(): string {
    return this.view.facts().geometry.minimum.preparedRequired ? this.paintedPresentationReceipt()?.identity ?? '' : this.view.facts().geometry.minimum.identity;
  }

  committedMinimumIdentity(): string {
    return this.view.facts().geometry.minimum.committedIdentity || this.view.facts().geometry.minimum.identity;
  }

  preparedMinimum(): ReaderControlPreparedModuleProfile | undefined {
    const prepared = this.minimumPresentationAvailable() ? this.paintedPresentationReceipt()?.prepared : undefined;
    if (prepared === undefined) return undefined;
    const scope = `${this.view.facts().geometry.minimum.ownerKey}|${this.currentMinimumIdentity()}|${this.view.currentOwnerScope()}`;
    if (this.preparedInputSource !== prepared || this.preparedInputScope !== scope || this.preparedInputProfile === undefined) {
      this.preparedInputSource = prepared;
      this.preparedInputScope = scope;
      this.preparedInputProfile = { identity: prepared.identity, key: prepared.key, moduleData: prepared.moduleData,
        facts: prepared.facts, ownerCurrent: this.view.captureControlGuard() };
    }
    return this.preparedInputProfile;
  }

  minimumPresentationAvailable(): boolean {
    if (!this.view.facts().geometry.minimum.preparedRequired) return true;
    const receipt = this.paintedPresentationReceipt();
    return receipt !== undefined && receipt.ownerKey === this.view.facts().geometry.minimum.ownerKey &&
      receipt.key === receipt.layout.minimumKey &&
      receipt.profile.identity === receipt.identity && (receipt.profile.module === 'home' ||
        (receipt.prepared !== undefined && receipt.prepared.identity === receipt.identity && receipt.prepared.key === receipt.key));
  }

  onPresentationReceiptChanged(): void {
    if (!this.minimumPresentationAvailable()) return;
    const receipt = this.view.facts().geometry.minimum.receipt;
    if (receipt === undefined || receipt.identity !== this.committedMinimumIdentity() || receipt.environmentKey !== this.view.facts().geometry.minimum.environmentKey) return;
    const location = receipt.location;
    const previous = this.view.contentLocation();
    if (this.view.facts().geometry.directSheet && location.level === 'secondary' && readerControlIsDirectSheet(location.module)) {
      this.directSheetReceipt = receipt;
    }
    if (this.view.facts().geometry.directSheet && location.level === 'home' && previous.level === 'secondary' &&
      readerControlIsDirectSheet(previous.module)) {
      if (this.view.directSheetClosing()) return;
      const transition = this.view.semanticSession().transition;
      if (transition?.fromLocation.level === 'secondary' && transition.toLocation.level === 'home') return;
    }
    if (location.level !== 'hidden' && (location.level !== previous.level || location.module !== previous.module ||
      location.directoryTab !== previous.directoryTab)) {
      this.view.admitVisibleLocation({ level: location.level, module: location.module,
        directoryTab: location.directoryTab, form: location.form });
    }
    const geometry = `${receipt.identity}|${receipt.environmentKey}|${receipt.key}`;
    if (geometry !== this.adoptedPresentationGeometry) {
      this.adoptedPresentationGeometry = geometry;
      this.view.layoutChanged();
    } else this.publishSelectedPlaybackProfile();
  }

  onMinimumFactsPropsChanged(): void {
    this.publishMinimumMeasurer();
  }

  onCommittedMinimumIdentityChanged(): void {
    this.view.retireTemporaryInput();
    if (this.view.mounted()) this.view.onIntent({ kind: 'temporaryLayerChange', active: false });
    this.onPresentationReceiptChanged();
  }

  onModuleMinimumFactsChanged(identity: string, facts: ReaderControlModuleFacts): void {
    if (!this.view.mounted() || identity !== this.view.facts().geometry.minimum.identity || facts.module !== this.minimumModule()) return;
    const defaults = this.defaultMinimumFacts();
    this.minimumOwnerFactsSignature = readerControlModuleFactsGeometryKey(defaults);
    this.minimumOwnerFacts = defaults;
    this.localMinimumFacts = facts;
    this.publishMinimumMeasurer();
  }

  onMinimumIdentityChanged(): void {
    if (this.moduleMinimumIdentity !== this.view.facts().geometry.minimum.identity) {
      this.moduleMinimumMeasurer = undefined;
      this.localMinimumFacts = undefined;
      this.minimumOwnerFactsSignature = '';
      this.minimumOwnerFacts = undefined;
      this.publishedMinimumFacts = undefined;
      this.minimumFactsSignature = '';
    }
    this.publishMinimumMeasurer();
  }

  onMinimumMetricsChanged(): void {
    this.publishMinimumMeasurer();
    this.publishSelectedPlaybackProfile();
    this.view.refreshLaunchSample();
    this.view.confirmLaunchSourceReady();
  }

  minimumInputReady(): boolean {
    if (this.view.facts().geometry.minimum.preparedRequired) {
      const receipt = this.view.facts().geometry.minimum.receipt;
      const budget = receipt?.layout.contentBudget;
      const viewport = this.view.contentMotionProgress() === 1 ? budget?.fullContentHeightVp : budget?.quickContentHeightVp;
      return this.minimumPresentationAvailable() && receipt !== undefined && receipt.identity === this.committedMinimumIdentity() &&
        receipt.environmentKey === this.view.facts().geometry.minimum.environmentKey &&
        ((this.view.onIntent({ kind: 'minimumReceiptCurrent', key: receipt.key }) as boolean | undefined) ?? false) && viewport !== undefined && Number.isFinite(viewport) && viewport > 0;
    }
    const ready = this.view.facts().geometry.minimum.identity.length === 0 ||
      (this.view.facts().geometry.minimum.ready && this.view.facts().geometry.minimum.key.startsWith(`${this.view.facts().geometry.minimum.identity}|`) &&
        ((this.view.onIntent({ kind: 'minimumReceiptCurrent', key: this.view.facts().geometry.minimum.key }) as boolean | undefined) ?? true));
    const budget = this.currentLayout().contentBudget;
    const viewport = this.view.contentMotionProgress() === 1 ? budget?.fullContentHeightVp : budget?.quickContentHeightVp;
    return ready && (viewport === undefined || Number.isFinite(viewport) && viewport > 0);
  }

  onMinimumAvailabilityChanged(): void {
    if (DEBUG && this.diagnosticReadyEvents < 32) {
      this.diagnosticReadyEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=ready-changed ready=%{public}s prefix=%{public}s effective=%{public}s input=%{public}s obscured=%{public}s',
        String(this.view.facts().geometry.minimum.ready), String(this.view.facts().geometry.minimum.key.startsWith(`${this.view.facts().geometry.minimum.identity}|`)),
        String(this.minimumInputReady()), String(this.view.facts().geometry.inputEnabled), String(this.view.facts().geometry.obscured));
    }
    if (!this.minimumInputReady() || this.view.brightnessDragInvalid()) this.view.cancelBrightnessDrag();
    this.view.syncProgressInput();
    this.publishSelectedPlaybackProfile();
  }

  bindModuleMinimum(module: ReaderControlContentModule, identity: string,
    measurer: ReaderControlModuleMeasurer | undefined, profileReader?: ReaderControlPlaybackProfileReader): void {
    if (this.view.facts().geometry.minimum.preparedRequired) return;
    if (DEBUG && this.diagnosticBindGeneration < 32 && (identity !== this.diagnosticMinimumIdentity || module !== this.diagnosticMinimumModule ||
      measurer !== this.diagnosticMinimumMeasurer)) {
      this.diagnosticMinimumIdentity = identity;
      this.diagnosticMinimumModule = module;
      this.diagnosticMinimumMeasurer = measurer;
      this.diagnosticBindGeneration += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=module-bind generation=%{public}d mounted=%{public}s identityMatch=%{public}s moduleMatch=%{public}s hasDelegate=%{public}s',
        this.diagnosticBindGeneration, String(this.view.mounted()), String(identity === this.view.facts().geometry.minimum.identity),
        String(module === this.minimumModule()), String(measurer !== undefined));
    }
    if (!this.view.mounted() || identity !== this.view.facts().geometry.minimum.identity || module !== this.minimumModule()) return;
    this.moduleMinimumMeasurer = measurer;
    this.moduleMinimumProfileReader = profileReader;
    this.moduleMinimumIdentity = identity;
    this.moduleMinimumModule = module;
    this.publishMinimumMeasurer();
  }

  publishMinimumMeasurer(): void {
    if (!this.view.mounted() || !this.minimumFontsReady || this.view.facts().geometry.minimum.identity.length === 0) return;
    const identity = this.view.facts().geometry.minimum.identity;
    const module = this.minimumModule();
    if (this.view.facts().geometry.minimum.preparedRequired) {
      const defaults = this.defaultMinimumFacts();
      const ownerSignature = readerControlModuleFactsGeometryKey(defaults);
      if (ownerSignature !== this.minimumOwnerFactsSignature || !readerControlModuleFactsDisplayEqual(defaults, this.minimumOwnerFacts)) {
        this.localMinimumFacts = undefined;
        this.minimumOwnerFactsSignature = ownerSignature;
        this.minimumOwnerFacts = defaults;
      }
      const facts = this.localMinimumFacts ?? defaults;
      const signature = JSON.stringify([identity, this.view.facts().geometry.minimum.environmentKey, this.view.facts().document.chapterTitle, this.view.facts().document.totalChapters,
        readerControlModuleFactsGeometryKey(facts)]);
      if (signature === this.minimumFactsSignature && readerControlModuleFactsDisplayEqual(facts, this.publishedMinimumFacts)) return;
      this.minimumFactsSignature = signature;
      this.publishedMinimumFacts = facts;
      this.moduleMinimumIdentity = identity;
      this.moduleMinimumModule = module;
      this.view.onIntent({ kind: 'minimumMeasurerReady', identity, measurer: (widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum | undefined => {
          if (!this.view.mounted() || identity !== this.view.facts().geometry.minimum.identity || signature !== this.minimumFactsSignature ||
            facts !== this.publishedMinimumFacts ||
            module !== this.minimumModule()) return undefined;
          return this.measureControlMinimum(module, widths, key, undefined, undefined, facts);
        }, profileReader: this.minimumProfileReader, facts, factsGeometryKey: signature });
      return;
    }
    const delegate = this.moduleMinimumIdentity === identity && this.moduleMinimumModule === module ?
      this.moduleMinimumMeasurer : undefined;
    const profileReader = this.moduleMinimumIdentity === identity && this.moduleMinimumModule === module ?
      this.moduleMinimumProfileReader : undefined;
    if (module !== 'home' && delegate === undefined) {
      this.view.onIntent({ kind: 'minimumMeasurerReady', identity, measurer: undefined });
      return;
    }
    this.view.onIntent({ kind: 'minimumMeasurerReady', identity, measurer: (widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum | undefined => {
        if (!this.view.mounted() || identity !== this.view.facts().geometry.minimum.identity || module !== this.minimumModule()) return undefined;
        return this.measureControlMinimum(module, widths, key, delegate, profileReader);
      } });
  }

  private measureHomeForm(width: number): ReaderControlHomeFormProfile | undefined {
    const context = this.view.uiContext();
    const title = measureReaderControlText(context, this.view.facts().document.chapterTitle,
      TYPE_READER_CONTROL_CHAPTER_TITLE, Math.max(1, width - 106));
    const percent = measureReaderControlText(context, '100%',
      TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL, Math.max(1, width));
    const actionWidth = Math.max(1, (width - 18 - TOK_BORDER_W * 2 - 16) / 3);
    let actionLabelHeight = 13;
    for (const label of ['目录', '搜索', '替换']) {
      const extent = measureReaderControlText(context, label,
        TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL, actionWidth, 'wrap');
      if (extent === undefined) return undefined;
      actionLabelHeight = Math.max(actionLabelHeight, extent.heightVp);
    }
    if (title === undefined || percent === undefined) return undefined;
    const titleHeight = Math.max(34, title.heightVp);
    const chapterHeight = Math.max(54, READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT, titleHeight + 18.563);
    const progressHeight = Math.max(50, READER_CONTROL_HOME_PROGRESS_ROW_HEIGHT, percent.heightVp + 6);
    const actionHeight = READER_CONTROL_HOME_QUICK_ACTION_HEIGHT + actionLabelHeight - 13;
    const percentWidth = Math.max(26.23, percent.singleLineWidthVp);
    const minWidth = Math.max(106, percentWidth + 22 + 18, 24 * 3 + 16 + 18 + TOK_BORDER_W * 2);
    const profile: ReaderControlHomeFormProfile = { chapterTitleHeight: titleHeight,
      chapterRowHeight: chapterHeight, progressHeight: progressHeight, percentWidth: percentWidth,
      actionLabelHeight: actionLabelHeight, actionHeight: actionHeight,
      minimumHeight: Math.max(READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
        Math.max(36, titleHeight) + Math.max(44, this.view.bookmarkPillHeight() + 4, actionLabelHeight + 16) +
        Math.max(36, progressHeight - 14) + TOK_BORDER_W * 2) +
        actionHeight + READER_CONTROL_HOME_SECTION_GAP,
      minWidth: minWidth, fits: width >= minWidth };
    return profile;
  }

  private measureControlMinimum(module: ReaderControlContentModule, widths: ReaderControlCandidateWidths,
    key: string, delegate: ReaderControlModuleMeasurer | undefined,
    profileReader?: ReaderControlPlaybackProfileReader, facts?: ReaderControlModuleFacts): ReaderControlCandidateMinimum | undefined {
    const topBarHeight = readerReadingTopBarHeight(this.view.uiContext(), 'reading', READER_CONTROL_TOP_BAR_HEIGHT);
    const availableWithTopBar = this.view.facts().geometry.layout.fullPanelHeight + this.view.facts().geometry.layout.fullPanelTop -
      Math.max(READER_FULL_PANEL_TOP, this.view.facts().geometry.layout.topBarTop + topBarHeight + 8);
    const location = this.view.facts().geometry.minimum.preparedRequired ? this.view.facts().geometry.minimum.requestLocation ?? readerControlContentLocation(this.view.semanticSession()) : this.view.contentLocation();
    const measured = measureReaderControlMinimum({ context: this.view.uiContext(), headerInter: this.minimumHeaderInter(module),
      title: this.minimumTitle(module, location.directoryTab), identity: this.view.facts().geometry.minimum.identity, metricsRevision: this.view.facts().geometry.minimum.metricsRevision,
      topBarHeightVp: topBarHeight, availableWithTopBarHeightVp: availableWithTopBar,
      moduleFacts: facts, preparedMinimumRequired: this.view.facts().geometry.minimum.preparedRequired,
      measureHomeForm: (width: number): ReaderControlHomeFormProfile | undefined => this.measureHomeForm(width) },
      module, widths, key, delegate, profileReader);
    if (measured === undefined) return undefined;
    const ticket = key.slice(0, key.lastIndexOf('|'));
    if (ticket !== this.minimumProfileTicket) {
      const selectedKey = this.currentMinimumKey();
      const selected = this.minimumProfiles.get(selectedKey);
      this.minimumProfiles.clear();
      if (selected !== undefined) this.minimumProfiles.set(selectedKey, selected);
      this.minimumProfileTicket = ticket;
    }
    this.minimumProfiles.set(key, measured.profile);
    return measured.candidate;
  }

  selectedMinimumProfile(): ReaderControlMeasuredProfile | undefined {
    if (this.view.facts().geometry.minimum.preparedRequired) return this.minimumPresentationAvailable() ? this.view.facts().geometry.minimum.receipt?.profile : undefined;
    return this.view.facts().geometry.minimum.key.length > 0 ? this.minimumProfiles.get(this.view.facts().geometry.minimum.key) : undefined;
  }

  publishSelectedPlaybackProfile(): void {
    const profile = this.selectedMinimumProfile();
    const module = this.view.facts().geometry.minimum.preparedRequired ? profile?.module : this.minimumModule();
    const identity = this.view.facts().geometry.minimum.preparedRequired ? this.committedMinimumIdentity() : this.view.facts().geometry.minimum.identity;
    const key = this.currentMinimumKey();
    if (!this.view.mounted() || !this.view.facts().geometry.minimum.ready ||
      (module !== 'tts' && module !== 'autoPage') || profile === undefined || profile.playbackData === undefined ||
      profile.module !== module || profile.identity !== identity ||
      (this.view.facts().geometry.minimum.preparedRequired && (!this.minimumInputReady() || !this.minimumPresentationAvailable())) ||
      (!this.view.facts().geometry.minimum.preparedRequired && profile.metricsRevision !== this.view.facts().geometry.minimum.metricsRevision) || this.currentLayout().minimumKey !== key ||
      !key.startsWith(`${identity}|`) ||
      profile.widths.panelWidthVp !== this.currentLayout().fullPanelWidth) return;
    const facts = this.view.facts().geometry.minimum.receipt?.facts;
    const layout = this.currentLayout();
    const budget = layout.contentBudget;
    if (budget === undefined) return;
    const data: ReaderControlPlaybackProfileData = this.view.facts().geometry.minimum.preparedRequired ? {
      tts: profile.playbackData.tts, autoPage: profile.playbackData.autoPage,
      ttsPlaybackErrorHeight: profile.playbackData.ttsPlaybackErrorHeight,
      ttsFacts: facts?.tts, autoPageFacts: facts?.autoPage,
    } : profile.playbackData;
    const receipt: ReaderControlPlaybackProfileReceipt = { module: module, identity: profile.identity,
      key: key, metricsRevision: this.view.facts().geometry.minimum.metricsRevision, widths: profile.widths,
      data: data, layout: layout,
      // The prepared profile describes the measurement candidate. The
      // visible card and fixed island shell are captured separately at launch.
      bounds: readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight,
        layout.dockBottomGap, layout.quickPanelHeight, budget),
      quickContentHeightVp: budget.quickContentHeightVp, fullContentHeightVp: budget.fullContentHeightVp };
    if (readerControlPlaybackProfileMatches(receipt, module, identity,
      key, this.view.facts().geometry.minimum.metricsRevision)) this.view.onIntent({ kind: 'playbackProfileSelected', receipt });
  }
}
