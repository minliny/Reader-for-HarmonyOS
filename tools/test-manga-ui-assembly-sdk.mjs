/** Read-only installed SDK parser and component lowering.
 * Register real production child metadata before checking assembly; no HAP,
 * compiler cache, signing or native/device actions. Not semantic typecheck. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const require = createRequire(import.meta.url), sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
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
const selected = ['pages/Index.ets', 'features/shell/ReaderShell.ets', 'features/manga/MangaReadingSurface.ets', 'features/bookshelf/BookshelfPage.ets', 'features/bookshelf/LocalBookDetail.ets', 'features/bookshelf/BookDirectoryPage.ets', 'features/reading/SourceSwitchPanel.ets', 'features/source/SourceSwitchWindow.ets', 'features/reading/ReaderDirectoryNavigationSurface.ets', 'features/reading/ReaderDirectoryNavigationList.ets', 'features/reading/ReaderDirectoryList.ets'];
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
for (const relative of selected) {
    const tree = trees.get(resolve(root, relative));
    const node = tree.statements.find(n => n.members && n.name && n.members.some(m => m.name?.getText(tree) === 'build'));
    utils.storedFileInfo.setCurrentArkTsFile();
    syntax.componentCollection.currentClassName = node.name.getText(tree);
    ui.transformLog.sourceFile = tree;
    const diagnostics = [];
    const transformed = ts.transform(tree, [context => file => { ui.contextGlobal = context; compiler.processComponentClass(node, context, diagnostics, false); return file; }]);
    transformed.dispose();
    assert.deepEqual(diagnostics, [], `${relative}: real SDK component transform`);
    console.log(`PASS SDK component transform ${relative}`);
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
        const { owner, output } = createReaderBuilderProbe(source, ['settingsPanel', 'option', 'inkColor', 'surfaceColor', 'paperColor', 'mutedColor', 'lineColor'], { Toggle, ToggleType: { Switch: 'switch' } });
        Object.assign(owner, { backgroundPreference: background, automaticBrightness: enabled, showPageNumbers: enabled, brightnessPercent: 55,
            setBrightness: (percent, automatic) => events.push(['brightness', percent, automatic]), setPageNumbers: value => events.push(['pageNumbers', value]) });
        owner.settingsPanel();
        assert.equal(toggles.length, 2);
        assert.ok(toggles.every(toggle => toggle.create.type === 'switch' && toggle.create.isOn === enabled && toggle.selectedColor === '#1F3528'));
        toggles[0].onChange(!enabled);
        toggles[1].onChange(!enabled);
        assert.deepEqual(events, [['brightness', 55, !enabled], ['pageNumbers', !enabled]]);
        assert.match(output, /Toggle\.selectedColor\('#1F3528'\)/);
    }
console.log('PASS actual SDK settings-panel native Toggle properties: paper/ink, on/off, explicit approved green and independent existing callbacks');
console.log('Boundary: SDK parsing/member lowering + exact initializer field names; no project-wide semantic typecheck, package, native layout or device proof.');
