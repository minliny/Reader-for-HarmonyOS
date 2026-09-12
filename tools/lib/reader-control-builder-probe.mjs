import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';

const sdkRoot = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
export const readerBuilderSdkAvailable = existsSync(`${sdkRoot}/lib/process_component_class.js`);

/** Run the actual SDK-emitted observer closures, mounting each Builder once.
 * This models closure lifetime, not ArkUI's dependency scheduling/native layout.
 * No source files, compiler cache, HAP or device are written by this helper. */
export function createReaderBuilderProbe(source, names, dependencies = {}) {
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
  const original = parse(source);
  assert.equal(original.parseDiagnostics.length, 0, 'production ETS parses');
  const struct = original.statements.find(n => n.members && n.name &&
    n.members.some(m => m.name?.getText(original) === 'build'));
  const members = names.map(name => {
    const member = struct.members.find(n => n.name?.getText(original) === name);
    assert.ok(member, `production member ${name}`);
    if (member.getText(original).includes('@Builder')) {
      require(`${sdkRoot}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
    }
    return member.getText(original);
  });
  main.partialUpdateConfig.partialUpdateMode = true;
  utils.storedFileInfo.setCurrentArkTsFile();
  // Register the actual shared child Prop names so the SDK emits its real
  // updateStateVarsOfChildByElmtId payload instead of an empty test stub.
  const childName = 'ReaderControlSwitchTrack';
  const childSource = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderControlSwitchTrack.ets', import.meta.url), 'utf8');
  syntax.componentCollection.customComponents.add(childName);
  syntax.propCollection.set(childName, new Set([...childSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
  const file = parse(`@Component struct ReaderBuilderProbe {\n${members.join('\n')}\n build() { Column() {} }\n}`);
  require(`${sdkRoot}/lib/process_ui_syntax.js`).transformLog.sourceFile = file;
  const diagnostics = [];
  let transformed;
  const result = ts.transform(file, [context => node => {
    require(`${sdkRoot}/lib/process_ui_syntax.js`).contextGlobal = context;
    transformed = compiler.processComponentClass(node.statements[0], context, diagnostics, false);
    return node;
  }]);
  result.dispose();
  assert.deepEqual(diagnostics, [], 'real SDK Builder/member transform has no diagnostics');
  const output = ts.createPrinter().printNode(ts.EmitHint.Unspecified, transformed, file);
  assert.match(output, /observeComponentCreation2/, 'exercise real SDK observer closures');
  let activeOwner, activeId;
  const native = name => { const instance = new Proxy({ name }, { get(target, property) {
    if (property === 'name') return name;
    return (...args) => {
      if (property === 'pop' || activeOwner === undefined) return;
      const record = activeOwner.nodes.get(activeId);
      activeOwner.attributeCalls.push({ id: activeId, property, args });
      if (property === 'attributeModifier') { args[0].applyNormalAttribute(instance); return instance; }
      if (property === 'create') record.type = name;
      record[property] = args.length === 1 ? args[0] : args;
      return instance;
    };
  } }); return instance; };
  class ViewPU {
    constructor() { this.observers = []; this.nodes = new Map(); this.children = new Map(); this.keys = new Map(); this.attributeCalls = []; }
    finalizeConstruction() {}
    observeComponentCreation2(callback, component) {
      const id = this.observers.length;
      this.observers.push(callback);
      this.nodes.set(id, { type: component.name, id });
      this.runObserver(id, true);
    }
    runObserver(id, initial) {
      activeOwner = this; activeId = id;
      this.observers[id](id, initial);
      activeOwner = undefined;
    }
    replay() {
      const before = this.observers.length;
      for (let id = 0; id < before; id++) this.runObserver(id, false);
      assert.equal(this.observers.length, before, 'state update does not remount Builder actors');
    }
    forEachUpdateFunction(id, data, generator, key) {
      const seen = this.keys.get(id) ?? new Set(); this.keys.set(id, seen);
      data.forEach((item, index) => {
        const identity = key(item, index);
        if (!seen.has(identity)) { seen.add(identity); generator(item, index); }
      });
    }
    ifElseBranchUpdateFunction(id, generator) {
      if (!this.keys.has(`if-${activeId}`)) { this.keys.set(`if-${activeId}`, id); generator(); }
    }
    updateStateVarsOfChildByElmtId(id, params) {
      const record = this.children.get(id); assert.ok(record, 'native child retained');
      Object.assign(record.params, params);
    }
    static create(child) { child.owner.children.set(child.id, child); }
  }
  class Child {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
  }
  const globals = { ViewPU, ReaderControlSwitchTrack: Child, $r: value => value,
    ...Object.fromEntries(['Row', 'Column', 'Stack', 'Scroll', 'Text', 'TextInput', 'Span', 'Image', 'ForEach', 'If', '__Common__']
      .map(name => [name, native(name)])),
    ...Object.fromEntries(['FontWeight', 'VerticalAlign', 'HorizontalAlign', 'HitTestMode', 'Alignment',
      'TextAlign', 'TextOverflow', 'Visibility', 'Color', 'EnterKeyType', 'BarState', 'EdgeEffect'].map(name => [name, new Proxy({}, { get: (_, key) => `${name}.${String(key)}` })])),
    ...Object.fromEntries([...source.matchAll(/\b(TOK_[A-Z0-9_]+)\b/g)].map(m => [m[1], m[1]])),
    ...dependencies };
  const Component = new Function(...Object.keys(globals), `${stripTypeScriptTypes(output)}; return ReaderBuilderProbe;`)(...Object.values(globals));
  return { owner: new Component(undefined, {}), output };
}
