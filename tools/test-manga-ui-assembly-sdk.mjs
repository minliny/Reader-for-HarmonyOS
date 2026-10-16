import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
/** Read-only installed SDK parser and component lowering.
 * Register real production child metadata before checking assembly; no HAP,
 * compiler cache, signing or native/device actions. Not semantic typecheck. */
import assert from 'node:assert/strict';
import { mangaSurfaceSdkDependencies } from './lib/manga-surface-sdk-probe.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
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
function registerObservedClasses(tree) {
    for (const node of tree.statements) {
        if (ts.isClassDeclaration(node) && node.name && ts.getAllDecorators(node).some(decorator =>
            (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression).getText(tree) === 'Observed'))
            syntax.observedClassCollection.add(node.name.getText(tree));
    }
}
for (const file of files) {
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, extname(file) === '.ets' ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
    trees.set(file, tree);
    for (const d of tree.parseDiagnostics)
        parseFailures.push({ file, line: tree.getLineAndCharacterOfPosition(d.start ?? 0).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
    // The normal frontend collects non-component @Observed classes too.
    // ObjectLink lowering must use actual declaration metadata, not a type
    // exemption or a hand-written list of candidate class names.
    registerObservedClasses(tree);
    for (const n of tree.statements) {
        if (!n.members || !n.name || !n.members.some(m => m.name?.getText(tree) === 'build'))
            continue;
        const name = n.name.getText(tree), properties = n.members.filter(ts.isPropertyDeclaration), members = new Set(properties.map(m => m.name?.getText(tree)).filter(Boolean));
        components.set(name, { file, tree, node: n, members });
        syntax.componentCollection.customComponents.add(name);
        const fileMethods = syntax.classMethodCollection.get(tree.fileName) ?? new Map();
        fileMethods.set(name, new Set(n.members.filter(ts.isMethodDeclaration).map(m => m.name.getText(tree))));
        syntax.classMethodCollection.set(tree.fileName, fileMethods);
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
const selected = ['features/common/ReaderPageScaffold.ets', 'pages/Index.ets', 'features/shell/ReaderShell.ets', 'features/manga/MangaReadingSurface.ets', 'features/bookshelf/BookshelfPage.ets', 'features/bookshelf/LocalBookDetail.ets', 'features/bookshelf/BookDirectoryPage.ets', 'features/reading/SourceSwitchPanel.ets', 'features/source/SourceSwitchWindow.ets', 'features/reading/ReaderDirectoryNavigationSurface.ets', 'features/reading/ReaderDirectoryNavigationList.ets', 'features/reading/ReaderDirectoryList.ets'];
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
console.log(`PASS ${bindings} actual custom-component field bindings in Index/Shell/manga/bookshelf/detail/directory/source/Native directory assembly`);
main.partialUpdateConfig.partialUpdateMode = true;
function transformComponent(tree, node) {
    utils.storedFileInfo.setCurrentArkTsFile();
    syntax.componentCollection.currentClassName = node.name.getText(tree);
    ui.transformLog.sourceFile = tree;
    const diagnostics = [];
    const transformed = ts.transform(tree, [context => file => {
        ui.contextGlobal = context;
        compiler.processComponentClass(node, context, diagnostics, false);
        return file;
    }]);
    transformed.dispose();
    return diagnostics;
}
// Negative control: removing the actual retained-row decorator still fails
// the installed SDK's ObjectLink admission, even when its field names exist.
const sourceWindow = trees.get(resolve(root, 'features/source/SourceSwitchWindow.ets'));
const retainedRow = sourceWindow.statements.find(node => ts.isClassDeclaration(node) &&
    node.name?.getText(sourceWindow) === 'SourceSwitchCandidateRow');
assert.ok(retainedRow);
const observed = ts.getAllDecorators(retainedRow).find(decorator => decorator.expression.getText(sourceWindow) === 'Observed');
assert.ok(observed, 'retained production row has its actual Observed decorator');
const mutatedText = sourceWindow.text.slice(0, observed.getStart(sourceWindow)) +
    sourceWindow.text.slice(observed.end);
const mutatedWindow = ts.createSourceFile(sourceWindow.fileName, mutatedText,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.deepEqual(mutatedWindow.parseDiagnostics, []);
syntax.observedClassCollection.delete(retainedRow.name.getText(sourceWindow));
try {
    registerObservedClasses(mutatedWindow);
    const mutatedConsumer = mutatedWindow.statements.find(node => node.name?.getText(mutatedWindow) === 'SourceSwitchNovelRow');
    assert.deepEqual(transformComponent(mutatedWindow, mutatedConsumer).map(diagnostic => ({ type: diagnostic.type, code: diagnostic.code })),
        [{ type: 'ERROR', code: '10905307' }],
        'actual SDK rejects ObjectLink when the production Observed decorator is removed');
} finally {
    registerObservedClasses(sourceWindow);
}
console.log('PASS actual SDK ObjectLink metadata comes from production Observed classes; missing decorator is rejected');
for (const relative of selected) {
    const tree = trees.get(resolve(root, relative));
    const nodes = tree.statements.filter(n => n.members && n.name && n.members.some(m => m.name?.getText(tree) === 'build'));
    assert.ok(nodes.length > 0, `${relative}: actual production components`);
    for (const node of nodes) {
        const diagnostics = transformComponent(tree, node);
        assert.deepEqual(diagnostics, [], `${relative}/${node.name.getText(tree)}: real SDK component transform`);
        console.log(`PASS SDK component transform ${relative}/${node.name.getText(tree)}`);
    }
}
const source = readFileSync('entry/src/main/ets/features/manga/MangaReadingSurface.ets', 'utf8');
for (const background of ['paper', 'ink'])
    for (const enabled of [false, true]) {
        const toggles = [], events = [];
        let current;
        const Toggle = new Proxy({ name: 'Toggle' }, { get(_, property) { if (property === 'name')
                return 'Toggle'; return (...args) => { if (property === 'create') {
                current = { create: args[0] };
                toggles.push(current);
            }
            else if (property !== 'pop') {
                current[property] = args[0];
            } }; } });
        const { owner } = createReaderBuilderProbe(source, ['settingsPanel', 'displayedBrightnessPercent', 'sheetChoice', 'sectionTitle', 'choiceIcon', 'isSheetChoiceSelected', 'inkColor', 'surfaceColor', 'paperColor', 'mutedColor', 'lineColor', 'greenColor', 'accentColor', 'softSurfaceColor'], { ...mangaSurfaceSdkDependencies, Toggle, ToggleType: { Switch: 'switch' } });
        Object.assign(owner, { backgroundPreference: background, automaticBrightness: enabled, showPageNumbers: enabled, brightnessPercent: 55,
            setBrightness: percent => events.push(['brightness', percent]), setPageNumbers: value => events.push(['pageNumbers', value]),
            setBackground: value => events.push(['background', value]), resetMangaPreferences: async () => events.push(['reset']) });
        owner.settingsPanel();
        assert.equal(toggles.length, 1,'the approved demo has one page-number switch');
        assert.ok(toggles.every(toggle => toggle.create.type === 'switch' && toggle.create.isOn === enabled && toggle.selectedColor === (background==='ink'?'#324C37':'#1F3528')));
        assert.equal(toggles[0].width,38);assert.equal(toggles[0].height,23);
        toggles[0].onChange(!enabled);
        const nodes=[...owner.nodes.values()];
        nodes.find(node=>node.type==='Slider').onChange(72);
        const choices=nodes.filter(node=>node.type==='Row'&&node.height===43&&node.layoutWeight===1);
        assert.equal(choices.length,2);assert.ok(choices.every(node=>node.borderRadius===12&&node.border.width===1));
        choices[0].onClick();choices[1].onClick();
        nodes.find(node=>node.type==='Text'&&node.create==='恢复默认').onClick();
        assert.deepEqual(events, [['pageNumbers', !enabled], ['brightness',72],['background','paper'],['background','ink'],['reset']]);
    }
console.log('PASS actual SDK demo settings: paper/ink selection colors, 38×23 native page switch, equal bottom-color choices, brightness/reset and preference callbacks');
console.log('Boundary: SDK parsing/member lowering + exact initializer field names; no project-wide semantic typecheck, package, native layout or device proof.');
