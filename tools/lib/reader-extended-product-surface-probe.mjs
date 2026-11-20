import { readFileSync } from 'node:fs';
import { createReaderComponentProbe } from './reader-component-probe.mjs';
import { builderComponentMembers } from './ets-builder-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';

const root = new URL('../../entry/src/main/ets/', import.meta.url);
export const extendedProductSurfaceSource = readFileSync(new URL('app/ReaderExtendedProductSurface.ets', root), 'utf8');
const pages = {
  DiscoverPage: 'discover/DiscoverPage', SyncPage: 'sync/SyncPage', RssPage: 'rss/RssPage',
  RssSubscriptionEditorPage: 'rss/RssSubscriptionEditorPage', RssSourceFeedPage: 'rss/RssSourceFeedPage',
  RssEntryDetailPage: 'rss/RssEntryDetailPage', RssSubscriptionManagementPage: 'rss/RssSubscriptionManagementPage',
};

/** Explicit feature composition. Leaf page/platform ports belong to the caller;
 * this fixture compiles the complete shipping product boundary through the SDK.
 * It never chooses a business Runtime, state default or enabled profile. */
export function extendedProductSurfaceSdk(dependencies = {}, hooks = {}) {
  if (dependencies.ObservedPropertyObjectPU === undefined) {
    const properties = createArkUIPropertyRuntimeProbe();
    dependencies = { ...properties.sdk, ...dependencies };
    const originalHooks = hooks;
    hooks = { ...properties.hooks, ...hooks,
      onChildUpdated(child, params) { properties.flush(); originalHooks.onChildUpdated?.(child, params); } };
  }
  const childSources = { ...Object.fromEntries(Object.entries(pages).map(([name,file]) =>
    [name,readFileSync(new URL(`features/${file}.ets`, root), 'utf8')])), ...hooks.childSources,
    ReaderExtendedProductSurface: extendedProductSurfaceSource };
  const fixture = createReaderComponentProbe(extendedProductSurfaceSource,
    builderComponentMembers(extendedProductSurfaceSource), dependencies, { ...hooks, childSources, mountChildren:true });
  class Surface extends fixture.Component {
    constructor(owner, params, storage, id, ...rest) { super(owner, params, storage, id, ...rest); this.params = { ...params }; }
    updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params,params); }
  }
  return { dependencies:{...dependencies, ReaderExtendedProductSurface:Surface},
    hooks:{...hooks,childSources,mountChildren:true}, Surface };
}
export function productSurfaceDescendants(owner) {
  return [...(owner.children?.values() ?? [])].flatMap(child=>[child,...productSurfaceDescendants(child)]);
}

/** Index tests explicitly opt into the product feature fixture. The general
 * SDK/component probes never infer or import this optional product assembly. */
export function createIndexProductBuilderProbe(source, names, dependencies = {}, hooks = {}) {
  const composition = extendedProductSurfaceSdk(dependencies, hooks);
  return createReaderBuilderProbe(source, names, composition.dependencies, composition.hooks);
}
