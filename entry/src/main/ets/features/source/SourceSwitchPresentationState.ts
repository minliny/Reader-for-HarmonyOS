import type { SourceSwitchCandidate } from './SourceSwitchGateway';

/**
 * SourceSwitch overlay window state (Window State 7态, SS-SOURCE-SWITCH-01).
 * The seven states follow the Source Switch state contract. Candidate-state
 * geometry comes from SourceSwitch/Window (Phone 943:15215 / Tablet 943:15705,
 * both mounting 568:656). States without a dedicated visible Figma frame stay
 * fail-closed for visual acceptance; the owning Index still drives the real
 * gateway transitions.
 */
export interface SourceSwitchDiscoveringState {
  kind: 'discovering';
}

export interface SourceSwitchCandidatesState {
  kind: 'candidates';
  candidates: SourceSwitchCandidate[];
  refreshing?: boolean;
  refreshError?: string;
}

export interface SourceSwitchEmptyState {
  kind: 'empty';
}

export interface SourceSwitchDiscoveryErrorState {
  kind: 'discoveryError';
  message: string;
}

export interface SourceSwitchSwitchingState {
  kind: 'switching';
  targetSourceId: string;
}

export interface SourceSwitchSuccessState {
  kind: 'success';
}

export interface SourceSwitchFailureState {
  kind: 'failure';
  message: string;
  transactionId?: string;
  confirmation?: 'undispatched' | 'confirmed' | 'unknown';
  reconcile?: boolean;
}

export type SourceSwitchPanelState =
  | SourceSwitchDiscoveringState
  | SourceSwitchCandidatesState
  | SourceSwitchEmptyState
  | SourceSwitchDiscoveryErrorState
  | SourceSwitchSwitchingState
  | SourceSwitchSuccessState
  | SourceSwitchFailureState;

