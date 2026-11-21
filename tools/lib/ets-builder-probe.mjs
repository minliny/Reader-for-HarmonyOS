import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';

// SDK/compiler and platform-recording core. No Reader production imports,
// component family factories, file fixtures or inferred business dependencies.
const sdkRoot = resolveEtsLoaderRoot();
export const builderSdkAvailable = existsSync(`${sdkRoot}/lib/process_component_class.js`);
// Cache only installed-SDK emitted code. Each use still constructs new real
// dependency/property/native recording owners; no UI state or callback is shared.
const sdkLoweringCache = new Map();
let sdkLoweringCompiles = 0, sdkLoweringHits = 0;
export const builderCompilationCacheStats = () => ({ compiles: sdkLoweringCompiles, hits: sdkLoweringHits, entries: sdkLoweringCache.size });
const digest = value => createHash('sha256').update(value).digest('hex');
const childPropertyMetadata = new Map();
let childPropertyParses = 0, childPropertyHits = 0;
export const builderChildPropertyCacheStats = () => ({ parses: childPropertyParses, hits: childPropertyHits, entries: childPropertyMetadata.size });
function selectComponentDeclaration(tree, name, ts) {
  const declarations = tree.statements.filter(node => node.members && node.name &&
    node.members.some(member => member.name?.getText(tree) === 'build'));
  const exact = name === undefined ? undefined : declarations.find(node => node.name.getText(tree) === name);
  if (exact !== undefined) return exact;
  const exported = declarations.filter(node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  assert.ok(exported.length === 1 || declarations.length === 1,
    'multi-component production ETS requires an explicit componentName or one exported component');
  return exported[0] ?? declarations[0];
}
export function builderComponentMembers(source, componentName) {
  const require = createRequire(import.meta.url), ts = require(`${sdkRoot}/node_modules/typescript`);
  const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
  const tree = ts.createSourceFile(virtualFilePath('ComponentMembers.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, [], 'actual component member declarations parse');
  const component = selectComponentDeclaration(tree, componentName, ts);
  assert.ok(component, 'select a component with a build declaration');
  return component.members.filter(member => member.name).map(member => member.name.getText(tree));
}
/** Share only successful immutable child Prop metadata before the existing
 * lowering cache. SDK registration receives a fresh Set on every invocation;
 * component classes, dependencies, windows and property runtimes stay fresh. */
export function builderChildProperties(definition, name) {
  const require = createRequire(import.meta.url), ts = require(`${sdkRoot}/node_modules/typescript`);
  const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
  const file = virtualFilePath('ReaderBuilderProbe.ets');
  const key = JSON.stringify([sdkRoot, ts.version, file, ts.ScriptTarget.Latest, ts.ScriptKind.ETS, options, name ?? null, definition]);
  let names = childPropertyMetadata.get(key);
  if (names === undefined) {
    childPropertyParses++;
    const tree = ts.createSourceFile(file, definition, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0, 'actual shared child ETS parses');
    const declaration = selectComponentDeclaration(tree, name, ts);
    names = Object.freeze((declaration?.members ?? []).filter(member => ts.isPropertyDeclaration(member) &&
      ts.getAllDecorators(member).some(decorator => {
        const expression = decorator.expression;
        return (ts.isCallExpression(expression) ? expression.expression : expression).getText(tree) === 'Prop';
      })).map(member => member.name.getText(tree)));
    // A full cache follows the original parse path without adding entries.
    if (childPropertyMetadata.size < 256) childPropertyMetadata.set(key, names);
  } else childPropertyHits++;
  return new Set(names);
}

export function createEtsBuilderProbe(source, names, dependencies = {}, hooks = {}) {
  assert.ok(builderSdkAvailable, 'SDK required for the real Builder closure probe');
  const require = createRequire(import.meta.url);
  const ts = require(`${sdkRoot}/node_modules/typescript`);
  const compiler = require(`${sdkRoot}/lib/process_component_class.js`);
  const utils = require(`${sdkRoot}/lib/utils.js`);
  const main = require(`${sdkRoot}/main.js`);
  const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
  const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
  const parse = text => ts.createSourceFile(virtualFilePath('ReaderBuilderProbe.ets'), text,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const componentDeclaration = (tree, name) => selectComponentDeclaration(tree, name, ts);
  const childProps = builderChildProperties;
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
  if (hooks.prepareComponent) {
    const prepared = hooks.prepareComponent({ source, names, dependencies, hooks, original, struct,
      ts, syntax, parse, componentDeclaration, childProps, require });
    ({ names, dependencies, hooks } = prepared);
  }
  // The SDK requires the declared callback for each selected @Watch field.
  for (let cursor = 0; cursor < names.length; cursor++) {
    const member = struct.members.find(candidate => candidate.name?.getText(original) === names[cursor]);
    for (const decorator of member ? ts.getAllDecorators(member) : []) {
      const call = decorator.expression;
      if (ts.isCallExpression(call) && call.expression.getText(original) === 'Watch' &&
          call.arguments.length === 1 && ts.isStringLiteral(call.arguments[0]) &&
          !names.includes(call.arguments[0].text)) names.push(call.arguments[0].text);
    }
    // A selected method cannot run without the private helpers it calls.
    // Pull same-struct members referenced as this.name(...) so fixtures do not
    // have to mirror every refactor-internal call site.
    if (member !== undefined) {
      for (const match of member.getText(original).matchAll(/this\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
        const callee = match[1];
        if (callee !== 'build' && !names.includes(callee) &&
            struct.members.some(candidate => candidate.name?.getText(original) === callee)) names.push(callee);
      }
    }
  }
  const members = names.map(name => {
    const member = struct.members.find(candidate => candidate.name?.getText(original) === name);
    assert.ok(member, `production member ${name}`);
    return member.getText(original);
  });
  // Selected methods call these owners but their declarations are not part of
  // the member slice. Keep the same names with an inert, overridable host.
  const hostFields = ['transientFeedback', 'feedback']
    .filter(name => !names.includes(name) && struct.members.some(member => member.name?.getText(original) === name))
    .map(name => `${name} = { show() { return true; }, reset() {} };`).join('\n');
  main.partialUpdateConfig.partialUpdateMode = true;
  utils.storedFileInfo.setCurrentArkTsFile();
  for (const [name, child] of Object.entries(hooks.childSources ?? {})) {
    syntax.componentCollection.customComponents.add(name);
    syntax.propCollection.set(name, childProps(child, name));
    const childTree = parse(child), declaration = componentDeclaration(childTree, name);
    const slots = declaration.members.filter(member => ts.isPropertyDeclaration(member) && ts.getAllDecorators(member)
      .some(decorator => decorator.getText(childTree) === '@BuilderParam')).map(member => member.name.getText(childTree));
    if (slots.length) syntax.builderParamObjectCollection.set(name, new Set(slots));
  }
  const file = parse(`@Component struct ReaderBuilderProbe {\n${hostFields}\n${members.join('\n')}\n${names.includes('build') ? '' : 'build() { Column() {} }'}\n}`);
  // The full SDK frontend collects declared method names before transforming
  // @Watch. Preserve that prepass for fixtures that include real decorated fields.
  syntax.classMethodCollection.set(file.fileName, new Map([['ReaderBuilderProbe', new Set(
    file.statements[0].members.filter(node => ts.isMethodDeclaration(node)).map(node => node.name.getText(file)),
  )]]));
  const properties = file.statements[0].members.filter(node => ts.isPropertyDeclaration(node));
  syntax.builderParamObjectCollection.set('ReaderBuilderProbe', new Set(properties.filter(node =>
    ts.getAllDecorators(node).some(decorator => decorator.getText(file) === '@BuilderParam'))
    .map(node => node.name.getText(file))));
  syntax.regularCollection.set('ReaderBuilderProbe', new Set(properties.filter(node =>
    ts.getAllDecorators(node).length === 0).map(node => node.name.getText(file))));
  syntax.componentCollection.currentClassName = 'ReaderBuilderProbe';
  require(`${sdkRoot}/lib/process_ui_syntax.js`).transformLog.sourceFile = file;
  const calledNames = new Set();
  const collectCalls = node => { if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) &&
    ts.isIdentifier(node.expression)) calledNames.add(node.expression.text); ts.forEachChild(node, collectCalls); };
  collectCalls(file);
  const schema = [...calledNames].sort().map(name => [name, syntax.componentCollection.customComponents.has(name),
    ...['propCollection','builderParamObjectCollection','regularCollection','propertyCollection'].map(key => [...(syntax[key]?.get(name) ?? [])].sort())]);
  const childSources = Object.entries(hooks.childSources ?? {}).sort(([a],[b])=>a.localeCompare(b)).map(([name,text])=>[name,digest(text)]);
  const cacheKey = digest(JSON.stringify([sdkRoot, ts.version, file.text, schema, childSources, hooks.allowEmptyBranchAdmission === true]));
  let lowered = sdkLoweringCache.get(cacheKey), output;
  if (lowered === undefined) {
    const diagnostics = [];
    let transformed;
    const result = ts.transform(file, [context => node => {
      require(`${sdkRoot}/lib/process_ui_syntax.js`).contextGlobal = context;
      transformed = compiler.processComponentClass(node.statements[0], context, diagnostics, false);
      const visit = child => ts.visitEachChild(child, visit, context);
      transformed = ts.visitNode(transformed, visit);
      return node;
    }]);
    result.dispose();
    assert.deepEqual(diagnostics, [], 'real SDK Builder/member transform has no diagnostics');
    output = ts.createPrinter().printNode(ts.EmitHint.Unspecified, transformed, file);
    sdkLoweringCompiles++;
    if (sdkLoweringCache.size >= 256) sdkLoweringCache.delete(sdkLoweringCache.keys().next().value);
    lowered = { output, javascript: stripTypeScriptTypes(output) };
    sdkLoweringCache.set(cacheKey, lowered);
  } else { sdkLoweringHits++; output = lowered.output; }
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
        const beforeEmpty = this.keys.get(`${key}-empty`);
        const before = this.observers.length; generator();
        const nextEmpty = before === this.observers.length;
        assert.ok(beforeEmpty === true || nextEmpty,
          'probe only admits switches to a newly empty branch; it does not model non-empty replacement');
        this.keys.set(key, id);
        this.keys.set(`${key}-empty`, nextEmpty);
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
  const platform = { ViewPU, $r: value => value,
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {}, getApiVersion: () => 21 },
    LengthMetrics: { vp: value => ({ value, unit: 'vp' }) },
    ColorMetrics: { resourceColor: color => ({ color }) },
    ...Object.fromEntries(['Blank', 'Divider', 'Button', 'Row', 'Column', 'Flex', 'Stack', 'Scroll', 'List', 'ListItem', 'Grid', 'GridItem', 'LazyForEach', 'Web', 'LoadingProgress', 'Progress', 'Circle', 'Rect', 'Shape', 'Path', 'Polygon', 'Polyline', 'Text', 'TextInput', 'TextArea', 'Select', 'Span', 'Marquee', 'Image', 'Slider', 'Toggle', 'Checkbox', 'Radio', 'ForEach', 'If', '__Common__']
      .map(name => [name, native(name)])),
    ...Object.fromEntries(['FontWeight', 'FlexAlign', 'VerticalAlign', 'HorizontalAlign', 'HitTestMode', 'Alignment', 'LayoutPolicy', 'AccessibilityRoleType',
      'LineCapStyle', 'ImageFit', 'TextAlign', 'TextOverflow', 'WordBreak', 'Visibility', 'Color', 'EnterKeyType', 'BarState', 'NestedScrollMode', 'EdgeEffect', 'Axis', 'SliderStyle', 'SliderChangeMode', 'ProgressType', 'FlexWrap', 'FlexDirection', 'ItemAlign',
      'SafeAreaType','SafeAreaEdge','LayoutSafeAreaType','LayoutSafeAreaEdge'].map(name => [name, new Proxy({}, { get: (_, key) => `${name}.${String(key)}` })])),
  };
  const globals = { ...platform,
    ...hooks.createGlobals?.({ source, dependencies, platform, Child }), ...dependencies };
  const Component = new Function(...Object.keys(globals), `${lowered.javascript}; return ReaderBuilderProbe;`)(...Object.values(globals));
  return { owner: new Component(undefined, hooks.initialParams ?? {}), Component, output };
}
