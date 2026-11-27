import type { ReaderControlMeasuredProfileReader, ReaderControlModuleFacts, ReaderControlPresentationReceipt } from './ReaderControlMinimumMeasurement';
import type { ReaderControlPlaybackLaunchProfile, ReaderControlPlaybackProfileReceipt } from './ReaderControlPlaybackProfile';
import type { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import type { ReaderControlThemeStyle } from './ReaderControlThemeStyle';
import {
  ReaderControlFactDelivery, defaultReaderControlIntent,
  type ReaderControlGeometrySnapshot as GeometrySnapshot, type ReaderControlLaunchSnapshot as LaunchSnapshot,
  type ReaderControlLaunchSource as LaunchSource,
  type ReaderControlDocumentSnapshot as DocumentSnapshot, type ReaderControlPanelFacts as PanelFacts,
  type ReaderControlIntent as PanelIntent, type ReaderControlIntentHandler as PanelIntentHandler,
  type ReaderControlPreferencesSnapshot, type ReaderControlPlaybackSnapshot,
} from './ReaderControlPanelContract';

export { defaultReaderControlIntent };
export type { ReaderControlFactWatch, ReaderControlIntentResult, ReaderControlPreferencesSnapshot,
  ReaderControlPlaybackSnapshot } from './ReaderControlPanelContract';

export type ReaderControlGeometrySnapshot = GeometrySnapshot<ReaderControlPresentationReceipt, ReaderControlThemeStyle>;
export type ReaderControlLaunchSnapshot = LaunchSnapshot<ReaderControlPlaybackLaunchProfile>;
export type ReaderControlLaunchSource = LaunchSource<ReaderControlPlaybackProfileReceipt>;
export type ReaderControlDocumentSnapshot = DocumentSnapshot<ReaderContentSearchPublication>;
export type ReaderControlPanelFacts = PanelFacts<ReaderControlPresentationReceipt, ReaderControlThemeStyle,
  ReaderControlPlaybackLaunchProfile, ReaderContentSearchPublication>;
export type ReaderControlIntent = PanelIntent<ReaderControlMeasuredProfileReader, ReaderControlModuleFacts,
  ReaderControlPlaybackProfileReceipt>;
export type ReaderControlIntentHandler = PanelIntentHandler<ReaderControlMeasuredProfileReader, ReaderControlModuleFacts,
  ReaderControlPlaybackProfileReceipt>;
export type ReaderControlNativeFactDelivery = ReaderControlFactDelivery<ReaderControlPresentationReceipt,
  ReaderControlThemeStyle, ReaderControlPlaybackLaunchProfile, ReaderContentSearchPublication>;

export function createReaderControlFactDelivery(): ReaderControlNativeFactDelivery {
  return new ReaderControlFactDelivery<ReaderControlPresentationReceipt, ReaderControlThemeStyle,
    ReaderControlPlaybackLaunchProfile, ReaderContentSearchPublication>();
}

/** Associates the pure control facts with one native ArkUI publication. */
@Observed
export class ReaderControlPanelFrame implements ReaderControlPanelFacts {
  @Track readonly geometry: ReaderControlGeometrySnapshot;
  @Track readonly launch: ReaderControlLaunchSnapshot;
  @Track readonly document: ReaderControlDocumentSnapshot;
  @Track readonly preferences: ReaderControlPreferencesSnapshot;
  @Track readonly playback: ReaderControlPlaybackSnapshot;

  constructor(facts: ReaderControlPanelFacts) {
    this.geometry = facts.geometry;
    this.launch = facts.launch;
    this.document = facts.document;
    this.preferences = facts.preferences;
    this.playback = facts.playback;
  }
}
