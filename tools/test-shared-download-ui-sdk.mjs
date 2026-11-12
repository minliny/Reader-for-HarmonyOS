import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'page-assembly': {
    description: 'SharedDownloadPage根及直接本地import元数据的有限SDK parse/initializer/lowering；storageSummary Prop、Normal、InlineSelect、DTO getter、overlay/action-sheet命中策略；含私有负对照，非全生产/语义typecheck/像素证明',
    resources: [],
  },
};
for (const id of selectContractCases(definitions)) {
  await runPageAssembly();
  recordContractCasePass(id);
}

async function runPageAssembly() {
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');
  const { resolve, extname, parse: parsePath, relative, sep } = await import('node:path');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
  const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const syntax = require(`${sdk}/lib/validate_ui_syntax.js`), compiler = require(`${sdk}/lib/process_component_class.js`);
  const main = require(`${sdk}/main.js`), utils = require(`${sdk}/lib/utils.js`);
  const ui = require(`${sdk}/lib/process_ui_syntax.js`), componentMap = require(`${sdk}/lib/component_map.js`);
  const root = resolve('entry/src/main/ets'), pagePath = resolve(root, 'features/downloads/ui/SharedDownloadPage.ets');
  const framePath = resolve(root, 'ui/surfaces/ReaderBoundedSurface.ets');
  const unrelatedPath = resolve(root, 'pages/ReaderControlMotionVerification.ets');
  const media = readdirSync(resolve('entry/src/main/resources/base/media')), baselineSources = new Map();
  const read = path => {
    if (!baselineSources.has(path)) baselineSources.set(path, readFileSync(path, 'utf8'));
    return baselineSources.get(path);
  };
  const parse = (path, source) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true,
    extname(path) === '.ets' ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
  const isCall = node => ts.isCallExpression(node) || ts.isEtsComponentExpression(node);
  const walk = (node, action) => { action(node); ts.forEachChild(node, child => walk(child, action)); };
  const tag = decorator => (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression);
  const fieldName = (node, tree) => node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : node.name?.getText(tree);
  function assertHitPolicy(node, tree, owner, explicit) {
    const policies = [];
    walk(node, call => {
      if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'hitTestBehavior') {
        policies.push(call.arguments.length === 1 ? ts.createPrinter().printNode(ts.EmitHint.Expression, call.arguments[0], tree) : '<missing>');
      }
    });
    if (explicit) assert.ok(policies.length > 0, `${owner} declares its actual Default hit policy`);
    assert.ok(policies.every(policy => policy === 'HitTestMode.Default'), `${owner} accepts only native-default or explicit Default hit policy`);
  }

  /** Root plus direct local import metadata only. Variants never write
   * production files, media, SDK caches, or another test's source. */
  function audit({ variants = new Map(), mediaNames = media } = {}) {
    const reads = new Set(), source = path => { reads.add(path); return variants.get(path) ?? read(path); };
    const rootTree = parse(pagePath, source(pagePath));
    assert.deepEqual(rootTree.parseDiagnostics, [], 'selected download root parses with the installed SDK');
    const files = new Set([pagePath]);
    for (const declaration of rootTree.statements.filter(ts.isImportDeclaration)) {
      const name = declaration.moduleSpecifier.text;
      if (!name.startsWith('.')) continue;
      const path = resolve(pagePath, '..', name);
      const dependency = [path, `${path}.ets`, `${path}.ts`].find(candidate => existsSync(candidate) && /\.(?:ets|ts)$/.test(candidate));
      assert.ok(dependency && dependency.startsWith(root + sep), `finite direct import resolves inside the ETS root: ${name}`);
      files.add(dependency);
    }
    const trees = new Map(), components = new Map();
    for (const path of files) {
      const tree = path === pagePath ? rootTree : parse(path, source(path));
      trees.set(path, tree);
      assert.deepEqual(tree.parseDiagnostics, [], `selected direct-import metadata parses: ${relative(root, path)}`);
      const methods = new Map();
      for (const node of tree.statements) {
        if (!node.members || !node.name || !node.members.some(member => member.name?.getText(tree) === 'build')) continue;
        const name = node.name.getText(tree), properties = node.members.filter(ts.isPropertyDeclaration);
        const members = new Set(properties.map(member => member.name.getText(tree)));
        assert.ok(!components.has(name), `finite metadata component name is unambiguous: ${name}`);
        components.set(name, { path, tree, node, members });
        syntax.componentCollection.customComponents.add(name);
        methods.set(name, new Set(node.members.filter(ts.isMethodDeclaration).map(member => member.name.getText(tree))));
        for (const [annotation, collection] of [
          ['BuilderParam', syntax.builderParamObjectCollection], ['Prop', syntax.propCollection], ['State', syntax.stateCollection],
          ['Link', syntax.linkCollection], ['ObjectLink', syntax.objectLinkCollection], ['StorageLink', syntax.storageLinkCollection],
          ['StorageProp', syntax.storagePropCollection], ['Consume', syntax.consumeCollection], ['Provide', syntax.provideCollection],
          ['LocalStorageLink', syntax.localStorageLinkCollection], ['LocalStorageProp', syntax.localStoragePropCollection],
        ]) collection.set(name, new Set(properties.filter(member => ts.getAllDecorators(member)
          .some(decorator => tag(decorator).getText(tree) === annotation)).map(member => member.name.getText(tree))));
        syntax.propertyCollection.set(name, members);
        syntax.regularCollection.set(name, new Set(properties.filter(member => ts.getAllDecorators(member).length === 0).map(member => member.name.getText(tree))));
        syntax.privateCollection.set(name, new Set(properties.filter(member => member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword)).map(member => member.name.getText(tree))));
        for (const member of node.members) if (member.name && ts.getAllDecorators(member)
          .some(decorator => tag(decorator).getText(tree) === 'Builder')) componentMap.CUSTOM_BUILDER_METHOD.add(member.name.getText(tree));
      }
      syntax.classMethodCollection.set(tree.fileName, methods);
    }
    const inputNode = rootTree.statements.find(node => node.name?.getText(rootTree) === 'SharedDownloadPage');
    assert.ok(inputNode, 'the finite root declares SharedDownloadPage');
    let bindings = 0;
    walk(inputNode, node => {
      if (!isCall(node) || !ts.isIdentifier(node.expression) || !components.has(node.expression.text) || node.arguments.length === 0) return;
      const initializer = node.arguments[0], child = components.get(node.expression.text);
      assert.ok(ts.isObjectLiteralExpression(initializer), `opaque component initializer is unsupported: ${node.expression.text}`);
      for (const field of initializer.properties) {
        assert.ok(!ts.isSpreadAssignment(field), `component initializer spread is unsupported: ${node.expression.text}`);
        const name = fieldName(field, rootTree); bindings++;
        assert.ok(child.members.has(name), `unknown component initializer field: ${node.expression.text}.${name}`);
      }
    });
    assert.ok(bindings > 0, 'the finite initializer check inspects actual root bindings');
    const storage = inputNode.members.find(member => member.name?.getText(rootTree) === 'storageSummary');
    assert.ok(storage && ts.isPropertyDeclaration(storage), 'storageSummary remains the real native field');
    assert.ok(ts.getAllDecorators(storage).some(decorator => tag(decorator).getText(rootTree) === 'Prop'), 'storageSummary requires its actual @Prop');
    assert.equal(storage.type?.getText(rootTree), 'DownloadStorageSummary');
    assert.equal(storage.initializer?.getText(rootTree), '{}', 'absent storage facts remain structured unknown');
    const buttons = [], selects = [], inlineSelects = [], stems = new Set();
    walk(inputNode, node => {
      if (!isCall(node) || !ts.isIdentifier(node.expression)) return;
      if (node.expression.text === 'Button') buttons.push(node);
      if (node.expression.text === 'Select') selects.push(node);
      if (node.expression.text === 'ReaderInlineSelect') inlineSelects.push(node);
      if (node.expression.text === '$r') {
        const name = node.arguments[0];
        assert.ok(name && ts.isStringLiteral(name), 'dynamic root resource identifiers require a separately evidenced resolver');
        if (name.text.startsWith('app.media.')) stems.add(name.text.slice('app.media.'.length));
      }
    });
    assert.ok(buttons.length > 0, 'actual root native buttons are inspected');
    for (const call of buttons) {
      const initializer = call.arguments[0];
      assert.ok(initializer && ts.isObjectLiteralExpression(initializer), 'download Button declares native constructor options');
      const type = initializer.properties.find(field => field.name?.getText(rootTree) === 'type');
      assert.equal(type?.initializer?.getText(rootTree), 'ButtonType.Normal', 'each download Button keeps the native Normal constructor');
    }
    assert.equal(selects.length, 0, 'the actual download page does not mount platform Select');
    assert.ok(inlineSelects.length > 0, 'actual download choices retain ReaderInlineSelect');
    for (const [name, indices] of [['bookRow', [0]], ['statusButton', [0]], ['chapterRow', [0, 1]], ['chapterGroup', [0, 1]]]) {
      const method = inputNode.members.find(member => member.name?.getText(rootTree) === name);
      for (const index of indices) assert.ok(ts.isFunctionTypeNode(method?.parameters[index]?.type), `${name} retains its current DTO getter`);
    }
    const mediaStems = new Set(mediaNames.map(name => parsePath(name).name));
    assert.ok(stems.size > 0, 'actual root media declarations are inspected');
    for (const stem of stems) assert.ok(mediaStems.has(stem), `exact media resource stem exists: ${stem}`);
    const frameTree = trees.get(framePath);
    assert.ok(frameTree, 'action-sheet frame is a real direct metadata import');
    const frame = frameTree.statements.find(node => node.name?.getText(frameTree) === 'ReaderBoundedFrameModifier');
    const apply = frame?.members.find(node => node.name?.getText(frameTree) === 'applyNormalAttribute');
    const actionSheet = apply?.body.statements.find(node => ts.isIfStatement(node) && node.expression.getText(frameTree) === "this.id === 'reader-action-sheet'");
    assert.ok(actionSheet, 'the actual finite action-sheet branch is inspected');
    assertHitPolicy(actionSheet.thenStatement, frameTree, 'action-sheet frame', true);
    main.partialUpdateConfig.partialUpdateMode = true;
    utils.storedFileInfo.setCurrentArkTsFile();
    syntax.componentCollection.currentClassName = inputNode.name.getText(rootTree);
    ui.transformLog.sourceFile = rootTree;
    const diagnostics = [];
    let lowered;
    const transformed = ts.transform(rootTree, [context => file => {
      ui.contextGlobal = context;
      lowered = compiler.processComponentClass(inputNode, context, diagnostics, false);
      const visit = node => ts.visitEachChild(node, visit, context);
      lowered = ts.visitNode(lowered, visit);
      return file;
    }]);
    transformed.dispose();
    assert.deepEqual(diagnostics, [], 'selected download root real SDK component lowering');
    const output = ts.createPrinter().printNode(ts.EmitHint.Unspecified, lowered, rootTree);
    assert.match(output, /SynchedPropertyObjectOneWayPU\(params\.storageSummary,/, 'SDK lowering retains structured storage publication observation');
    assert.match(output, /Button\.createWithChild\(\{\s*type:\s*ButtonType\.Normal/, 'SDK lowering retains the native Normal constructor');
    assert.doesNotMatch(output, /Button\.createWithChild\(\s*\)/, 'SDK lowering has no implicit Capsule constructor');
    for (const name of ['sheetOverlay', 'sheetSurface', 'operationsSurface', 'confirmationOverlay']) {
      const method = lowered.members.find(member => member.name?.getText(rootTree) === name);
      assert.ok(method, `actual overlay method exists: ${name}`);
      // The root overlay retains native default behavior. Its real child
      // surfaces declare Default; require it at those actual owners only.
      assertHitPolicy(method, rootTree, name, name !== 'sheetOverlay');
    }
    return { files: [...reads].map(path => relative(root, path)).sort(), bindings, mediaStems: [...stems].sort() };
  }

  const scope = audit(), page = read(pagePath);
  function replace(source, before, after) {
    assert.ok(source.includes(before), `private variant targets current production: ${before}`);
    return source.replace(before, after);
  }
  function memberVariant(path, owner, name, change) {
    const source = read(path), tree = parse(path, source);
    const declaration = tree.statements.find(node => node.name?.getText(tree) === owner);
    const member = declaration?.members.find(node => node.name?.getText(tree) === name);
    assert.ok(member, `private variant targets actual ${owner}.${name}`);
    const before = member.getText(tree), after = change(before);
    assert.notEqual(after, before, 'private variant must change its exact production member');
    return source.slice(0, member.getStart(tree)) + after + source.slice(member.end);
  }
  const negatives = [];
  function reject(name, variants, expected) {
    assert.throws(() => audit(variants), expected, `negative control is rejected: ${name}`);
    negatives.push(name);
  }
  reject('unknown-child-field', { variants: new Map([[pagePath, replace(page, 'SharedDownloadBookCover({ bookKey:', 'SharedDownloadBookCover({ unknownDownloadField: 1, bookKey:')]]) }, /unknown component initializer field: SharedDownloadBookCover\.unknownDownloadField/);
  reject('initializer-spread-rejected', { variants: new Map([[pagePath, replace(page, 'SharedDownloadBookCover({ bookKey:', 'SharedDownloadBookCover({ ...{ unknownDownloadField: 1 }, bookKey:')]]) }, /component initializer spread is unsupported/);
  reject('opaque-initializer-rejected', { variants: new Map([[pagePath, replace(page, 'ReaderPageScaffold({', 'ReaderPageScaffold(this.unknownInitializer, {')]]) }, /opaque component initializer is unsupported/);
  reject('missing-storage-prop', { variants: new Map([[pagePath, replace(page, '@Prop storageSummary:', 'storageSummary:')]]) }, /storageSummary requires its actual @Prop/);
  reject('missing-normal-constructor', { variants: new Map([[pagePath, replace(page, 'Button({ type: ButtonType.Normal })', 'Button({})')]]) }, /native Normal constructor/);
  reject('overlay-blocks-actions', { variants: new Map([[pagePath, memberVariant(pagePath, 'SharedDownloadPage', 'sheetOverlay', text => replace(text,
    "}.width('100%').height('100%');", "}.width('100%').height('100%').hitTestBehavior(HitTestMode.Block);"))]]) }, /sheetOverlay accepts only native-default or explicit Default/);
  reject('overlay-disables-actions', { variants: new Map([[pagePath, memberVariant(pagePath, 'SharedDownloadPage', 'sheetOverlay', text => replace(text,
    "}.width('100%').height('100%');", "}.width('100%').height('100%').hitTestBehavior(HitTestMode.None);"))]]) }, /sheetOverlay accepts only native-default or explicit Default/);
  reject('action-sheet-blocks-actions', { variants: new Map([[framePath, memberVariant(framePath, 'ReaderBoundedFrameModifier', 'applyNormalAttribute', text => replace(text, '.hitTestBehavior(HitTestMode.Default)', '.hitTestBehavior(HitTestMode.Block)'))]]) }, /action-sheet frame accepts only native-default or explicit Default/);
  const stem = scope.mediaStems[0];
  reject('same-prefix-wrong-resource', { mediaNames: [...media.filter(name => parsePath(name).name !== stem), `${stem}.wrong.svg`] }, /exact media resource stem exists/);
  reject('platform-select-regression', { variants: new Map([[pagePath, replace(page, 'ReaderInlineSelect({', 'Select({')]]) }, /does not mount platform Select/);
  reject('plain-dto-snapshot', { variants: new Map([[pagePath, replace(page, 'private bookRow(book: () => DownloadBookView', 'private bookRow(book: DownloadBookView')]]) }, /bookRow retains its current DTO getter/);
  reject('selected-root-sdk-parse', { variants: new Map([[pagePath, '@Component struct SharedDownloadPage { build( {']]) }, /selected download root parses/);
  const unrelated = audit({ variants: new Map([[unrelatedPath, '@Component struct BrokenUnrelatedPage { build( {']]) });
  assert.deepEqual(unrelated.files, scope.files, 'a broken unrelated page cannot widen the selected import/initializer boundary');
  assert.ok(!scope.files.includes(relative(root, unrelatedPath)), 'the unrelated-page control was not read');
  console.log(JSON.stringify({ kind: 'reader-download-page-assembly-proof', scope, rejectedNegativeControls: negatives,
    unrelatedPageDamage: 'IGNORED_OUTSIDE_FINITE_CLOSURE', boundary: 'SDK parse/component lowering and declared root initializer fields only; no semantic typecheck, whole-production scan, native event delivery, HAP or pixels' }));
}
