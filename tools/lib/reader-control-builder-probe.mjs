import * as directoryVisual from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import * as directoryGeometry from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { productionMangaDirectoryPressFeedback } from './manga-directory-press-feedback-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { labeledIconControls } from './reader-labeled-icon-action-probe.mjs';
import { foundationControls } from './reader-foundation-control-probe.mjs';
import { switchControls } from './reader-switch-control-probe.mjs';
import { iconButtonControls } from './reader-icon-button-probe.mjs';
import { mangaDirectoryEntryRowSdk } from './manga-directory-entry-row-probe.mjs';
import { actualReaderPageShell } from './reader-page-shell-runtime-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const sdkRoot = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
export const readerBuilderSdkAvailable = existsSync(`${sdkRoot}/lib/process_component_class.js`);
let pageFrameworkProperties;

/** Run the actual SDK-emitted observer closures, mounting each Builder once.
 * This models closure lifetime, not ArkUI's dependency scheduling/native layout.
 * No source files, compiler cache, HAP or device are written by this helper. */
export function createReaderBuilderProbe(source, names, dependencies = {}, hooks = {}) {
  assert.ok(readerBuilderSdkAvailable, 'SDK required for the real Builder closure probe');
  const require = createRequire(import.meta.url);
  const ts = require(`${sdkRoot}/node_modules/typescript`);
  const compiler = require(`${sdkRoot}/lib/process_component_class.js`);
  const utils = require(`${sdkRoot}/lib/utils.js`);
  const main = require(`${sdkRoot}/main.js`);
  const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
  const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
  const parse = text => ts.createSourceFile('/tmp/ReaderBuilderProbe.ets', text,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const componentDeclaration = (tree, name) => {
    const declarations = tree.statements.filter(node => node.members && node.name &&
      node.members.some(member => member.name?.getText(tree) === 'build'));
    const exact = name === undefined ? undefined : declarations.find(node => node.name.getText(tree) === name);
    if (exact !== undefined) return exact;
    const exported = declarations.filter(node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    assert.ok(exported.length === 1 || declarations.length === 1,
      'multi-component production ETS requires an explicit componentName or one exported component');
    return exported[0] ?? declarations[0];
  };
  const childProps = (definition, name) => {
    const tree = parse(definition);
    assert.equal(tree.parseDiagnostics.length, 0, 'actual shared child ETS parses');
    const declaration = componentDeclaration(tree, name);
    return new Set((declaration?.members ?? []).filter(member => ts.isPropertyDeclaration(member) &&
      ts.getAllDecorators(member).some(decorator => {
        const expression = decorator.expression;
        return (ts.isCallExpression(expression) ? expression.expression : expression).getText(tree) === 'Prop';
      })).map(member => member.name.getText(tree)));
  };
  const original = parse(source);
  assert.equal(original.parseDiagnostics.length, 0, 'production ETS parses');
  const struct = componentDeclaration(original, hooks.componentName);
  assert.ok(struct, 'production component declaration exists');
  // Match the real SDK frontend's whole-struct Builder name collection. A
  // focused probe may supply a pre-existing nonselected Builder seam, but its
  // actual declared UI syntax must still be recognized by the compiler.
  for (const member of struct.members) if (member.name && ts.getAllDecorators(member)
    .some(decorator => decorator.getText(original) === '@Builder'))
    require(`${sdkRoot}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(member.name.getText(original));
  names = [...names];
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
  // These newly introduced members are the finite page-chrome measurement
  // seam. Keep their real initializers/functions when older focused probes
  // select pre-migration Builders; do not reconstruct inset math in fixtures.
  const chromeMembers = new Set(['searchContentStartInset', 'fixedHeaderHeight', 'selectionHeaderHeight',
    'standardHeaderHeight', 'pageHeaderHeight', 'pageFooterHeight', 'headerHeight', 'fixedHeaderLayoutKey', 'searchHeaderLayoutKey']);
  let addedChrome;
  do {
    addedChrome = false;
    const selected = names.map(name => struct.members.find(member => member.name?.getText(original) === name)
      ?.getText(original) ?? '').join('\n');
    for (const member of struct.members) {
      const name = member.name?.getText(original);
      if (name && chromeMembers.has(name) && !names.includes(name) && selected.includes(`this.${name}`)) {
        names.push(name); addedChrome = true;
      }
    }
  } while (addedChrome);
  const members = names.map(name => {
    const member = struct.members.find(n => n.name?.getText(original) === name);
    assert.ok(member, `production member ${name}`);
    if (member.getText(original).includes('@Builder')) {
      require(`${sdkRoot}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
    }
    return member.getText(original);
  });
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
    const controls = mangaDirectoryEntryRowSdk();
    const originalHooks = hooks;
    dependencies = { ...controls.deps, ...dependencies };
    hooks = { ...controls.hooks, ...originalHooks,
      childSources: { ...controls.hooks.childSources, ...originalHooks.childSources },
      mountChildren: true,
      onChildUpdated(child, params) {
        controls.properties.flush();
        originalHooks.onChildUpdated?.(child, params);
      },
    };
  }
  // Legacy consumers now mount the same production controls as new callers.
  // Resolve only actual calls in the selected production members, and keep an
  // explicitly supplied component/property runtime authoritative. Foundation
  // components themselves do not call either child, so this is not recursive.
  const missingFoundation = ['ReaderButton', 'ReaderFormField', 'ReaderLabeledIconAction'].filter(name =>
    dependencies[name] === undefined && new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n')));
  if (missingFoundation.length > 0) {
    const foundation = missingFoundation.includes('ReaderLabeledIconAction') ? labeledIconControls() : foundationControls();
    const originalHooks = hooks;
    dependencies = { ...foundation.dependencies, ...dependencies };
    hooks = { ...foundation.hooks, ...originalHooks,
      childSources: { ...foundation.hooks.childSources, ...originalHooks.childSources },
      mountChildren: true, lifecycleChildren: true,
      onChildUpdated(child, params) {
        foundation.properties.flush();
        originalHooks.onChildUpdated?.(child, params);
      },
    };
  }
  // The two existing controlled switch families follow the same bounded
  // actual-child resolution. Explicit components remain authoritative; the
  // producer itself calls neither child, so it cannot recursively resolve.
  const missingSwitch = ['ReaderToggle', 'ReaderSegmentedControl'].filter(name =>
    dependencies[name] === undefined && new RegExp(`\\b${name}\\s*\\(`).test(members.join('\n')));
  if (missingSwitch.length > 0) {
    const controls = switchControls();
    const originalHooks = hooks;
    dependencies = { ...controls.dependencies, ...dependencies };
    hooks = { ...controls.hooks, ...originalHooks,
      childSources: { ...controls.hooks.childSources, ...originalHooks.childSources },
      mountChildren: true, lifecycleChildren: true,
      onChildUpdated(child, params) {
        controls.properties.flush();
        originalHooks.onChildUpdated?.(child, params);
      },
    };
  }
  if (dependencies.ReaderIconButton === undefined && /\bReaderIconButton\s*\(/.test(members.join('\n'))) {
    const controls = iconButtonControls();
    const originalHooks = hooks;
    dependencies = { ...controls.dependencies, ...dependencies };
    hooks = { ...controls.hooks, ...originalHooks,
      childSources: { ...controls.hooks.childSources, ...originalHooks.childSources },
      mountChildren: true, lifecycleChildren: true,
      onChildUpdated(child, params) {
        controls.properties.flush();
        originalHooks.onChildUpdated?.(child, params);
      },
    };
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
  main.partialUpdateConfig.partialUpdateMode = true;
  utils.storedFileInfo.setCurrentArkTsFile();
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
  for (const [name, child] of Object.entries(hooks.childSources ?? {})) {
    syntax.componentCollection.customComponents.add(name);
    syntax.propCollection.set(name, childProps(child, name));
  }
  const file = parse(`@Component struct ReaderBuilderProbe {\n${members.join('\n')}\n${names.includes('build') ? '' : 'build() { Column() {} }'}\n}`);
  // The full SDK frontend collects declared method names before transforming
  // @Watch. Preserve that prepass for fixtures that include real decorated fields.
  syntax.classMethodCollection.set(file.fileName, new Map([['ReaderBuilderProbe', new Set(
    file.statements[0].members.filter(node => ts.isMethodDeclaration(node)).map(node => node.name.getText(file)),
  )]]));
  const properties = file.statements[0].members.filter(node => ts.isPropertyDeclaration(node));
  syntax.regularCollection.set('ReaderBuilderProbe', new Set(properties.filter(node =>
    ts.getAllDecorators(node).length === 0).map(node => node.name.getText(file))));
  syntax.componentCollection.currentClassName = 'ReaderBuilderProbe';
  require(`${sdkRoot}/lib/process_ui_syntax.js`).transformLog.sourceFile = file;
  const diagnostics = [];
  let transformed;
  const result = ts.transform(file, [context => node => {
    require(`${sdkRoot}/lib/process_ui_syntax.js`).contextGlobal = context;
    transformed = compiler.processComponentClass(node.statements[0], context, diagnostics, false);
    // The normal emitter visits the returned class after the component pass;
    // this removes omitted lifecycle statements for undecorated fields.
    const visit = child => ts.visitEachChild(child, visit, context);
    transformed = ts.visitNode(transformed, visit);
    return node;
  }]);
  result.dispose();
  assert.deepEqual(diagnostics, [], 'real SDK Builder/member transform has no diagnostics');
  const output = ts.createPrinter().printNode(ts.EmitHint.Unspecified, transformed, file);
  assert.match(output, /observeComponentCreation2/, 'exercise real SDK observer closures');
  let activeOwner, activeId;
  // The SDK lowers a component .animation modifier to Context start/reset
  // instructions surrounding its native attributes. Record those unmodified
  // instructions on the active observer; never pretend to render their frames.
  const nativeContext = { animation(value) {
    if (activeOwner === undefined) return;
    const record = activeOwner.nodes.get(activeId);
    activeOwner.attributeCalls.push({ id: activeId, property: 'contextAnimation', args: [value] });
    if (value !== null && value !== undefined) record.animation = value;
  } };
  const native = name => { const instance = new Proxy({ name }, { get(target, property) {
    if (property === 'name') return name;
    return (...args) => {
      if (property === 'canRetake') return false; // Fresh native tree: no retained id may skip creation.
      if (property === 'pop' || activeOwner === undefined) return;
      const record = activeOwner.nodes.get(activeId);
      activeOwner.attributeCalls.push({ id: activeId, property, args });
      if (property === 'attributeModifier') { args[0].applyNormalAttribute(instance); return instance; }
      if (property === 'create') record.type = name;
      // ArkUI TextInput.type() is an input attribute, not the native node kind.
      // Keep the actual call in attributeCalls and preserve both identities.
      record[property === 'type' ? 'nativeInputType' : property] = args.length === 1 ? args[0] : args;
      return instance;
    };
  } }); return instance; };
  class ViewPU {
    constructor(parent, _storage, id = -1) {
      this.owner = parent; this.id = id;
      this.observers = []; this.nodes = new Map(); this.children = new Map(); this.keys = new Map(); this.attributeCalls = [];
      this.watches = new Map();
    }
    finalizeConstruction() {}
    createStorageLink(_key, value, name) {
      return new dependencies.ObservedPropertySimplePU(value, this, name);
    }
    getUIContext() { return dependencies.uiContext?.getFont ? dependencies.uiContext : { ...dependencies.uiContext, getFont: () => ({}) }; }
    declareWatch(name, callback) { this.watches.set(name, callback); }
    observeComponentCreation2(callback, component) {
      const id = this.observers.length;
      this.observers.push(callback);
      this.nodes.set(id, { type: component.name, id });
      this.runObserver(id, true);
    }
    runObserver(id, initial) {
      activeOwner = this; activeId = id;
      const previousContext = globalThis.Context;
      globalThis.Context = nativeContext;
      hooks.onObserverEnter?.(this, id);
      try { this.observers[id](id, initial); }
      finally {
        try { hooks.onObserverExit?.(this, id); }
        finally { globalThis.Context = previousContext; activeOwner = undefined; }
      }
    }
    replayOnly(ids) { for (const id of ids) this.runObserver(id, false); }
    replay() {
      const before = this.observers.length;
      for (let id = 0; id < before; id++) this.runObserver(id, false);
      if (!hooks.allowEmptyBranchAdmission) assert.equal(this.observers.length, before, 'state update does not remount Builder actors');
    }
    forEachUpdateFunction(id, data, generator, key) {
      const seen = this.keys.get(id) ?? new Set(); this.keys.set(id, seen);
      data.forEach((item, index) => {
        const identity = key(item, index);
        if (!seen.has(identity)) { seen.add(identity); generator(item, index); }
      });
    }
    ifElseBranchUpdateFunction(id, generator) {
      const key = `if-${activeId}`;
      if (!this.keys.has(key)) {
        this.keys.set(key, id); const before = this.observers.length; generator();
        this.keys.set(`${key}-empty`, before === this.observers.length);
      } else if (hooks.allowEmptyBranchAdmission && this.keys.get(key) !== id) {
        assert.equal(this.keys.get(`${key}-empty`), true, 'probe only admits previously empty branches; it does not model removal');
        this.keys.set(key, id); const before = this.observers.length; generator();
        this.keys.set(`${key}-empty`, before === this.observers.length);
      }
    }
    updateStateVarsOfChildByElmtId(id, params) {
      const record = this.children.get(id); assert.ok(record, 'native child retained');
      hooks.onChildUpdate?.(record, params);
      if (typeof record.updateStateVars === 'function') record.updateStateVars(params);
      else Object.assign(record.params, params);
      hooks.onChildUpdated?.(record, params);
    }
    static create(child) {
      child.owner.children.set(child.id, child);
      if (hooks.lifecycleChildren) child.aboutToAppear?.();
      if (hooks.mountChildren && typeof child.initialRender === 'function') child.initialRender();
    }
  }
  class Child {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  }
  // Geometry/property probes do not register physical platform fonts. The
  // actual registrar has a separate demand/failure/retry test.
  const globals = { readerRegisteredFontFamily: (_font, family) => family,
    readerFontFamilyReady: () => true, MangaDirectoryCurrentFooter: Child,
    // Constructor arguments cross the platform seam unchanged; native color
    // parsing and focus-box rasterization remain target evidence.
    LengthMetrics: { vp: value => ({ value, unit: 'vp' }) }, ColorMetrics: { resourceColor: color => ({ color }) },
    readerAppColor, readerThemeDefinition, ViewPU, ReaderControlSwitchTrack: Child,
    ...Object.fromEntries(recoveryChildren.map(name => [name, Child])), $r: value => value,
    ...Object.fromEntries(['Blank', 'Button', 'Row', 'Column', 'Flex', 'Stack', 'Scroll', 'List', 'ListItem', 'Grid', 'GridItem', 'LazyForEach', 'Web', 'LoadingProgress', 'Progress', 'Circle', 'Rect', 'Shape', 'Path', 'Text', 'TextInput', 'TextArea', 'Select', 'Span', 'Marquee', 'Image', 'Slider', 'Toggle', 'Checkbox', 'Radio', 'ForEach', 'If', '__Common__']
      .map(name => [name, native(name)])),
    ...Object.fromEntries(['FontWeight', 'FlexAlign', 'VerticalAlign', 'HorizontalAlign', 'HitTestMode', 'Alignment', 'LayoutPolicy', 'AccessibilityRoleType',
      'LineCapStyle', 'TextAlign', 'TextOverflow', 'WordBreak', 'Visibility', 'Color', 'EnterKeyType', 'BarState', 'NestedScrollMode', 'EdgeEffect', 'Axis', 'SliderStyle', 'SliderChangeMode', 'ProgressType', 'FlexWrap', 'FlexDirection', 'ItemAlign'].map(name => [name, new Proxy({}, { get: (_, key) => `${name}.${String(key)}` })])),
    ...Object.fromEntries([...source.matchAll(/\b(TOK_[A-Z0-9_]+)\b/g)].map(m => [m[1], m[1]])),
    ...readerTypographyRoles, ...directoryVisual, ...directoryGeometry, visual: directoryVisual.MANGA_DIRECTORY_VISUAL,
    // Actual production surface/inset policy, including all finite variants.
    ...actualReaderPageShell(),
    // Constructor identity is the native seam; movement requires an explicit
    // focused Scroller fixture. Render probes do not simulate scroll physics.
    Scroller: class {},
    ReaderWindowCoordinator: { metrics: () => {
      const metrics = createDefaultReaderWindowMetrics();
      metrics.windowRect.width = 393; metrics.windowRect.height = 852;
      return metrics;
    } },
    readerInteractiveSafeBottom: metrics => metrics.interactiveSafeInsets?.bottom ?? 0,
    ...dependencies };
  globals.ReaderPressFeedback ??= productionReaderPressFeedback({ Color: globals.Color });
  globals.MangaDirectoryPressFeedback ??= productionMangaDirectoryPressFeedback(undefined,
    { LengthMetrics: globals.LengthMetrics, ColorMetrics: globals.ColorMetrics });
  const Component = new Function(...Object.keys(globals), `${stripTypeScriptTypes(output)}; return ReaderBuilderProbe;`)(...Object.values(globals));
  return { owner: new Component(undefined, hooks.initialParams ?? {}), Component, output };
}
