import { SourceSwitchSurfaceLifecycle } from '../../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { acquisitionCandidateRank } from '../../entry/src/main/ets/app/library/BookAcquisitionPresentation.ts';
import { readBookAuthorIdentity } from '../../entry/src/main/ets/app/library/BookAuthorMetadata.ts';
import { readBookSearchTiming } from '../../entry/src/main/ets/app/library/BookSearchTiming.ts';

const root = new URL('../../entry/src/main/ets/features/source/', import.meta.url);
const owner = readFileSync(new URL('presentation/SourceSwitchPresentation.ets', root), 'utf8');
const gateway = readFileSync(new URL('application/SourceSwitchGateway.ts', root), 'utf8');
const candidateKey = gateway.match(/export function sourceSwitchCandidateKey\([^\n]+\{\n[^\n]+\n\}/)?.[0];
if (candidateKey === undefined) throw new Error('Production source switch key unavailable');
const sourceSwitchCandidateKey = new Function(`${stripTypeScriptTypes(candidateKey.replace('export ', ''))}; return sourceSwitchCandidateKey;`)();
const presentation = new Function('ReaderRuntimeOwner', 'SourceSwitchHost', 'sourceSwitchCandidateKey',
  'acquisitionCandidateRank', 'readBookAuthorIdentity', 'readBookSearchTiming', 'LOCAL_SOURCE_ID', 'SourceSwitchSurfaceLifecycle',
  `${stripTypeScriptTypes(owner.replace(/^import[^;]+;\s*/gm, '').replace(/^@Observed\n/gm, '').replace(/^export /gm, ''))}; return { SourceSwitchPresentation, sourceSwitchProbeQuery };`);

export function actualSourceSwitchPresentation(deps) {
  return presentation(deps.ReaderRuntimeOwner, deps.SourceSwitchHost, sourceSwitchCandidateKey,
    acquisitionCandidateRank, readBookAuthorIdentity, readBookSearchTiming, deps.LOCAL_SOURCE_ID ?? 'local', SourceSwitchSurfaceLifecycle).SourceSwitchPresentation;
}
export const { sourceSwitchProbeQuery } = presentation(undefined, undefined, sourceSwitchCandidateKey,
  acquisitionCandidateRank, readBookAuthorIdentity, readBookSearchTiming, 'local', SourceSwitchSurfaceLifecycle);

const legacyFields = {
  sourceSwitchVisible: 'visible', sourceSwitchState: 'state', sourceSwitchFailureMessage: 'failureMessage',
  sourceSwitchScopeId: 'scopeId', pendingSourceSwitch: 'pending', sourceSwitchHost: 'activeHost',
  sourceSwitchNamedCandidate: 'namedCandidate',
};
export const legacySourceSwitchIndexFields = Object.keys(legacyFields);
export function bindSourceSwitchFixtureFields(prototype) {
  for (const [name, field] of Object.entries(legacyFields)) Object.defineProperty(prototype, name, {
    get() { return this.sourceSwitchPresentation[field]; },
    set(value) { this.sourceSwitchPresentation[field] = value; },
    configurable: true,
  });
}
