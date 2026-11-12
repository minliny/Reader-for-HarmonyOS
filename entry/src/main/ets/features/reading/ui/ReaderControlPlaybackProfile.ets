import type { ReaderControlCandidateWidths, ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderControlMotionBounds } from './ReaderControlMotionGeometry';
import type { ReaderTtsMinimumProfile } from './ReaderControlTtsMinimum';
import type { ReaderControlAutoPageMinimumProfile } from './ReaderControlAutoPageMinimum';
import type { ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';

/** Already measured, finite playback projections. No task or measurement port. */
export interface ReaderControlPlaybackProfileData {
  tts?: ReaderTtsMinimumProfile;
  autoPage?: ReaderControlAutoPageMinimumProfile;
  ttsPlaybackErrorHeight?: number;
}

export type ReaderControlPlaybackProfileReader = (key: string) => ReaderControlPlaybackProfileData | undefined;

/** One selected Native measurement result and its resolved source geometry. */
export interface ReaderControlPlaybackProfileReceipt {
  module: 'tts' | 'autoPage';
  identity: string;
  key: string;
  metricsRevision: number;
  widths: ReaderControlCandidateWidths;
  data: ReaderControlPlaybackProfileData;
  layout: ReaderControlLayoutSnapshot;
  bounds: ReaderControlMotionBounds;
  quickContentHeightVp: number;
  fullContentHeightVp: number;
}

export interface ReaderControlPlaybackLaunchProfile {
  generation: number;
  kind: ReaderSessionMorphSourceKind;
  requiresNaturalProfile: boolean;
  receipt: ReaderControlPlaybackProfileReceipt | undefined;
}

export function readerControlPlaybackSourceKindMatches(kind: ReaderSessionMorphSourceKind,
  module: 'tts' | 'autoPage'): boolean {
  return module === 'tts' ? kind === 'quickTts' || kind === 'fullTtsPlayback' :
    kind === 'quickAutoPage' || kind === 'fullAutoPagePlayback';
}

export function readerControlPlaybackProfileMatches(receipt: ReaderControlPlaybackProfileReceipt | undefined,
  module: 'tts' | 'autoPage', identity: string, key: string, metricsRevision: number): boolean {
  const budget = receipt?.bounds.contentBudget;
  if (receipt === undefined || budget === undefined || identity.length === 0 || key.length === 0 || receipt.module !== module ||
    receipt.identity !== identity || receipt.key !== key || receipt.metricsRevision !== metricsRevision ||
    !key.startsWith(`${identity}|`) || receipt.layout.minimumKey !== key || budget.key !== key ||
    receipt.widths.panelWidthVp !== receipt.layout.fullPanelWidth || receipt.bounds.width !== receipt.widths.panelWidthVp ||
    receipt.bounds.fullHeight !== receipt.layout.fullPanelHeight || receipt.bounds.quickHeight !== receipt.layout.quickPanelHeight ||
    receipt.bounds.bottomGap !== receipt.layout.dockBottomGap || receipt.bounds.quickHeight > receipt.bounds.fullHeight ||
    !Number.isFinite(receipt.quickContentHeightVp) || receipt.quickContentHeightVp < 0 ||
    !Number.isFinite(receipt.fullContentHeightVp) || receipt.fullContentHeightVp < 0 ||
    receipt.quickContentHeightVp !== budget.quickContentHeightVp || receipt.fullContentHeightVp !== budget.fullContentHeightVp ||
    (receipt.data.ttsPlaybackErrorHeight !== undefined && (!Number.isFinite(receipt.data.ttsPlaybackErrorHeight) ||
      receipt.data.ttsPlaybackErrorHeight < 0))) return false;
  return module === 'tts' ? receipt.data.tts !== undefined && receipt.data.tts.minimum.module === 'tts' &&
    receipt.data.autoPage === undefined : receipt.data.autoPage !== undefined &&
    receipt.data.autoPage.minimum.module === 'autoPage' && receipt.data.tts === undefined;
}
