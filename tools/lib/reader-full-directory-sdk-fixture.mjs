import { readFileSync } from 'node:fs';
import { createReaderComponentProbe } from './reader-component-probe.mjs';
import { builderComponentMembers } from './ets-builder-probe.mjs';
import { pageFrameSdkFixture } from './reader-page-frame-sdk-fixture.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { selectedProductionValues } from './selected-production-methods.mjs';
import * as metricsPolicy from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as widthClass from '../../entry/src/main/ets/features/common/ReaderWidthClass.ts';

const url = file => new URL('../../' + file, import.meta.url);
const source = file => readFileSync(url(file), 'utf8');

/** The real directory and shared frame execute through the installed SDK.
 * Only business leaf components are explicit capture ports: their internals,
 * native rendering/measurement and platform input are not simulated here. */
export function fullDirectorySdkFixture(definition, metrics) {
  const accessibility = pureModuleProbe(source('entry/src/main/ets/features/common/ReaderActionAccessibility.ets'),
    'ReaderActionAccessibility.ets', { AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' } },
    ['ReaderActionAccessibility','readerActionTouchRegion']);
  const scales = pureModuleProbe(source('entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts'),
    'ReaderSurfaceResolvers.ts', metricsPolicy, ['readerReadableFontScale','readerScaledControlHeight']);
  const defaults = selectedProductionValues(url('entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts'),
    ['EMPTY_VIEW','EMPTY_READING_DIRECTORY_RECOVERY']);
  class LeafPort {
    constructor(owner, params, _storage, id) { Object.assign(this,{owner,params:{...params},id}); }
    updateStateVars(params) { Object.assign(this.params,params); }
  }
  class DirectoryPanel extends LeafPort {}
  class RecoverySurface extends LeafPort {}
  const frame = pageFrameSdkFixture({ dependencies: { ...accessibility, ...scales, ...defaults,
    ...metricsPolicy, ...widthClass, ReaderWindowCoordinator: { metrics: () => metrics },
    FullDirectoryPanel: DirectoryPanel, ReaderDirectoryRecoverySurface: RecoverySurface } });
  const hooks = { ...frame.hooks, childSources: { ...frame.hooks.childSources,
    FullDirectoryPanel: source('entry/src/main/ets/features/reading/FullDirectoryPanel.ets'),
    ReaderDirectoryRecoverySurface: source('entry/src/main/ets/features/reading/ReaderDirectoryRecoverySurface.ets') } };
  const {owner} = createReaderComponentProbe(definition, builderComponentMembers(definition,'ReaderFullDirectory'),
    frame.deps, hooks);
  return { ...frame, hooks, owner, DirectoryPanel, RecoverySurface };
}
