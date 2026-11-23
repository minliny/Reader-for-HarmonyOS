import type { JsonObject } from '@reader/core-harmony';
import { RULES_MUTATION_METHODS } from '../features/settings/application/RulesMutationContract';

export interface ReaderRuleMutationEffectRequest { method: string; params: JsonObject; }

/** Classification only. The SDK must still receive the original typed envelope.
 * Reuse the existing effects for versioned Core mutations.
 * Malformed or future envelopes cannot borrow another command's effects. */
export function readerRuleMutationEffects(method: string, params: JsonObject): ReaderRuleMutationEffectRequest {
  if (method === 'manga.sourceSwitch.commit.v2') return { method: 'manga.sourceSwitch.commit', params };
  if (method !== 'rules.mutation.apply' && method !== 'bookshelf.management.mutation.apply') return { method, params };
  const mutation = params['mutation'];
  if (typeof params['operationId'] !== 'string' || (params['operationId'] as string).trim().length === 0 ||
    typeof params['sequence'] !== 'number' || !Number.isSafeInteger(params['sequence']) || (params['sequence'] as number) < 1 ||
    mutation === null || typeof mutation !== 'object' || Array.isArray(mutation)) return { method, params };
  const command = mutation as JsonObject;
  const originalMethod = command['method'];
  const originalParams = command['params'];
  if (typeof originalMethod !== 'string' || !(method==='rules.mutation.apply' ? RULES_MUTATION_METHODS : ['bookshelf.remove','bookshelf.removeBatch']).includes(originalMethod) ||
    originalParams === null || typeof originalParams !== 'object' || Array.isArray(originalParams)) return { method, params };
  return { method: originalMethod, params: originalParams as JsonObject };
}
