import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';
import * as visual from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import * as layout from '../../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import * as presentation from '../../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import * as fonts from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

export const mangaDirectoryEntryRowSource = readFileSync(new URL('../../entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets', import.meta.url), 'utf8');

/** Actual SDK-emitted shared row and V1 Prop runtime. Parents continue to
 * execute their production callbacks; no row geometry or identity is copied. */
export function mangaDirectoryEntryRowSdk({ source = mangaDirectoryEntryRowSource,
  properties = createArkUIPropertyRuntimeProbe(), dependencies = {}, hooks = {} } = {}) {
  const deps = { ...visual, WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' }, FlexWrap: { Wrap: 'FlexWrap.Wrap' }, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) }, ...layout, ...presentation, ...fonts, ...properties.sdk, ...dependencies };
  const carrier = { ...properties.hooks, ...hooks,
    childSources: { ...hooks.childSources, MangaDirectoryEntryRow: source }, mountChildren: true };
  deps.MangaDirectoryEntryRow = createReaderBuilderProbe(source, boundedMembers(source), deps, carrier).Component;
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  return { deps, hooks: carrier, properties, source,
    nodes: owner => walk(owner).flatMap(child => [...child.nodes.values()]),
    rowChildren: owner => [...owner.children.values()].filter(child => child.params === undefined && child.nodes),
  };
}
