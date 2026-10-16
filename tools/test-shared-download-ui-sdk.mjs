import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
/** Read-only installed SDK parser and component lowering.
 * Register real production child metadata before checking assembly; no HAP,
 * compiler cache, signing or native/device actions. Not semantic typecheck. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`), compiler = require(`${sdk}/lib/process_component_class.js`), main = require(`${sdk}/main.js`), utils = require(`${sdk}/lib/utils.js`), ui = require(`${sdk}/lib/process_ui_syntax.js`), componentMap = require(`${sdk}/lib/component_map.js`);
const root = resolve('entry/src/main/ets');
const files = [];
function walk(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory())
        walk(p);
    else if (['.ets', '.ts'].includes(extname(p)))
        files.push(p);
} }
walk(root);
const trees = new Map(), components = new Map();
const parseFailures = [];
for (const file of files) {
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, extname(file) === '.ets' ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
    trees.set(file, tree);
    for (const d of tree.parseDiagnostics)
        parseFailures.push({ file, line: tree.getLineAndCharacterOfPosition(d.start ?? 0).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
    for (const n of tree.statements) {
        if (!n.members || !n.name || !n.members.some(m => m.name?.getText(tree) === 'build'))
            continue;
        const name = n.name.getText(tree), properties = n.members.filter(ts.isPropertyDeclaration), members = new Set(properties.map(m => m.name?.getText(tree)).filter(Boolean));
        components.set(name, { file, tree, node: n, members });
        syntax.componentCollection.customComponents.add(name);
        syntax.classMethodCollection.set(tree.fileName, new Map([[name, new Set(n.members.filter(ts.isMethodDeclaration).map(m => m.name.getText(tree)))]]));
        for (const [tag, collection] of [['BuilderParam', syntax.builderParamObjectCollection], ['Prop', syntax.propCollection], ['State', syntax.stateCollection], ['Link', syntax.linkCollection], ['ObjectLink', syntax.objectLinkCollection], ['StorageLink', syntax.storageLinkCollection], ['StorageProp', syntax.storagePropCollection], ['Consume', syntax.consumeCollection], ['Provide', syntax.provideCollection], ['LocalStorageLink', syntax.localStorageLinkCollection], ['LocalStorageProp', syntax.localStoragePropCollection]])
            collection.set(name, new Set(properties.filter(m => ts.getAllDecorators(m).some(d => (ts.isCallExpression(d.expression) ? d.expression.expression : d.expression).getText(tree) === tag)).map(m => m.name.getText(tree))));
        syntax.propertyCollection.set(name, members);
        syntax.regularCollection.set(name, new Set(properties.filter(m => ts.getAllDecorators(m).length === 0).map(m => m.name.getText(tree))));
        syntax.privateCollection.set(name, new Set(properties.filter(m => m.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword)).map(m => m.name.getText(tree))));
        for (const member of n.members) {
            if (ts.getAllDecorators(member).some(d => (ts.isCallExpression(d.expression) ? d.expression.expression : d.expression).getText(tree) === 'Builder'))
                componentMap.CUSTOM_BUILDER_METHOD.add(member.name.getText(tree));
        }
    }
}
assert.deepEqual(parseFailures, [], 'all production ETS and TS parse with installed SDK');
console.log(`PASS installed SDK parses ${files.length} production ETS/TS files, ${components.size} custom components registered`);
const selected = ['pages/Index.ets', 'features/settings/SettingsPage.ets', 'features/downloads/SharedDownloadPage.ets'];
let bindings = 0;
const bindingFailures = [];
for (const relative of selected) {
    const tree = trees.get(resolve(root, relative));
    assert.ok(tree, relative);
    const visit = n => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && components.has(n.expression.text) && n.arguments.length > 0 && ts.isObjectLiteralExpression(n.arguments[0])) {
        const component = components.get(n.expression.text);
        for (const prop of n.arguments[0].properties) {
            if (ts.isSpreadAssignment(prop))
                continue;
            const name = prop.name?.getText(tree).replace(/^['"]|['"]$/g, '');
            bindings++;
            if (!component.members.has(name))
                bindingFailures.push({ file: relative, line: tree.getLineAndCharacterOfPosition(prop.pos).line + 1, child: n.expression.text, unknown: name });
        }
    } ts.forEachChild(n, visit); };
    visit(tree);
}
assert.deepEqual(bindingFailures, [], 'real component initializer fields exist');
console.log(`PASS ${bindings} actual custom-component field bindings in shared download/settings/Index assembly`);
main.partialUpdateConfig.partialUpdateMode = true;
for (const relative of selected) {
    const tree = trees.get(resolve(root, relative));
    const node = tree.statements.find(n => n.members && n.name && n.members.some(m => m.name?.getText(tree) === 'build'));
    utils.storedFileInfo.setCurrentArkTsFile();
    syntax.componentCollection.currentClassName = node.name.getText(tree);
    ui.transformLog.sourceFile = tree;
    const diagnostics = [];
    let lowered;
    const transformed = ts.transform(tree, [context => file => {
        ui.contextGlobal = context;
        lowered = compiler.processComponentClass(node, context, diagnostics, false);
        // Match the real emitter visitation after component lowering: omitted
        // lifecycle statements for undecorated fields are not printable nodes.
        const visit = child => ts.visitEachChild(child, visit, context);
        lowered = ts.visitNode(lowered, visit);
        return file;
    }]);
    transformed.dispose();
    assert.deepEqual(diagnostics, [], `${relative}: real SDK component transform`);
    if (relative === 'features/downloads/SharedDownloadPage.ets') {
        // The SDK mutates the supplied class while lowering. Inspect a fresh
        // AST of the identical input text for source constructors/signatures;
        // retain the real lowered class separately for emitted-call assertions.
        const inputTree = ts.createSourceFile(tree.fileName, tree.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
        const inputNode = inputTree.statements.find(n => n.name?.getText(inputTree) === 'SharedDownloadPage');
        const storageProp = inputNode.members.find(member => member.name?.getText(inputTree) === 'storageSummary');
        assert.ok(storageProp && ts.isPropertyDeclaration(storageProp), 'storage statistics use the actual native component field');
        assert.ok(ts.getAllDecorators(storageProp).some(decorator =>
            (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression).getText(inputTree) === 'Prop'));
        assert.equal(storageProp.type?.getText(inputTree), 'DownloadStorageSummary');
        assert.equal(storageProp.initializer?.getText(inputTree), '{}', 'absence remains structured unknown data');
        const buttonCalls = [];
        const visitButtons = n => {
            if ((ts.isCallExpression(n) || ts.isEtsComponentExpression(n)) && ts.isIdentifier(n.expression) && n.expression.text === 'Button') buttonCalls.push(n);
            ts.forEachChild(n, visitButtons);
        };
        visitButtons(inputNode);
        assert.ok(buttonCalls.length > 0);
        for (const call of buttonCalls) {
            const options = call.arguments[0];
            assert.ok(options && ts.isObjectLiteralExpression(options), 'download Button declares actual native creation options');
            const type = options.properties.find(prop => prop.name?.getText(inputTree) === 'type');
            assert.equal(type?.initializer?.getText(inputTree), 'ButtonType.Normal', 'zero corner radius cannot substitute for the native Normal button type');
        }
        const output = ts.createPrinter().printNode(ts.EmitHint.Unspecified, lowered, tree);
        assert.match(output, /SynchedPropertyObjectOneWayPU\(params\.storageSummary,/,
            'real SDK lowering observes subsequent structured storage publications');
        assert.match(output, /Button\.createWithChild\(\{\s*type:\s*ButtonType\.Normal/, 'the actual SDK lowering retains the explicit Normal constructor');
        assert.doesNotMatch(output, /Button\.createWithChild\(\s*\)/, 'SDK output contains no implicit Capsule constructor');
        const selectCalls = [], inlineSelectCalls = [];
        const visitSelects = n => {
            if ((ts.isCallExpression(n) || ts.isEtsComponentExpression(n)) && ts.isIdentifier(n.expression) && n.expression.text === 'Select') selectCalls.push(n);
            if ((ts.isCallExpression(n) || ts.isEtsComponentExpression(n)) && ts.isIdentifier(n.expression) && n.expression.text === 'ReaderInlineSelect') inlineSelectCalls.push(n);
            ts.forEachChild(n, visitSelects);
        };
        visitSelects(inputNode);
        assert.equal(selectCalls.length, 0, 'download pages no longer mount platform Select directly');
        assert.equal(inlineSelectCalls.length, 6, 'all download choices use the shared ReaderInlineSelect host');

        for (const [name, indices] of [['bookRow', [0]], ['statusButton', [0]], ['chapterRow', [0, 1]], ['chapterGroup', [0, 1]]]) {
            const method = inputNode.members.find(member => member.name?.getText(inputTree) === name);
            for (const index of indices) assert.ok(ts.isFunctionTypeNode(method?.parameters[index]?.type),
                `${name} consumes a current DTO getter rather than an initial plain snapshot`);
        }
    }
    console.log(`PASS SDK component transform ${relative}`);
}

for (const relative of selected) {
 const source = readFileSync(resolve(root, relative), 'utf8');
 for (const match of source.matchAll(/\$r\('app\.media\.([^']+)'\)/g)) assert.ok(readdirSync(resolve('entry/src/main/resources/base/media')).some(name => name.startsWith(match[1] + '.')), `resource exists: ${match[1]}`);
}
console.log('PASS shared download installed SDK parse, production component fields, member lowering and media resources; no full HAP or native visual proof');
