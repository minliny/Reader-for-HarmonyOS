import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"scaffold": {"description": "仅当前features/common/ReaderPageScaffold.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "index": {"description": "仅当前pages/Index.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "reader-shell": {"description": "仅当前features/shell/ReaderShell.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "manga": {"description": "仅当前features/manga/MangaReadingSurface.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "bookshelf": {"description": "仅当前features/bookshelf/BookshelfPage.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "detail": {"description": "仅当前features/bookshelf/LocalBookDetail.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "book-directory": {"description": "仅当前features/bookshelf/BookDirectoryPage.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "source-panel": {"description": "仅当前features/reading/SourceSwitchPanel.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "source-window": {"description": "仅当前features/source/SourceSwitchWindow.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "navigation-surface": {"description": "仅当前features/reading/ReaderDirectoryNavigationSurface.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "navigation-list": {"description": "仅当前features/reading/ReaderDirectoryNavigationList.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "flat-list": {"description": "仅当前features/reading/ReaderDirectoryList.ets root/direct metadata SDK降低与公开字段边", "resources": []}, "observed-metadata": {"description": "实际SourceSwitch retained row Observed缺失10905307负例", "resources": []}, "settings-controls": {"description": "实际settings Toggle/Slider/background/reset事件", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { mangaSurfaceSdkDependencies } = await import('./lib/manga-surface-sdk-probe.mjs');
const { readFileSync, existsSync } = await import('node:fs');
const { resolve, extname } = await import('node:path');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');

/** Read-only installed SDK parser and component lowering.
 * Register real production child metadata before checking assembly; no HAP,
 * compiler cache, signing or native/device actions. Not semantic typecheck. */

const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`), compiler = require(`${sdk}/lib/process_component_class.js`), main = require(`${sdk}/main.js`), utils = require(`${sdk}/lib/utils.js`), ui = require(`${sdk}/lib/process_ui_syntax.js`), componentMap = require(`${sdk}/lib/component_map.js`);
const root = resolve('entry/src/main/ets');
const roots={"scaffold": "features/common/ReaderPageScaffold.ets", "index": "pages/Index.ets", "reader-shell": "features/shell/ReaderShell.ets", "manga": "features/manga/MangaReadingSurface.ets", "bookshelf": "features/bookshelf/BookshelfPage.ets", "detail": "features/bookshelf/LocalBookDetail.ets", "book-directory": "features/bookshelf/BookDirectoryPage.ets", "source-panel": "features/reading/SourceSwitchPanel.ets", "source-window": "features/source/SourceSwitchWindow.ets", "navigation-surface": "features/reading/ReaderDirectoryNavigationSurface.ets", "navigation-list": "features/reading/ReaderDirectoryNavigationList.ets", "flat-list": "features/reading/ReaderDirectoryList.ets"};
const selected=selectedCase==='observed-metadata'?['features/source/SourceSwitchWindow.ets']:selectedCase==='settings-controls'?[]:[roots[selectedCase]];
const files=[];
for(const relative of selected){const file=resolve(root,relative);files.push(file);const src=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 for(const statement of src.statements.filter(ts.isImportDeclaration)){const name=statement.moduleSpecifier.text;if(!name.startsWith('.'))continue;const target=resolve(file,'..',name);const metadata=[target+'.ets',target+'.ts'].find(existsSync);if(metadata&&!files.includes(metadata))files.push(metadata);}}
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
assert.deepEqual(parseFailures, [], 'only selected root and explicit direct local metadata imports parse');

let bindings = 0;
const bindingFailures = [];
for (const relative of selected) {
    const tree = trees.get(resolve(root, relative));
    assert.ok(tree, relative);
    const visit = n => { if ((ts.isCallExpression(n)||ts.isEtsComponentExpression(n)) && ts.isIdentifier(n.expression) && components.has(n.expression.text) && n.arguments.length > 0 && ts.isObjectLiteralExpression(n.arguments[0])) {
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
if(selectedCase==='observed-metadata') {
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

}
for (const relative of selected) {
    const tree = trees.get(resolve(root, relative));
    const nodes = tree.statements.filter(n => n.members && n.name && n.members.some(m => m.name?.getText(tree) === 'build'));
    assert.ok(nodes.length > 0, `${relative}: actual production components`);
    for (const node of nodes) {
        const diagnostics = transformComponent(tree, node);
        assert.deepEqual(diagnostics, [], `${relative}/${node.name.getText(tree)}: real SDK component transform`);

    }
}
if(selectedCase==='settings-controls') {
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
        assert.ok(toggles.every(toggle => toggle.create.type === 'switch' && toggle.create.isOn === enabled));

        toggles[0].onChange(!enabled);
        const nodes=[...owner.nodes.values()];
        nodes.find(node=>node.type==='Slider').onChange(72);
        const choices=nodes.filter(node=>node.type==='Row'&&/^(暖纸|深墨)，/.test(node.accessibilityText??''));
        assert.equal(choices.length,2);
        choices[0].onClick();choices[1].onClick();
        nodes.find(node=>node.type==='Text'&&node.create==='恢复默认').onClick();
        assert.deepEqual(events, [['pageNumbers', !enabled], ['brightness',72],['background','paper'],['background','ink'],['reset']]);
    }


}

}
