import type { SourceSwitchCandidate } from './SourceSwitchGateway';

/**
 * SourceSwitch overlay window state (Window State 7态, SS-SOURCE-SWITCH-01).
 * The seven states follow the Source Switch state contract. Candidate-state
 * manga geometry comes from SourceSwitch/Window (Phone 943:15215 / Tablet
 * 943:15705, both mounting 568:656). Novel presentation follows the selected
 * 2026-10-06 demo drawer. The owning Host still drives real gateway transitions;
 * native visual acceptance is recorded separately from the selected demo.
 */
export interface SourceSwitchDiscoveringState {
  kind: 'discovering';
}

export interface SourceSwitchCandidatesState {
  kind: 'candidates';
  candidates: SourceSwitchCandidate[];
  refreshing?: boolean;
  refreshError?: string;
  stopped?: boolean;
}

export interface SourceSwitchEmptyState {
  kind: 'empty';
  stopped?: boolean;
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
