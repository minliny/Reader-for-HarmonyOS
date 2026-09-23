import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
export const { ReaderContentSearchPublication } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(
  readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderContentSearchPublication.ets', import.meta.url), 'utf8'))));
// Adapt old probe inspection fields to the actual sole owner, never create a
// second writable state in production just to keep a test fixture working.
export function installContentSearchOwnerProbe(owner, publications = [], gateway) {
  const initial = owner.quickSearchState;
  const publication = owner.quickSearchPublication instanceof ReaderContentSearchPublication
    ? owner.quickSearchPublication : new ReaderContentSearchPublication();
  if (initial !== undefined) publication.publish(initial);
  if (gateway !== undefined) publication.gateway = gateway;
  const publish = publication.publish.bind(publication);
  publication.publish = state => { publish(state); publications.push(state); };
  owner.quickSearchPublication = publication;
  Object.defineProperty(owner, 'quickSearchState', { configurable: true,
    get: () => publication.stateAt(0), set: value => publication.publish(value) });
  Object.defineProperty(owner, 'searchGeneration', { configurable: true, get: () => publication.generation });
  return owner;
}
