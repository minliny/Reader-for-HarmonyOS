import type { JsonObject } from '@reader/core-harmony';
import type { RssSubscription } from './RssGateway';

/** Original RSS delta identity. It is independent from current list/read-back. */
export interface RssOriginalMutationIdentity {
  generation: number;
  operationId: string;
  method: string;
  scope: 'management' | 'editor' | 'entry' | 'foreign';
  subscriptionId: string;
  guid: string;
}
export interface RssOriginalMutationProjection extends RssOriginalMutationIdentity {
  sequence: number;
  confirmation: 'undispatched' | 'confirmed' | 'unknown';
  writeStage: 'intent' | 'core' | 'cleanup';
  busy: boolean;
  blocked: boolean;
  canRetryOriginal: boolean;
  message: string;
}
export interface RssOriginalMutationOutcome {
  method: string;
  params: JsonObject;
  /** Historical exact ACK only; refresh current state before publishing it. */
  data: JsonObject;
  subscription?: RssSubscription;
}
export interface RssOriginalMutationRecovery {
  original?: RssOriginalMutationProjection;
  outcome?: RssOriginalMutationOutcome;
}

export function rssOriginalMatchesScope(original: RssOriginalMutationProjection | undefined,
  scope: 'management' | 'editor' | 'entry' | 'feed', subscriptionId: string = '', guid: string = ''): boolean {
  return original?.blocked === true && original.scope === scope &&
    (scope === 'management' || original.subscriptionId === subscriptionId &&
      (scope !== 'entry' || original.guid === guid));
}
