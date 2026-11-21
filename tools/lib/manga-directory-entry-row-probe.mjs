import { readFileSync } from 'node:fs';
import { createReaderComponentProbe as createReaderBuilderProbe } from './reader-component-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { builderComponentMembers as boundedMembers } from './ets-builder-probe.mjs';
import * as visual from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import * as layout from '../../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import * as presentation from '../../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import { mangaDirectoryDisplay } from '../../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';
import * as directoryState from '../../entry/src/main/ets/features/manga/MangaDirectoryState.ts';
import * as fonts from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import * as timing from '../../entry/src/main/ets/features/common/ProductMotionTiming.ts';
import { SOURCE_SWITCH_VISUAL } from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import { readerPanelActorPose } from '../../entry/src/main/ets/features/reading/ReaderPanelMotionContract.ts';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';

export const mangaDirectoryEntryRowSource = readFileSync(new URL('../../entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets', import.meta.url), 'utf8');
const motionSource = readFileSync(new URL('../../entry/src/main/ets/features/common/MotionSpec.ets', import.meta.url), 'utf8');
const curves = new Proxy({}, { get: (_target, name) => (...args) => ({ nativeCurve: String(name), args }) });
const motion = pureModuleProbe(motionSource, 'MotionSpec.ets', {
  ...timing, SOURCE_SWITCH_VISUAL, MANGA_DIRECTORY_VISUAL: visual.MANGA_DIRECTORY_VISUAL,
  readerPanelActorPose, curves, Curve: new Proxy({}, { get: (_target, name) => String(name) }),
}, ['motionAnimateParam']);

/** Actual SDK-emitted shared row and V1 Prop runtime. Parents continue to
 * execute their production callbacks; no row geometry or identity is copied. */
export function mangaDirectoryEntryRowSdk({ source = mangaDirectoryEntryRowSource,
  properties = createArkUIPropertyRuntimeProbe(), dependencies = {}, hooks = {} } = {}) {
  const deps = { ...visual, ...directoryState, mangaDirectoryDisplay, ...motion, WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' }, FlexWrap: { Wrap: 'FlexWrap.Wrap' }, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) }, ...layout, ...presentation, ...fonts, ...properties.sdk, ...dependencies };
  const carrier = { ...properties.hooks, ...hooks,
    childSources: { ...hooks.childSources, MangaDirectoryEntryRow: source }, mountChildren: true };
  deps.MangaDirectoryEntryRow = createReaderBuilderProbe(source, boundedMembers(source), deps, carrier).Component;
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  return { deps, hooks: carrier, properties, source,
    nodes: owner => walk(owner).flatMap(child => [...child.nodes.values()]),
    rowChildren: owner => [...owner.children.values()].filter(child => child.params === undefined && child.nodes),
  };
}
