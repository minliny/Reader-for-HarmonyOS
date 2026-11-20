import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { labeledIconControls } from './reader-labeled-icon-action-probe.mjs';
import { foundationControls } from './reader-foundation-control-probe.mjs';
import { switchControls } from './reader-switch-control-probe.mjs';
import { iconButtonControls } from './reader-icon-button-probe.mjs';
import { mangaDirectoryEntryRowSdk } from './manga-directory-entry-row-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { readerPageBuilderSlots } from './reader-page-builder-slots.mjs';
import { boundedSurfaceSdk } from './bounded-surface-sdk-probe.mjs';
import { createEtsBuilderProbe, builderChildProperties, builderComponentMembers, builderSdkAvailable,
  builderCompilationCacheStats, builderChildPropertyCacheStats } from './ets-builder-probe.mjs';
import { readerProbeGlobals } from './reader-probe-globals.mjs';

export const readerBuilderSdkAvailable = builderSdkAvailable;
export const readerBuilderCompilationCacheStats = builderCompilationCacheStats;
export const readerBuilderChildPropertyCacheStats = builderChildPropertyCacheStats;
export const readerBuilderChildProperties = builderChildProperties;
const sdkRoot = resolveEtsLoaderRoot();
let pageFrameworkProperties;

/** Mount actual SDK-emitted child components into the parent probe. The
 * factory supplies its own deps/hooks/property runtime; the consumer's
 * explicit values still win. Every child family here uses this exact merge. */
function mountProbeChildren({ dependencies, hooks, factory, lifecycle = false }) {
  const controls = factory();
  const originalHooks = hooks;
  return {
    dependencies: { ...(controls.dependencies ?? controls.deps), ...dependencies },
    hooks: { ...controls.hooks, ...originalHooks,
      childSources: { ...controls.hooks.childSources, ...originalHooks.childSources },
      mountChildren: true, ...(lifecycle ? { lifecycleChildren: true } : {}),
      onChildUpdated(child, params) {
        controls.properties.flush();
        originalHooks.onChildUpdated?.(child, params);
      },
    },
  };
}

// Reader composition fixture. Generic SDK lowering lives in ets-builder-probe.
function prepareReaderFixture({ source, names, dependencies, hooks, original, struct,
  ts, syntax, parse, componentDeclaration, childProps, require }) {
  readerPageBuilderSlots(source, struct.name.getText(original));
  // Main-tab migration adds real optional slots with production defaults.
  // Preserve those declarations/initializer Builders in old partial-method
  // probes rather than filling a fake empty callback in every consumer test.
  if (['MainTabShell', 'SettingsShell'].includes(struct.name.getText(original))) {
    for (const member of struct.members) {
      const name = member.name?.getText(original);
      if (!name || names.includes(name) || !ts.isPropertyDeclaration(member) || !member.initializer ||
        !ts.getAllDecorators(member)
          .some(decorator => decorator.getText(original) === '@BuilderParam')) continue;
      names.push(name);
      for (const match of member.initializer.getText(original).matchAll(/this\.(\w+)/g)) {
        const builder = struct.members.find(candidate => candidate.name?.getText(original) === match[1]);
        if (builder && !names.includes(match[1]) && ts.getAllDecorators(builder)
          .some(decorator => decorator.getText(original) === '@Builder')) names.push(match[1]);
      }
    }
  }
  // Preserve the pre-migration selected-method probe boundary. Only newly
  // delegated actual @Builder slots are admitted; arbitrary business methods
  // or state fields are still supplied explicitly by the focused consumer.
  const delegatedReferences = new Set();
  const collectSlots = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && ts.isIdentifier(node.expression) &&
      ['ReaderPageScaffold', 'ReaderFixedHeaderHost', 'ReaderStandardPage'].includes(node.expression.text)) {
      for (const argument of node.arguments) for (const match of argument.getText(original).matchAll(/this\.(\w+)/g))
        delegatedReferences.add(match[1]);
    }
    ts.forEachChild(node, collectSlots);
  };
  for (const member of struct.members.filter(member => names.includes(member.name?.getText(original)))) collectSlots(member);
  for (const member of struct.members) {
    const name = member.name?.getText(original);
    if (name && !names.includes(name) && delegatedReferences.has(name) &&
      ts.getAllDecorators(member).some(decorator => decorator.getText(original) === '@Builder')) names.push(name);
  }
  // Full directory's new surface context is a finite input fact. Retain the
  // actual reader default in older focused Builders instead of inventing a
  // caller default or weakening detail-vs-reader admission.
  if(struct.name.getText(original)==='ReaderFullDirectory'&&delegatedReferences.has('catalogContext')&&!names.includes('catalogContext'))
    names.push('catalogContext');
  // These newly introduced members are the finite page-chrome measurement
  // seam. Keep their real initializers/functions when older focused probes
  // select pre-migration Builders; do not reconstruct inset math in fixtures.
  const chromeMembers = new Set(['searchContentStartInset', 'fixedHeaderHeight', 'selectionHeaderHeight',
    'standardHeaderHeight', 'pageHeaderHeight', 'pageFooterHeight', 'headerHeight', 'fixedHeaderLayoutKey', 'searchHeaderLayoutKey',
    'catalogHeaderHeight','catalogHeaderTop',
    'searchFontScale','searchFilterHeight','searchFilterLabelWidth','searchBarHeight','bookFontScale',
    'resultTagWidth','resultTagHeight',
    // Nonmodal feedback is a finite visual/admission seam. Keep the actual
    // production defaults and helpers in focused pre-migration consumers.
    'indexRecoveryNotice','indexRecoveryActionLabel','indexRecoveryAction','indexRecoveryCurrent',
    'indexRecoveryRevision','remoteCacheRefreshConsent','indexRecoveryNoticeContent','showIndexRecoveryNotice','clearIndexRecoveryNotice','runIndexRecoveryAction',
    'sourceImportSearchActionLabel','sourceImportSearchActionRevision','sourceImportSearchAction','runSourceImportSearchAction',
    'statusActionLabel','statusActionGeneration','onStatusAction','rssOperationResultMessage','resultMessage',
    'readerRecoveryView','readerRecoveryActionLabel','readerRecoveryAction','showReaderRecovery','reconcileReaderRecovery',
    'detailPendingNoticeVisible','detailReadableAdmission','readableAdmissions','detailBookKey','hasUnknownShelfWrite','isCurrentRuntime',
    'pendingFeedback','hasPendingSettings','hasPendingCleanup','recovery',
    'operationFeedbackIdentity','cacheFeedbackIdentity','showFeedbackToast','lastOperationFeedback','lastOperationToast','lastCacheFeedback',
    'recoveryIdentityFor','capturedPendingAction','feedbackIdentity','lastFeedbackIdentity','lastToastMessage',
    'notifyOpenedError','openedErrorNoticeKey','chapterLoadState','openFailureStage',
    'modeReconcileBusy','modeLoadBusy','recoveryBusy','catalogBusy']);
  let addedChrome;
  do {
    addedChrome = false;
    const selected = names.map(name => struct.members.find(member => member.name?.getText(original) === name)
      ?.getText(original) ?? '').join('\n');
    // A selected real decorated field requires its declared Watch method in
    // the SDK frontend. Retain that exact method instead of weakening the
    // decorator or supplying an empty callback in each legacy fixture.
    for (const field of struct.members.filter(member => names.includes(member.name?.getText(original)))) {
      for (const decorator of ts.getAllDecorators(field)) {
        const call = decorator.expression;
        if (!ts.isCallExpression(call) || call.expression.getText(original) !== 'Watch' ||
          call.arguments.length !== 1 || !ts.isStringLiteral(call.arguments[0])) continue;
        const callback = call.arguments[0].text;
        if (!names.includes(callback) && struct.members.some(member => ts.isMethodDeclaration(member) &&
          member.name?.getText(original) === callback)) { names.push(callback); addedChrome = true; }
      }
    }
    for (const member of struct.members) {
      const name = member.name?.getText(original);
      if (name && chromeMembers.has(name) && !names.includes(name) && selected.includes(`this.${name}`)) {
        names.push(name); addedChrome = true;
      }
    }
  } while (addedChrome);
  // New quiet recovery defaults stay real in old focused, stateless Builder
  // probes too. Supply the existing ArkUI property runtime only when the
  // caller has not already selected its own genuine property seam.
  const hasMessageProperty = struct.members.some(member => names.includes(member.name?.getText(original)) &&
    chromeMembers.has(member.name?.getText(original)) && ts.getAllDecorators(member)
      .some(decorator => ['@State','@Prop'].includes(decorator.getText(original))));
  if ((hasMessageProperty || names.some(name => ['readerRecoveryView','indexRecoveryNotice','sourceImportSearchActionLabel','rssOperationResultMessage','resultMessage'].includes(name))) &&
    dependencies.ObservedPropertySimplePU === undefined && dependencies.ObservedPropertyObjectPU === undefined) {
    const feedbackProperties = createArkUIPropertyRuntimeProbe();
    const originalHooks = hooks;
    dependencies = { ...feedbackProperties.sdk, ...dependencies };
    hooks = { ...feedbackProperties.hooks, ...originalHooks };
  }
  const members = names.map(name => {
    const member = struct.members.find(n => n.name?.getText(original) === name);
    assert.ok(member, `production member ${name}`);
    if (member.getText(original).includes('@Builder')) {
      require(`${sdkRoot}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
    }
    return member.getText(original);
  });
  // Message migration delegates the existing empty/error/recovery slots to
  // these finite shipping children. Older focused consumers must execute the
  // same SDK-emitted children; explicit test compositions stay authoritative.
  const missingMessages = ['ReaderPageState', 'ReaderRecoveryAction', 'ReaderRecoveryNotice'].filter(name =>
    dependencies[name] === undefined && new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n')));
  if (missingMessages.length > 0) {
    ({ dependencies, hooks } = mountProbeChildren({ dependencies, hooks, factory: boundedSurfaceSdk, lifecycle: true }));
  }
  // Page migration introduces only these three finite visual hosts. Older
  // business probes still execute their own production slots, now delegated
  // through the actual SDK-emitted host instead of a no-op wrapper stub.
  for (const name of ['ReaderPageScaffold', 'ReaderFixedHeaderHost', 'ReaderStandardPage']) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n'))) continue;
    const url = new URL(`../../entry/src/main/ets/features/common/${name}.ets`, import.meta.url);
    const definition = readFileSync(url, 'utf8'), tree = parse(definition);
    assert.deepEqual(tree.parseDiagnostics, [], `actual ${name} parses`);
    const declaration = componentDeclaration(tree, name);
    const properties = declaration.members.filter(ts.isPropertyDeclaration);
    const decorated = tag => new Set(properties.filter(member => ts.getAllDecorators(member)
      .some(decorator => (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression)
        .getText(tree) === tag)).map(member => member.name.getText(tree)));
    syntax.componentCollection.customComponents.add(name);
    syntax.propCollection.set(name, decorated('Prop'));
    syntax.builderParamObjectCollection.set(name, decorated('BuilderParam'));
    syntax.propertyCollection.set(name, new Set(properties.map(member => member.name.getText(tree))));
    syntax.regularCollection.set(name, new Set(properties.filter(member => ts.getAllDecorators(member).length === 0)
      .map(member => member.name.getText(tree))));
    if (dependencies[name] !== undefined) continue;
    pageFrameworkProperties ??= createArkUIPropertyRuntimeProbe();
    const originalHooks = hooks;
    dependencies = { ...pageFrameworkProperties.sdk, ...dependencies };
    hooks = { ...pageFrameworkProperties.hooks, ...originalHooks, mountChildren: true,
      onChildUpdated(child, params) {
        pageFrameworkProperties.flush();
        originalHooks.onChildUpdated?.(child, params);
      },
    };
    const host = createReaderBuilderProbe(definition, declaration.members.filter(member => member.name)
      .map(member => member.name.getText(tree)), dependencies, { ...hooks, componentName: name });
    dependencies = { ...dependencies, [name]: class extends host.Component {
      constructor(owner, params, storage, id, ...rest) {
        super(owner, params, storage, id, ...rest);
        this.params = { ...params };
      }
      updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params, params); }
    } };
  }
  if (dependencies.MangaDirectoryEntryRow === undefined && /\bMangaDirectoryEntryRow\s*\(/.test(members.join('\n'))) {
    ({ dependencies, hooks } = mountProbeChildren({ dependencies, hooks, factory: mangaDirectoryEntryRowSdk }));
  }
  // Legacy consumers now mount the same production controls as new callers.
  // Resolve only actual calls in the selected production members, and keep an
  // explicitly supplied component/property runtime authoritative. Foundation
  // components themselves do not call either child, so this is not recursive.
  const missingFoundation = ['ReaderButton', 'ReaderFormField', 'ReaderLabeledIconAction'].filter(name =>
    dependencies[name] === undefined && new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n')));
  if (missingFoundation.length > 0) {
    const factory = missingFoundation.includes('ReaderLabeledIconAction') ? labeledIconControls : foundationControls;
    ({ dependencies, hooks } = mountProbeChildren({ dependencies, hooks, factory, lifecycle: true }));
  }
  // The two existing controlled switch families follow the same bounded
  // actual-child resolution. Explicit components remain authoritative; the
  // producer itself calls neither child, so it cannot recursively resolve.
  const missingSwitch = ['ReaderToggle', 'ReaderSegmentedControl'].filter(name =>
    dependencies[name] === undefined && new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n')));
  if (missingSwitch.length > 0) {
    ({ dependencies, hooks } = mountProbeChildren({ dependencies, hooks, factory: switchControls, lifecycle: true }));
  }
  if (dependencies.ReaderIconButton === undefined && /\bReaderIconButton\s*\(/.test(members.join('\n'))) {
    ({ dependencies, hooks } = mountProbeChildren({ dependencies, hooks, factory: iconButtonControls, lifecycle: true }));
  }
  // Index and reading-entry probes may mount the production full-directory
  // child directly. Register its real @Prop contract with the SDK syntax
  // validator even when an individual probe does not need to mount the child
  // runtime. The fallback Child instance is enough for observer execution;
  // focused directory probes can still provide an explicit implementation.
  const knownChildren = [
    // Index mounts the optional runtime geometry guide at the root. Keep it
    // registered as a real custom component for SDK Builder probes so focused
    // consumers do not need to know about this diagnostics-only child.
    ['ReaderLayoutDebugOverlay', '../../entry/src/main/ets/features/common/ReaderLayoutDebugOverlay.ets'],
    ['ReaderInlineSelect', '../../entry/src/main/ets/features/common/ReaderInlineSelect.ets'],
    ['ReaderFullDirectory', '../../entry/src/main/ets/features/reading/ReaderFullDirectory.ets'],
    ['BookDirectoryPage', '../../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets'],
  ];
  for (const [name, relative] of knownChildren) {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n'))) continue;
    if (dependencies[name] !== undefined) continue;
    const sourceUrl = new URL(relative, import.meta.url);
    if (!existsSync(sourceUrl)) continue;
    syntax.componentCollection.customComponents.add(name);
    syntax.propCollection.set(name, childProps(readFileSync(sourceUrl, 'utf8'), name));
    dependencies = { ...dependencies, [name]: class {
      constructor(owner, params, _storage, id) {
        this.owner = owner; this.params = params; this.id = id; this.children = new Map(); this.nodes = new Map();
        // Keep older focused probes able to exercise selection callbacks while
        // the production page now delegates the visual contract to the shared
        // ReaderInlineSelect host.
        if (name === 'ReaderInlineSelect') {
          const values = Array.isArray(params?.options) ? params.options : [];
          const node = { type: 'Select', readerInline: true, create: values.map(value => ({ value })),
            selected: params?.selectedIndex ?? 0, value: params?.value ?? '',
            width: params?.controlWidth > 0 ? params.controlWidth : '100%',
            onSelect: index => params?.onSelect?.(index, values[index]) };
          this.nodes.set(0, node);
        }
      }
      initialRender() {}
      aboutToAppear() {}
      updateStateVars(next) { Object.assign(this.params, next); }
    } };
  }
  // Register the actual shared child Prop names so the SDK emits its real
  // updateStateVarsOfChildByElmtId payload instead of an empty test stub.
  const childName = 'ReaderControlSwitchTrack';
  const childSource = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderControlSwitchTrack.ets', import.meta.url), 'utf8');
  syntax.componentCollection.customComponents.add(childName);
  syntax.propCollection.set(childName, childProps(childSource));
  const recoveryChildren = ['ReaderRecoveryAction', 'ReaderRecoveryNotice'];
  for (const name of recoveryChildren) {
    const child = new URL(`../../entry/src/main/ets/features/common/${name}.ets`, import.meta.url);
    if (!existsSync(child)) continue;
    const definition = readFileSync(child, 'utf8');
    syntax.componentCollection.customComponents.add(name);
    syntax.propCollection.set(name, childProps(definition));
  }
  return { names, dependencies, hooks };
}
// The SDK reports "X({...}) does not meet UI component syntax" when a page
// mounts a child the probe has not registered. Index the feature sources once
// so compilation can resolve such a child by its real name instead of failing.
const featureIndex = new Map();
function indexFeatureSources() {
  const root = new URL('../../entry/src/main/ets/features/', import.meta.url);
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(new URL(`${entry.name}/`, dir));
      else if (entry.name.endsWith('.ets')) {
        const name = entry.name.slice(0, -4);
        if (!featureIndex.has(name)) featureIndex.set(name, new URL(entry.name, dir));
      }
    }
  };
  visit(root);
}
// When a real child cannot compile with the parent's ports, mount a
// prop-compatible stand-in. Parent contracts still execute; the child's own
// visuals keep their dedicated suite.
function childStandIn(name, source) {
  const props = [...builderChildProperties(source, name)];
  const fields = props.map(prop => `  @Prop ${prop}: any = undefined;`).join('\n');
  return `@Component\nexport struct ${name} {\n${fields}\n  build() { Column() {} }\n}`;
}
function missingComponents(error) {
  const names = new Set();
  for (const diagnostic of error?.actual ?? []) {
    const match = /'([A-Za-z][A-Za-z0-9_]*)\s*\(\{/.exec(diagnostic?.message ?? '');
    if (match) names.add(match[1]);
  }
  return [...names];
}
export function createReaderBuilderProbe(source, names, dependencies = {}, hooks = {}) {
  const childSources = { ...(hooks.childSources ?? {}) };
  const options = { ...hooks, childSources, createGlobals: hooks.createGlobals ?? readerProbeGlobals,
    prepareComponent: hooks.prepareComponent ?? prepareReaderFixture };
  let deps = dependencies;
  if (featureIndex.size === 0) indexFeatureSources();
  // Mount children this source instantiates with parameters before lowering,
  // so an inline `Name({...})` never reaches the runtime as a bare global.
  for (const match of source.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\(\s*\{/g)) {
    const name = match[1];
    if (deps[name] !== undefined || !featureIndex.has(name)) continue;
    const child = readFileSync(featureIndex.get(name), 'utf8');
    try {
      deps = { ...deps, [name]: createReaderBuilderProbe(child, builderComponentMembers(child, name), deps,
        { ...hooks, componentName: name }).Component };
      if (childSources[name] === undefined) childSources[name] = child;
    } catch (_error) { /* keep unresolved */ }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return createEtsBuilderProbe(source, names, deps, options);
    } catch (error) {
      const pending = missingComponents(error).filter(name => deps[name] === undefined);
      if (process.env.PROBE_DEBUG) console.error('AUTO-PENDING', pending, 'actual', error?.actual?.length);
      if (pending.length === 0) throw error;
      if (featureIndex.size === 0) indexFeatureSources();
      let added = false;
      for (const name of pending) {
        const path = featureIndex.get(name);
        if (path === undefined) continue;
        const child = readFileSync(path, 'utf8');
        try {
          deps = { ...deps, [name]: createReaderBuilderProbe(child, builderComponentMembers(child, name), deps,
            { ...hooks, componentName: name }).Component };
          childSources[name] = child;
          added = true;
        } catch (childError) {
          const standIn = childStandIn(name, child);
          try {
            deps = { ...deps, [name]: createReaderBuilderProbe(standIn, ['build'], deps,
              { ...hooks, componentName: name }).Component };
            childSources[name] = standIn;
            added = true;
          } catch (stubError) {
            if (process.env.PROBE_DEBUG) console.error('AUTO-CHILD-FAIL', name, String(childError).split('\n')[0]);
          }
        }
      }
      if (!added) throw error;
    }
  }
  return createEtsBuilderProbe(source, names, deps, options);
}
