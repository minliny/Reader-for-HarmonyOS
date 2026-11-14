import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions = {
    'tts-original-targets': { description: 'Hash-bound Make V17 Quick native HTML button targets compared with the current paid response allocation, containment and peer separation', resources: [] },
    'authored-allocation-sdk': { description: 'Original default macros, same-pass typed module profiles, paid touch regions and actual SDK paint remain separate at real narrow/font growth inputs', resources: [] },
    'timer-custom-allocation-sdk': { description: 'Actual TTS timer child combination pays all four thirty-painted minute/second actions inside current and narrow enlarged-text viewports without horizontal hiding', resources: [] },
    'tts-paint-target-sdk': { description: 'Approved Make paint stays separate from actual paid response regions, including constrained44 goals, centered Full stop, glyph recipes and native choice ownership', resources: [] },
    'module-shell-sdk': { description: 'Current Home and all module receipts retain the common measured outer shell while content budgets, stale fencing and true metric reflow remain current', resources: [] },
    'admission-sdk': { description: 'Current experience scheduling to measured Panel admission across orientations and wide windows, render-safe readiness and stale frame negatives', resources: [] },
    'module-minimum-budget': { description: 'Shipping measured appearance/settings/search/replace/autopage budgets at four scales and exact narrow/wide widths', resources: [] },
    'native-targets-sdk': { description: 'Actual SDK control target attributes and paid parent geometry for reading modules', resources: [] },
    'manga-tts-sdk': { description: 'Manga dock/preferences and TTS configuration actual SDK targets, scale and busy identity', resources: [] },
    'header-home-sdk': { description: 'Actual reading topbar and home native frames, scalable title/action/slider parents with old fixed-height negatives', resources: [] },
    'brightness-sdk': { description: 'Constrained brightness rail Scroll, circular measured paint inside paid targets, cap centres, actual Pan/Tap declarations and same-owner resize', resources: [] },
    'rounded-parent-sdk': { description: 'Measured brightness child containment keeps unpaid crops and removes only a redundant outer mask; empty font paint keeps its separate motion mask.', resources: [] },
};
for (const id of selectContractCases(definitions)) {
    if (id === 'tts-original-targets') await ttsOriginalTargets();
    else await run(id);
    recordContractCasePass(id);
}

async function ttsOriginalTargets() {
    const { default: assert } = await import('node:assert/strict');
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { readerControlActor, readerControlPaidResponses } =
        await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
    const source = readFileSync(new URL('./fixtures/tts-reference/PhoneScreen.tsx', import.meta.url), 'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'),
        '731582c1ac493d48f1ebdaae1e5527de5dfe3f391d37d8c85a51643ce72b4a3c');
    const { ts } = installedEtsCompiler();
    const tree = ts.createSourceFile('PhoneScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(tree.parseDiagnostics, []);
    const quick = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ReadControlCardRestyled');
    assert.ok(quick);
    const original = [];
    function visit(node) {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'button') {
            const properties = node.openingElement.attributes.properties;
            const label = properties.find(value => value.name?.getText(tree) === 'aria-label')?.initializer;
            const classes = properties.find(value => value.name?.getText(tree) === 'className')?.initializer;
            const size = classes && ts.isStringLiteral(classes) ? /\bsize-\[(\d+)px\]/.exec(classes.text) : undefined;
            if (label && size) original.push({ label: ts.isStringLiteral(label) ? label.text : label.expression.getText(tree),
                width: Number(size[1]), height: Number(size[1]) });
        }
        ts.forEachChild(node, visit);
    }
    visit(quick);
    assert.deepEqual(original.map(value => value.label), ['上一句', 'playing ? "暂停" : "播放"', '停止', '下一句']);
    assert.deepEqual(original.map(value => [value.width, value.height]), [[28, 28], [36, 36], [28, 28], [28, 28]]);
    const oracle = JSON.parse(readFileSync(new URL('./fixtures/reader-control-tts-make-20260911.json', import.meta.url), 'utf8'));
    const [, , width, height] = oracle.shared.playback[0];
    const kinds = ['previous', 'toggle', 'stop', 'next'];
    const paints = kinds.map(kind => {
        const [x, y, w, h] = oracle.shared[kind][0];
        assert.equal(y + h / 2, height / 2, 'original transport boxes use the playback-card coordinate space');
        return readerControlActor(x, y, w, h);
    });
    const allocation = readerControlPaidResponses(paints, readerControlActor(0, 0, width, height));
    assert.deepEqual(allocation.map(value => value.response.width), [39, 36, 32.5, 37.5]);
    assert.deepEqual(allocation.map(value => value.response.height), [44, 44, 44, 44]);
    for (const [index, value] of allocation.entries()) {
        const response = value.response, paint = paints[index];
        assert.ok(response.x <= paint.x && response.y <= paint.y);
        assert.ok(response.x + response.width >= paint.x + original[index].width);
        assert.ok(response.y + response.height >= paint.y + original[index].height);
        assert.ok(response.x >= 0 && response.y >= 0 && response.x + response.width <= width && response.y + response.height <= height);
        if (index > 0) {
            const previous = allocation[index - 1].response;
            assert.ok(previous.x + previous.width <= response.x, 'adjacent paid targets remain disjoint');
        }
    }
    console.log(JSON.stringify({ kind: 'make-v17-quick-button-target-comparison', original,
        current: allocation.map(value => ({ width: value.response.width, height: value.response.height, conflict: value.conflict })),
        boundary: 'Frozen original HTML button dimensions and current pure allocation. Native event dispatch keeps its own evidence.' }));
}
async function run(id) {
    const { default: assert } = await import('node:assert/strict');
    const { readFileSync } = await import('node:fs');
    const { registerHooks } = await import('node:module');
    registerHooks({ resolve(specifier, context, next) {
            try {
                return next(specifier, context);
            }
            catch (error) {
                if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
                    return next(specifier + '.ts', context);
                throw error;
            }
        } });
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { selectedProductionClasses, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
    const fontFamilies = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
    const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
    const { readerTypographyRoles, readerMessageStyles } = await import('./lib/reader-typography-probe.mjs');
    const geo = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
    const motion = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts');
    const controls = await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
    const session = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
    const receipt = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMinimumReceipt.ts');
    const actor = await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
    const appearance = await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts');
    const settings = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSettingsGeometry.ts');
    const search = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts');
    const replace = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');
    const playback = await import('../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts');
    const headerGeometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHeaderGeometry.ts');
    const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
    const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
    const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    const ui = file => read('entry/src/main/ets/features/reading/ui/' + file);
    const classes = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url), ['ReaderTextStyle', 'ReaderInheritedTextStyle']);
    const measure = pureModuleProbe(ui('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
    const deps = { ScrollDirection: { Horizontal: 'horizontal', Vertical: 'vertical' }, ...readerTypographyRoles, ...readerMessageStyles, ...classes, ...measure, ...appearance, ...settings, ...search, ...replace, ...playback, ...headerGeometry, ...actor, ...controls, ...fontFamilies, ...readerFoundationTokens, readerAppColor };
    const pure = (file, names, source = ui(file)) => pureModuleProbe(source, file, deps, names);
    const headerSource = read('entry/src/main/ets/ui/chrome/ReaderReadingTopBar.ets');
    const compiler = installedEtsCompiler();
    const assertTypographyBindings = (source, file) => {
        const { ts, options } = compiler;
        const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
        const imported = tree.statements.filter(ts.isImportDeclaration)
            .filter(node => node.moduleSpecifier.text.endsWith('/ReaderTypography'))
            .flatMap(node => node.importClause?.namedBindings?.elements ?? []).map(node => node.name.text);
        const used = new Set();
        const visit = node => {
            if (ts.isIdentifier(node) && node.text.startsWith('TYPE_')) used.add(node.text);
            ts.forEachChild(node, visit);
        };
        visit(tree);
        for (const name of used)
            assert.equal(imported.filter(value => value === name).length, 1, `${file} imports ${name} exactly once`);
    };
    const headerTree = compiler.ts.createSourceFile('ReadingHeader.ets', headerSource, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.ETS, compiler.options);
    const headerMeasure = headerTree.statements.find(n => compiler.ts.isFunctionDeclaration(n) && n.name?.text === 'readerReadingTopBarHeight');
    Object.assign(deps, pureModuleProbe(headerMeasure.getText(headerTree), 'ReadingHeaderMeasure.ets', {
        ...deps,
        ...pureModuleProbe(read('entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']),
        readerWindowMetrics: () => ({ systemFontScale: 1 }),
    }, ['readerReadingTopBarHeight']));
    let scale = 1;
    let measurementCalls = 0;
    const advance = text => [...text].reduce((sum, point) => sum + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef]/u.test(point) ? 1 : .55), 0);
    const context = { px2vp: n => n, vp2px: n => n, getMeasureUtils: () => ({
            measureText: o => Math.max(1, advance(o.textContent)) * Number.parseFloat(o.fontSize) * scale,
            measureTextSize(o) {
                measurementCalls++;
                const font = Number.parseFloat(o.fontSize) * scale;
                const line = Number.parseFloat(o.lineHeight ?? o.fontSize) * scale * (o.lineHeight ? 1 : 1.5);
                const width = Math.max(1, advance(o.textContent)) * font;
                const rows = o.maxLines === 1 ? 1 : Math.ceil(width / Math.max(1, o.constraintWidth));
                return { width: Math.min(width, o.constraintWidth), height: line * rows };
            },
        }) };
    Object.assign(deps, pureModuleProbe(read('entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']));
    const ttsFacts = { playbackLabel: '朗读内容', status: '未开始', voice: '很长的中文女声音色', timerCaption: '不开启', timerSummary: '00:00', minutes: '00', seconds: '00', rate: '1.00x', error: '', seek: false, online: false, serviceDescription: '设备内置语音', manageLabel: '已配置 · 编辑', engineValue: '系统语音', languageValue: '中文普通话', failureValue: '停止并提示' };
    const widths = w => ({ panelWidthVp: w + 26, quickContentWidthVp: w - 52, fullContentWidthVp: w });
    const minimum = pure('ReaderControlMinimumMeasurement.ets', ['measureReaderControlMinimum',
        'readerControlModuleFactsGeometryKey', 'readerControlModuleFactsDisplayEqual',
        'readerControlModuleFactsMatch', 'readerControlModuleProfileMatches']);
    Object.assign(deps, minimum);
    const appInput = { themes: ['纸白', '暖纸', '米色', '黑色', '绿纸', '灰色', '棕色', '淡蓝'], themeSummary: '日间：纸白 · 夜间：黑色',
        themeActions: ['设为日间主题', '设为夜间主题'], fonts: Array.from({ length: 9 }, (_, i) => ({ label: i === 8 ? '导入字体' : '系统字体', family: 'HarmonyOS Sans' })),
        indentValue: '2字符', languageValue: '繁转简', indentOptions: ['无', '1字符', '2字符'], languageOptions: ['原文', '繁转简', '简转繁'],
        metricLabels: ['字号', '行距', '段距', '字距'], metricValues: ['32px', '1.50', '10px', '1px'] };
    const ap = pure('ReaderControlAppearanceMinimum.ets', ['measureReaderControlAppearanceMinimum']);
    const st = pure('ReaderControlSettingsMinimum.ets', ['measureReaderControlSettingsMinimum', 'readerControlSettingsGroupLabel', 'readerControlSettingsOptionLabel']);
    const se = pure('ReaderControlSearchMinimum.ets', ['measureReaderSearchMinimum', 'readerControlSearchMinimumFacts']);
    const rp = pure('ReaderControlReplaceMinimum.ets', ['measureReaderControlReplaceMinimum']);
    const tt = pure('ReaderControlTtsMinimum.ets', ['measureReaderTtsMinimum', 'sampleReaderTtsTextMinimum', 'readerTtsTimerCardLayout', 'readerControlTtsTwoDigits']);
    const au = pure('ReaderControlAutoPageMinimum.ets', ['measureReaderControlAutoPageMinimum', 'readerControlAutoPageMinimumFacts']);
    const searchFacts = { query: '查找很长的正文关键字', title: '第一章 长章节', snippet: '正文命中关键字', message: '', hasResults: true, resultsMode: true, loading: false, loadMoreLabel: '加载更多结果', loadMoreMessage: '' };
    const optionLabels = [['从左到右', '从右到左', '跟随系统'], ['覆盖', '仿真', '滑动', '滚动', '无动画'], ['30秒', '1分钟', '5分钟', '10分钟', '永不']];
    const mkSettings = w => st.measureReaderControlSettingsMinimum(context, w, ['阅读方向', '翻页方式', '屏幕超时'], optionLabels, ['隐藏底部导航栏', '拓展到刘海（灵动岛）', '文字两端对齐']);
    const currentPanelMethods = ['currentLayout', 'currentMinimumKey', 'currentMinimumIdentity', 'committedMinimumIdentity',
        'minimumPresentationAvailable', 'minimumHeaderInter', 'minimumTitle', 'controlTouchHandler', 'currentMoreMenuOwnerScope',
        'presentedHomeChapterTitle', 'presentedHomeTotalChapters', 'controlCallbackGuard', 'controlActionScope', 'controlActionHandler', 'brightnessGestureHandler'];
    const currentHostMethods = ['controlMinimumCommittedIdentity', 'activeControlNavigationIntent',
        'controlMinimumRequestLocation', 'controlMinimumOwnerKey', 'controlMinimumEnvironmentKey'];
    // Include the actual readonly projection getters called by the selected
    // widgets. These finite legacy fixtures keep the production default
    // preparedMinimumRequired=false; they do not stand in for formal receipt
    // lifecycle tests or initialize another display-state owner.
    const displayMethods = (file, text = ui(file)) => {
        const tree = compiler.ts.createSourceFile(file, text, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.ETS, compiler.options);
        const component = tree.statements.find(node => compiler.ts.isStructDeclaration?.(node));
        return (component?.members ?? []).filter(node => compiler.ts.isMethodDeclaration(node) &&
            (node.name?.getText(tree).startsWith('display') || ['presentationPrepared', 'preparedProfile', 'currentMinimumProfile'].includes(node.name?.getText(tree))))
            .map(node => node.name.getText(tree));
    };
    const native = (file, names, additional = {}, hooks = {}) => {
        const owner = createReaderBuilderProbe(ui(file), [...new Set([...names, ...displayMethods(file),
        ...(file === 'ReaderControlPanel.ets' ? currentPanelMethods : []),
        ...(file === 'LocalReadingExperience.ets' ? currentHostMethods : [])])], { ...deps, ...additional }, hooks).owner;
        if (file === 'ReaderControlTtsContent.ets') owner.sourceOnly = 'none';
        return owner;
    };
    const nodes = (owner, type) => [...owner.nodes.values()].filter(n => n.type === type);
    const deepNodes = owner => [...owner.nodes.values(), ...[...owner.children.values()].filter(child => child.nodes).flatMap(deepNodes)];
    const target = (node, why) => { assert.ok(node, why); assert.ok(node.width >= 44 && node.height >= 44, `${why} pays >=44, got ${node.width}x${node.height}`); };
    const paidResponse = (node, host, why) => {
        assert.ok(node, why);
        const region = node.responseRegion ?? { x: 0, y: 0, width: node.width, height: node.height };
        const x = (node.position?.x ?? 0) + region.x, y = (node.position?.y ?? 0) + region.y;
        assert.ok(region.width > 0 && region.height > 0, why + ' has a usable declared response');
        assert.ok(x >= -.01 && y >= -.01 && x + region.width <= host.width + .01 && y + region.height <= host.height + .01,
            why + ' is paid inside the actual parent slot');
        return region;
    };
    if (id === 'authored-allocation-sdk') {
        const { createHash } = await import('node:crypto');
        const oracleSource = read('tools/fixtures/reader-control-tts-make-20260911.json');
        assert.equal(createHash('sha256').update(oracleSource).digest('hex'), '53cfb304a67a9311beb69cadd22501fc78ad33adc747cbd8b8d3a39371cd590d');
        const original = JSON.parse(oracleSource);
        const frozenMotionSource = read('tools/fixtures/reader-control-restored-baseline-20260905.json');
        const frozenMotion = JSON.parse(frozenMotionSource);
        // Reuse the exact endpoint extraction used by the existing source
        // geometry cases, without importing or executing those test cases.
        const sourceEndpoint = (module, nodeId, property, endpoint) => {
            const record = frozenMotion.records.find(value => value.module === module && value.direction === 'expand');
            const node = record.motionContext.nodes.find(value => value.nodeId === nodeId);
            assert.ok(node, 'original source node ' + nodeId);
            const values = [...node.codeSnippets.css.matchAll(new RegExp(property + ': ([^;]+);', 'g'))]
                .map(match => match[1].split(' ').map(value => Number.parseFloat(value)));
            assert.ok(values.length >= 2, nodeId + ' original endpoint ' + property);
            return values[endpoint === 'quick' ? 0 : values.length - 1][0];
        };
        const directoryBudget = await import('../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts');
        const header = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHeaderGeometry.ts');
        let metrics = createDefaultReaderWindowMetrics();
        Object.assign(deps, { ...directoryBudget, ...header, readerWindowMetrics: () => ({ ...metrics, systemFontScale: scale }) }, ap, st, se, rp, tt, au);
        const directoryMeasurer = pure('ReaderControlDirectoryMinimum.ets', ['measureReaderDirectoryMinimum']);
        Object.assign(deps, directoryMeasurer);
        const moduleMeasurer = pure('ReaderControlMinimumMeasurement.ets', ['measureReaderControlMinimum', 'measureReaderControlModuleMinimum',
            'readerControlModuleFactsMatch', 'readerControlModuleProfileMatches', 'readerControlMeasuredProfileGeometryKey']);
        const dirFacts = { tab: 'directory', title: '第一章', excerpt: '', currentTitle: '第一章', currentPosition: '1 / 1',
            hasRows: true, loading: false, bookmarkError: false, message: '', action: '', catalogStatus: '', catalogAction: '' };
        const settingsFacts = pure('ReaderControlSettingsMinimum.ets', ['readerControlSettingsMinimumFacts']).readerControlSettingsMinimumFacts();
        const facts = [{ module: 'directory', directory: dirFacts }, { module: 'appearance', appearance: appInput },
            { module: 'settings', settings: settingsFacts }, { module: 'search', search: { ...searchFacts, query: '', loadMoreLabel: '' } },
            { module: 'tts', tts: { ...ttsFacts, playbackLabel: '未开始' } }, { module: 'autoPage', autoPage: { status: '未开始', timerSummary: '15:00' } },
            { module: 'replace', replace: { statusText: '', recoveryLabel: '', name: '规则', pattern: 'a → b', meta: '正文', temporaryTitle: '',
                    editorOpen: false, layerOpen: false, ruleCount: 3, statusVisible: false } }];
        // The controlled display inputs are frozen references. They are kept
        // outside the numerical geometry oracle and are never copied by facts.
        const directoryView = { rows: [{ key: 'chapter:0' }], catalogState: 'ready', loading: false,
            targetRow: 0, currentTitle: dirFacts.currentTitle, currentPosition: dirFacts.currentPosition };
        dirFacts.readViewSnapshot = () => directoryView;
        dirFacts.viewCatalogComplete = true;
        dirFacts.viewBookmarkLoadFailed = false;
        dirFacts.viewBookmarkLoadMessage = '';
        const searchView = { kind: 'results', keyword: '正文', results: [{}] };
        facts[3].search.readViewState = () => searchView;
        const ttsView = { status: 'idle', rate: 1, totalSlices: 1 };
        facts[4].tts.readViewState = () => ttsView;
        Object.assign(facts[4].tts, { viewTimerMode: 'off', viewTimerMinutes: 0, viewTimerSeconds: 0, viewRate: 1 });
        const appearanceView = { activeTheme: 'day', dayTheme: 'day', nightTheme: 'night', font: 'system' };
        appInput.readViewSnapshot = () => appearanceView;
        const fontOrderView = ['system', 'serif', 'sans', 'mono', 'wenkai', 'fangsong', 'custom', 'import'];
        appInput.readViewFontOrder = () => fontOrderView;
        const replaceView = { rules: [{}, {}, {}], status: 'ready', errorMessage: '' };
        facts[6].replace.readViewState = () => replaceView;
        facts[6].replace.viewLayer = '';
        facts[6].replace.viewLocalError = '';
        const referenceWidths = { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 };
        scale = 1;
        const preparedModules = facts.map(value => moduleMeasurer.measureReaderControlModuleMinimum(context, referenceWidths, value.module, value));
        assert.ok(preparedModules.every(Boolean), 'all seven modules produce one complete typed preflight');
        const ttsProfile = preparedModules[4].moduleData.tts;
        for (const kind of ['playback', 'timer', 'speed']) {
            assert.deepEqual(['x', 'y', 'width', 'height'].map(key => ttsProfile.quick[kind][key]), original.shared[kind][0], `Make Quick ${kind} complete macro`);
        }
        assert.equal(ttsProfile.quick.contentHeight, 190);
        assert.equal(ttsProfile.fullText.voiceField, 30, 'voice paint retains original30 inside a52 row');
        const directory = preparedModules[0].moduleData.directory;
        assert.equal(directory.quick.tabHeightVp, 31);
        assert.equal(directory.full.tabHeightVp, 36);
        assert.equal(directory.quick.rowHeightVp, 32);
        assert.equal(directory.full.rowHeightVp, 40);
        assert.equal(directory.quick.listTopVp, 48);
        assert.equal(directory.full.listTopVp, 99);
        assert.equal(directory.full.fieldHeightVp, 32);
        assert.equal(directory.full.toolbarHeightVp, 52);
        assert.deepEqual(directoryBudget.readerDirectoryToolbarBudget(336, true, 32, 60), {
            stacked: false, height: 50, fieldMinimumWidth: 99, actionsWidth: 143,
        });
        assert.equal(336 - 20 - 5 - directoryBudget.readerDirectoryToolbarBudget(336, true, 32, 60).actionsWidth, 168);
        const settingsProfile = preparedModules[2].moduleData.settings;
        assert.deepEqual(settingsProfile.quick.optionHeights, Array(3).fill(sourceEndpoint('settings', '1692:3688', 'height', 'quick')));
        assert.deepEqual(settingsProfile.full.optionHeights, Array(3).fill(sourceEndpoint('settings', '1692:3688', 'height', 'full')));
        const settingsQuickFrame = settings.sampleReaderControlSettings(0, 286, settingsProfile);
        assert.deepEqual(settingsQuickFrame.bars.map(value => value.height), ['1692:3687', '1692:3692', '1692:3699'].map(nodeId => sourceEndpoint('settings', nodeId, 'height', 'quick')));
        assert.equal(settingsQuickFrame.contentHeight, 190);
        const appearanceProfile = preparedModules[1].moduleData.appearance;
        assert.equal(appearanceProfile.quickFontCellHeight, sourceEndpoint('appearance', '1691:20799', 'height', 'quick'));
        assert.equal(appearanceProfile.fullFontCellHeight, sourceEndpoint('appearance', '1691:20799', 'height', 'full'));
        const appearanceQuickFrame = appearance.sampleReaderControlAppearance(0, 286, 666, 8, 8, appearanceProfile);
        assert.equal(appearanceQuickFrame.themeSwatches[4].y - appearanceQuickFrame.themeSwatches[0].y, 28);
        assert.equal(appearanceQuickFrame.themeSwatches[0].height, 24);
        assert.equal(appearanceQuickFrame.quickFontHeader.y, 102.9);
        const searchProfile = preparedModules[3].moduleData.search;
        assert.equal(searchProfile.quick.natural.fieldHeightVp, sourceEndpoint('search', '1939:346', 'height', 'quick'));
        assert.equal(searchProfile.full.natural.fieldHeightVp, sourceEndpoint('search', '1939:346', 'height', 'full'));
        assert.equal(search.sampleReaderControlSearch(0, 286, 190, searchProfile.quick.natural).field.width, sourceEndpoint('search', '1939:346', 'width', 'quick'));
        const autoPageProfile = preparedModules[5].moduleData.autoPage;
        assert.equal(autoPageProfile.quick.stop.width, 24);
        assert.equal(autoPageProfile.quick.stop.height, 24);
        assert.equal(autoPageProfile.quick.speedContent.plus.width, 24);
        assert.equal(autoPageProfile.quick.speed.height, 32);
        const replaceProfile = preparedModules[6].moduleData.replace;
        assert.equal(replaceProfile.quick.rowHeight, sourceEndpoint('replace', '1939:1237', 'height', 'quick'));
        assert.equal(replaceProfile.quick.backHeight, 24);
        assert.equal(replaceProfile.quick.actionHeight, 28);
        const replaceQuickFrame = replace.sampleReaderControlReplace(0, 286, 190, replaceProfile, 190);
        assert.ok(Math.abs(replaceQuickFrame.list.height - 84) < 1e-9);
        assert.equal(replaceQuickFrame.list.y, 47.55);
        const allocations = actor.readerControlPaidResponses([ttsProfile.quick.previous, ttsProfile.quick.toggle, ttsProfile.quick.stop, ttsProfile.quick.next], actor.readerControlActor(0, 0, 264, 66));
        assert.ok(allocations.some(value => !value.complete && value.conflict === 'neighbor'));
        const overlaps = (firstResponse, secondResponse) => Math.max(firstResponse.x, secondResponse.x) < Math.min(firstResponse.x + firstResponse.width, secondResponse.x + secondResponse.width) &&
            Math.max(firstResponse.y, secondResponse.y) < Math.min(firstResponse.y + firstResponse.height, secondResponse.y + secondResponse.height);
        allocations.forEach((value, allocationIndex) => allocations.slice(allocationIndex + 1).forEach(other => assert.equal(overlaps(value.response, other.response), false)));
        // The same producers deliver complete data and independently resolve
        // the reference736 or actual safe-area705 shell. No module minimum is
        // promoted to another module's paint dimensions.
        const home = width => ({ chapterTitleHeight: 33, chapterRowHeight: 54, progressHeight: 50, percentWidth: 20,
            countWidth: 20, actionLabelHeight: 40.438, actionHeight: 75.438, minimumHeight: 185.438, minWidth: 100, fits: width >= 100 });
        const input = { context, headerInter: false, title: '目录', identity: 'book|open|directory', metricsRevision: 0,
            topBarHeightVp: 54, availableWithTopBarHeightVp: 736, measureHomeForm: home, preparedMinimumRequired: true };
        const candidates = facts.map(value => moduleMeasurer.measureReaderControlMinimum({ ...input, title: header.readerControlHeaderTitle(value.module),
            moduleFacts: value }, value.module, referenceWidths, input.identity + '|' + value.module));
        assert.ok(candidates.every(value => value?.profile.moduleData?.module === value.candidate.minimum.module));
        const poses = candidates.map(value => geo.resolveReaderControlLayout(390, 844, false, metrics, 0, [value.candidate]));
        assert.ok(poses.every(value => value.fullPanelHeight === 736 && value.quickPanelHeight === 330), JSON.stringify(poses));
        const oldMetadata = { ...candidates[0].profile, identity: 'another', metricsRevision: 100 };
        assert.equal(moduleMeasurer.readerControlMeasuredProfileGeometryKey(oldMetadata), moduleMeasurer.readerControlMeasuredProfileGeometryKey(candidates[0].profile));
        assert.notEqual(moduleMeasurer.readerControlMeasuredProfileGeometryKey({ ...oldMetadata, headerPaint: { ...oldMetadata.headerPaint, heightVp: 31 } }), moduleMeasurer.readerControlMeasuredProfileGeometryKey(oldMetadata));
        assert.equal(moduleMeasurer.measureReaderControlModuleMinimum(context, referenceWidths, 'directory', { ...facts[0], tts: facts[4].tts }), undefined);
        assert.equal(moduleMeasurer.measureReaderControlMinimum(input, 'directory', referenceWidths, 'missing', () => { throw Error('formal must not delegate'); }), undefined);
        metrics = { ...metrics, systemInsets: { ...metrics.systemInsets, top: 39 },
            gestureInsets: { ...metrics.gestureInsets, bottom: 28 }, statusBarHeight: 39 };
        assert.ok(candidates.every(value => geo.resolveReaderControlLayout(390, 844, false, metrics, 0, [value.candidate]).fullPanelHeight === 705));
        let samples = 0;
        for (const factor of [1, 1.3, 1.6, 2])
            for (const width of [260, 286, 338]) {
                scale = factor;
                const candidateWidths = { panelWidthVp: width + 26, fullContentWidthVp: width, quickContentWidthVp: Math.max(100, width - 52) };
                for (const value of facts) {
                    const result = moduleMeasurer.measureReaderControlModuleMinimum(context, candidateWidths, value.module, value);
                    assert.ok(result && moduleMeasurer.readerControlModuleProfileMatches(result.moduleData, value.module));
                    assert.ok(Number.isFinite(result.minimum.quick.heightVp) && Number.isFinite(result.minimum.full.heightVp));
                    samples++;
                }
            }
        // Real SDK consumer attributes. The measured profile controls paint,
        // and the actual response differs when the existing parent cannot pay44.
        scale = 1;
        const actionAccessibility = selectedProductionClasses(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url), ['ReaderActionAccessibility'], { AccessibilityRoleType: { BUTTON: 'button' } });
        const ttsOwner = native('ReaderControlTtsContent.ets', ['p', 'transport', 'transportPaint', 'transportGlyphSize', 'transportResponse', 'roundControl'], {
            ...tt, ...actionAccessibility, readerTtsPlayGradientStart: () => '#fff', ...actor
        });
        Object.assign(ttsOwner, { appScheme: 'day', motionProgress: 0, frame: () => ttsProfile.quick, textMinimum: () => ttsProfile.quickText,
            sharedInput: () => true, serviceBusy: false, onlineServicePage: () => false, isHttpEngineSelected: () => false,
            state: { status: 'idle' }, hasActiveQueue: () => true, displayHasActiveQueue: () => true, isActivelySpeaking: () => false, controlText: kind => kind,
            onPrevious() { }, onNext() { }, onToggle() { }, onStop() { } });
        for (const kind of ['previous', 'toggle', 'stop', 'next'])
            ttsOwner.roundControl(kind);
        const buttons = nodes(ttsOwner, 'Button');
        assert.deepEqual(buttons.map(node => [node.width, node.height]), [[28, 28], [36, 36], [28, 28], [28, 28]]);
        assert.ok(buttons.every(node => node.responseRegion.height === 44));
        assert.ok(buttons.some(node => node.responseRegion.width < 44));
        for (const invalid of [
            { paint: actor.readerControlActor(0, 0, 28, 28), host: { x: 0, y: 0, width: Number.NaN, height: 50 } },
            { paint: { x: Number.NaN, y: 0, width: 28, height: 28 }, host: actor.readerControlActor(0, 0, 100, 50) },
            { paint: actor.readerControlActor(200, 0, 28, 28), host: actor.readerControlActor(0, 0, 100, 50) },
            { paint: actor.readerControlActor(0, 0, 28, 28), host: actor.readerControlActor(0, 0, 0, 0) },
        ]) {
            const [allocation] = actor.readerControlPaidResponses([invalid.paint], invalid.host);
            assert.deepEqual(allocation.response, actor.readerControlActor(0, 0, 0, 0, 0));
            assert.equal(allocation.conflict, 'host');
            assert.equal(allocation.complete, false);
            assert.equal(allocation.paint, invalid.paint, 'original invalid paint facts remain observable');
        }
        const frozen = read('tools/fixtures/reader-control-restored-baseline-20260905.json');
        assert.equal(createHash('sha256').update(frozen).digest('hex'), 'cd3895d292cf8ec21daf25ea5426363f2edb266c2eb802fba949e051e2ad4e40');
        const directoryRaw = read('tools/fixtures/reader-directory-toolbar-hierarchy-20260905.json');
        assert.equal(createHash('sha256').update(directoryRaw).digest('hex'), 'e1e0db2b114f11b80f86e93a38a3269c4eeeb74310a3be7f92a842b12f855af6');
        const oldSettings = pure('ReaderControlSettingsMinimum.ets', ['measureReaderControlSettingsMinimum'], ui('ReaderControlSettingsMinimum.ets').replace('let naturalHeight = full ? 27 : 24;', 'let naturalHeight = 44;'));
        const oldSettingsData = oldSettings.measureReaderControlSettingsMinimum(context, referenceWidths, settingsFacts.groupLabels, settingsFacts.optionLabels, settingsFacts.toggleLabels);
        assert.throws(() => assert.deepEqual(settings.sampleReaderControlSettings(0, 286, oldSettingsData).bars.map(value => value.height), [30, 30, 30]), 'old response-as-paint mutant is rejected');
        const oldTts = pure('ReaderControlTtsMinimum.ets', ['measureReaderTtsMinimum'], ui('ReaderControlTtsMinimum.ets').replace('const inline = 13 + labelMinimumWidth + 2 + transportWidth + 10 <= inner;', 'const inline = false;'));
        assert.throws(() => assert.equal(oldTts.measureReaderTtsMinimum(context, referenceWidths, facts[4].tts).quick.playback.height, 66), 'unconditional transport stack mutant is rejected');
        const oldDirectory = pure('ReaderControlDirectoryMinimum.ets', ['measureReaderDirectoryMinimum'], ui('ReaderControlDirectoryMinimum.ets').replace('readerScaledControlHeight(32, 24, scale)', 'readerScaledControlHeight(44, 24, scale)'));
        assert.throws(() => assert.equal(oldDirectory.measureReaderDirectoryMinimum(context, referenceWidths, dirFacts).full.fieldHeightVp, 32), 'old input44 paint mutant is rejected');
        const bookmark = directoryMeasurer.measureReaderDirectoryMinimum(context, referenceWidths, { ...dirFacts, tab: 'bookmarks', excerpt: '正文' });
        assert.equal(bookmark.quick.rowHeightVp, 54);
        assert.equal(bookmark.full.rowHeightVp, 74);
        const ttsState = await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');
        const ttsFormat = pureModuleProbe(ui('ReaderControlTtsMinimum.ets'), 'TtsFacts.ets', { ...deps, ...ttsState,
            readerTtsLanguageLabel: value => value }, ['readerControlTtsMinimumFacts', 'readerControlTtsPlaybackLabel', 'readerControlTtsStatusLabel',
            'readerControlTtsTwoDigits', 'readerControlTtsTimerSummary', 'readerControlTtsTimerCaption', 'readerControlTtsEngineLabel', 'readerControlTtsVoiceLabel']);
        const ttsLabels = native('ReaderControlTtsContent.ets', ['playbackLabel', 'statusText', 'timerCaption', 'timerSummary', 'twoDigits', 'currentEngineLabel', 'currentVoiceLabel', 'displayedFacts'], ttsFormat);
        let formattedStates = 0;
        for (const status of ['idle', 'probing', 'preparing', 'playing', 'paused', 'interrupted', 'resuming', 'completed', 'stopping', 'error', 'failed', 'unavailable']) {
            const raw = { state: { status, rate: 1, totalSlices: 1 }, timerMode: 'duration', timerMinutes: 15, timerSeconds: 5, failurePolicy: 'stop', allowMixing: false,
                engine: 'system', httpEngines: [], voiceOptions: [], language: 'zh-CN', person: 0, ratePreview: -1, serviceTab: '' };
            Object.assign(ttsLabels, raw, { sourceOnly: 'none', onlineServicePage: () => false });
            const value = ttsFormat.readerControlTtsMinimumFacts(raw);
            assert.equal(value.playbackLabel, ttsLabels.playbackLabel());
            assert.equal(value.status, ttsLabels.statusText());
            assert.equal(value.timerCaption, ttsLabels.timerCaption());
            assert.equal(value.timerSummary, ttsLabels.timerSummary());
            assert.equal(value.voice, ttsLabels.currentVoiceLabel());
            assert.equal(value.engineValue, '系统默认');
            formattedStates++;
        }
        const viewOwner = native('ReaderControlTtsContent.ets', ['presentationPrepared', 'preparedProfile', 'displayedFacts',
            'displayState', 'minimumFacts'], { ...ttsFormat, ...moduleMeasurer });
        const oldState = { status: 'idle', rate: 1, totalSlices: 1 };
        const nextState = { ...oldState, status: 'error', errorMessage: '新增错误会改变播放块高度' };
        const rawOptions = { state: oldState, timerMode: 'off', timerMinutes: 0, timerSeconds: 0,
            failurePolicy: 'stop', allowMixing: false, engine: 'system', httpEngines: [], voiceOptions: [],
            language: 'zh-CN', person: 0, ratePreview: -1, serviceTab: '' };
        const oldView = { identity: 'owner', key: 'old', moduleData: preparedModules[4].moduleData,
            facts: { module: 'tts', tts: ttsFormat.readerControlTtsMinimumFacts(rawOptions) } };
        Object.assign(viewOwner, rawOptions, { state: nextState, preparedMinimumRequired: true,
            sourceOnly: 'none', minimumIdentity: 'owner', minimumKey: 'old', preparedMinimum: oldView, adoptedPrepared: oldView });
        assert.equal(viewOwner.displayState(), oldState, 'old measured paint keeps its own readonly error projection');
        assert.equal(viewOwner.minimumFacts().readViewState(), nextState, 'successor measurement facts still read live state');
        const nextFacts = { module: 'tts', tts: ttsFormat.readerControlTtsMinimumFacts({ ...rawOptions, state: nextState }) };
        const nextPrepared = moduleMeasurer.measureReaderControlModuleMinimum(context, referenceWidths, 'tts', nextFacts);
        const nextView = { identity: 'owner', key: 'new', moduleData: nextPrepared.moduleData, facts: nextFacts };
        viewOwner.preparedMinimum = nextView;
        assert.equal(viewOwner.displayState(), oldState, 'partial new receipt without matching key keeps old paint and view together');
        assert.equal(viewOwner.preparedProfile(), preparedModules[4].moduleData.tts);
        viewOwner.minimumKey = 'new';
        assert.equal(viewOwner.displayState(), nextState);
        assert.equal(viewOwner.preparedProfile(), nextPrepared.moduleData.tts);
        const selectSource = read('entry/src/main/ets/ui/controls/ReaderSelect.ets');
        const selectConstants = selectedProductionValues(new URL('../entry/src/main/ets/ui/controls/ReaderSelect.ets', import.meta.url), ['APPEARANCE_TRIGGER_H', 'APPEARANCE_VALUE_VERTICAL_SPACE', 'APPEARANCE_HIT_OUTSET'], deps);
        const select = createReaderBuilderProbe(selectSource, ['phoneTrigger', 'triggerEnabled', 'triggerHeight', 'appearanceLibraryTriggerHeight',
            'measuredValueHeight', 'appearanceLibraryTrigger', 'resolvedWidth'], { ...deps, ...selectConstants }).owner;
        Object.assign(select, { variant: 'appearanceLibrary', value: '2字符', options: ['无', '1字符', '2字符'], controlWidth: 0, appThemeScheme: 'day',
            readerWindowMetricsRevision: 0, focusId: 'select', mounted: true, actionEnabled: true, getUIContext: () => context, dropdownAnimation: () => ({}), trigger() { this.appearanceLibraryTrigger(); } });
        select.phoneTrigger();
        const trigger = nodes(select, 'Button')[0];
        assert.equal(trigger.height, 30);
        assert.equal(trigger.responseRegion.height, 42);
        assert.equal(trigger.responseRegion.y, -6);
        assert.equal(appearanceProfile.selectRowHeight, 42);
        let toggles = 0;
        select.onToggle = () => toggles++;
        trigger.onClick();
        assert.equal(toggles, 1);
        select.mounted = false;
        trigger.onClick();
        assert.equal(toggles, 1);
        const toolbar = native('ReaderDirectoryToolbar.ets', ['tool', 'toolLabel', 'iconSize', 'controlFieldHeight'], {
            ...actionAccessibility, readerWindowMetrics: () => ({ systemFontScale: 1 }), MangaDirectoryPressFeedback: class {
                applyNormalAttribute() { }
            }
        });
        Object.assign(toolbar, { variant: 'full-directory', appThemeScheme: 'day', readerWindowMetricsRevision: 0, naturalFieldHeightVp: 32, showChapterTools: true });
        toolbar.tool('search', () => { });
        const tool = nodes(toolbar, 'Button')[0];
        assert.equal(tool.width, 32);
        assert.equal(tool.height, 44);
        assert.deepEqual(tool.responseRegion, { x: 0, y: 0, width: 32, height: 44 });
        const toolPaint = nodes(toolbar, 'Stack').find(node => node.width === 32 && node.height === 32);
        assert.ok(toolPaint);
        const toolGlyph = nodes(toolbar, 'Image')[0];
        assert.equal(toolGlyph.width, 16);
        assert.equal(toolGlyph.height, 16);
        const searchFieldSource = read('entry/src/main/ets/ui/controls/ReaderSearchField.ets');
        class CapturedDirectoryField {
            constructor(parent, params, _storage, id) {
                this.owner = parent;
                this.params = params;
                this.id = id;
            }
        }
        const queryOwner = createReaderBuilderProbe(ui('ReaderDirectoryToolbar.ets'), ['queryField', 'controlFieldHeight'], {
            ...deps, ReaderSearchField: CapturedDirectoryField, readerWindowMetrics: () => ({ systemFontScale: 1 }),
        }, { childSources: { ReaderSearchField: searchFieldSource } }).owner;
        const fieldOwner = createReaderBuilderProbe(searchFieldSource, ['fieldHeight', 'inputHeight', 'fieldBorderWidth',
            'directoryFontScale', 'isBookField'], deps).owner;
        Object.assign(queryOwner, { variant: 'manga-catalog', readerWindowMetricsRevision: 0, naturalFieldHeightVp: 0,
            naturalInputHeightVp: 0, text: '', placeholder: '搜索章节名称', directoryFocusAllowed: false });
        queryOwner.queryField('manga');
        const mangaField = [...queryOwner.children.values()][0].params;
        Object.assign(fieldOwner, mangaField, { readerWindowMetricsRevision: -1 });
        assert.equal(mangaField.naturalFieldHeightVp, 44);
        assert.equal(mangaField.naturalInputHeightVp, 44);
        assert.equal(fieldOwner.fieldHeight(), 44);
        assert.equal(fieldOwner.inputHeight(), 44);
        Object.assign(fieldOwner, { naturalFieldHeightVp: 32, naturalInputHeightVp: 30 });
        assert.equal(fieldOwner.fieldHeight(), 32);
        assert.equal(fieldOwner.inputHeight(), 30);
        const profileChecks = pure('ReaderControlPlaybackProfile.ets', ['readerControlPlaybackProfileMatches']);
        for (const module of ['tts', 'autoPage']) {
            const index = module === 'tts' ? 4 : 5;
            const candidate = candidates[index], layout = poses[index], data = candidate.profile.playbackData;
            const sourceReceipt = { module, identity: input.identity, key: candidate.candidate.key, metricsRevision: 0, widths: referenceWidths, data, layout,
                bounds: motion.readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight, layout.dockBottomGap, layout.quickPanelHeight, layout.contentBudget),
                quickContentHeightVp: layout.contentBudget.quickContentHeightVp, fullContentHeightVp: layout.contentBudget.fullContentHeightVp };
            assert.equal(profileChecks.readerControlPlaybackProfileMatches(sourceReceipt, module, input.identity, candidate.candidate.key, 0), true);
            const sourceOwner = native(module === 'tts' ? 'ReaderControlTtsContent.ets' : 'ReaderControlAutoPageContent.ets', ['sourceMinimumCurrent', module === 'tts' ? 'selectedMinimum' : 'minimumProfile', ...(module === 'tts' ? ['displayedFacts', 'displayState', 'displayTimerMode', 'displayTimerDigits', 'effectiveRate'] : [])], { ...profileChecks, ...ttsState });
            Object.assign(sourceOwner, { sourceOnly: 'quick', sourceMinimum: sourceReceipt, sourceMinimumIdentity: input.identity, sourceMinimumKey: candidate.candidate.key,
                sourceMinimumMetricsRevision: 0, readerWindowMetricsRevision: 0 });
            assert.equal(module === 'tts' ? sourceOwner.selectedMinimum() : sourceOwner.minimumProfile(), data[module]);
            if (module === 'tts') {
                sourceOwner.state = { status: 'error', rate: 1, totalSlices: 9, errorMessage: '后继媒体错误' };
                const frozenFacts = sourceReceipt.data.ttsFacts;
                assert.equal(frozenFacts.readViewState(), ttsView, 'frozen launch facts retain the exact captured media state');
                assert.equal(sourceReceipt.data.ttsFacts.readViewState().errorMessage, undefined);
                assert.equal(sourceOwner.displayState(), ttsView, 'actual source-only getter keeps the frozen view');
                sourceOwner.timerMode = 'duration';
                sourceOwner.timerMinutes = 30;
                sourceOwner.ratePreview = -1;
                sourceOwner.state.rate = 2;
                assert.equal(sourceOwner.displayTimerMode(), 'off');
                assert.equal(sourceOwner.displayTimerDigits(true), '00');
                assert.equal(sourceOwner.effectiveRate(), 1);
            }
            sourceOwner.sourceMinimumKey += 'retired';
            assert.equal(module === 'tts' ? sourceOwner.selectedMinimum() : sourceOwner.minimumProfile(), undefined);
        }
        const contains = (outer, inner) => outer.x <= inner.x && outer.y <= inner.y &&
            outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
        for (const allocation of allocations) {
            assert.ok(contains(allocation.response, allocation.paint), 'actual TTS target covers every visible paint edge');
        }
        const widePaints = [actor.readerControlActor(0, 0, 200, 8), actor.readerControlActor(100, 12, 200, 8)];
        const wideHost = actor.readerControlActor(0, 0, 300, 44);
        const wideAllocations = actor.readerControlPaidResponses(widePaints, wideHost);
        assert.equal(overlaps(wideAllocations[0].response, wideAllocations[1].response), false);
        for (const allocation of wideAllocations) {
            assert.ok(contains(allocation.response, allocation.paint), 'separable vertical gap takes precedence over larger horizontal center distance');
            assert.ok(contains(wideHost, allocation.response));
        }
        const clipped = actor.readerControlPaidResponses([actor.readerControlActor(-1, 0, 50, 44)], actor.readerControlActor(0, 0, 44, 44))[0];
        assert.equal(clipped.complete, false, 'a44 response does not claim complete payment when host clips paint');
        assert.equal(clipped.conflict, 'host');
        const { existsSync } = await import('node:fs');
        let compiledBuilders = 0;
        for (const file of ['ReaderControlDirectoryContent.ets', 'ReaderControlSearchContent.ets', 'ReaderControlTtsContent.ets',
            'ReaderControlAppearanceContent.ets', 'ReaderControlReplaceContent.ets', 'ReaderControlSettingsContent.ets',
            'ReaderControlAutoPageContent.ets', 'ReaderDirectoryToolbar.ets', 'FullDirectoryPanel.ets', 'ReaderDirectoryNavigationList.ets']) {
            const source = ui(file);
            const tree = compiler.ts.createSourceFile(file, source, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.ETS, compiler.options);
            const component = tree.statements.find(node => node.members && node.members.some(member => member.name?.getText(tree) === 'build'));
            const builders = component.members.filter(member => member.name && compiler.ts.getAllDecorators(member)
                .some(decorator => decorator.getText(tree) === '@Builder')).map(member => member.name.getText(tree));
            const childSources = {};
            const sourceUrl = new URL('../entry/src/main/ets/features/reading/ui/' + file, import.meta.url);
            for (const declaration of tree.statements.filter(compiler.ts.isImportDeclaration)) {
                if (!declaration.moduleSpecifier.text.startsWith('.')) continue;
                let childUrl;
                for (const extension of ['', '.ets', '.ts']) {
                    const candidate = new URL(declaration.moduleSpecifier.text + extension, sourceUrl);
                    if (existsSync(candidate)) { childUrl = candidate; break; }
                }
                if (childUrl === undefined) continue;
                const childSource = readFileSync(childUrl, 'utf8');
                const childTree = compiler.ts.createSourceFile(String(childUrl), childSource, compiler.ts.ScriptTarget.Latest, true,
                    String(childUrl).endsWith('.ets') ? compiler.ts.ScriptKind.ETS : compiler.ts.ScriptKind.TS, compiler.options);
                for (const element of declaration.importClause?.namedBindings?.elements ?? []) {
                    const componentName = element.propertyName?.text ?? element.name.text;
                    if (childTree.statements.some(node => node.members && node.name?.text === componentName && compiler.ts.getAllDecorators(node)
                        .some(decorator => decorator.getText(childTree).startsWith('@Component')))) childSources[element.name.text] = childSource;
                }
            }
            const slots = component.members.filter(member => member.name && compiler.ts.getAllDecorators(member)
                .some(decorator => decorator.getText(tree) === '@BuilderParam')).map(member => member.name.getText(tree));
            createReaderBuilderProbe(source, [...builders, ...slots, 'build'], deps, { childSources });
            compiledBuilders += builders.length;
        }
        const fontHelper = native('ReaderControlAppearanceContent.ets', ['visiblePreviewFamily']);
        const capturedFonts = { readViewFontOrder: () => ['system'], fonts: [{ label: '系统', family: 'CapturedPreparedFace' }] };
        Object.assign(fontHelper, { displayedFacts: () => capturedFonts });
        assert.equal(fontHelper.visiblePreviewFamily('system'), 'CapturedPreparedFace');
        const settingsFactory = pure('ReaderControlSettingsMinimum.ets', ['readerControlSettingsMinimumFacts']);
        const lifecycleOwner = native('ReaderControlSettingsContent.ets', ['presentationPrepared', 'preparedProfile',
            'onPreparedMinimumChanged', 'aboutToDisappear', 'aboutToAppear', 'onMinimumIdentityChanged', 'currentInputEnabled', 'build'], {
            ...moduleMeasurer, ...settingsFactory, registerReaderFonts: () => {},
        });
        const settingsReceipt = { identity: 'first-opening', key: 'first-key', moduleData: preparedModules[2].moduleData,
            facts: { module: 'settings', settings: settingsFactory.readerControlSettingsMinimumFacts() } };
        Object.assign(lifecycleOwner, { preparedMinimumRequired: true, minimumIdentity: 'first-opening', minimumKey: 'first-key',
            preparedMinimum: settingsReceipt, adoptedPrepared: settingsReceipt, adoptedPreparedKey: 'first-opening|first-key',
            minimumMounted: true, publishedMinimumIdentity: '', interactionEnabled: true, inputCurrent: () => true,
            getUIContext: () => ({ getFont: () => ({}) }), onMinimumFactsChanged() {}, onMinimumMeasurerReady() {} });
        assert.ok(lifecycleOwner.presentationPrepared());
        lifecycleOwner.aboutToDisappear();
        assert.equal(lifecycleOwner.adoptedPrepared, undefined);
        assert.equal(lifecycleOwner.adoptedPreparedKey, '');
        lifecycleOwner.minimumIdentity = 'fresh-opening';
        lifecycleOwner.minimumKey = 'fresh-key';
        lifecycleOwner.preparedMinimum = { identity: 'fresh-opening', key: 'fresh-key', moduleData: preparedModules[2].moduleData };
        lifecycleOwner.aboutToAppear();
        assert.equal(lifecycleOwner.presentationPrepared(), undefined, 'same component fresh appearance cannot borrow prior readonly view');
        assert.equal(lifecycleOwner.currentInputEnabled(), false);
        lifecycleOwner.initialRender();
        assert.equal(nodes(lifecycleOwner, 'Scroll').length, 0, 'fresh malformed formal tuple cannot draw live content');
        for (const moduleName of ['Directory', 'Appearance', 'Settings', 'Search', 'Tts', 'AutoPage', 'Replace']) {
            const inputOwner = native(`ReaderControl${moduleName}Content.ets`, ['currentInputEnabled']);
            let originalOwnerCurrent = true;
            const inputReceipt = { ownerCurrent: () => originalOwnerCurrent };
            Object.assign(inputOwner, { preparedMinimumRequired: true, interactionEnabled: true,
                inputCurrent: () => true, presentationPrepared: () => inputReceipt });
            assert.equal(inputOwner.currentInputEnabled(), true, moduleName + ' current prepared owner admits input');
            originalOwnerCurrent = false;
            assert.equal(inputOwner.currentInputEnabled(), false, moduleName + ' retired prepared owner rejects input');
            inputReceipt.ownerCurrent = undefined;
            assert.equal(inputOwner.currentInputEnabled(), false, moduleName + ' formal tuple without owner guard rejects input');
            inputOwner.preparedMinimumRequired = false;
            assert.equal(inputOwner.currentInputEnabled(), true, moduleName + ' legacy owner keeps original admission');
        }
        const editorOwner = native('ReaderControlSearchContent.ets', ['currentEditorInputEnabled', 'currentInputEnabled']);
        Object.assign(editorOwner, { preparedMinimumRequired: true, queryInputMounted: true,
            editorInputCurrent: () => true, presentationPrepared: () => ({ ownerCurrent: () => false }) });
        assert.equal(editorOwner.currentEditorInputEnabled(), false, 'accepted editor lease cannot bypass a retired prepared book owner');
        scale = 2;
        const largerPreparedModules = facts.map(value => moduleMeasurer.measureReaderControlModuleMinimum(context, referenceWidths, value.module, value));
        scale = 1;
        const cacheCases = [
            { name: 'Settings', index: 2, module: 'settings', method: 'geometry', methods: ['geometry', 'p', 'sharedRect'],
                expected: profile => settings.sampleReaderControlSettings(0, 286, profile) },
            { name: 'AutoPage', index: 5, module: 'autoPage', method: 'frame', methods: ['frame', 'minimumProfile'],
                expected: profile => playback.sampleReaderControlAutoPage(0, 286, profile) },
            { name: 'Replace', index: 6, module: 'replace', method: 'frame', methods: ['frame'],
                expected: profile => replace.sampleReaderControlReplace(0, 286, 190, profile, 190) },
        ];
        for (const cacheCase of cacheCases) {
            const oldPair = { identity: 'cache-owner', key: 'old-pair', moduleData: preparedModules[cacheCase.index].moduleData,
                facts: facts[cacheCase.index] };
            const nextPair = { ...oldPair, key: 'new-pair', moduleData: largerPreparedModules[cacheCase.index].moduleData };
            const cacheOwner = native(`ReaderControl${cacheCase.name}Content.ets`, cacheCase.methods, moduleMeasurer);
            Object.assign(cacheOwner, { sourceOnly: 'none', preparedMinimumRequired: true, minimumIdentity: oldPair.identity,
                minimumKey: oldPair.key, preparedMinimum: oldPair, adoptedPrepared: oldPair, motionProgress: 0,
                availableWidth: 286, availableHeight: 190, quickContentHeight: 190, quickFlowExtra: () => 0 });
            const oldFrame = cacheOwner[cacheCase.method]();
            const oldClip = cacheCase.name === 'Settings' ? cacheOwner.sharedRect(0, true, 0) : undefined;
            cacheOwner.minimumKey = nextPair.key;
            assert.equal(cacheOwner[cacheCase.method](), oldFrame, cacheCase.name + ' key-first delivery retains old paired geometry');
            if (oldClip !== undefined) assert.equal(cacheOwner.sharedRect(0, true, 0), oldClip, 'Settings endpoint clip retains the old paired profile');
            cacheOwner.preparedMinimum = nextPair;
            const nextFrame = cacheOwner[cacheCase.method]();
            assert.notEqual(nextFrame, oldFrame, cacheCase.name + ' complete pair replaces cached geometry after partial delivery');
            assert.deepEqual(nextFrame, cacheCase.expected(nextPair.moduleData[cacheCase.module]));
            if (oldClip !== undefined) {
                assert.notEqual(cacheOwner.sharedRect(0, true, 0), oldClip, 'Settings endpoint clip replaces the old paired profile');
            }
        }
        const pathPresentation = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPresentation.ts');
        class RecordedPath {
            commands(path) { this.path = path; return this; }
        }
        for (const clipCase of [{ name: 'AutoPage', index: 5, module: 'autoPage', kind: 'control', profileMethod: 'minimumProfile' },
            { name: 'Tts', index: 4, module: 'tts', kind: 'playback', profileMethod: 'selectedMinimum' }]) {
            const oldPair = { identity: 'clip-owner', key: 'old-clip', moduleData: preparedModules[clipCase.index].moduleData,
                facts: facts[clipCase.index] };
            const nextPair = { ...oldPair, key: 'next-clip', moduleData: largerPreparedModules[clipCase.index].moduleData };
            const clipMethods = ['sharedClip', 'p', clipCase.profileMethod];
            if (clipCase.name === 'AutoPage') clipMethods.push('sharedPaintRect');
            const clipOwner = native(`ReaderControl${clipCase.name}Content.ets`, clipMethods,
                { ...moduleMeasurer, ...pathPresentation, PathShape: RecordedPath });
            Object.assign(clipOwner, { sourceOnly: 'none', preparedMinimumRequired: true, minimumIdentity: oldPair.identity,
                minimumKey: oldPair.key, preparedMinimum: oldPair, adoptedPrepared: oldPair, motionProgress: 0.5,
                availableWidth: 286, fullViewportHeight: 180, scrollMotion: { fullScrollOffset: 0 },
                getUIContext: () => ({ vp2px: value => value }), playbackExtraHeight: () => 0, effectiveRate: () => 1,
                onlineServicePage: () => 0, pathCache: new pathPresentation.ReaderControlMotionPathCache(path => new RecordedPath().commands(path)) });
            if (clipCase.name === 'Tts') clipOwner.frame = () => playback.sampleReaderControlTts(0.5, 286, 0, 0, 0, clipOwner.selectedMinimum());
            const oldPath = clipOwner.sharedClip(clipCase.kind);
            clipOwner.minimumKey = nextPair.key;
            assert.equal(clipOwner.sharedClip(clipCase.kind), oldPath, clipCase.name + ' partial tuple preserves paired path cache');
            clipOwner.preparedMinimum = nextPair;
            const nextPath = clipOwner.sharedClip(clipCase.kind);
            assert.notEqual(nextPath, oldPath, clipCase.name + ' new complete geometry pair replaces cached path');
            const retainedCache = clipOwner.pathCache;
            clipOwner.preparedMinimum = { ...nextPair, moduleData: structuredClone(nextPair.moduleData) };
            assert.equal(clipOwner.sharedClip(clipCase.kind), nextPath, clipCase.name + ' same-key SDK profile copy preserves the existing PathShape');
            assert.equal(clipOwner.pathCache, retainedCache, clipCase.name + ' view-only copy does not rebuild the path cache');
        }
        class CapturedTemporaryHeader {
            constructor(parent, params, _storage, id) { this.owner = parent; this.params = params; this.id = id; }
        }
        const temporaryHeaderOwner = native('ReaderControlReplaceContent.ets', ['temporaryHeader'],
            { ReaderBoundedSurfaceHeader: CapturedTemporaryHeader },
            { childSources: { ReaderBoundedSurfaceHeader: read('entry/src/main/ets/ui/surfaces/ReaderBoundedSurfaceHeader.ets') } });
        const replaceEditorProfile = largerPreparedModules[6].moduleData.replace;
        const replaceEditorFrame = replace.sampleReaderControlReplace(1, 338, 666, replaceEditorProfile, 190);
        Object.assign(temporaryHeaderOwner, { currentMinimumProfile: () => replaceEditorProfile,
            frame: () => replaceEditorFrame, displayedFacts: () => ({ temporaryTitle: '编辑替换规则' }) });
        temporaryHeaderOwner.temporaryHeader(1);
        const temporaryHeaderParams = [...temporaryHeaderOwner.children.values()][0].params;
        assert.equal(temporaryHeaderParams.naturalHeaderHeightVp, replaceEditorFrame.editorHeaderHeight,
            'formal Replace temporary header consumes the admitted typed profile without a legacy map entry');
        const metadataOnly = { ...candidates[4].profile, playbackData: { ...candidates[4].profile.playbackData,
            ttsFacts: { ...facts[4].tts, status: '已暂停' } } };
        assert.equal(moduleMeasurer.readerControlMeasuredProfileGeometryKey(metadataOnly),
            moduleMeasurer.readerControlMeasuredProfileGeometryKey(candidates[4].profile), 'same-width display metadata never enters geometry identity');
        const searchPublicationRuntime = pureModuleProbe(read('entry/src/main/ets/features/reading/presentation/ReaderContentSearchPublication.ets'),
            'ReaderContentSearchPublication.ets', {}, ['ReaderContentSearchPublication']);
        const publication = new searchPublicationRuntime.ReaderContentSearchPublication();
        const queryResult = { kind: 'results', keyword: '原查询', results: [], hasMore: true, loadingMore: false };
        publication.publish(queryResult);
        const searchActionOwner = native('ReaderControlSearchContent.ets', ['loadMoreAction', 'resultActionCurrent', 'displayedLoadMoreFailure', 'loadMoreActionEnabled', 'loadMoreActionHandler', 'performLoadMore', 'currentSearchState', 'displayResults']);
        let dispatchedLoadMore = 0;
        Object.assign(searchActionOwner, { state: queryResult, queryInputMounted: true, searchPublication: publication,
            motionProgress: 0, retainedLoadMoreFailure: false, appThemeScheme: 'day',
            displayedFacts: () => undefined, displayState: () => searchActionOwner.state, currentInputEnabled: () => true,
            frame: () => search.sampleReaderControlSearch(0, 286, 190, searchProfile.quick.natural),
            presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), onLoadMore: () => dispatchedLoadMore++ });
        searchActionOwner.loadMoreAction();
        const retainedLoadMore = nodes(searchActionOwner, 'Button')[0].onClick;
        retainedLoadMore();
        assert.equal(dispatchedLoadMore, 1);
        const busySameQuery = { ...queryResult, loadingMore: true };
        publication.publish(busySameQuery);
        searchActionOwner.state = busySameQuery;
        retainedLoadMore();
        assert.equal(dispatchedLoadMore, 1, 'current busy state rejects the old callback');
        const readySameQuery = { ...queryResult, loadingMore: false };
        publication.publish(readySameQuery);
        searchActionOwner.state = readySameQuery;
        retainedLoadMore();
        assert.equal(dispatchedLoadMore, 2, 'the same query scope can resume after busy clears');
        const successorQuery = { ...queryResult, keyword: '后继查询', results: [] };
        publication.publish(successorQuery);
        searchActionOwner.state = successorQuery;
        retainedLoadMore();
        assert.equal(dispatchedLoadMore, 2, 'old query callback cannot operate on the successor query');
        const catalogOwner = native('ReaderControlDirectoryContent.ets', ['catalogStatus', 'reconcileCatalog', 'currentContent']);
        let catalogRequests = 0;
        Object.assign(catalogOwner, { mounted: true, sessionKey: 'first-book', tab: 'directory', layoutPresentation: 3,
            appThemeScheme: 'day', catalogComplete: false, catalogLoading: false,
            currentInputEnabled: () => true, displaySnapshot: () => ({ catalogState: 'failed' }),
            onRequireCompleteCatalog: () => catalogRequests++ });
        catalogOwner.catalogStatus();
        const catalogAction = [...catalogOwner.children.values()].find(child => typeof child.onReconcile === 'function' || typeof child.params?.onReconcile === 'function');
        const retainedCatalog = catalogAction.onReconcile ?? catalogAction.params.onReconcile;
        retainedCatalog(3);
        assert.equal(catalogRequests, 1);
        catalogOwner.catalogLoading = true;
        retainedCatalog(3);
        assert.equal(catalogRequests, 1);
        catalogOwner.catalogLoading = false;
        catalogOwner.layoutPresentation = 4;
        catalogOwner.sessionKey = 'successor-book';
        retainedCatalog(3);
        assert.equal(catalogRequests, 1, 'old presentation cannot request the successor book catalog');
        console.log(`authored allocation PASS 7 independent default macros, ${samples} real producer profiles, constrained responses and actualSDK transport; ${compiledBuilders} affected Builders compile; callback scope and frozen-source checks`);
        return;
    }
    if (id === 'timer-custom-allocation-sdk') {
        const { createHash } = await import('node:crypto');
        const makeSource = read('tools/fixtures/tts-reference/PhoneScreen.tsx');
        assert.equal(createHash('sha256').update(makeSource).digest('hex'),
            '731582c1ac493d48f1ebdaae1e5527de5dfe3f391d37d8c85a51643ce72b4a3c');
        assert.match(makeSource, /function StepButton[\s\S]*?size-\[30px\][\s\S]*?<svg width="14" height="14"/);
        const accessibility = selectedProductionClasses(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url),
            ['ReaderActionAccessibility'], { AccessibilityRoleType: { BUTTON: 'button' } });
        const ttsSource = ui('ReaderControlTtsContent.ets');
        const presetPaint = pureModuleProbe(ttsSource.slice(0, ttsSource.indexOf('@Component')), 'ReaderTtsPaint.ets',
            { ...deps, ...accessibility, FrameCallback: class {}, Color: { Transparent: 'Color.Transparent' } },
            ['ReaderTtsPresetModifier', 'readerTtsPresetLabelColor']);
        const ttsState = await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');
        const methods = ['p', 'fullInput', 'sharedInput', 'timer', 'timerCardLayout', 'timerPreset', 'timerPresetLabel', 'timerPresetSelected',
            'timerPresetIsSelected', 'chooseTimerPreset', 'timerCustomDuration', 'timerCustomLabel', 'timerCustomGroup',
            'timerStepper', 'timerStepButton', 'stepTimer', 'twoDigits', ...displayMethods('ReaderControlTtsContent.ets')];
        const epsilon = 0.000001;
        const contains = (parent, child, label) => {
            assert.ok(child.x >= parent.x - epsilon && child.y >= parent.y - epsilon &&
                child.x + child.width <= parent.x + parent.width + epsilon &&
                child.y + child.height <= parent.y + parent.height + epsilon, label);
        };
        const inspectTimer = (profile, inputWidths, minutes, seconds, source = ttsSource, progress = 1) => {
            const owner = createReaderBuilderProbe(source, methods,
                { ...deps, ...tt, ...accessibility, ...presetPaint, ...ttsState }).owner;
            const text = tt.sampleReaderTtsTextMinimum(profile, progress);
            const animatedWidth = actor.readerControlLerp(inputWidths.quickContentWidthVp, inputWidths.fullContentWidthVp, progress);
            Object.assign(owner, { appScheme: 'day', state: { status: 'idle' }, sourceOnly: 'none',
                configField: '', timerMode: 'duration', timerMinutes: minutes, timerSeconds: seconds,
                motionProgress: progress, textMinimum: () => text,
                frame: () => playback.sampleReaderControlTts(progress, animatedWidth, 1 / 3, 0, false, profile),
                currentInputEnabled: () => true,
                sectionSurface() {}, moduleHeader() {}, quickLabel() {},
                sharedScrollTranslation: () => 0, sharedClip: () => 'retained-motion-mask',
                presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), timerCaption: () => '25 分钟' });
            const captures = { steppers: [], groups: [], labels: [], custom: [] };
            for (const [method, destination] of [['timerStepper', 'steppers'], ['timerCustomGroup', 'groups'],
                ['timerCustomLabel', 'labels'], ['timerCustomDuration', 'custom']]) {
                const original = owner[method].bind(owner);
                owner[method] = (...args) => {
                    const firstId = owner.nodes.size;
                    original(...args);
                    captures[destination].push({ args, nodes: [...owner.nodes.values()].slice(firstId) });
                };
            }
            owner.timer();
            assert.equal(captures.custom.length, 1, 'real timer Builder invokes its custom-duration child once');
            assert.equal(captures.steppers.length, 2, 'real custom-duration child mounts both unit steppers');
            assert.deepEqual(captures.steppers.map(stepper => stepper.args[0]), [true, false]);
            const customNodes = captures.custom[0].nodes;
            assert.equal(customNodes.filter(node => node.type === 'Scroll').length, 0,
                'required custom timer actions never depend on a hidden horizontal Scroll');
            const customRoot = customNodes[0];
            const mode = profile.fullText.timerCustomLayout;
            const flow = customNodes.find(node => node.padding?.left === 10);
            assert.ok(flow, 'actual custom parent pays its original left/right padding');
            const border = customRoot.border.width;
            const paidViewport = { x: border, y: border,
                width: customRoot.width - border * 2, height: customRoot.height - border * 2 };
            assert.equal(flow.height, paidViewport.height,
                'the actual flow height equals the border-paid custom viewport');
            assert.equal(flow.width, paidViewport.width,
                'the actual flow width explicitly equals the border-paid custom viewport');
            const contentWidth = paidViewport.width - flow.padding.left - flow.padding.right;
            const label = captures.labels[0].nodes[0];
            const stepperRoots = captures.steppers.map(record => record.nodes[0]);
            const groupRoots = captures.groups.map(record => record.nodes[0]);
            const groupGap = mode === 'labelAbove' ? customNodes.find(node => node.type === 'Row' &&
                node.width === '100%' && node.height === groupRoots[0].height).create.space : 4;
            const origins = [];
            if (mode === 'inline') {
                const nativeGap = flow.create.space;
                const childrenWidth = label.width + stepperRoots[0].width + stepperRoots[1].width;
                assert.ok(childrenWidth + nativeGap * 2 <= contentWidth + epsilon,
                    'actual inline label plus both actual native stepper rows fit the paid parent');
                const distributedGap = (contentWidth - childrenWidth) / 2;
                let x = paidViewport.x + flow.padding.left + label.width + distributedGap;
                for (const stepper of stepperRoots) {
                    origins.push({ x, y: paidViewport.y + (paidViewport.height - stepper.height) / 2 });
                    x += stepper.width + distributedGap;
                }
            } else {
                assert.equal(groupRoots.length, 2, 'wrapped layout retains a separate semantic unit group');
                assert.deepEqual(captures.groups.map(record => record.nodes.find(node => node.type === 'Text').create),
                    ['分', '秒'], 'wrapped groups visibly identify minutes and seconds');
                const firstY = paidViewport.y + flow.padding.top + label.height + flow.create.space;
                if (mode === 'labelAbove') {
                    const groupsWidth = groupRoots[0].width + groupRoots[1].width + groupGap;
                    assert.ok(groupsWidth <= contentWidth + epsilon, 'both actual unit groups fit their shared row');
                    let x = paidViewport.x + flow.padding.left + contentWidth - groupsWidth;
                    groupRoots.forEach((group, index) => {
                        const unit = captures.groups[index].nodes.find(node => node.type === 'Text');
                        origins.push({ x, y: firstY + unit.height + group.create.space });
                        x += group.width + groupGap;
                    });
                } else {
                    let y = firstY;
                    groupRoots.forEach((group, index) => {
                        assert.ok(group.width <= contentWidth + epsilon, 'each stacked unit group fits its own paid row');
                        const unit = captures.groups[index].nodes.find(node => node.type === 'Text');
                        origins.push({ x: paidViewport.x + flow.padding.left + contentWidth - group.width,
                            y: y + unit.height + group.create.space });
                        y += group.height + flow.create.space;
                    });
                }
            }
            const rectangles = [];
            captures.steppers.forEach((record, index) => {
                const row = record.nodes[0];
                const buttons = record.nodes.filter(node => node.type === 'Button');
                const digit = record.nodes.find(node => node.type === 'Text');
                assert.equal(buttons.length, 2);
                assert.ok(buttons[0].width + digit.width + buttons[1].width + row.create.space * 2 <= row.width + epsilon,
                    'real native buttons and numeric value fit their declared stepper parent');
                let x = origins[index].x;
                for (const [buttonIndex, button] of buttons.entries()) {
                    const rectangle = { x, y: origins[index].y + (row.height - button.height) / 2,
                        width: button.width, height: button.height };
                    assert.equal(button.width, 30, 'actual horizontal carrier preserves authored thirty paint');
                    assert.ok(button.height >= 44, 'actual vertical carrier pays the requested height');
                    contains({ ...origins[index], width: row.width, height: row.height }, rectangle,
                        'whole native action is inside its actual stepper parent');
                    contains(paidViewport, rectangle, 'whole native action is visible inside the custom viewport');
                    rectangles.push(rectangle);
                    x += button.width + row.create.space;
                    if (buttonIndex === 0) x += digit.width + row.create.space;
                }
                const paints = record.nodes.filter(node => node.type === 'Stack');
                assert.ok(paints.every(paint => paint.width === 30 && paint.height === 30));
                assert.ok(record.nodes.filter(node => node.type === 'Image').every(glyph => glyph.width === 14 && glyph.height === 14));
            });
            assert.equal(rectangles.length, 4);
            for (let first = 0; first < rectangles.length; first++) for (let second = first + 1; second < rectangles.length; second++) {
                const left = rectangles[first], right = rectangles[second];
                assert.ok(left.x + left.width <= right.x + epsilon || right.x + right.width <= left.x + epsilon ||
                    left.y + left.height <= right.y + epsilon || right.y + right.height <= left.y + epsilon,
                    'different unit actions have disjoint actual paid rectangles');
            }
            assert.equal(customRoot.width, profile.fullText.timerCustomWidth);
            assert.equal(customRoot.height, profile.fullText.timerCustom);
            assert.equal(profile.full.timerCard.height,
                tt.readerTtsTimerCardLayout(profile.fullText.timerPreset, profile.fullText.timerPresetPaint, customRoot.height).height);
            assert.equal(profile.full.timer.height, profile.full.timerCard.y + profile.full.timerCard.height);
            assert.equal(profile.full.config.y, profile.full.timer.y + profile.full.timer.height + 20);
            assert.equal(profile.full.detail.y, profile.full.config.y + profile.full.config.height + 20);
            assert.equal(profile.full.contentHeight, profile.full.detail.y + profile.full.detail.height + 16);
            const actualTimerFrame = owner.frame();
            const timerRoot = nodes(owner, 'Stack').find(node => node.clip === true &&
                node.position?.x === actualTimerFrame.timer.x && node.position?.y === actualTimerFrame.timer.y);
            assert.ok(timerRoot, 'real timer retains its original animated root clip');
            const timerCard = nodes(owner, 'Column').find(node => node.padding?.left === 14);
            assert.ok(timerCard);
            assert.equal(timerCard.height, actualTimerFrame.timerCard.height);
            assert.equal(timerCard.height,
                actor.readerControlLerp(profile.quick.timerCard.height, profile.full.timerCard.height, progress),
                'the original Card reveal follows one continuous endpoint interpolation');
            for (const field of ['timerCustomWidth', 'timerCustom', 'timerCustomLayout', 'timerCustomLabelWidth',
                'timerCustomLabelHeight', 'timerStepperWidth', 'timerUnitLabelHeight', 'timerStepButtonWidth',
                'timerDigit', 'timerDigitWidth', 'timerStepper', 'timerStepButton']) {
                assert.equal(text[field], profile.fullText[field],
                    'Full-only natural custom recipe stays stable through the morph: ' + field);
            }
            const customButtons = captures.steppers.flatMap(record => record.nodes.filter(node => node.type === 'Button'));
            if (progress < 1) {
                assert.ok(customButtons.every(button => button.enabled === false),
                    'partially revealed Full custom buttons have no input eligibility');
                assert.equal(timerCard.enabled, false);
                assert.equal(timerCard.opacity, progress);
            }
            return { mode, width: customRoot.width, height: customRoot.height, buttons: rectangles.length,
                progress, allocatedCardHeight: timerCard.height,
                naturalFullCardHeight: tt.readerTtsTimerCardLayout(text.timerPreset, text.timerPresetPaint, text.timerCustom).height };
        };
        const samples = [];
        const morphSamples = [];
        const nativeWidths = { panelWidthVp: 341.42857142857144, fullContentWidthVp: 315.42857142857144,
            quickContentWidthVp: 263.42857142857144 };
        scale = 1;
        const currentProfile = tt.measureReaderTtsMinimum(context, nativeWidths, { ...ttsFacts, minutes: '25', seconds: '00' });
        assert.equal(currentProfile.fullText.timerCustomLayout, 'inline');
        assert.ok(Math.abs(currentProfile.fullText.timerCustomWidth - 261.42857142857144) < epsilon);
        samples.push(inspectTimer(currentProfile, nativeWidths, 25, 0));
        for (const progress of [.25, .5, .75])
            morphSamples.push(inspectTimer(currentProfile, nativeWidths, 25, 0, ttsSource, progress));
        for (const viewportWidth of [320, 366]) for (const fontScale of [1, 1.3, 1.6, 2]) {
            scale = fontScale;
            const metrics = createDefaultReaderWindowMetrics();
            metrics.windowRect.width = viewportWidth;
            metrics.windowRect.height = 844;
            metrics.densityPixels = 3.5;
            const actualWidths = geo.readerControlCandidateWidths(viewportWidth, 844, false, metrics)[0];
            for (const minutes of [25, 180]) {
                const profile = tt.measureReaderTtsMinimum(context, actualWidths,
                    { ...ttsFacts, minutes: String(minutes), seconds: '59' });
                assert.ok(profile, 'current native measurement input yields a complete TTS profile');
                samples.push(inspectTimer(profile, actualWidths, minutes, 59));
                for (const progress of [.25, .5, .75])
                    morphSamples.push(inspectTimer(profile, actualWidths, minutes, 59, ttsSource, progress));
            }
        }
        assert.deepEqual(new Set(samples.map(sample => sample.mode)), new Set(['inline', 'labelAbove', 'stacked']));
        const unavailableWidths = { panelWidthVp: 26, fullContentWidthVp: 0, quickContentWidthVp: 0 };
        assert.equal(tt.measureReaderTtsMinimum(context, unavailableWidths, ttsFacts), undefined,
            'a zero-width viewport does not produce a payable profile');
        scale = 1;
        const physicallyNarrow = tt.measureReaderTtsMinimum(context,
            { panelWidthVp: 156, fullContentWidthVp: 130, quickContentWidthVp: 104 }, ttsFacts);
        assert.equal(physicallyNarrow, undefined,
            'an unsupported tiny viewport keeps the existing unavailable measurement result');
        const originalCarrier = ttsSource.replace('.width(this.textMinimum()?.timerStepButtonWidth ?? 30)', '.width(44)');
        assert.notEqual(originalCarrier, ttsSource);
        assert.throws(() => inspectTimer(currentProfile, nativeWidths, 25, 0, originalCarrier),
            /fit their declared stepper parent|preserves authored thirty paint/,
            'the old forty-four horizontal carrier is rejected by the actual child composition');
        console.log('PASS TTS custom duration actual timer composition', JSON.stringify({ samples: samples.length,
            actualNativeViewport: currentProfile.fullText.timerCustomWidth, layouts: [...new Set(samples.map(sample => sample.mode))],
            completeNativeActions: samples.reduce((count, sample) => count + sample.buttons, 0),
            partialMorphSamples: morphSamples.length,
            partialMorphActionsDisabled: morphSamples.reduce((count, sample) => count + sample.buttons, 0), negativeControls: 1,
            partialMorphBoundary: 'Full natural custom recipe is stable; original animated timer/Card clipping can reveal only part until Full input becomes eligible',
            evidence: 'SDK attributes and finite Row/Column allocation, controlled text measurement, no native rasterization' }));
        return;
    }
    if (id === 'tts-paint-target-sdk') {
        const { createHash } = await import('node:crypto');
        const oracle = JSON.parse(read('tools/fixtures/reader-control-tts-make-20260911.json'));
        const makeSource = read('tools/fixtures/tts-reference/PhoneScreen.tsx');
        assert.equal(createHash('sha256').update(makeSource).digest('hex'), '731582c1ac493d48f1ebdaae1e5527de5dfe3f391d37d8c85a51643ce72b4a3c');
        assert.match(makeSource, /function StepButton[\s\S]*?size-\[30px\][\s\S]*?<svg width="14" height="14"/);
        assert.match(makeSource, /className="h-\[36px\] rounded-\[10px\] text-\[12px\] leading-none/);
        const accessibility = selectedProductionClasses(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url),
            ['ReaderActionAccessibility'], { AccessibilityRoleType: { BUTTON: 'button' } });
        const ttsSource = ui('ReaderControlTtsContent.ets');
        const presetPaint = pureModuleProbe(ttsSource.slice(0, ttsSource.indexOf('@Component')), 'ReaderTtsPaint.ets',
            { ...deps, ...accessibility, FrameCallback: class {}, Color: { Transparent: 'Color.Transparent' } }, ['ReaderTtsPresetModifier', 'readerTtsPresetLabelColor']);
        const state = await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts');
        const ttsMaterial = pure('ReaderControlTtsStyle.ts', ['readerTtsPlayGradientStart']);
        const methods = ['p', 'transport', 'transportPaint', 'transportGlyphSize', 'transportResponse', 'roundControl', 'timer', 'timerCardLayout',
            'timerPreset', 'timerPresetLabel', 'timerPresetSelected', 'timerPresetIsSelected', 'chooseTimerPreset',
            'timerStepButton', 'timerStepper', 'timerCustomDuration', 'timerCustomLabel', 'timerCustomGroup', 'stepTimer', 'twoDigits', 'ratePreset', 'ratePresetWidth', 'chooseRatePreset',
            ...displayMethods('ReaderControlTtsContent.ets')];
        const paintOwner = source => createReaderBuilderProbe(source, methods,
            { ...deps, ...tt, ...accessibility, ...presetPaint, ...state, ...ttsMaterial }).owner;
        const owner = paintOwner(ttsSource);
        let profile, progress = 0, availableWidth = 286, admitted = true, speaking = false;
        const commands = [];
        Object.assign(owner, { appScheme: 'day', state: { status: 'idle' }, sourceOnly: 'none', serviceBusy: false, configField: '',
            timerMode: 'duration', timerMinutes: 25, timerSeconds: 20,
            p: () => progress, frame: () => playback.sampleReaderControlTts(progress, availableWidth, 1 / 3, 0, false, profile),
            textMinimum: () => tt.sampleReaderTtsTextMinimum(profile, progress),
            sharedInput: () => admitted && (progress === 0 || progress === 1), fullInput: () => admitted && progress === 1,
            isActivelySpeaking: () => speaking, onlineServicePage: () => false, isHttpEngineSelected: () => false,
            hasActiveQueue: () => true, controlText: kind => kind,
            sectionSurface() {}, moduleHeader() {}, quickLabel() {}, sharedScrollTranslation: () => 0, sharedClip: () => 'retained-motion-mask',
            presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), timerCaption: () => '不开启',
            cycleQuickTimer: () => commands.push('quickTimer'), effectiveRate: () => 1,
            onPrevious: () => commands.push('previous'), onNext: () => commands.push('next'),
            onToggle: () => commands.push('toggle'), onStop: () => commands.push('stop'),
            onTimerChange: (...args) => commands.push(['timer', ...args]), onRateChange: rate => commands.push(['rate', rate]),
        });
        const emitted = fn => { const before = owner.nodes.size; fn(); return [...owner.nodes.values()].slice(before); };
        let transportSamples = 0, stateSamples = 0;
        for (const factor of [1, 1.3, 1.6, 2]) for (const fullWidth of [338, 286]) {
            scale = factor;
            const w = { panelWidthVp: fullWidth + 26, fullContentWidthVp: fullWidth, quickContentWidthVp: fullWidth - 52 };
            for (const facts of [ttsFacts, { ...ttsFacts, seek: true }, { ...ttsFacts, error: '朗读服务暂时不可用，请稍后重试。'.repeat(3) },
                { ...ttsFacts, online: true }]) {
                profile = tt.measureReaderTtsMinimum(context, w, facts);
                assert.ok(profile);
                const base = oracle.shared.stop[1];
                const headerGrowth = profile.fullText.header - 18;
                assert.equal(profile.full.stop.y + profile.full.stop.height / 2, base[1] + base[3] / 2 + headerGrowth);
                assert.ok(profile.full.stop.y >= 0 && profile.full.stop.y + profile.full.stop.height <= profile.full.playback.height);
                assert.ok(profile.full.timerCard.height >= 168 && profile.full.speed.height >= 147.5);
                for (const p of [0, .37, 1]) {
                    progress = p; availableWidth = w.quickContentWidthVp + (w.fullContentWidthVp - w.quickContentWidthVp) * p;
                    for (const kind of ['previous', 'toggle', 'stop', 'next']) {
                        const created = emitted(() => owner.roundControl(kind));
                        const button = created.find(node => node.type === 'Button');
                        const paint = created.find(node => node.type === 'Stack' && typeof node.width === 'number');
                        const glyph = created.find(node => node.type === 'Image');
                        const response = paidResponse(button, owner.frame().playback, 'TTS transport ' + kind);
                        assert.ok(response.width <= Math.max(44, button.width) + .001 && response.height <= Math.max(44, button.height) + .001);
                        assert.equal(button.backgroundColor, 'Color.Transparent');
                        assert.ok(paint.width <= button.width && paint.height <= button.height);
                        assert.deepEqual(paint.position, { x: (button.width - paint.width) / 2, y: (button.height - paint.height) / 2 });
                        assert.equal(glyph.width, kind === 'stop' ? 10 : kind === 'toggle' ? 14 + 8 * p : 17 + 9 * p);
                        if (factor === 1 && fullWidth === 338 && (p === 0 || p === 1)) {
                            const expected = oracle.shared[kind][p];
                            assert.equal(paint.width, expected[2], kind + ' approved paint width');
                            assert.equal(paint.height, expected[3], kind + ' approved paint height');
                        }
                        transportSamples++;
                    }
                    stateSamples++;
                }
                progress = 1; availableWidth = w.fullContentWidthVp;
                const timerNodes = emitted(() => owner.timer());
                const timerPaint = timerNodes.filter(node => node.type === 'Stack' && node.height === profile.fullText.timerPresetPaint && node.borderRadius === 10);
                assert.equal(timerPaint.length, 6);
                assert.equal(timerNodes.find(node => node.type === 'Column' && node.height === owner.frame().timerCard.height && node.width === owner.frame().timer.width)?.padding.top,
                    owner.timerCardLayout().topPadding);
                assert.ok(timerNodes.filter(node => node.type === 'Button' && node.enabled !== false && node.opacity !== 0).every(button => button.height >= 44));
                const rateNodes = emitted(() => owner.ratePreset(1.25));
                assert.equal(rateNodes.find(node => node.type === 'Stack').height, profile.fullText.ratePresetPaint);
                const stepNodes = emitted(() => owner.timerStepButton(false, 5));
                assert.equal(stepNodes.find(node => node.type === 'Stack').width, 30);
                assert.equal(stepNodes.find(node => node.type === 'Image').width, 14);
                const step = stepNodes.find(node => node.type === 'Button');
                const before = commands.length;
                owner.configField = 'voice'; step.onClick();
                assert.equal(commands.length, before, 'old step callback cannot write under a successor configuration layer');
                owner.configField = ''; admitted = false; step.onClick();
                assert.equal(commands.length, before, 'retired module callback is fenced');
                admitted = true; step.onClick(); assert.equal(commands.length, before + 1);
                progress = 0; availableWidth = w.quickContentWidthVp;
                const quickNodes = emitted(() => owner.timer());
                const captionPaint = quickNodes.find(node => node.type === 'Stack' && node.height === profile.quickText.quickTimerPaintHeight && node.border?.width === .5);
                assert.ok(captionPaint);
                assert.ok(profile.quickText.quickTimerPaintHeight <= profile.quick.quickTimerSelect.height);
                if (factor === 1 && fullWidth === 338 && facts === ttsFacts) {
                    assert.equal(captionPaint.height, oracle.quickOnly.quickTimerSelect[3]);
                    assert.equal(profile.full.playback.height, oracle.shared.playback[1][3]);
                    assert.equal(profile.full.timerCard.height, oracle.fullOnly.timerCard[3]);
                    assert.equal(profile.full.speedPresets.y + (profile.fullText.ratePreset - profile.fullText.ratePresetPaint) / 2,
                        oracle.fullOnly.speedPresets[1]);
                    assert.equal(profile.fullText.ratePresetPaint, oracle.fullOnly.speedPresets[3]);
                }
            }
        }
        progress = 0; speaking = true;
        assert.equal(owner.transportGlyphSize('toggle'), 13);
        progress = 1; assert.equal(owner.transportGlyphSize('toggle'), 20);
        const currentMinimum = ui('ReaderControlTtsMinimum.ets');
        const uncentered = pure('ReaderControlTtsMinimum.ets', ['measureReaderTtsMinimum'],
            currentMinimum.replace('frame.stop.y -= (frame.stop.height - stopPaintHeight) / 2;', 'frame.stop.y += 0;'));
        scale = 1;
        const wrong = uncentered.measureReaderTtsMinimum(context, { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 }, ttsFacts);
        assert.notEqual(wrong.full.stop.y + wrong.full.stop.height / 2, 161 + 21 / 2);
        const targetPaintMutant = paintOwner(ttsSource.replace('.height(this.textMinimum()?.timerPresetPaint ?? 36)', '.height(this.textMinimum()?.timerPreset ?? 44)'));
        Object.assign(targetPaintMutant, owner, { p: () => 1, textMinimum: () => wrong.fullText });
        targetPaintMutant.timerPreset(15);
        assert.notEqual(nodes(targetPaintMutant, 'Stack').at(-1).height, 36, 'old paint-equals-target is rejected by independent reference36');
        const metrics = { revision: 1, systemFontScale: 1 };
        const picker = native('ReaderTtsConfigOverlay.ets', ['choiceRow', 'choiceHeight', 'panelWidth', 'previewActionWidth',
            'previewActionHeight', 'previewPaintHeight', 'choose', 'preview', 'stopPreview'], {
            ReaderWindowCoordinator: { metrics: () => metrics },
        });
        const choice = { id: 'voice:one', label: '清晰女声 · 标准温润' };
        const choiceCalls = [], previewCalls = [], closeCalls = [];
        Object.assign(picker, { voicePicker: true, manager: false, availableWidth: 338, availableHeight: 666,
            mounted: true, busy: false, choices: [choice], selectedId: choice.id, selectionId: 'current-opening',
            previewId: '', previewGeneration: 0, generation: 0, getUIContext: () => context, appThemeScheme: 'day',
            onChoose: async (...args) => choiceCalls.push(args), onClose: id => closeCalls.push(id),
            onPreview: (...args) => { previewCalls.push(args); return new Promise(() => {}); },
            onPreviewStop: id => previewCalls.push(['stop', id]),
        });
        picker.choiceRow(choice);
        const choiceButtons = nodes(picker, 'Button');
        assert.equal(choiceButtons.length, 2, 'selection and preview have two native input owners');
        const selection = choiceButtons.find(node => node.accessibilityText === choice.label);
        const preview = choiceButtons.find(node => node !== selection);
        assert.equal(selection.accessibilitySelected, true);
        assert.ok(selection.height >= 44 && preview.height >= 44);
        assert.ok(nodes(picker, 'Row').some(node => node.height === 26 && node.backgroundColor !== undefined));
        assert.ok(nodes(picker, 'Image').some(node => node.width === 16 && node.height === 16));
        picker.busy = true; picker.replay();
        assert.ok(nodes(picker, 'Button').every(button => button.enabled === false), 'each native owner declares its current busy availability');
        selection.onClick(); preview.onClick();
        assert.equal(choiceCalls.length, 0); assert.equal(previewCalls.length, 0);
        picker.busy = false; picker.replay();
        preview.onClick(); assert.equal(previewCalls.length, 1); assert.equal(choiceCalls.length, 0);
        preview.onClick(); assert.equal(previewCalls.length, 2);
        selection.onClick();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        assert.deepEqual(choiceCalls, [[choice.id, 'current-opening']]);
        assert.deepEqual(closeCalls, ['current-opening']);
        picker.choices = [{ id: 'voice:successor', label: '后继音色' }];
        picker.previewId = 'voice:successor'; picker.previewSelectionId = 'current-opening';
        selection.onClick(); preview.onClick();
        assert.equal(picker.previewId, 'voice:successor', 'removed row callbacks cannot stop the current audition');
        assert.equal(choiceCalls.length, 1); assert.equal(previewCalls.length, 2, 'removed row cannot start or stop an audition');
        picker.mounted = false; selection.onClick(); preview.onClick();
        assert.equal(choiceCalls.length, 1); assert.equal(previewCalls.length, 2);
        console.log(JSON.stringify({ kind: 'tts-approved-paint-and-native-targets', transportSamples, stateSamples,
            reference: 'Make V17 exact original plus44vp target successor', defaultFullPlayback: 198,
            defaultTimerCard: 168, previewPaintHeight: 26, nativeRaster: 'NOT_RUN' }));
        return;
    }
    if (id === 'module-shell-sdk') {
        const hostSession = await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
        const directoryBudget = await import('../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts');
        let metrics = createDefaultReaderWindowMetrics();
        Object.assign(deps, directoryBudget, ap, st, se, rp, tt, au, {
            readerWindowMetrics: () => metrics,
        });
        Object.assign(deps, pure('ReaderControlDirectoryMinimum.ets', ['measureReaderDirectoryMinimum']));
        const composedMinimum = pure('ReaderControlMinimumMeasurement.ets', [
            'measureReaderControlMinimum', 'measureReaderControlModuleMinimum',
            'readerControlModuleFactsGeometryKey', 'readerControlModuleFactsDisplayEqual',
            'readerControlModuleFactsMatch', 'readerControlModuleProfileMatches',
            'readerControlMeasuredProfileGeometryKey',
        ]);
        // Use the current window facts in the original top-bar producer too.
        const topBarProducer = pureModuleProbe(headerMeasure.getText(headerTree), 'ReadingHeaderMeasure.ets', {
            ...deps, readerWindowMetrics: () => metrics,
        }, ['readerReadingTopBarHeight']);
        const directorySnapshot = { rows: [{ key: 'chapter:0' }], catalogState: 'ready', loading: false,
            targetRow: 0, currentTitle: 'Chapter One', currentPosition: '1 / 1' };
        const directoryFacts = { title: 'Chapter One', excerpt: '', hasRows: true, loading: false,
            currentTitle: 'Chapter One', currentPosition: '1 / 1', bookmarkError: false,
            message: '', action: '', catalogStatus: '', catalogAction: '',
            readViewSnapshot: () => directorySnapshot };
        const appearanceSnapshot = { fontOrder: ['system', 'serif'] };
        const searchState = { kind: 'results', results: [{ key: 'result:0' }] };
        const ttsState = { status: 'idle', totalSlices: 0, errorMessage: '' };
        const replaceState = { rules: [{ name: '规则一' }, { name: '规则二' }, { name: '规则三' }] };
        const settingsFacts = pure('ReaderControlSettingsMinimum.ets',
            ['readerControlSettingsMinimumFacts']).readerControlSettingsMinimumFacts();
        const moduleFacts = new Map([
            ['home', { module: 'home', home: { chapterTitle: 'Chapter One', totalChapters: 1 } }],
            ['directory', { module: 'directory', directory: { ...directoryFacts, tab: 'directory' } }],
            ['bookmarks', { module: 'directory', directory: { ...directoryFacts, tab: 'bookmarks' } }],
            ['appearance', { module: 'appearance', appearance: { ...appInput,
                readViewSnapshot: () => appearanceSnapshot,
                readViewFontOrder: () => appearanceSnapshot.fontOrder } }],
            ['settings', { module: 'settings', settings: settingsFacts }],
            ['search', { module: 'search', search: { ...searchFacts,
                readViewState: () => searchState } }],
            ['tts', { module: 'tts', tts: { ...ttsFacts, readViewState: () => ttsState } }],
            ['autoPage', { module: 'autoPage', autoPage: { status: '未开始', timerSummary: '15:00' } }],
            ['replace', { module: 'replace', replace: { statusText: '', recoveryLabel: '', name: '规则',
                pattern: 'a → b', meta: '正文', temporaryTitle: '', editorOpen: false, layerOpen: false,
                ruleCount: replaceState.rules.length, statusVisible: false, readViewState: () => replaceState } }],
        ]);
        const frames = [];
        const current = native('LocalReadingExperience.ets', [
            'setControlPage', 'requestExit', 'requestControlSession', 'cancelControlNavigationIntent',
            'onControlInputActivity', 'controlMinimumIdentity', 'controlMinimumCurrent',
            'controlMinimumReceiptCurrent', 'bindControlMinimum', 'scheduleControlMinimum',
            'admitControlMinimum', 'adoptControlDisplayFacts', 'controlLayoutGeometryKey', 'controlLayout',
        ], { ...geo, ...receipt, ...session, ...hostSession, ...composedMinimum,
            ReaderWindowCoordinator: { metrics: () => metrics },
            ReaderUIFrameCallback: class { constructor(fn) { this.onFrame = fn; } },
        });
        const panel = native('ReaderControlPanel.ets', [
            'measureHomeForm', 'measureControlMinimum', 'minimumModule', 'publishMinimumMeasurer',
            'minimumProfileReader', 'minimumInputReady', 'contentInputEnabled',
        ], { ...geo, ...composedMinimum, ...topBarProducer, DEBUG: false });
        const timing = { showDurationMs: 320, dismissDurationMs: 200,
            morphDurationMs: 260, navigateDurationMs: 0 };
        Object.assign(current, { sourceId: 'source', bookId: 'book', lifecycleToken: 1, mounted: true,
            appForeground: true, windowChromeActive: true, windowChromeOverlayActive: false,
            interactionBlocked: false, controlObscured: false, controlOpenRevision: 1,
            isSessionActive: token => token === 1, isControlInputEnabled: () => true,
            controlTiming: () => timing, pageTurnInputPhase: () => 'idle',
            invalidateControlBackdrop() {}, prepareControlPage() {},
            controlPage: () => hostSession.readerControlHostPage(current.controlSession),
            readerRecoveryRequestCurrent: () => false, controlVisible: () => true,
            effectiveViewportWidth() { return this.width; },
            effectiveViewportHeight() { return this.height; },
            getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
        });
        Object.assign(panel, { runtimeMounted: true, minimumFontsReady: true,
            preparedMinimumRequired: true, chapterTitle: 'Chapter One', totalChapters: 1,
            inputEnabled: true, controlObscured: false, visualVisibilityProgress: 1,
            visualTransitionKind: '', visualHeldPointerId: -1, temporaryLayerActive: false,
            hasCurrentTemporaryInput: () => false, contentMotionProgress: 0,
            getUIContext: () => context,
            contentLocation: () => panel.presentationReceipt?.location ?? session.readerControlContentLocation(current.controlSession),
            minimumReceiptCurrent: key => current.controlMinimumReceiptCurrent(key),
            defaultMinimumFacts: () => {
                const location = current.controlMinimumRequestLocation();
                const module = location.level === 'secondary' ? location.module : 'home';
                return moduleFacts.get(module === 'directory' ? location.directoryTab : module);
            },
            onMinimumMeasurerReady: (identity, provider, reader, facts, signature) =>
                current.bindControlMinimum(identity, provider, reader, facts, signature),
        });
        const deliverHostProps = () => Object.assign(panel, {
            controlSession: current.controlSession,
            minimumIdentity: current.controlMinimumIdentity(),
            minimumCommittedIdentity: current.controlMinimumCommittedIdentity(),
            minimumOwnerKey: current.controlMinimumOwnerKey(),
            minimumEnvironmentKey: current.controlMinimumEnvironmentKey(),
            minimumRequestLocation: current.controlMinimumRequestLocation(),
            minimumMetricsRevision: metrics.revision,
            presentationReceipt: current.controlPresentationReceipt,
            minimumReady: current.controlMinimumReady,
            layout: current.controlLayout(metrics.revision),
        });
        const flush = () => {
            let count = 0;
            while (frames.length) {
                assert.ok(++count < 20, 'bounded current production frame queue');
                frames.shift().onFrame(0);
            }
            current.latestControlVisualSession = session.copyReaderControlSessionState(current.controlSession);
            deliverHostProps();
        };
        const outer = layout => [layout.fullPanelWidth, layout.quickPanelHeight, layout.fullPanelHeight,
            layout.fullPanelTop, layout.dockBottomGap, layout.topBarTop, layout.topBarHeight];
        const pages = { directory: 'moduleDirectory', tts: 'moduleTts', appearance: 'moduleAppearance',
            settings: 'moduleSettings', search: 'quickSearch', replace: 'quickReplace',
            autoPage: 'quickAutoPage', home: 'home' };
        const visit = (module, tab = 'directory') => {
            const previous = current.controlPresentationReceipt;
            const previousSession = session.copyReaderControlSessionState(current.controlSession);
            const previousProvider = current.controlMinimumProvider;
            if (module === 'directory' && tab === 'bookmarks') {
                current.requestControlSession(session.setReaderControlDirectoryTab(current.controlSession, tab));
            } else current.setControlPage(pages[module]);
            assert.deepEqual(current.controlSession, previousSession, 'pending semantic owner stays committed');
            assert.equal(current.controlPresentationReceipt, previous, 'pending paint/profile pair stays committed');
            deliverHostProps();
            panel.publishMinimumMeasurer();
            if (previousProvider !== undefined && previous !== undefined &&
                current.controlMinimumIdentity() !== previous.identity) {
                const candidateWidth = geo.readerControlCandidateWidths(current.width, current.height,
                    current.expandedLayout, metrics)[0];
                assert.equal(previousProvider(candidateWidth, 'retired|1'), undefined,
                    'old actual Panel provider cannot measure the requested successor');
                assert.equal(current.controlMinimumReceiptCurrent(previous.key), true,
                    'pending target retains the committed input receipt');
            }
            assert.equal(current.controlPresentationReceipt, previous, 'real provider publication does not commit inline');
            flush();
            const next = current.controlPresentationReceipt;
            assert.ok(next, module + ' has a complete real measured receipt');
            assert.equal(next.profile.module, module);
            assert.equal(next.identity, current.controlMinimumCommittedIdentity());
            assert.equal(next.key, next.layout.minimumKey);
            assert.equal(next.profile.identity, next.identity);
            if (module !== 'home') {
                assert.equal(next.prepared.key, next.key);
                assert.equal(next.prepared.moduleData, next.profile.moduleData);
                assert.equal(composedMinimum.readerControlModuleProfileMatches(next.prepared.moduleData, module), true);
            }
            assert.equal(current.controlMinimumReceiptCurrent(next.key), true);
            return next.layout;
        };
        let compositions = 0, samples = 0, oldChooserRejected = false, immediateCommitRejected = false;
        let metadataUpdates = 0, environmentUpdates = 0, backCancellations = 0, environmentReflows = 0;
        const naturalQuickHeights = new Set();
        const viewports = [[366, 844, 1], [320, 640, 1], [568, 320, 1], [760, 960, 1],
            [1280 / 3.5, 2832 / 3.5, 3.5]];
        for (const [width, height, density] of viewports) {
            for (const factor of [1, 1.3, 1.6, 2]) {
                scale = factor;
                metrics = { ...createDefaultReaderWindowMetrics(), revision: metrics.revision + 1,
                    densityPixels: density, systemFontScale: factor,
                    windowRect: { left: 0, top: 0, width, height } };
                frames.length = 0;
                Object.assign(current, { width, height, expandedLayout: width >= 600,
                    controlModuleVisitRevision: 1, controlMinimumRevision: 0, controlMinimumGeneration: 0,
                    controlNavigationGeneration: 0, observedControlModule: 'home',
                    controlMinimumCandidates: [], controlMinimumReady: false, controlPresentationReceipt: undefined,
                    controlNavigationIntent: undefined, controlLayoutCache: undefined,
                    controlSession: session.openReaderControlSession(session.createReaderControlSessionState(), 0),
                });
                current.latestControlVisualSession = session.copyReaderControlSessionState(current.controlSession);
                Object.assign(panel, { minimumProfiles: new Map(), minimumProfileTicket: '',
                    minimumFactsSignature: '', minimumOwnerFactsSignature: '', minimumOwnerFacts: undefined,
                    localMinimumFacts: undefined, publishedMinimumFacts: undefined });
                const home = visit('home');
                for (const [module, tab] of [['directory', 'directory'], ['directory', 'bookmarks'], ['tts'],
                    ['appearance'], ['settings'], ['search'], ['replace'], ['autoPage'], ['home']]) {
                    const layout = visit(module, tab);
                    assert.deepEqual(outer(layout), outer(home), `${width}x${height}@${factor} ${module}/${tab} retains shared W/Q/F/anchors`);
                    const selected = current.controlMinimumCandidates.find(candidate => candidate.key === layout.minimumKey);
                    assert.ok(selected.sharedShell);
                    naturalQuickHeights.add(selected.minimum.quick.heightVp);
                    for (const progress of [0, .37, 1]) {
                        const sample = value => motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: progress },
                            motion.readerControlMotionBounds(value.fullPanelWidth, value.fullPanelHeight,
                                value.dockBottomGap, value.quickPanelHeight, value.contentBudget));
                        assert.deepEqual(sample(layout).shell, sample(home).shell, 'actual measured module commit retains common shell trajectory');
                        assert.deepEqual(sample(layout).brightness, sample(home).brightness, 'actual module chrome cannot resize the shared brightness rail');
                        samples++;
                    }
                    if (!oldChooserRejected && module === 'directory' && width === 366 && factor === 1) {
                        const legacy = geo.resolveReaderControlLayout(width, height, false, metrics, 0,
                            current.controlMinimumCandidates.map(({ sharedShell, ...candidate }) => candidate));
                        assert.notDeepEqual(outer(legacy), outer(home), 'old active-module chooser reproduces shell movement with actual current producer');
                        oldChooserRejected = true;
                    }
                    compositions++;
                }
                // Same geometry, new business snapshot follows the actual metadata fast path.
                visit('directory');
                const before = current.controlPresentationReceipt;
                const facts = moduleFacts.get('directory');
                const snapshot = facts.directory.readViewSnapshot();
                const nextSnapshot = { ...snapshot, rows: snapshot.rows.slice() };
                moduleFacts.set('directory', { ...facts, directory: { ...facts.directory,
                    readViewSnapshot: () => nextSnapshot } });
                const measuredBefore = measurementCalls;
                deliverHostProps(); panel.publishMinimumMeasurer(); flush();
                assert.equal(current.controlPresentationReceipt.key, before.key);
                assert.equal(current.controlPresentationReceipt.profile, before.profile);
                assert.equal(current.controlPresentationReceipt.layout, before.layout);
                assert.equal(measurementCalls, measuredBefore, 'same geometry metadata does not invoke real text producers again');
                metadataUpdates++;
                // The real Back entry cancels a queued target before its frame can commit.
                current.setControlPage('moduleTts'); deliverHostProps(); panel.publishMinimumMeasurer();
                assert.ok(current.controlNavigationIntent);
                const cancelled = current.controlPresentationReceipt;
                current.requestExit(); flush();
                assert.equal(current.controlPresentationReceipt, cancelled);
                assert.equal(current.controlNavigationIntent, undefined);
                backCancellations++;
                // Real environment changes may reflow while semantic ownership stays current.
                metrics = { ...metrics, revision: metrics.revision + 1, systemFontScale: factor === 2 ? 1 : 2 };
                scale = metrics.systemFontScale;
                deliverHostProps(); panel.publishMinimumMeasurer(); flush();
                assert.equal(current.controlPresentationReceipt.environmentKey, current.controlMinimumEnvironmentKey());
                assert.equal(current.controlPresentationReceipt.location.module, 'directory');
                assert.notEqual(current.controlPresentationReceipt.key, cancelled.key);
                if (JSON.stringify(outer(current.controlPresentationReceipt.layout)) !== JSON.stringify(outer(cancelled.layout)))
                    environmentReflows++;
                environmentUpdates++;
                const admitted = current.controlPresentationReceipt.layout;
                const candidates = current.controlMinimumCandidates;
                const overflow = geo.resolveReaderControlLayout(width, height, current.expandedLayout, metrics, 0,
                    candidates.map(candidate => ({ ...candidate, minimum: { module: candidate.minimum.module,
                        quick: { heightVp: 5000, minWidthVp: 5000, fits: false },
                        full: { heightVp: 5000, minWidthVp: 5000, fits: false } } })));
                assert.deepEqual(outer(overflow), outer(admitted), 'unfit content stays inside the same paid shell');
                assert.equal(overflow.quickMinimumFits, false);
                assert.equal(overflow.fullMinimumFits, false);
                const malformed = geo.resolveReaderControlLayout(width, height, current.expandedLayout, metrics, 0,
                    candidates.map(candidate => ({ ...candidate, sharedShell: { ...candidate.sharedShell,
                        chrome: { ...candidate.sharedShell.chrome, quickReserveVp: NaN } } })));
                assert.equal(malformed.minimumStatus, 'legacy', 'malformed shared basis is rejected');
                assert.equal(current.controlMinimumReceiptCurrent(malformed.minimumKey), false);
                if (!immediateCommitRejected) {
                    const request = current.requestControlSession;
                    const committedSession = current.controlSession;
                    current.requestControlSession = next => { current.controlSession = next; };
                    assert.throws(() => visit('tts'), /pending semantic owner stays committed/,
                        'former semantic-first navigation fails the composed pending assertion');
                    current.requestControlSession = request;
                    current.controlSession = committedSession;
                    current.latestControlVisualSession = session.copyReaderControlSessionState(committedSession);
                    immediateCommitRejected = true;
                }
            }
        }
        const provider = current.controlMinimumProvider;
        const profileReader = current.controlMinimumProfileReader;
        const facts = current.controlMinimumProviderFacts;
        const factsKey = current.controlMinimumProviderFactsKey;
        const identity = current.controlMinimumIdentity();
        current.bindControlMinimum(identity, undefined);
        const retiredClear = frames.shift();
        current.bindControlMinimum(identity, provider, profileReader, facts, factsKey);
        const revision = current.controlMinimumRevision;
        retiredClear.onFrame(0);
        assert.equal(current.controlMinimumRevision, revision, 'retired provider clear cannot invalidate the new binding');
        flush();
        assert.equal(current.controlMinimumReady, true);
        assert.ok(environmentReflows > 0, 'real environment changes can reflow the common shell');
        assert.ok(naturalQuickHeights.size > 7, 'real module measurers replace the uniform190 lifecycle fixture');
        assert.equal(oldChooserRejected, true);
        assert.equal(immediateCommitRejected, true);
        console.log(JSON.stringify({ kind: 'reader-current-atomic-module-shell', compositions, samples,
            modules: 8, directoryTabs: 2, viewports, fontScales: [1, 1.3, 1.6, 2],
            metadataUpdates, environmentUpdates, environmentReflows, backCancellations,
            distinctNaturalQuickHeights: naturalQuickHeights.size,
            pendingOwnerAndProfile: 'PAIRED_UNTIL_FRAME_COMMIT',
            oldActiveModuleChooser: 'REJECTED', oldSemanticFirstNavigation: 'REJECTED',
            boundary: 'Actual current Host/Panel producer and commit methods with pure production module measurements. Readonly business facts and text metrics are finite ports. Prop scheduler, native raster, glyphs and continuous device frames are outside this case.' }));
        return;
    }
    if (id === 'admission-sdk') {
        let metrics = createDefaultReaderWindowMetrics();
        const frames = [];
        const panel = native('ReaderControlPanel.ets', ['minimumInputReady', 'publishMinimumMeasurer', 'measureControlMinimum', 'minimumModule', 'contentInputEnabled', 'bindModuleMinimum'], { ...geo, ...minimum, DEBUG: false });
        Object.assign(panel, { runtimeMounted: true, minimumFontsReady: true, minimumProfiles: new Map(), minimumProfileTicket: '',
            minimumIdentity: '', minimumKey: '', minimumMetricsRevision: 1, minimumReady: false, inputEnabled: true, controlObscured: false,
            visualVisibilityProgress: 1, visualTransitionKind: '', visualHeldPointerId: -1, hasCurrentTemporaryInput: () => false,
            contentLocation: () => session.readerControlContentLocation(current.controlSession), contentTitle: () => '阅读控制', headerInter: () => false,
            isExpanded: () => current.expandedLayout, getUIContext: () => context,
            measureHomeForm: w => ({ minimumHeight: 170 * scale, minWidth: 130, fits: w >= 130 }),
        });
        const current = native('LocalReadingExperience.ets', ['controlMinimumIdentity', 'controlMinimumCurrent', 'controlMinimumReceiptCurrent', 'bindControlMinimum', 'scheduleControlMinimum', 'admitControlMinimum', 'controlLayout'], {
            ...geo, ...receipt, ...session, ReaderWindowCoordinator: { metrics: () => metrics },
            ReaderUIFrameCallback: class {
                constructor(fn) { this.onFrame = fn; }
            },
        });
        Object.assign(current, { sourceId: 'source', bookId: 'book', lifecycleToken: 1, mounted: true, appForeground: true,
            windowChromeActive: true, windowChromeOverlayActive: false, interactionBlocked: false, controlObscured: false,
            controlOpenRevision: 1, controlModuleVisitRevision: 1, readerRecoveryBottom: 0, controlMinimumRevision: 0, controlMinimumGeneration: 0, controlMinimumCandidates: [],
            controlSession: { location: { level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' } },
            isSessionActive: token => token === 1, effectiveViewportWidth() { return this.width; }, effectiveViewportHeight() { return this.height; },
            pageTurnInputPhase: () => 'idle', invalidateControlBackdrop() { }, getUIContext: () => ({ postFrameCallback: f => frames.push(f) }),
        });
        panel.minimumReceiptCurrent = key => current.controlMinimumReceiptCurrent(key);
        let rendering = false, ready = false;
        Object.defineProperty(current, 'controlMinimumReady', {
            get: () => ready,
            set(value) {
                assert.equal(rendering, false, 'child publication must not mutate parent @State during render');
                ready = value;
            },
        });
        panel.onMinimumMeasurerReady = (identity, provider) => current.bindControlMinimum(identity, provider);
        let prepareModule;
        const cycle = (width, height) => {
            Object.assign(current, { width, height, expandedLayout: width >= 600 });
            metrics.revision++;
            metrics.systemFontScale = scale;
            const cold = current.controlLayout(metrics.revision);
            assert.ok(cold.topBarHeight >= deps.readerReadingTopBarHeight(context, 'reading', 54), 'cold conservative shell pays current native line extent');
            assert.ok(cold.fullPanelTop >= (cold.topBarVisible ? cold.topBarTop + cold.topBarHeight + 8 : cold.topBarTop));
            panel.layout = cold;
            panel.minimumIdentity = current.controlMinimumIdentity();
            panel.minimumMetricsRevision = metrics.revision;
            const beforePublication = current.controlMinimumReady;
            rendering = true;
            if (prepareModule)
                prepareModule(panel.minimumIdentity);
            else
                panel.publishMinimumMeasurer();
            rendering = false;
            assert.equal(current.controlMinimumReady, beforePublication, 'readiness changes only in the scheduled frame');
            assert.equal(current.controlMinimumReceiptCurrent(panel.minimumKey), false, 'provider replacement synchronously fences the old measured generation');
            assert.equal(panel.minimumInputReady(), false, 'old reactive ready value cannot admit the new generation');
            assert.ok(frames.length > 0, 'supported viewport scheduled measurement');
            frames.shift().onFrame(0);
            assert.equal(current.controlMinimumReady, true);
            const layout = current.controlLayout(metrics.revision);
            assert.notEqual(layout.minimumStatus, 'legacy');
            assert.ok(layout.minimumKey.startsWith(panel.minimumIdentity + '|'));
            assert.ok(layout.contentBudget);
            assert.ok(layout.fullPanelTop >= (layout.topBarVisible ? layout.topBarTop + layout.topBarHeight + 8 : layout.topBarTop));
            panel.layout = layout;
            assert.ok(layout.fullPanelWidth <= width && layout.fullPanelHeight <= height);
            panel.minimumKey = layout.minimumKey;
            panel.minimumReady = current.controlMinimumReady;
            assert.equal(panel.minimumInputReady(), true);
            assert.equal(panel.contentInputEnabled(), true);
            assert.ok(panel.minimumProfiles.get(layout.minimumKey), 'current Panel owns measured profile');
            return layout;
        };
        for (const [w, h] of [[568, 320], [366, 844], [568, 320], [366, 844], [600, 320], [760, 960], [760, 320]])
            cycle(w, h);
        const { ReaderContentSearchPublication } = selectedProductionClasses(
            new URL('../entry/src/main/ets/features/reading/presentation/ReaderContentSearchPublication.ets', import.meta.url),
            ['ReaderContentSearchPublication']);
        // This legacy geometry fixture supplies a raw owner snapshot through
        // the real Publication/helper. Actual @State proxy and operation
        // identity behavior belongs to the separate recovery-generation leaf.
        const searchState = { kind: 'results', keyword: '正文', hasMore: true,
            results: [{ chapterTitle: '章节', snippet: '正文' }] };
        const searchPublication = new ReaderContentSearchPublication();
        searchPublication.publish(searchState);
        const moduleSpecs = [
            ['appearance', 'ReaderControlAppearanceContent.ets', ['publishMinimumMeasurer'], { ...ap }, { feedbackMounted: true, minimumMeasurerGeneration: 0, minimumInput: () => appInput, expandedLayout: true }],
            ['tts', 'ReaderControlTtsContent.ets', ['publishMinimumMeasurer'], { ...tt }, { configMounted: true, sourceOnly: 'none', minimumFacts: () => ttsFacts, expandedLayout: true }],
            ['autoPage', 'ReaderControlAutoPageContent.ets', ['publishMinimumMeasurer'], { ...au }, { minimumMounted: true, minimumFontsReady: true, sourceOnly: 'none', headerMeta: () => '未开始', timerSummaryText: '未设置', expandedLayout: true }],
            ['search', 'ReaderControlSearchContent.ets', ['publishMinimumMeasurer', 'currentSearchState'], { ...se },
                { queryInputMounted: true, state: searchState, searchPublication, searchRevision: 1,
                    query: '正文', resultTitle: () => '章节', statusText: () => '', retainedLoadMoreFailure: false }],
            ['settings', 'ReaderControlSettingsContent.ets', ['onMinimumIdentityChanged', 'measureMinimum', 'groupLabel', 'groupOptions', 'optionLabel', 'minimumMeasurer'], { ...st,
                    ...selectedProductionValues(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlSettingsContent.ets', import.meta.url), ['SETTINGS_DIRECTION_OPTIONS', 'SETTINGS_PAGE_OPTIONS', 'SETTINGS_TIMEOUT_OPTIONS'], deps) }, { minimumMounted: true }],
            ['replace', 'ReaderControlReplaceContent.ets', ['onMinimumIdentityChanged', 'measureMinimum', 'minimumMeasurer'], { ...rp }, { mounted: true, state: { rules: [{ name: '替换', pattern: '原文', replacement: '替换' }], errorMessage: '', recoveryLabel: '' }, localError: '', layer: '', fullContentHeight: 500, statusText: () => '', scopeSummary: () => '正文', temporaryTitle: () => '替换规则' }],
        ];
        for (const [module, file, names, extra, properties] of moduleSpecs) {
            const child = native(file, names, extra);
            Object.assign(child, { minimumProfiles: new Map(), minimumPublishedIdentity: '', publishedMinimumIdentity: '', registeredMinimumIdentity: '',
                minimumKey: '', minimumCacheTicket: '', minimumProfileTicket: '', minimumCandidateTicket: '', getUIContext: () => context, ...properties });
            current.controlSession.location = { level: 'secondary', module, directoryTab: 'directory', form: 'quick' };
            prepareModule = identity => {
                child.minimumIdentity = identity;
                child.minimumMetricsRevision = panel.minimumMetricsRevision;
                child.onMinimumMeasurerReady = (ticket, provider, reader) => panel.bindModuleMinimum(module, ticket, provider, reader);
                if (module === 'settings' || module === 'replace')
                    child.onMinimumIdentityChanged();
                else
                    child.publishMinimumMeasurer();
            };
            scale = 2;
            const layout = cycle(760, 320);
            assert.ok(child.minimumProfiles.has(layout.minimumKey), module + ' retains current expanded measurement');
            scale = 1;
            cycle(568, 320);
            const previousChildProvider = panel.moduleMinimumMeasurer;
            if (module !== 'settings' && module !== 'replace') {
                child.minimumIdentity = 'retired';
                assert.equal(previousChildProvider(geo.readerControlCandidateWidths(568, 320, false, metrics)[0], 'late|1'), undefined, module + ' provider rejects retired identity');
            }
        }
        prepareModule = undefined;
        current.controlSession.location = { level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' };
        cycle(366, 844);
        const old = panel.minimumIdentity;
        const oldKey = panel.minimumKey;
        panel.publishMinimumMeasurer();
        const late = frames.shift();
        cycle(390, 844);
        const revision = current.controlMinimumRevision;
        late.onFrame(0);
        assert.equal(current.controlMinimumRevision, revision);
        assert.equal(current.controlMinimumCurrent(old), true, 'viewport reflow preserves the current semantic owner');
        assert.equal(current.controlMinimumReceiptCurrent(oldKey), false, 'the superseded measured key remains retired after same-owner viewport reflow');
        const previous = current.controlMinimumProvider;
        rendering = true;
        current.bindControlMinimum(current.controlMinimumIdentity(), undefined);
        rendering = false;
        assert.equal(current.controlMinimumReceiptCurrent(panel.minimumKey), false, 'same-identity undefined provider is fenced before its frame');
        assert.equal(panel.contentInputEnabled(), false);
        frames.shift().onFrame(0);
        assert.equal(current.controlMinimumReady, false);
        current.bindControlMinimum(current.controlMinimumIdentity(), undefined);
        current.bindControlMinimum(current.controlMinimumIdentity(), previous);
        frames.shift().onFrame(0);
        assert.equal(current.controlMinimumReady, false, 'superseded undefined provider cannot commit readiness');
        assert.equal(current.controlMinimumReceiptCurrent(panel.minimumKey), false, 'stale clear frame cannot admit the replacement');
        frames.shift().onFrame(0);
        assert.equal(current.controlMinimumReady, true);
        assert.equal(current.controlMinimumReceiptCurrent(panel.minimumKey), false, 'new receipt cannot re-enable old Panel props');
        panel.minimumKey = current.controlLayout(metrics.revision).minimumKey;
        assert.equal(current.controlMinimumReceiptCurrent(panel.minimumKey), true);
        const portraitOnly = ui('LocalReadingExperience.ets').replace('this.effectiveViewportWidth() > 0 && this.effectiveViewportHeight() > 0 &&', '!this.expandedLayout && this.effectiveViewportWidth() < this.effectiveViewportHeight() &&');
        const mutant = createReaderBuilderProbe(portraitOnly, ['controlMinimumCurrent'], {}).owner;
        Object.assign(mutant, current, { width: 568, height: 320, expandedLayout: false });
        assert.equal(mutant.controlMinimumCurrent(current.controlMinimumIdentity()), false, 'old portrait-only admission fails landscape');
        return;
    }
    if (id === 'module-minimum-budget') {
        const check = (w, a, s, q, r, auto) => {
            assert.ok(a && s && q && r && auto);
            assert.ok(a.profile.quickFontCellHeight >= 27 && a.profile.fullFontCellHeight >= 30 && a.profile.selectTriggerHeight >= 30 && a.profile.stepperRowHeight > 0 && a.profile.themeActionHeight >= 28);
            const quick = appearance.sampleReaderControlAppearance(0, w.quickContentWidthVp, 0, 8, 8, a.profile);
            for (let i = 4; i < 8; i++)
                assert.ok(quick.themeSwatches[i].y >= quick.themeSwatches[i - 4].y + quick.themeSwatches[i - 4].height);
            for (const full of [false, true]) {
                const f = settings.sampleReaderControlSettings(full ? 1 : 0, full ? w.fullContentWidthVp : w.quickContentWidthVp, s);
                for (const [choices, bar] of [[f.directionChoices, f.bars[0]], [f.pageChoices, f.bars[1]], [f.timeoutChoices, f.bars[2]]])
                    for (const cell of choices) {
                        assert.ok(cell.width > 0 && cell.height >= (full ? 27 : 24));
                        assert.ok(cell.x + cell.width <= bar.width + .1 && cell.y + cell.height <= bar.height + .1);
                    }
                assert.ok(f.children[2].height >= 36);
                const form = full ? q.full : q.quick;
                const searchFrame = search.sampleReaderControlSearch(full ? 1 : 0, full ? w.fullContentWidthVp : w.quickContentWidthVp, 180, form.natural);
                assert.ok(searchFrame.action.width >= 32 && searchFrame.action.height >= (full ? 32 : 24));
                assert.ok(searchFrame.back.width >= 51 && searchFrame.back.height >= 24);
                assert.ok(searchFrame.field.x + searchFrame.field.width <= searchFrame.action.x + .1);
                assert.ok(searchFrame.field.width > 44);
                const replaceForm = full ? r.full : r.quick;
                assert.ok(replaceForm.actionHeight >= 28 && replaceForm.backHeight >= 24 && replaceForm.editorFlagHeight >= 44 && replaceForm.toolbarCellHeight >= 24);
            }
            assert.ok(auto.quick.back.height >= 24);
            for (const endpoint of [auto.quick, auto.full]) {
                for (const name of ['previous', 'toggle', 'stop', 'next']) {
                    assert.ok(endpoint[name].width >= 24 && endpoint[name].height >= 24, 'AutoPage authored transport remains usable');
                    assert.ok(endpoint[name].x + endpoint[name].width <= endpoint.control.width + .1);
                }
                assert.ok(endpoint.follow.height >= 36);
            }
            assert.ok(auto.full.speedContent.slider.width > 0 && auto.full.speedContent.slider.height > 0);
            assert.ok(auto.full.speedContent.slider.x + auto.full.speedContent.slider.width <= auto.full.speed.width + .1);
            assert.ok(auto.fullText.wheelRowHeight >= 44 && auto.fullText.wheelWidth >= 44);
            assert.ok(auto.fullText.timerPickerY + auto.fullText.wheelRowHeight * 3 + 4 + auto.fullText.wheelUnitHeight <= auto.full.timer.height - 33.39 + .1);
            const tts = tt.measureReaderTtsMinimum(context, w, ttsFacts);
            assert.ok(tts);
            for (const text of [tts.quickText, tts.fullText])
                for (const key of ['timerPreset', 'timerStepButton', 'ratePreset', 'manageButton'])
                    assert.ok(text[key] >= 44, key);
            assert.ok(tts.quickText.voiceField >= 30 && tts.fullText.voiceField >= 30);
            for (const endpoint of [tts.quick, tts.full]) {
                for (const name of ['previous', 'toggle', 'stop', 'next'])
                    assert.ok(endpoint[name].width >= 21 && endpoint[name].height >= 21, 'TTS authored transport is distinct from response allocation');
                assert.ok(endpoint.speedTrack.width >= 44, 'TTS speed track width');
                assert.ok(endpoint.speedTrack.x + endpoint.speedTrack.width <= endpoint.speed.width + .1);
            }
            assert.ok(tts.quick.quickTimerSelect.x + tts.quick.quickTimerSelect.width <= tts.quick.timer.width + .1);
            assert.ok(tts.full.speedPresets.width >= 44 * 5 + 32);
            assert.equal(tts.fullText.timerCustomWidth, Math.max(0, tts.full.timer.width - 28));
            assert.equal(tts.fullText.timerStepButtonWidth, 30);
        };
        for (scale of [1, 1.3, 1.6, 2])
            for (const width of [272, 314, 548, 694]) {
                const w = widths(width);
                check(w, ap.measureReaderControlAppearanceMinimum(context, w, appInput), mkSettings(w), se.measureReaderSearchMinimum(context, w, searchFacts), rp.measureReaderControlReplaceMinimum(context, w, '', '核对原规则操作', '长规则名', '正则 → 替换', '正文规则', '编辑替换规则', true), au.measureReaderControlAutoPageMinimum(context, w, '未开始', '未设置'));
            }
        const appearanceSource = ui('ReaderControlAppearanceMinimum.ets');
        const inflatedAppearance = appearanceSource.replace('quickFontCellHeight: Math.max(27,', 'quickFontCellHeight: Math.max(44,');
        assert.notEqual(inflatedAppearance, appearanceSource);
        const old = pure('ReaderControlAppearanceMinimum.ets', ['measureReaderControlAppearanceMinimum'], inflatedAppearance);
        scale = 1;
        assert.notEqual(old.measureReaderControlAppearanceMinimum(context, widths(314), appInput).profile.quickFontCellHeight,
            ap.measureReaderControlAppearanceMinimum(context, widths(314), appInput).profile.quickFontCellHeight,
            'uniform44 font paint changes the independently restored default recipe');
        assert.ok(65 < 44 * 2 + 5, 'old replacement trailing65 cannot pay two44 actions');
        const settingsSource = ui('ReaderControlSettingsMinimum.ets');
        const inflatedSettings = settingsSource.replace('let naturalHeight = full ? 27 : 24;', 'let naturalHeight = 44;');
        assert.notEqual(inflatedSettings, settingsSource);
        const oldSettings = pure('ReaderControlSettingsMinimum.ets', ['measureReaderControlSettingsMinimum'], inflatedSettings);
        const brokenSettings = oldSettings.measureReaderControlSettingsMinimum(context, widths(314), ['方向', '翻页', '超时'], optionLabels, ['隐藏底部导航栏']);
        assert.notDeepEqual(brokenSettings.quick.optionHeights, mkSettings(widths(314)).quick.optionHeights,
            'uniform44 option paint changes the independently restored24/27 recipe');
        return;
    }
    if (id === 'native-targets-sdk') {
        for (scale of [1, 1.3, 1.6, 2]) {
            const w = widths(314), profile = ap.measureReaderControlAppearanceMinimum(context, w, appInput).profile;
            let p = 0, changed = 0;
            const a = native('ReaderControlAppearanceContent.ets', ['themeSwatch', 'themeAction', 'stepButton', 'stepperRowHeight', 'stepperOffset'], {});
            Object.assign(a, { frame: () => appearance.sampleReaderControlAppearance(p, p ? w.fullContentWidthVp : w.quickContentWidthVp, 600, 8, 8, profile),
                minimumProfile: () => profile, themeColor: () => '#fff', snapshot: { activeTheme: 'paper' }, appThemeScheme: 'day',
                actorPosition: a => ({ x: a.x, y: a.y }), sharedClip: () => undefined, sharedInput: () => true, fullInput: () => true,
                themeLabel: () => '纸白', onThemeChange: () => changed++, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
                defaultThemeActionLabel: () => '设为日间主题', motionProgress: 1,
            });
            a.themeSwatch('paper', 0);
            const swatch = nodes(a, 'Button')[0];
            paidResponse(swatch, { width: w.quickContentWidthVp, height: a.frame().contentHeight }, 'quick theme slot');
            swatch.onClick();
            assert.equal(changed, 1);
            const ids = [...a.nodes.keys()];
            p = 1;
            a.replay();
            assert.deepEqual([...a.nodes.keys()], ids);
            paidResponse(swatch, { width: w.fullContentWidthVp, height: a.frame().contentHeight }, 'same full theme slot');
            a.themeAction(true);
            paidResponse(nodes(a, 'Button').at(-1), { width: w.fullContentWidthVp, height: a.frame().contentHeight }, 'theme action');
            const gesture = new Proxy({}, { get: () => () => { } });
            const fontFormat = await import('../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts');
            const font = native('ReaderControlAppearanceContent.ets', ['fontCell'], { ...fontFormat, BorderStyle: { Dashed: 'dashed', Solid: 'solid' },
                LongPressGesture: gesture, globalThis: { Gesture: gesture, LongPressGesture: gesture }, GesturePriority: { Low: 'low' } });
            const fontFrame = appearance.sampleReaderControlAppearance(1, w.fullContentWidthVp, 600, 8, 8, profile);
            Object.assign(font, { fontActor: () => appearance.readerControlAppearanceFontActor(fontFrame, 0, 0), activeFont: () => true,
                frame: () => fontFrame, minimumProfile: () => profile, fontPreviewReady: () => true, visiblePreviewFamily: () => 'HarmonyOS Sans', snapshot: {},
                sharedClip: () => undefined, fontCellPosition: () => ({ x: 11, y: fontFrame.fullFontHeader.y + profile.fullFontHeaderHeight + 14 }),
                draggedFontId: '', fontInput: () => true, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), appThemeScheme: 'day', importLayout: 'ordered-slot-approved' });
            // The label formatter is outside this geometry repair. Its actual saved
            // identity remains the production slot passed across the Builder boundary.
            font.fontCell('system');
            const fontCarrier = nodes(font, 'Stack')[0];
            assert.ok(fontCarrier.width > 0 && fontCarrier.height === font.fontActor().height,
                'font carrier consumes its own authored27/30 lane and measured growth');
            const selectSource = read('entry/src/main/ets/ui/controls/ReaderSelect.ets');
            const selectValues = selectedProductionValues(new URL('../entry/src/main/ets/ui/controls/ReaderSelect.ets', import.meta.url), ['APPEARANCE_TRIGGER_H', 'APPEARANCE_VALUE_VERTICAL_SPACE', 'APPEARANCE_HIT_OUTSET'], deps);
            const select = createReaderBuilderProbe(selectSource, ['phoneTrigger', 'resolvedWidth', 'triggerHeight', 'appearanceLibraryTriggerHeight', 'measuredValueHeight', 'triggerEnabled', 'appearanceLibraryTrigger'], {
                ...deps, ...selectValues, uiContext: context,
            }).owner;
            Object.assign(select, { variant: 'appearanceLibrary', value: '2字符', readerWindowMetricsRevision: 1, appThemeScheme: 'day',
                actionEnabled: true, mounted: true, focusId: 'indent', options: ['无', '1字符', '2字符'], isOpen: false, trigger: () => select.appearanceLibraryTrigger(),
                dropdownAnimation: () => undefined, onToggle: () => changed++ });
            select.phoneTrigger();
            const selectButton = nodes(select, 'Button')[0];
            assert.ok(selectButton.height >= 30);
            assert.equal(Math.abs(selectButton.responseRegion.y), selectValues.APPEARANCE_HIT_OUTSET);
            assert.equal(selectButton.responseRegion.height, selectButton.height + selectValues.APPEARANCE_HIT_OUTSET * 2);
            assert.ok(profile.selectRowHeight >= selectButton.responseRegion.height, 'appearance row pays the actual shared trigger response');
            selectButton.onClick();
            changed--;
            const step = native('ReaderControlAppearanceContent.ets', ['stepButton', 'stepperRowHeight', 'stepperOffset'], {
                readerAppearanceCanStep: () => true,
            });
            Object.assign(step, { minimumProfile: () => profile, snapshot: {}, metricLabel: () => '字号', fullInput: () => true, onMetricStep: () => { }, appThemeScheme: 'day' });
            step.stepButton('fontSize', 1, 0);
            paidResponse(nodes(step, 'Button')[0], { width: profile.stepButtonWidth,
                height: step.stepperRowHeight() }, 'appearance stepper');
            const back = native('ReaderControlQuickBack.ets', ['build', 'icon', 'labelStyle']);
            Object.assign(back, { variant: 'search', scheme: 'day', actionWidth: 51, actionHeight: 44, actionVisible: true, actionEnabled: true, onAction: () => changed++ });
            back.initialRender();
            target(nodes(back, 'Button')[0], 'shared QuickBack');
            nodes(back, 'Button')[0].onClick();
            assert.equal(changed, 2);
            const r = native('ReaderControlReplaceContent.ets', ['ruleIcon']);
            Object.assign(r, { state: { sessionKey: 'one' }, layer: '', appThemeScheme: 'day', fullInput: () => true, readyInput: () => true });
            r.ruleIcon('edit', () => '编辑规则', () => changed++, () => true, () => 'rule1');
            target(nodes(r, 'Button')[0], 'replace edit');
            nodes(r, 'Button')[0].onClick();
            assert.equal(changed, 3);
            const replaceProfile = rp.measureReaderControlReplaceMinimum(context, w, '', '核对原操作', '规则名', '原文 → 替换', '正文', '编辑规则', false);
            const replaceFrame = replace.sampleReaderControlReplace(1, w.fullContentWidthVp, 500, replaceProfile);
            const mountRule = source => {
                const owner = createReaderBuilderProbe(source, ['ruleRow', 'ruleIcon'], deps).owner;
                Object.assign(owner, { state: { sessionKey: 'one' }, layer: '', appThemeScheme: 'day', frame: () => replaceFrame,
                    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), readyInput: () => true, fullInput: () => true, quickInput: () => false,
                    scopeSummary: () => '正文', rowClip: () => undefined, openEditor: () => { }, askDelete: () => { } });
                const rule = { id: 1, name: '规则名', isEnabled: true, pattern: '原文', replacement: '替换' };
                owner.ruleRow(() => rule, () => 0);
                return owner;
            };
            const row = mountRule(ui('ReaderControlReplaceContent.ets'));
            const trailing = nodes(row, 'Row').find(n => n.width === 93 && n.height === 44);
            assert.ok(trailing && trailing.width >= 44 * 2 + 5);
            assert.ok(replaceFrame.rowHeight >= trailing.height);
            for (const button of nodes(row, 'Button'))
                target(button, 'replacement actual rule action');
            const oldTrailing = mountRule(ui('ReaderControlReplaceContent.ets').replace('}.width(93).height(44).position(', '}.width(65).height(44).position('));
            assert.equal(nodes(oldTrailing, 'Row').some(n => n.width >= 93 && n.height === 44), false, 'old65 trailing loses paid action lane');
            const t = native('ReaderControlTtsContent.ets', ['toggleRow', 'toggleValue', 'toggleLabel', 'changeToggle']);
            Object.assign(t, { appScheme: 'day', fullInput: () => true, textMinimum: () => ({ toggleRow: 48 * scale }), followHighlight: false, onFollowHighlightChange: () => changed++ });
            t.toggleRow('followHighlight');
            target(nodes(t, 'Button')[0], 'TTS toggle');
            nodes(t, 'Button')[0].onClick();
            assert.equal(changed, 4);
            const settingsMinimum = mkSettings(w);
            const Modifier = pure('ReaderControlSettingsOptionModifier.ets', ['ReaderControlSettingsOptionModifier'], ui('ReaderControlSettingsOptionModifier.ets')).ReaderControlSettingsOptionModifier;
            const attributes = {};
            const carrier = new Proxy({}, { get: (_, key) => (...args) => { attributes[key] = args.length === 1 ? args[0] : args; return carrier; } });
            const frame = settings.sampleReaderControlSettings(0, w.quickContentWidthVp, settingsMinimum);
            new Modifier(() => changed++).update(frame.pageChoices[0], { contentOpacity: 1, contentBlur: 0 }, true, true, '翻页', 'day').applyNormalAttribute(carrier);
            assert.equal(attributes.width, frame.pageChoices[0].width);
            assert.equal(attributes.height, frame.pageChoices[0].height);
            paidResponse({ ...attributes, position: { x: 0, y: 0 } }, frame.pageChoices[0], 'settings actual modifier default slot');
            attributes.onClick();
            assert.equal(changed, 5);
            const settingsOwner = native('ReaderControlSettingsContent.ets', ['segmentRow', 'segmentResponse', 'choice']);
            const optionModifiers = new Map();
            Object.assign(settingsOwner, { appThemeScheme: 'day', groupLabel: () => '翻页方式', p: () => 0, label: () => frame.labels[1], bar: () => frame.bars[1],
                presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), sharedClip: () => undefined, geometry: () => frame, groupOptions: () => ['cover', 'slide', 'simulation', 'scroll', 'none'],
                optionLabel: (_group, option) => option, isSegmentActive: () => true,
                optionModifier: (_group, _row, index) => {
                    if (!optionModifiers.has(index))
                        optionModifiers.set(index, new Modifier(() => { }));
                    return optionModifiers.get(index).update(frame.pageChoices[index], { contentOpacity: 1, contentBlur: 0 }, true, index !== 2, '翻页选项', 'day',
                        settingsOwner.segmentResponse('pageTurn', 1, index));
                } });
            settingsOwner.segmentRow('pageTurn', 1);
            for (const button of nodes(settingsOwner, 'Button')) {
                assert.equal(button.height, frame.pageChoices[0].height);
                paidResponse(button, frame.bars[1], 'settings native option');
            }
            assert.equal(nodes(settingsOwner, 'Button')[2].enabled, false, 'unavailable capability remains disabled');
            const ttsProfile = tt.measureReaderTtsMinimum(context, w, ttsFacts);
            const accessibility = selectedProductionClasses(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets', import.meta.url), ['ReaderActionAccessibility'], { AccessibilityRoleType: { BUTTON: 'button' } });
            const presetModifier = selectedProductionClasses(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTtsContent.ets', import.meta.url), ['ReaderTtsPresetModifier'], { ...accessibility, readerAppColor, Color: { Transparent: 'transparent' } });
            const presets = native('ReaderControlTtsContent.ets', ['timer', 'timerCardLayout', 'timerPreset', 'timerStepper', 'timerStepButton', 'timerCustomDuration', 'timerCustomLabel', 'timerCustomGroup', 'ratePreset', 'ratePresetWidth'], {
                ...accessibility, ...presetModifier, ...tt, readerTtsPresetLabelColor: () => '#222', ...await import('../entry/src/main/ets/features/reading/application/ReaderTtsState.ts'),
            });
            Object.assign(presets, { appScheme: 'day', frame: () => ttsProfile.full, textMinimum: () => ttsProfile.fullText, sectionSurface: () => { }, moduleHeader: () => { }, quickLabel: () => { },
                timerCaption: () => '不开启', p:()=>1, sharedInput: () => true, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), fullInput: () => true, configField: '',
                timerPresetLabel: minutes => String(minutes), timerPresetIsSelected: () => false, chooseTimerPreset: () => { }, timerMinutes: 5, timerSeconds: 5, twoDigits: n => String(n).padStart(2, '0'),
                sharedScrollTranslation: () => 0, sharedClip: () => undefined, cycleQuickTimer: () => { }, stepTimer: () => { }, effectiveRate: () => 1, chooseRatePreset: () => { },
            });
            presets.timer();
            presets.ratePreset(.5);
            for (const button of nodes(presets, 'Button').filter(node => node.opacity !== 0)) {
                assert.ok(button.height >= 44, button.accessibilityText);
                if (typeof button.width === 'number') {
                    if (/五分钟|五秒/.test(button.accessibilityText ?? ''))
                        assert.equal(button.width, 30, 'custom timer uses authored horizontal paint slots');
                    else assert.ok(button.width >= 44);
                }
            }
            assert.equal(nodes(presets, 'Scroll').length, 1,
                'only enlarged preset choices retain their bounded horizontal lane');
            const hiddenQuick=nodes(presets,'Button').find(node=>node.opacity===0);assert.equal(hiddenQuick.enabled,false);assert.equal(hiddenQuick.accessibilityLevel,'no-hide-descendants');
        }
        const wheelNames = ['build', 'targetWidth', 'targetHeight', 'offsets', 'valid', 'label', 'step'];
        let stepped = 0;
        const wheel = native('ReaderControlTimerWheel.ets', wheelNames);
        Object.assign(wheel, { value: 5, minimum: 0, maximum: 59, neighbours: 1, wheelWidth: 44, rowHeight: 44, unitHeight: 16, unit: '秒', interactionEnabled: true, appThemeScheme: 'day', onStep: delta => stepped += delta });
        wheel.initialRender();
        for (const button of nodes(wheel, 'Button')) target(button, 'timer discrete choice');
        assert.ok(nodes(wheel, 'Stack').some(node => node.height === 132 && node.width === 44));
        nodes(wheel, 'Button')[2].onClick(); assert.equal(stepped, 1);
        wheel.interactionEnabled = false; nodes(wheel, 'Button')[2].onClick(); assert.equal(stepped, 1);
        const oldWheel = createReaderBuilderProbe(ui('ReaderControlTimerWheel.ets').replace('Math.max(44, this.rowHeight)', 'this.rowHeight'), wheelNames, deps).owner;
        Object.assign(oldWheel, { value: 5, minimum: 0, maximum: 59, neighbours: 1, wheelWidth: 44, rowHeight: 34, unitHeight: 8, unit: '秒', interactionEnabled: true, appThemeScheme: 'day' });
        oldWheel.initialRender(); assert.throws(() => target(nodes(oldWheel, 'Button')[0], 'old discrete wheel34'), />=44/);
        const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
        const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
        const wheelProperties = createArkUIPropertyRuntimeProbe();
        const wheelComponent = createReaderBuilderProbe(ui('ReaderControlTimerWheel.ets'), boundedMembers(ui('ReaderControlTimerWheel.ets')), { ...deps, ...wheelProperties.sdk }, wheelProperties.hooks).Component;
        const autoProfile = au.measureReaderControlAutoPageMinimum(context, widths(272), '未开始', '未设置');
        const autoWheel = native('ReaderControlAutoPageContent.ets', ['timerWheel', 'timerWheelWidth', 'currentTimerValue'], { ...await import('../entry/src/main/ets/features/reading/ui/ReaderAutoPageFullState.ts'), ReaderControlTimerWheel: wheelComponent }, { ...wheelProperties.hooks, mountChildren: true, lifecycleChildren: true, childSources: { ReaderControlTimerWheel: ui('ReaderControlTimerWheel.ets') } });
        Object.assign(autoWheel, { appScheme: 'day', timerMinutes: 5, timerSeconds: 5, minimumProfile: () => autoProfile, textMetric: name => autoProfile.fullText[name], fullInput: () => true, commitTimerStep: () => {} });
        autoWheel.timerWheel(true);
        assert.ok(deepNodes(autoWheel).filter(node => node.type === 'Button').length === 3);
        for (const button of deepNodes(autoWheel).filter(node => node.type === 'Button')) target(button, 'AutoPage actual imported wheel');
        const morph = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
        for (const file of ['ReaderControlSettingsContent.ets', 'ReaderControlTtsContent.ets', 'ReaderControlAutoPageContent.ets']) {
            let offset = 60;
            const scrolled = native(file, ['p', 'fullInput', 'syncMorphScroll', 'onFullDidScroll', 'nativeScrollDelta', 'sharedScrollTranslation', 'quickMinimumScrollInput', 'quickMinimumScrollPresentation'],
                { ...morph, readerControlExtentFits: geo.readerControlExtentFits });
            Object.assign(scrolled, { sourceOnly: 'none', motionProgress: 0, interactionEnabled: true, availableHeight: 80,
                scrollMotion: morph.createReaderControlMorphScroll(), minimumQuickScrollOffset: 0, minimumScrollPath: undefined,
                scroller: { currentOffset: () => ({ yOffset: offset }), scrollTo: request => { offset = request.yOffset; } },
                frame: () => ({ contentHeight: 500 }), geometry: () => ({ contentHeight: 500 }), selectedMinimum: () => ({ minimum: { quick: { heightVp: 500 } } }), minimumProfile: () => ({ minimum: { quick: { heightVp: 500 } } }), reportMorphActor: () => {} });
            scrolled.syncMorphScroll(); assert.equal(scrolled.minimumQuickScrollOffset, 60);
            assert.equal(scrolled.nativeScrollDelta(12, 'gesture').yOffset, 12);
            assert.equal(scrolled.sharedScrollTranslation(), 0);
            scrolled.minimumScrollPath = morph.readerControlMorphScrollPath(0, 60); scrolled.motionProgress = .5; scrolled.interactionEnabled = false;
            scrolled.syncMorphScroll(); assert.equal(offset, morph.sampleReaderControlMorphScrollPath(scrolled.minimumScrollPath, .5));
            scrolled.motionProgress = 1; scrolled.interactionEnabled = true; scrolled.syncMorphScroll();
            assert.equal(offset, 0); assert.equal(scrolled.minimumScrollPath, undefined);
        }
        scale = 2;
        const ttsNarrow = tt.measureReaderTtsMinimum(context, widths(272), { ...ttsFacts, online: true });
        assert.ok(ttsNarrow.fullText.configRow > 52 && ttsNarrow.fullText.serviceTabTitle > 34, 'actual residual CJK column widths grow row/card and tab title');
        const config = native('ReaderControlTtsContent.ets', ['onlineServiceInfoRow', 'manageConfigured', 'ttsClosedConfigRow', 'voiceSelectorRow', 'ttsSelectValueField', 'fieldWidth', 'fieldHeight', 'ttsServiceTypeTabs', 'ttsServiceTypeTab']);
        Object.assign(config, { appScheme: 'day', httpEngines: [{}], textMinimum: () => ttsNarrow.fullText, fullInput: () => true, serviceBusy: false, configFocusId: 'current',
            fieldLabel: () => '不可用处理', fieldValue: () => '停止并提示', currentVoiceLabel: () => '中文女声', isTtsServiceTabSelected: () => true, onlineServiceDescription: () => '设备内置语音', onlineTtsAccessibilityText: () => '在线TTS', openConfiguration: () => {}, selectTtsServiceType: () => {} });
        config.onlineServiceInfoRow(); config.ttsClosedConfigRow('failure'); config.voiceSelectorRow(); config.ttsServiceTypeTabs();
        const manageAction = nodes(config, 'Button').find(node => node.accessibilityText === '已配置在线 TTS，编辑服务信息');
        assert.equal(manageAction.width, ttsNarrow.fullText.manageButtonWidth); assert.ok(manageAction.height >= 44);
        assert.ok(nodes(config, 'Row').some(node => node.height === ttsNarrow.fullText.configRow && node.padding?.left === 14));
        assert.equal(nodes(config, 'Text').find(node => node.create?.[0] === '服务信息')?.maxLines, undefined);
        assert.ok(nodes(config, 'Row').some(node => node.height === ttsNarrow.fullText.serviceTab));
        const manager = native('ReaderTtsConfigOverlay.ets', ['managerForm']);
        Object.assign(manager, { appThemeScheme: 'day', draftName: '', draftUrl: '', draftApiKey: '', draftVoice: '', draftClearApiKey: false, busy: false, errorText: '', formatActionHeight: () => 44, formatChoice: () => {} });
        manager.managerForm();
        const fields = deepNodes(manager).filter(node => node.type === 'TextInput');
        assert.equal(fields.length, 4); for (const field of fields) assert.equal(field.height, 44, 'actual manager field consumes shared44');
        const editor = native('ReaderControlReplaceContent.ets', ['editorText']);
        Object.assign(editor, { appThemeScheme: 'day', editorTextEnabled: () => true });
        editor.editorText('名称', () => '旧规则', () => {}, 1);
        assert.equal(deepNodes(editor).find(node => node.type === 'TextInput').height, 44, 'actual replace field consumes shared44');
        const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
        const bounded = boundedSurfaceSdk();
        let opening = 1, saved = 0;
        const actions = bounded.consumer(ui('ReaderControlReplaceContent.ets'), ['temporaryActions', 'editorActions'], deps);
        Object.assign(actions, { appThemeScheme: 'day', layer: 'editor', state: { mutationPending: false }, localPending: false, readyInput: () => true,
            temporaryInputCurrent: token => token === opening, cancelTemporaryLayer: () => {}, saveEditor: () => saved++ });
        actions.temporaryActions(1);
        const actionNodes = bounded.nodes(actions), actionButtons = actionNodes.filter(node => node.type === 'Button');
        assert.equal(actionButtons.length, 2);
        for (const action of actionButtons) assert.ok(action.height >= 44, 'actual shared replace footer44');
        assert.ok(actionNodes.some(node => node.type === 'Row' && node.height >= actionButtons[0].height));
        actionButtons[1].onClick(); assert.equal(saved, 1);
        opening++; actionButtons[1].onClick(); assert.equal(saved, 1, 'old editor opening cannot save');
        const flow = native('ReaderControlReplaceContent.ets', ['temporaryNeedsFlow', 'temporaryFlow'], { ...bounded.deps, readerWindowMetrics: () => ({ systemFontScale: 2 }) });
        Object.assign(flow, { layer: 'editor', availableHeight: 142, frame: () => ({ editorHeaderHeight: 52 }), temporaryHeader: () => {}, temporaryBodyContent: () => {}, temporaryActions: () => {} });
        assert.equal(flow.temporaryNeedsFlow(), true); flow.temporaryFlow(1);
        assert.equal(nodes(flow, 'Scroll').length, 1, 'short replace header/body/actions share one bounded Scroll');
        assert.equal(nodes(flow, 'Scroll')[0].layoutWeight, 1);
        const small = createReaderBuilderProbe(ui('ReaderControlQuickBack.ets').replace('@Prop actionHeight: number = 44;', '@Prop actionHeight: number = 24;'), ['build', 'icon', 'labelStyle'], { ...deps }).owner;
        Object.assign(small, { variant: 'search', scheme: 'day', actionWidth: 51, actionHeight: 24, actionVisible: true, actionEnabled: true, onAction() { } });
        small.initialRender();
        assert.throws(() => target(nodes(small, 'Button')[0], 'old QuickBack'), />=44/);
        return;
    }
    if (id === 'manga-tts-sdk') {
        const overlaySource = ui('ReaderTtsConfigOverlay.ets');
        assertTypographyBindings(overlaySource, 'ReaderTtsConfigOverlay.ets');
        const duplicateImport = "import { TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE } from '../../../ui/foundation/ReaderTypography';\n" + overlaySource;
        assert.throws(() => assertTypographyBindings(duplicateImport, 'ReaderTtsConfigOverlay.ets'), /imports TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE exactly once/);
        const { ts, options, root: sdkRoot } = compiler;
        const scrollArguments = source => {
            const tree = ts.createSourceFile('ReaderControlTtsContent.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
            const values = [];
            const visit = node => {
                if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'scrollable')
                    values.push(node.arguments.map(argument => argument.getText(tree)).join(', '));
                ts.forEachChild(node, visit);
            };
            visit(tree);
            return values;
        };
        const scrollDiagnostics = source => {
            const file = '/ReaderTtsScrollSdkCheck.ts';
            const text = 'declare const ttsScroll: ScrollAttribute;\n' + scrollArguments(source).map(value => `ttsScroll.scrollable(${value});`).join('\n');
            const checkOptions = { noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022 };
            const host = ts.createCompilerHost(checkOptions), getSourceFile = host.getSourceFile.bind(host);
            host.getSourceFile = (name, ...args) => name === file ? ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true) : getSourceFile(name, ...args);
            const declarations = ['common', 'enums', 'scroll'].map(name => `${sdkRoot}/declarations/${name}.d.ts`);
            return ts.getPreEmitDiagnostics(ts.createProgram([file, ...declarations], checkOptions, host))
                .filter(value => value.file?.fileName === file).map(value => ({ code: value.code, message: ts.flattenDiagnosticMessageText(value.messageText, '\n') }));
        };
        const ttsSource = ui('ReaderControlTtsContent.ets');
        assert.deepEqual(scrollArguments(ttsSource), Array(3).fill('ScrollDirection.Horizontal'), 'all three TTS viewports retain horizontal scrolling');
        assert.deepEqual(scrollDiagnostics(ttsSource), [], 'actual production Scroll arguments type-check against installed SDK declarations');
        const oldAxis = ttsSource.replaceAll('.scrollable(ScrollDirection.Horizontal)', '.scrollable(Axis.Horizontal)');
        assert.notEqual(oldAxis, ttsSource);
        const axisErrors = scrollDiagnostics(oldAxis);
        assert.equal(axisErrors.length, 3, 'all three former Axis arguments enter the SDK semantic checker');
        assert.ok(axisErrors.every(error => error.code === 2345 && /Axis.*ScrollDirection/.test(error.message)), 'SDK rejects the former Axis enum at every production site');
        const { mangaSurfaceSdkDependencies } = await import('./lib/manga-surface-sdk-probe.mjs');
        const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
        const surfaces = readerSurfaceSpecsForProbe();
        const source = read('entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets');
        const base = ['bottomControls', 'footerAction', 'controlFontScale', 'dockPageRowHeight', 'dockActionHeight', 'dockHeight', 'bottomControlViewportHeight', 'recoveryNoticeHeight', 'mangaTopBarHeight'];
        const metrics = createDefaultReaderWindowMetrics();
        const m = createReaderBuilderProbe(source, base, { ...mangaSurfaceSdkDependencies, ...deps, uiContext: context, ReaderWindowCoordinator: { metrics: () => metrics } }).owner;
        Object.assign(m, { viewportWidth: 320, viewportHeight: 320, recovering: false, offlineProbeStatus: '', loginRequiredForControls: false, windowMetricsRevision: 1, interactiveInsets: () => ({ left: 0, right: 0, top: 24, bottom: 24 }), backgroundPreference: 'paper',
            opened: true, horizontalPageCount: 10, pageOrdinal: () => 2, mutedColor: () => '#888', greenColor: () => '#080', lineColor: () => '#ddd', inkColor: () => '#222', chromeScheme: () => 'day',
            readerPanelForeground: () => true, panelTriggerFocusId: x => x, stepPage: () => { }, seekPage: () => { }, openPanel: () => { },
        });
        m.bottomControls();
        const previous = nodes(m, 'Button').find(n => n.accessibilityText === '上一页'), next = nodes(m, 'Button').find(n => n.accessibilityText === '下一页');
        for (scale of [1, 1.3, 1.6, 2]) {
            metrics.systemFontScale = scale;
            m.windowMetricsRevision++;
            m.replay();
            target(previous, 'manga previous');
            target(next, 'manga next');
            const dock = nodes(m, 'Row').find(n => n.height === m.dockActionHeight() + 1 && n.border);
            assert.ok(dock);
            for (const button of nodes(m, 'Button').filter(n => ['目录', '阅读方式', '设置'].includes(n.accessibilityText)))
                assert.ok(button.height + 1 <= dock.height);
            assert.ok(m.dockPageRowHeight() >= 44 + 3 + 15 * scale);
            assert.ok(m.bottomControlViewportHeight() + m.mangaTopBarHeight() + 10 <= m.viewportHeight - 48);
            const ordinaryViewport = m.bottomControlViewportHeight();
            m.recovering = true;
            assert.equal(m.bottomControlViewportHeight(), ordinaryViewport, 'the independent recovery overlay preserves the dock viewport');
            m.recovering = false;
        }
        const legacyManga = createReaderBuilderProbe(source.replace("Button('‹').height(44).width(44)", "Button('‹').height(28).width(28)").replace('.height(this.dockActionHeight() + 1).border', '.height(55).border'), base, { ...mangaSurfaceSdkDependencies, ...deps, uiContext: context, ReaderWindowCoordinator: { metrics: () => metrics } }).owner;
        for (const key of ['viewportWidth', 'viewportHeight', 'recovering', 'offlineProbeStatus', 'loginRequiredForControls', 'windowMetricsRevision', 'interactiveInsets', 'backgroundPreference', 'opened', 'horizontalPageCount', 'pageOrdinal', 'mutedColor', 'greenColor', 'lineColor', 'inkColor', 'chromeScheme', 'readerPanelForeground', 'panelTriggerFocusId', 'stepPage', 'seekPage', 'openPanel'])
            legacyManga[key] = m[key];
        legacyManga.bottomControls();
        assert.throws(() => target(nodes(legacyManga, 'Button').find(node => node.accessibilityText === '上一页'), 'old manga28'), />=44/);
        const legacyDock = nodes(legacyManga, 'Row').find(node => node.height === 55 && node.border);
        assert.ok(legacyDock && nodes(legacyManga, 'Button').some(node => node.height > legacyDock.height), 'old55 dock parent underpays current footer');
        const choice = createReaderBuilderProbe(source, ['sheetChoice', 'sheetActionHeight', 'controlFontScale'], { ...mangaSurfaceSdkDependencies, ...deps, uiContext: context, ReaderWindowCoordinator: { metrics: () => metrics } }).owner;
        Object.assign(choice, { windowMetricsRevision: 1, isSheetChoiceSelected: () => false, choiceIcon: () => 'icon', mutedColor: () => '#888', greenColor: () => '#080', softSurfaceColor: () => '#fff', lineColor: () => '#ddd' });
        choice.sheetChoice('vertical', '竖向连续', () => { });
        const modeChoice = nodes(choice, 'Button')[0];
        assert.equal(modeChoice.height, undefined, 'native choice grows with actual wrapped text');
        assert.equal(modeChoice.constraintSize.minHeight, 44);
        assert.ok(nodes(choice, 'Text').some(node => node.layoutWeight === 1), 'label gets finite remaining Row width and wraps');
        assert.ok(4 * 12 * 2 > 74 && 18 * 2 * 2 + 16 > 52, 'wide CJK two-line old52 negative');
        let closing = 0, mangaOpening = 1;
        const close = createReaderBuilderProbe(source, ['directorySheet', 'directorySideHeader', 'directoryHeaderChrome'], { ...mangaSurfaceSdkDependencies, ...deps }).owner;
        Object.assign(close, { panel: 'directory', panelPhase: 'open', actionPanelPresentationGeneration: 1, backgroundPreference: 'paper',
            panelInputCurrent: token => token === mangaOpening, directorySheetInputCurrent: () => true, chromeScheme: () => 'day', panelTitle: () => '长篇漫画目录', inkColor: () => '#222', lineColor: () => '#ddd',
            panelContentInset: () => 20, directoryFontScale: () => 2, quickHeaderMeasured: 0, measureDirectorySheetHeader: () => {},
            widePanel: () => false, directoryBottomHeader: () => {}, directoryPanel: () => {}, directoryOuterScroller: {}, directoryOuterIdentity: () => 'd', panelContentHeight: () => 260,
            panelWidth: () => 280, panelInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }), panelOffset: 0, panelCloseFocusId: () => 'directory:close', closePanel: () => closing++ });
        close.directorySheet('d', 1);
        target(nodes(close, 'Button')[0], 'Manga quick close44');
        assert.ok(close.directoryHeaderChrome() >= 24 + 44 + 8);
        nodes(close, 'Button')[0].onClick(); assert.equal(closing, 1);
        mangaOpening++; nodes(close, 'Button')[0].onClick(); assert.equal(closing, 1);
        mangaOpening = 1; close.widePanel = () => true; close.directorySideHeader(1);
        const wideClose = nodes(close, 'Button').at(-1); target(wideClose, 'Manga wide close44');
        assert.ok(nodes(close, 'Row').some(node => node.constraintSize?.minHeight >= 69));
        mangaOpening++; wideClose.onClick(); assert.equal(closing, 1, 'old wide close opening rejected');
        const chapter = createReaderBuilderProbe(source, ['chapterEndContent'], { ...mangaSurfaceSdkDependencies, ...deps }).owner;
        Object.assign(chapter, { backgroundPreference: 'paper', viewportHeight: 160, windowMetricsRevision: 1, interactiveInsets: () => ({ left: 40, right: 40, top: 24, bottom: 24 }),
            chapterEndTypeLabel: () => '本话', chapterEndLabel: () => '超长章节标题'.repeat(8), inkColor: () => '#222', mutedColor: () => '#888', paperColor: () => '#fff', chromeScheme: () => 'day',
            adjacentChapter: () => ({}), adjacentLabel: () => '下一话 长标题', adjacentActionLabel: () => '继续阅读下一话', selectAdjacentChapter: () => {}, openPanel: () => {}, pageOrdinal: () => 9, horizontalPageCount: 10 });
        chapter.chapterEndContent();
        assert.equal(nodes(chapter, 'Scroll').length, 1);
        assert.equal(nodes(chapter, 'Scroll')[0].height, '100%');
        for (const button of nodes(chapter, 'Button')) { assert.equal(button.constraintSize.minHeight, 44); assert.equal(button.height, undefined); }
        assert.ok(7 * 13 * 2 > 102 && 2 * 13 * 2 * 1.5 + 16 > 44, 'old fixed44 next action loses wide CJK wrapped label');
        const o = native('ReaderTtsConfigOverlay.ets', ['headerAreaChangeHandler', 'headerLayoutKey', 'headerHeight', 'formatChoice', 'formatActionHeight', 'previewActionWidth', 'previewPaintHeight', 'previewActionHeight', 'choiceHeight', 'panelWidth', 'managerSurfaceSpec', 'compactManager', 'footerHeight', 'managerOuterPadding', 'panelHeight', 'choiceRow', 'close', 'onIdentityChanged', 'stopPreview', 'preview'], {
            uiContext: context, resolvePopupSpec: surfaces.resolvePopupSpec, ReaderWindowCoordinator: { metrics: () => metrics },
        });
        Object.assign(o, { modalUsableWidth: 0, measuredHeaderHeight: 0, measuredHeaderKey: '', manager: false, voicePicker: true, availableWidth: 320, availableHeight: 180, appThemeScheme: 'day', choices: [], selectedId: 'v1', draftFormat: 'mp3', busy: false,
            metricsRevision: 1, getUIContext: () => context, previewId: '', previewGeneration: 0, selectionId: 'one', mounted: true, errorText: '', onPreviewStop: () => { }, onBusyChange: () => { }, generation: 0 });
        const choiceFact = { id: 'v1', label: '很长的在线中文女声音色 · 服务提供者' };
        o.choiceRow(choiceFact);
        target(nodes(o, 'Button')[0], 'TTS voice preview');
        assert.ok(nodes(o, 'Row').find(n => n.height === o.choiceHeight(choiceFact)));
        o.formatChoice('MP3', 'mp3');
        const format = nodes(o, 'Button').at(-1);
        assert.ok(format.height >= 44);
        const before = [...o.nodes.keys()];
        scale = 1;
        o.replay();
        assert.deepEqual([...o.nodes.keys()], before);
        assert.ok(format.height >= 44);
        o.manager = true;
        o.modalUsableHeight = 166;
        assert.equal(o.compactManager(), true);
        assert.ok(o.panelHeight() <= 166);
        o.modalUsableHeight = 100;
        assert.ok(o.panelHeight() <= 100);
        assert.equal(o.compactManager(), true);
        o.voicePicker = false;
        o.modalUsableWidth = 320;
        assert.ok(o.panelWidth() <= 294, 'manager consumes measured viewport minus26 outer padding');
        const staleHeader = o.headerAreaChangeHandler(o.headerLayoutKey());
        o.metricsRevision++;
        staleHeader({}, { height: 140 });
        assert.equal(o.measuredHeaderHeight, 0);
        o.headerAreaChangeHandler(o.headerLayoutKey())({}, { height: 64 });
        assert.equal(o.headerHeight(), 64);
        metrics.systemFontScale = 2; scale = 2; o.manager = true; o.voicePicker = false; o.modalUsableHeight = 240;
        o.measuredHeaderKey = o.headerLayoutKey(); o.measuredHeaderHeight = 78;
        assert.equal(o.footerHeight(), 96);
        assert.equal(o.panelHeight(), 208);
        assert.equal(o.compactManager(), true, 'actual96 footer and78 header leave34, so entire manager flows');
        assert.ok(o.panelHeight() - o.headerHeight() - 76 >= 44 && o.panelHeight() - o.headerHeight() - o.footerHeight() < 44, 'old raw76 negative');
        const shortPicker = native('ReaderTtsConfigOverlay.ets', ['compactContent', 'compactManager', 'boundedContent'], { ReaderWindowCoordinator: { metrics: () => metrics } });
        Object.assign(shortPicker, { manager: false, voicePicker: false, panelHeight: () => 126, headerHeight: () => 88, configurationHeader: () => {}, configurationBody: () => {}, managerFooter: () => {} });
        shortPicker.boundedContent();
        assert.equal(nodes(shortPicker, 'Scroll')[0].height, 126, 'short picker Header and choices share full126 flow viewport');

        const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
        const bounded = boundedSurfaceSdk();
        const footerControls = boundedSurfaceSdk({ windowMetrics: () => metrics });
        const footerConsumer = footerControls.consumer(ui('ReaderTtsConfigOverlay.ets'), ['managerFooter'], deps);
        Object.assign(footerConsumer, { canSubmit: () => true, busy: false, close: () => {}, submit: () => {} });
        footerConsumer.managerFooter();
        const actualFooter = footerControls.nodes(footerConsumer).find(node => node.type === 'Row' && node.height === o.footerHeight());
        assert.ok(actualFooter && actualFooter.height - 32 >= 44, 'shared footer actual96 pays row padding32 and Native64');

        const headerConsumer = bounded.consumer(ui('ReaderTtsConfigOverlay.ets'), ['configurationHeader', 'boundedSpecId', 'headerAreaChangeHandler', 'headerLayoutKey', 'panelWidth', 'managerSurfaceSpec', 'close', 'stopPreview'], { ...deps, uiContext: context });
        Object.assign(headerConsumer, { manager: true, modalUsableWidth: 320, availableWidth: 320, voicePicker: false, metricsRevision: 1, title: '第三方 TTS 配置',
            measuredHeaderHeight: 0, measuredHeaderKey: '', selectionId: 'header:current', mounted: true, appThemeScheme: 'day', busy: false, previewGeneration: 0, previewId: '', onPreviewStop: () => { }, onClose: () => { }, closeFocusId: 'close' });
        headerConsumer.configurationHeader();
        const closeButton = bounded.nodes(headerConsumer).find(node => node.accessibilityText === '关闭 TTS 配置');
        target(closeButton, 'actual shared TTS header close');
        const actualHeaderRow = bounded.nodes(headerConsumer).find(node => node.type === 'Row' && node.constraintSize?.minHeight === 58);
        assert.ok(actualHeaderRow && actualHeaderRow.height === undefined, 'TTS header allows actual text extent above minimum58');
        actualHeaderRow.onAreaChange({}, { width: 293, height: 64 });
        assert.equal(headerConsumer.measuredHeaderHeight, 64);
        const smallHeader = read('entry/src/main/ets/ui/surfaces/ReaderBoundedSurfaceHeader.ets').replace("}.width(44).height(44).padding(0).backgroundColor(Color.Transparent)\n        .id(this.closeFocusId)\n        .enabled(this.actionEnabled)", "}.width(16).height(16).padding(0).backgroundColor(Color.Transparent)\n        .id(this.closeFocusId)\n        .enabled(this.actionEnabled)");
        assert.notEqual(smallHeader, read('entry/src/main/ets/ui/surfaces/ReaderBoundedSurfaceHeader.ets'));
        const oldBounded = boundedSurfaceSdk({ ReaderBoundedSurfaceHeader: smallHeader });
        const oldHeaderConsumer = oldBounded.consumer(ui('ReaderTtsConfigOverlay.ets'), ['configurationHeader', 'boundedSpecId', 'headerAreaChangeHandler', 'headerLayoutKey', 'panelWidth', 'managerSurfaceSpec', 'close', 'stopPreview'], { ...deps, uiContext: context });
        Object.assign(oldHeaderConsumer, { manager: true, modalUsableWidth: 320, availableWidth: 320, voicePicker: false, metricsRevision: 1, title: '第三方 TTS 配置', selectionId: 'old', mounted: true, appThemeScheme: 'day', busy: false, onClose: () => { }, closeFocusId: 'old:close' });
        oldHeaderConsumer.configurationHeader();
        assert.throws(() => target(oldBounded.nodes(oldHeaderConsumer).find(node => node.accessibilityText === '关闭 TTS 配置'), 'old small TTS close'), />=44/);
        o.busy = true;
        o.onIdentityChanged();
        assert.equal(o.busy, false);
        assert.equal(o.generation, 1);
        let finish;
        const events = [];
        Object.assign(o, { busy: false, selectionId: 'one', onPreview: () => new Promise(r => { finish = r; }), onPreviewStop: id => events.push(id) });
        o.preview('v1');
        o.selectionId = 'two';
        o.onIdentityChanged();
        finish();
        await new Promise(r => setImmediate(r));
        assert.equal(o.previewId, '');
        assert.ok(events.includes('one'));
        return;
    }
    if (id === 'header-home-sdk') {
        const panelSource = ui('ReaderControlPanel.ets');
        assertTypographyBindings(panelSource, 'ReaderControlPanel.ets');
        for (const name of ['TYPE_READER_CONTROL_BOOK_TITLE', 'TYPE_READER_CONTROL_CHAPTER_SOURCE']) {
            const missingImport = panelSource.replace(name + ', ', '');
            assert.notEqual(missingImport, panelSource);
            assert.throws(() => assertTypographyBindings(missingImport, 'ReaderControlPanel.ets'), /exactly once/, `missing ${name} import is rejected before injected probe dependencies`);
        }
        let headerFontsReady = true;
        const headerDependencies = pureModuleProbe(headerSource.slice(0, headerSource.indexOf('@Component')), 'ReaderReadingTopBarTitle.ets', {
            ...deps, readerWindowMetrics: () => ({ systemFontScale: scale }),
            readerFontFamilyReady: () => headerFontsReady, mangaDirectoryColor: () => '#222', FontWeight: { Bold: 700 }, TextOverflow: { Ellipsis: 'ellipsis' }, TextAlign: { Start: 'start' },
        }, ['ReaderReadingTopBarTitle', 'readerReadingTopBarHeight', 'readerReadingTopBarFontsReady']);
        const header = createReaderBuilderProbe(headerSource, ['build', 'resolvedHeight', 'titleFontScale', 'leading', 'trailing', 'empty'], {
            ...deps, ...headerDependencies, readerWindowMetrics: () => ({ systemFontScale: scale }), uiContext: context,
        }).owner;
        Object.assign(header, { variant: 'reading', barWidth: 320, barHeight: 54, bookTitle: '长书名', subtitle: '很长的章节与书源', scheme: 'day', inputEnabled: true,
            windowMetricsRevision: 1, leading: () => { }, trailing: () => { } });
        header.initialRender();
        const ids = [...header.nodes.keys()];
        for (scale of [1, 1.3, 1.6, 2]) {
            header.windowMetricsRevision++;
            header.replay();
            assert.deepEqual([...header.nodes.keys()], ids);
            const row = nodes(header, 'Row')[0];
            assert.ok(row.height >= (19.2 + 14.4) * scale + 5);
            assert.equal(nodes(header, 'Column')[0].height, undefined, 'title Column uses its real text extent');
            assert.equal(row.height, headerDependencies.readerReadingTopBarHeight(context, 'reading', 54));
        }
        const afterReady = measurementCalls;
        header.replay();
        header.replay();
        assert.equal(measurementCalls, afterReady, 'same header revision reuses actual measurement');
        headerFontsReady = false;
        header.replay();
        const preparing = measurementCalls;
        header.replay();
        assert.ok(measurementCalls > preparing, 'preparing font never caches fallback');
        headerFontsReady = true;
        header.replay();
        const registered = measurementCalls;
        header.replay();
        assert.equal(measurementCalls, registered, 'ready font caches current result at same metrics revision');
        const h = native('ReaderControlPanel.ets', ['measureHomeForm', 'chapterRow', 'progressRow', 'sourceActionHeight', 'topBarActions', 'topBarBack', 'topBarInputEnabled'], {
            uiContext: context, sourceSwitchTriggerFocusId: () => 'source:one',
        });
        Object.assign(h, { appScheme: 'day', minimumMetricsRevision: 1, layout: { topBarHeight: 54, topBarVisible: true }, chapterTitle: '很长的章节标题', totalChapters: 100, inputEnabled: true,
            runtimeMounted: true, frame: () => ({ topBar: { opacity: 1 } }), progressInputEnabled: () => true,
            controlObscured: false, temporaryLayerActive: false, moreMenuVisible: false, sourceId: 's', sourceBookId: 'b',
            canStepChapter: () => true, onPreviousChapter: () => { }, onNextChapter: () => { }, progressPercent: 40, effectiveProgressPercent: () => 40,
            progressInputRevision: 1, progressChangeHandler: () => () => { }, sourceActionHeight: h.sourceActionHeight,
            isLocalBook: () => false, setMoreMenuVisible: () => { }, readerMorePopupOptions: () => ({}), onSourceSwitch: () => { }, onExitReading: () => { },
        });
        let profile = h.measureHomeForm(240);
        h.homeMetric = (name, fallback) => profile[name] ?? fallback;
        h.chapterRow();
        h.progressRow();
        h.topBarActions();
        h.topBarBack();
        const homeIds = [...h.nodes.keys()];
        for (scale of [1, 1.3, 1.6, 2]) {
            profile = h.measureHomeForm(240);
            h.layout.topBarHeight = headerDependencies.readerReadingTopBarHeight(context, 'reading', 54);
            h.replay();
            assert.deepEqual([...h.nodes.keys()], homeIds);
            assert.ok(profile.chapterRowHeight >= 54);
            assert.ok(profile.progressHeight >= 50);
            const chapter = nodes(h, 'Row').find(n => n.height === profile.chapterRowHeight && n.padding?.top === 10);
            assert.ok(chapter.height - 10 >= 44);
            for (const child of h.children.values())
                for (const button of nodes(child, 'Button')) {
                    if (button.responseRegion) {
                        const region = button.responseRegion;
                        assert.ok(region.width >= 44 && region.height >= 44);
                        assert.ok((chapter.height - 10 - button.height) / 2 + region.y >= 0, 'chapter native44 region remains inside its paid vertical content');
                    }
                }
            const progress = nodes(h, 'Row').find(n => n.height === profile.progressHeight && n.padding?.top === 6);
            const slider = nodes(h, 'Slider')[0];
            assert.ok(slider.height >= 44 && progress.height - 6 >= slider.height);
            const source = nodes(h, 'Button').find(n => n.accessibilityText === '换源');
            target(source, 'reading source action');
            assert.ok(source.height >= 25 + 14.4 * scale);
            target(nodes(h, 'Button').find(n => n.accessibilityText === '更多'), 'reading more');
            target(nodes(h, 'Button').find(n => n.accessibilityText === '退出阅读，返回上一页'), 'reading back');
        }
        const oldHeader = createReaderBuilderProbe(headerSource.replace('.height(this.resolvedHeight())', '.height(this.barHeight)'), ['build', 'resolvedHeight', 'titleFontScale', 'leading', 'trailing', 'empty'], {
            ...deps, ...headerDependencies, readerWindowMetrics: () => ({ systemFontScale: 2 }), uiContext: context,
        }).owner;
        Object.assign(oldHeader, { variant: 'reading', barWidth: 320, barHeight: 54, bookTitle: '长书名', subtitle: '长章节', scheme: 'day', inputEnabled: true, windowMetricsRevision: 1, leading: () => { }, trailing: () => { } });
        oldHeader.initialRender();
        assert.ok(nodes(oldHeader, 'Row')[0].height < (19.2 + 14.4) * 2 + 5, 'old54 bar underpays two enlarged native lines');
        const oldColumn = createReaderBuilderProbe(headerSource.replace('}.layoutWeight(1)\n        .constraintSize', '}.layoutWeight(1).height(45)\n        .constraintSize'), ['build', 'resolvedHeight', 'titleFontScale', 'leading', 'trailing', 'empty'], {
            ...deps, ...headerDependencies, readerWindowMetrics: () => ({ systemFontScale: 2 }), uiContext: context,
        }).owner;
        Object.assign(oldColumn, { variant: 'reading', barWidth: 320, barHeight: 54, bookTitle: '长书名', subtitle: '长章节', scheme: 'day', inputEnabled: true, windowMetricsRevision: 1, leading: () => { }, trailing: () => { } });
        oldColumn.initialRender();
        assert.ok(nodes(oldColumn, 'Column')[0].height < (19.2 + 14.4) * 2 + 5, 'old45 title Column underpays current native lines');
        assert.ok(52.563 - 10 < 44 && 30 - 6 < 44, 'old home rows cannot pay44');
        return;
    }
    if (id === 'rounded-parent-sdk') {
        const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
        const properties = createArkUIPropertyRuntimeProbe();
        const gesture = new Proxy({}, { get: () => () => gesture });
        const gestureBindings = { PanGesture: gesture, TapGesture: gesture, GestureGroup: gesture, LongPressGesture: gesture,
            PanDirection: { Vertical: 'vertical' }, GestureMode: { Exclusive: 'exclusive' }, GesturePriority: { Low: 'low' },
            globalThis: { Gesture: gesture, GestureGroup: gesture, PanGesture: gesture, TapGesture: gesture, LongPressGesture: gesture } };
        const methods = [...currentPanelMethods, 'layout', 'minimumReady', 'minimumIdentity', 'minimumKey', 'contentMotionProgress',
            'onLayoutChanged', 'onMinimumIdentityChanged', 'onMinimumAvailabilityChanged', 'publishSelectedPlaybackProfile',
            'minimumInputReady', 'contentInputEnabled', 'brightnessInputEnabled', 'brightnessRequiresChildClip', 'brightnessRail', 'brightnessRailContent',
            'brightnessContentHeight', 'brightnessTrackHeight', 'effectiveBrightnessPercent', 'clampBrightness'];
        let receiptCurrent = true, automaticActions = 0;
        const frame = { brightness: { width: 46, height: 190, opacity: 1 } };
        const probe = createReaderBuilderProbe(ui('ReaderControlPanel.ets'), methods, {
            ...deps, ...geo, ...properties.sdk, ...gestureBindings, DEBUG: false,
        }, properties.hooks);
        const owner = probe.owner;
        Object.assign(owner, {
            isExpanded: () => false, moreMenuVisible: false, runtime: undefined,
            syncProgressInput() {}, cancelBrightnessDrag() {}, publishMinimumMeasurer() {},
            minimumModule: () => 'home', selectedMinimumProfile: () => undefined, runtimeMounted: true,
            inputEnabled: true, controlObscured: false, visualVisibilityProgress: 1, visualTransitionKind: '', visualHeldPointerId: -1,
            hasCurrentTemporaryInput: () => false, accessibleBrightnessActions() {},
        });
        Object.assign(owner, {
            appScheme: 'day', minimumIdentity: 'current', minimumKey: 'current|1', minimumReady: true,
            minimumReceiptCurrent: () => receiptCurrent, frame: () => frame,
            brightnessPercent: 50, brightnessPreviewPercent: -1, brightnessAutomatic: false,
            temporaryLayerActive: false, brightnessDragging: false, runtime: undefined,
            onBrightnessAuto: () => automaticActions++,
        });
        function measuredLayout(fontScale, viewportWidth = 366, viewportHeight = 844) {
            scale = fontScale;
            const metrics = createDefaultReaderWindowMetrics();
            metrics.windowRect.width = viewportWidth; metrics.windowRect.height = viewportHeight;
            metrics.systemFontScale = fontScale;
            const initial = geo.resolveReaderControlLayout(viewportWidth, viewportHeight, false, metrics);
            const candidateWidths = geo.readerControlCandidateWidths(viewportWidth, viewportHeight, false, metrics)[0];
            const nativeBar = deps.readerReadingTopBarHeight(context, 'reading', 54);
            const measured = minimum.measureReaderControlMinimum({ context, headerInter: false, title: '阅读控制',
                identity: 'current', metricsRevision: 1, topBarHeightVp: nativeBar,
                availableWithTopBarHeightVp: initial.fullPanelHeight + initial.fullPanelTop -
                    Math.max(88, initial.topBarTop + nativeBar + 8),
                measureHomeForm: () => ({ minimumHeight: 170, minWidth: 100, fits: true }) },
                'home', candidateWidths, 'current|1');
            assert.ok(measured);
            return geo.resolveReaderControlLayout(viewportWidth, viewportHeight, false, metrics, 0, [measured.candidate]);
        }
        function deliver(patch) {
            owner.updateStateVars({ layout: owner.layout, minimumReady: owner.minimumReady,
                minimumIdentity: owner.minimumIdentity, minimumKey: owner.minimumKey, ...patch });
            properties.flush();
        }
        owner.layout = measuredLayout(1);
        properties.flush();
        owner.brightnessRail();
        const scroll = nodes(owner, 'Scroll')[0];
        const column = nodes(owner, 'Column')[0];
        const marker = nodes(owner, 'Stack').find(node => node.border?.width === 1);
        const track = nodes(owner, 'Stack').find(node => node.borderRadius === 4);
        const automatic = nodes(owner, 'Button')[0];
        const recordedIds = [...owner.nodes.keys()];
        let samples = 0, motionSamples = 0;
        for (const fontScale of [1, 1.3, 1.6, 2]) {
            const layout = measuredLayout(fontScale);
            const expectedSize = Math.max(20, 13 * fontScale + 2);
            assert.equal(layout.contentBudget.brightnessAutoWidthVp, expectedSize);
            assert.equal(layout.contentBudget.brightnessAutoHeightVp, expectedSize);
            deliver({ layout, minimumReady: true });
            for (const viewport of [[366, 844], [568, 320]]) {
                const actualLayout = measuredLayout(fontScale, ...viewport);
                deliver({ layout: actualLayout });
                const bounds = motion.readerControlMotionBounds(actualLayout.fullPanelWidth, actualLayout.fullPanelHeight,
                    actualLayout.dockBottomGap, actualLayout.quickPanelHeight, actualLayout.contentBudget);
                for (const progress of [0, .25, .5, .75, 1]) {
                    frame.brightness = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: progress }, bounds).brightness;
                    owner.contentMotionProgress = progress; properties.flush(); owner.replay();
                    assert.equal(column.clip, false, 'actual admitted normal/short motion geometry pays the same contained Column');
                    motionSamples++;
                }
            }
            deliver({ layout });
            for (const height of [0, 20, 44, 80, 190]) for (const progress of [0, .25, .5, .75, 1]) {
                frame.brightness = { width: 46, height, opacity: 1 - progress };
                owner.contentMotionProgress = progress;
                properties.flush();
                owner.replay();
                assert.equal(column.clip, height < 44, 'only paid current frames omit the decorative outer crop');
                assert.equal(scroll.clip, true, 'the short-window Scroll remains the live viewport crop');
                assert.equal(track.clip, true, 'the percentage fill keeps its rounded8vp crop');
                assert.equal(track.width, 8);
                assert.equal(marker.width, expectedSize); assert.equal(marker.height, expectedSize);
                assert.ok(automatic.width >= 44 && automatic.height >= 44);
                assert.deepEqual([...owner.nodes.keys()], recordedIds, 'the same native actors survive font/short/morph samples');
                if (height >= 44) {
                    const sun = nodes(owner, 'Image')[0];
                    const hit = nodes(owner, 'Stack').find(node => node.hitTestBehavior === 'HitTestMode.Block');
                    const radius = column.width / 2;
                    const sunCenter = 1 + sun.margin.top + sun.height / 2;
                    const markerCenter = 1 + sun.margin.top + sun.height + hit.margin.top + hit.height +
                        automatic.margin.top + automatic.height / 2;
                    assert.equal(sunCenter, radius);
                    assert.equal(markerCenter, column.height - radius);
                    assert.ok(2 * (sun.width / 2) ** 2 <= radius ** 2, 'the fixed sun rectangle lies in the top circular cap');
                    assert.ok((marker.width / 2) ** 2 + (marker.height / 2) ** 2 <= radius ** 2,
                        'the full measured A rectangle, including its glyph, lies in the bottom cap');
                    assert.ok(1 + sun.margin.top + sun.height + hit.margin.top >= radius);
                    assert.ok(1 + sun.margin.top + sun.height + hit.margin.top + hit.height <= column.height - radius,
                        'the track lies entirely in the straight span');
                }
                samples++;
            }
        }
        frame.brightness = { width: 46, height: 190, opacity: 1 };
        deliver({ layout: measuredLayout(2), minimumReady: false });
        assert.equal(column.clip, true, 'actual minimumReady Prop retirement restores the original crop');
        deliver({ minimumReady: true });
        assert.equal(column.clip, false, 'the same Row observes the current minimum Prop');
        automatic.onClick(); assert.equal(automaticActions, 1);
        receiptCurrent = false; owner.replay();
        assert.equal(column.clip, true); automatic.onClick(); assert.equal(automaticActions, 1);
        receiptCurrent = true;
        const valid = measuredLayout(1);
        for (const [width, height] of [[undefined, 20], [20, undefined], [0, 20], [45, 20], [33, 33], [NaN, 20]]) {
            deliver({ layout: { ...valid, contentBudget: { ...valid.contentBudget,
                brightnessAutoWidthVp: width, brightnessAutoHeightVp: height } } });
            assert.equal(column.clip, true, 'missing, invalid or uncontained measured boxes keep clipping');
        }
        deliver({ layout: valid });
        frame.brightness.width = 0; owner.replay(); assert.equal(column.clip, true, 'an unpaid morph width keeps clipping');
        frame.brightness.width = 46;
        const contentHeight = owner.brightnessContentHeight;
        owner.brightnessContentHeight = () => 100; owner.replay(); assert.equal(column.clip, true, 'insufficient content height keeps clipping');
        owner.brightnessContentHeight = contentHeight;
        deliver({ minimumIdentity: '' });
        assert.equal(column.clip, true, 'legacy or missing minimum identity keeps clipping');
        deliver({ minimumIdentity: 'current' }); assert.equal(column.clip, false);

        const appearanceState = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts');
        const renderStyle = await import('../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts');
        const outerClip = { identity: 'unchanged-font-motion-mask' };
        const appearanceOwner = native('ReaderControlAppearanceContent.ets', ['fontCell'], {
            ...appearanceState, ...renderStyle, ...gestureBindings,
        });
        let chosen = '';
        Object.assign(appearanceOwner, {
            snapshot: appearanceState.createDefaultReaderAppearanceSnapshot(), appThemeScheme: 'day',
            fontActor: () => ({ width: 72, height: 44, opacity: 1 }), activeFont: () => true,
            visiblePreviewFamily: () => 'ReaderNotoSansSCUIBold', presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
            fontPreviewReady: () => true, sharedClip: () => outerClip, fontCellPosition: () => ({ x: 0, y: 0 }),
            draggedFontId: '', suppressFontClick: false, fontInput: () => true,
            onFontChange: font => { chosen = font; },
        });
        appearanceOwner.fontCell('sans');
        const paint = nodes(appearanceOwner, 'Row')[0], outer = nodes(appearanceOwner, 'Stack')[0];
        assert.equal(paint.clip, false); assert.equal(paint.borderRadius, 12);
        assert.equal(paint.width, 72); assert.equal(paint.height, 44);
        assert.equal(paint.hitTestBehavior, 'HitTestMode.None');
        assert.equal(outer.clipShape, outerClip, 'the unpainted motion viewport keeps its original path');
        outer.onClick(); assert.equal(chosen, 'sans');
        const source = ui('ReaderControlAppearanceContent.ets');
        const tree = compiler.ts.createSourceFile('Appearance.ets', source, compiler.ts.ScriptTarget.Latest, true,
            compiler.ts.ScriptKind.ETS, compiler.options);
        const component = tree.statements.find(node => node.members?.some(member => member.name?.getText(tree) === 'fontCell'));
        const cell = component.members.find(member => member.name?.getText(tree) === 'fontCell');
        const rowBodies = [];
        function visit(node) {
            if (node.kind === compiler.ts.SyntaxKind.EtsComponentExpression && node.expression.getText(tree) === 'Row')
                rowBodies.push(node.body?.statements?.length ?? 0);
            compiler.ts.forEachChild(node, visit);
        }
        visit(cell); assert.deepEqual(rowBodies, [0], 'the only painted Row has no child content to crop');
        assert.doesNotMatch(source.slice(cell.pos, cell.end), /\.borderRadius\(12\)\.clip\(true\)/,
            'the redundant empty rounded-parent mask cannot return');
        const panelSource = ui('ReaderControlPanel.ets');
        function verifyPanelSource(sourceText, frameHeight = 190, boxSize = 20) {
            const { owner: mutant } = createReaderBuilderProbe(sourceText, [...currentPanelMethods, 'minimumInputReady',
                'contentInputEnabled', 'brightnessInputEnabled',
                'brightnessRailContent', 'brightnessRequiresChildClip', 'brightnessContentHeight',
                'brightnessTrackHeight', 'effectiveBrightnessPercent', 'clampBrightness'], {
                ...deps, ...gestureBindings,
            });
            Object.assign(mutant, {
                layout: { contentBudget: { quickContentHeightVp: 190, fullContentHeightVp: 190,
                    brightnessAutoWidthVp: boxSize, brightnessAutoHeightVp: boxSize } },
                frame: () => ({ brightness: { width: 46, height: frameHeight } }), appScheme: 'day',
                minimumIdentity: 'current', minimumKey: 'current|1', minimumReady: true,
                minimumReceiptCurrent: () => true, contentMotionProgress: 0,
                brightnessPercent: 50, brightnessPreviewPercent: -1,
                runtimeMounted: true, inputEnabled: true, controlObscured: false, moreMenuVisible: false,
                visualVisibilityProgress: 1, visualTransitionKind: '', visualHeldPointerId: -1,
                hasCurrentTemporaryInput: () => false, accessibleBrightnessActions() {},
            });
            mutant.brightnessRailContent();
            assert.equal(nodes(mutant, 'Column')[0].clip, frameHeight < 44 || boxSize > 32,
                'the exact native material respects the paid containment domain');
            assert.equal(nodes(mutant, 'Stack').find(node => node.borderRadius === 4).clip, true,
                'the percentage-fill crop remains enabled');
        }
        verifyPanelSource(panelSource);
        for (const [name, before, after, height, size] of [
            ['old-parent-mask', '.clip(this.brightnessRequiresChildClip())', '.clip(true)', 190, 20],
            ['unpaid-parent-unclipped', '.clip(this.brightnessRequiresChildClip())', '.clip(false)', 0, 20],
            ['A-box-diagonal-unpaid', 'width * width + height * height > READER_CONTROL_BRIGHTNESS_RAIL_WIDTH * READER_CONTROL_BRIGHTNESS_RAIL_WIDTH', 'false', 190, 33],
            ['fill-track-crop-lost', '.borderRadius(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH / 2).clip(true)',
                '.borderRadius(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH / 2).clip(false)', 190, 20],
        ]) {
            assert.equal(panelSource.split(before).length - 1, 1);
            assert.throws(() => verifyPanelSource(panelSource.replace(before, after), height, size),
                /paid containment domain|percentage-fill crop/, `${name} must fail the actual SDK attribute contract`);
        }
        console.log(JSON.stringify({ kind: 'reading-rounded-parent-inputs', samples, motionSamples, productionSites: 2,
            scrollCrop: 'RETAINED', trackCrop: 'RETAINED', fontMotionMask: 'RETAINED', nativeRaster: 'NOT_RUN' }));
        return;
    }
    if (id === 'brightness-sdk') {
        const metrics = createDefaultReaderWindowMetrics();
        scale = 2; metrics.systemFontScale = 2;
        metrics.systemInsets.top = 24; metrics.navigationInsets.bottom = 24;
        const initial = geo.resolveReaderControlLayout(568, 320, false, metrics);
        const width = geo.readerControlCandidateWidths(568, 320, false, metrics)[0];
        const nativeBar = deps.readerReadingTopBarHeight(context, 'reading', 54);
        const measured = minimum.measureReaderControlMinimum({ context, headerInter: false, title: '阅读控制', identity: 'current', metricsRevision: 1,
            topBarHeightVp: nativeBar, availableWithTopBarHeightVp: initial.fullPanelHeight + initial.fullPanelTop - Math.max(88, initial.topBarTop + nativeBar + 8),
            measureHomeForm: () => ({ minimumHeight: 170, minWidth: 100, fits: true }) }, 'home', width, 'current|1');
        const candidate = measured.candidate;
        const layout = geo.resolveReaderControlLayout(568, 320, false, metrics, 0, [candidate]);
        assert.equal(layout.topBarVisible, false, 'short layout relocates topbar actions to Home Scroll');
        assert.ok(layout.contentBudget.quickContentHeightVp >= 44, 'physical Home/brightness viewport admits complete44 target');
        assert.ok(layout.contentBudget.fullContentHeightVp >= 44);
        const withRecovery = geo.resolveReaderControlLayout(568, 320, false, metrics, initial.topBarTop + geo.READER_CONTROL_SAFE_TOP_GAP + 44, [candidate]);
        assert.ok(withRecovery.contentBudget.quickContentHeightVp >= 44, 'bounded44 recovery plus gap pays full native target viewport');
        const oldChrome = { ...candidate, chrome: { ...candidate.chrome, topBarVisible: true, quickReserveVp: 29 + 18 + measured.profile.navigationHeight + 13 } };
        const oldLayout = geo.resolveReaderControlLayout(568, 320, false, metrics, 0, [oldChrome]);
        assert.ok(oldLayout.contentBudget.quickContentHeightVp < 44, 'old topbar and gaps clip an entire44 target');
        console.log(JSON.stringify({ kind: 'reader-short-control-budget', viewport: [568, 320], fontScale: 2, safeTop: 24, safeBottom: 24, topBarHeight: nativeBar, topBarVisible: layout.topBarVisible, homeNavigationHeight: layout.contentBudget.navigationHeightVp, quickReserve: candidate.chrome.quickReserveVp, quickContentHeight: layout.contentBudget.quickContentHeightVp, withRecoveryQuickContentHeight: withRecovery.contentBudget.quickContentHeightVp, oldChromeContentHeight: oldLayout.contentBudget.quickContentHeightVp }));
        for (const module of ['tts', 'appearance', 'settings', 'search', 'replace', 'autoPage', 'directory']) {
            const secondary = minimum.measureReaderControlMinimum({ context, headerInter: false, title: '阅读控制', identity: 'current', metricsRevision: 1,
                topBarHeightVp: nativeBar, availableWithTopBarHeightVp: 100, measureHomeForm: () => ({ minimumHeight: 170, minWidth: 100, fits: true }) }, module, width, 'module|1',
                () => ({ module, quick: { heightVp: 500, minWidthVp: 100, fits: true }, full: { heightVp: 500, minWidthVp: 100, fits: true } }));
            const secondaryLayout = geo.resolveReaderControlLayout(568, 320, false, metrics, withRecovery.minimumPanelTop - 8, [secondary.candidate]);
            assert.equal(secondaryLayout.contentBudget.navigationHeightVp, 0);
            assert.ok(secondaryLayout.contentBudget.quickContentHeightVp >= 44);
        }
        const frame = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: 0 }, motion.readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight, layout.dockBottomGap, layout.quickPanelHeight, layout.contentBudget));
        assert.ok(frame.brightness.height >= 44 && frame.brightness.opacity === 1);
        const focus = await import('../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts');
        let exited = 0, sourceOpened = '', location = { level: 'home' }, more = false;
        const short = native('ReaderControlPanel.ets', ['shortWindowActions', 'shortWindowActionInput', 'topBarInputEnabled'], { ...focus, ScrollDirection: { Horizontal: 'horizontal' } });
        Object.assign(short, { layout, appScheme: 'day', runtimeMounted: true, inputEnabled: true, sourceId: 'source:one', sourceBookId: 'book:one', temporaryLayerActive: false,
            moreMenuVisible: false, moreMenuGeneration: 7, contentLocation: () => location, contentInputEnabled: () => true, frame: () => frame,
            isLocalBook: () => false, onExitReading: () => exited++, onSourceSwitch: origin => sourceOpened = origin,
            setMoreMenuVisible: value => { more = value; }, readerMorePopupOptions: () => ({ generation: 7 }) });
        short.shortWindowActions();
        const shortButtons = nodes(short, 'Button'); for (const button of shortButtons) target(button, 'short Home action');
        assert.equal(nodes(short, 'Row').find(node => node.height === 44).width, Math.max(180, frame.content.width));
        assert.equal(nodes(short, 'Scroll')[0].width, frame.content.width);
        const actualWidth = frame.content.width; frame.content.width = 148; short.replay();
        assert.equal(nodes(short, 'Scroll')[0].width, 148); assert.equal(nodes(short, 'Scroll')[0].height, 44);
        assert.equal(nodes(short, 'Scroll')[0].enableScrollInteraction, true);
        assert.equal(nodes(short, 'Row').find(node => node.height === 44).width, 180);
        frame.content.width = actualWidth; short.replay();
        shortButtons[1].onClick(); assert.equal(sourceOpened, focus.sourceSwitchTriggerFocusId('source:one', 'book:one', 'reader-control-short'));
        assert.notEqual(shortButtons[1].id, focus.sourceSwitchTriggerFocusId('source:one', 'book:one', 'reader-control'), 'short source focus is unique from retained hidden topbar');
        shortButtons[2].onClick(); assert.equal(more, true);
        shortButtons[0].onClick(); assert.equal(exited, 1);
        assert.equal(short.topBarInputEnabled(), false);
        location = { level: 'secondary', module: 'settings' }; sourceOpened = ''; more = false;
        shortButtons[0].onClick(); shortButtons[1].onClick(); shortButtons[2].onClick();
        assert.equal(exited, 1); assert.equal(sourceOpened, ''); assert.equal(more, false, 'old short Home callbacks cannot operate secondary owner');
        location = { level: 'home' }; short.layout = { ...layout, topBarVisible: true };
        shortButtons[1].onClick(); assert.equal(sourceOpened, '', 'retired short source cannot invoke under normal topbar');
        let stageFrame = frame;
        const stage = native('ReaderControlPanel.ets', ['build', 'topBarInputEnabled', 'navigationInputEnabled', 'controlActionInputEnabled'], { ...motion, AccessibilityRoleType: { BUTTON: 'button' } }, { childSources: { ReaderSessionLaunchStage: ui('ReaderSessionLaunchStage.ets') } });
        Object.assign(stage, { layout, frame: () => stageFrame, appScheme: 'day', controlActorsRetained: true, launchSample: undefined, controlObscured: false,
            runtimeMounted: true, inputEnabled: true, temporaryLayerActive: false, moreMenuVisible: false, visualHeldPointerId: -1,
            visualVisibilityProgress: 1, hasCurrentTemporaryInput: () => false,
            contentLocation: () => ({ level: 'home', module: 'directory', form: 'quick' }),
            topBar: () => {}, controlContent: () => {}, controlHeader: () => {}, headerAction: () => {}, headerGrabCap: () => {}, brightnessRail: () => {}, moduleNavBar: () => {}, measureTopBar: () => {},
            contentInputEnabled: () => true, controlPanelHeight: () => layout.fullPanelHeight, dockLeft: () => 0, dockTop: () => layout.fullPanelTop, accessibleControlActions: () => {}, handleControlTouch: () => {} });
        stage.initialRender();
        const retainedHeader = nodes(stage, 'Stack').find(node => node.width === layout.topBarWidth && node.height === layout.topBarHeight && node.position?.y === layout.topBarTop);
        assert.equal(retainedHeader.opacity, 0); assert.equal(retainedHeader.enabled, false);
        assert.equal(retainedHeader.hitTestBehavior, 'HitTestMode.None'); assert.equal(retainedHeader.accessibilityLevel, 'no-hide-descendants');
        stageFrame = { ...frame, navigation: { ...frame.navigation, height: 0, opacity: 0 } }; stage.replay();
        const retiredNav = nodes(stage, 'Stack').find(node => node.width === frame.navigation.width && node.height === 0 && node.position?.y === frame.navigation.y);
        assert.equal(retiredNav.enabled, false); assert.equal(retiredNav.hitTestBehavior, 'HitTestMode.None'); assert.equal(retiredNav.accessibilityLevel, 'no-hide-descendants');
        const gestures = [];
        const gesture = new Proxy({}, { get: (_, name) => (...args) => { gestures.push({ name, args }); return gesture; } });
        const b = native('ReaderControlPanel.ets', ['minimumInputReady', 'contentInputEnabled', 'brightnessInputEnabled', 'brightnessRequiresChildClip', 'brightnessRail', 'brightnessRailContent', 'brightnessContentHeight', 'brightnessTrackHeight', 'effectiveBrightnessPercent', 'clampBrightness', 'beginBrightnessDrag', 'updateBrightnessDrag', 'finishBrightnessDrag', 'cancelBrightnessDrag', 'roundBrightness', 'commitBrightnessTap'], {
            PanGesture: gesture, TapGesture: gesture, GestureGroup: gesture, PanDirection: { Vertical: 'vertical' }, GestureMode: { Exclusive: 'exclusive' },
            GesturePriority: { Low: 'low' }, globalThis: { Gesture: gesture, GestureGroup: gesture, PanGesture: gesture, TapGesture: gesture },
        });
        let auto = 0, cancelled = 0, receiptCurrent = true;
        const changed = [];
        Object.assign(b, { layout, frame: () => frame, appScheme: 'day', brightnessPercent: 50, brightnessPreviewPercent: -1, brightnessAutomatic: false,
            runtimeMounted: true, inputEnabled: true, controlObscured: false, visualVisibilityProgress: 1, visualTransitionKind: '', visualHeldPointerId: -1,
            moreMenuVisible: false, hasCurrentTemporaryInput: () => false, accessibleBrightnessActions() {}, onInputActivity() {},
            minimumIdentity: 'current', minimumKey: 'current|1', minimumReady: true, minimumReceiptCurrent: () => receiptCurrent,
            temporaryLayerActive: false, brightnessDragging: false, emitBrightness: () => { }, onBrightnessChange: v => changed.push(v), onBrightnessAuto: () => auto++, onBrightnessCancel: () => cancelled++, });
        b.brightnessRail();
        const scroll = nodes(b, 'Scroll')[0], column = nodes(b, 'Column')[0];
        assert.equal(scroll.height, frame.brightness.height);
        assert.ok(column.height > scroll.height);
        assert.equal(scroll.enableScrollInteraction, true);
        assert.ok(b.brightnessTrackHeight() >= 44);
        assert.ok(nodes(b, 'Stack').some(n => n.height === b.brightnessTrackHeight() && n.hitTestBehavior === 'HitTestMode.Block'));
        const automatic = nodes(b, 'Button')[0];
        target(automatic, 'brightness automatic');
        assert.ok(column.width >= automatic.width + 1);
        const marker = nodes(b, 'Stack').find(node => node.border?.width === deps.TOK_BORDER_W);
        const markerId = marker.id;
        for (const fontScale of [1, 1.3, 1.6, 2]) {
            scale = fontScale;
            const sample = minimum.measureReaderControlMinimum({ context, headerInter: false, title: '阅读控制', identity: 'current', metricsRevision: 1,
                topBarHeightVp: nativeBar, measureHomeForm: () => ({ minimumHeight: 170, minWidth: 100, fits: true }) }, 'home', width, 'current|1');
            const expectedSize = Math.max(20, 13 * fontScale + deps.TOK_BORDER_W * 2);
            assert.equal(sample.candidate.chrome.brightnessAutoWidthVp, expectedSize, 'paint follows its glyph and border, independent of the44 target');
            assert.equal(sample.candidate.chrome.brightnessAutoHeightVp, expectedSize);
            b.layout = { ...layout, contentBudget: { ...layout.contentBudget, ...sample.candidate.chrome } };
            for (const scheme of ['day', 'night']) {
                b.appScheme = scheme;
                b.replay();
                assert.equal(marker.width, expectedSize);
                assert.equal(marker.height, expectedSize, 'automatic marker stays circular');
                assert.ok(marker.width < automatic.width);
                target(automatic, 'brightness automatic at' + fontScale);
                const sun = nodes(b, 'Image')[0];
                const track = nodes(b, 'Stack').find(node => node.hitTestBehavior === 'HitTestMode.Block');
                const centre = deps.TOK_BORDER_W + sun.margin.top + sun.height + track.margin.top + track.height + automatic.margin.top + automatic.height / 2;
                assert.equal(centre, column.height - column.width / 2, 'automatic marker shares the rail cap centre');
                const oldTrackHeight = Math.max(0, controls.READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT -
                    (controls.READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT - column.height) - (automatic.height - 20));
                assert.notEqual(track.height, oldTrackHeight, 'full deduction of target growth would move the bottom marker inward');
            }
        }
        scale = 2;
        b.layout = layout;
        b.replay();
        assert.equal(marker.id, markerId, 'same marker survives scale and scheme updates');
        automatic.onClick();
        assert.equal(auto, 1);
        assert.ok(gestures.some(g => g.name === 'onActionStart') && gestures.some(g => g.name === 'onActionUpdate') && gestures.some(g => g.name === 'onActionEnd') && gestures.some(g => g.name === 'onAction'));
        const start = gestures.find(g => g.name === 'onActionStart').args[0];
        const move = gestures.find(g => g.name === 'onActionUpdate').args[0];
        const end = gestures.find(g => g.name === 'onActionEnd').args[0];
        start();
        move({ offsetY: -10 });
        end({ offsetY: -10 });
        assert.ok(changed.length >= 1);
        gestures.find(g => g.name === 'onAction').args[0]({ fingerList: [{ localY: 0 }] });
        assert.equal(changed.at(-1), 100);
        const emissions = changed.length;
        receiptCurrent = false;
        automatic.onClick(); start(); move({ offsetY: -10 }); end({ offsetY: -10 });
        gestures.find(g => g.name === 'onAction').args[0]({ fingerList: [{ localY: 0 }] });
        assert.equal(auto, 1, 'retained automatic callback rejects a superseded provider before the next frame');
        assert.equal(changed.length, emissions, 'retained Pan/Tap callbacks reject the old ready value');
        receiptCurrent = true; start(); receiptCurrent = false; end({ offsetY: -10 });
        assert.equal(cancelled, 1, 'in-flight drag settles through its original cancel owner when admission changes');
        assert.equal(changed.length, emissions);
        receiptCurrent = true;
        const ids = [...b.nodes.keys()];
        frame.brightness.height = 190;
        b.replay();
        assert.deepEqual([...b.nodes.keys()], ids);
        assert.equal(scroll.enableScrollInteraction, false);
        assert.equal(column.height, 190);
        assert.equal(scroll.height, 190);
        const old = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: 0 }, motion.readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight, layout.dockBottomGap, layout.quickPanelHeight, layout.contentBudget));
        assert.ok(controls.readerControlBrightnessTrackHeight(old.brightness.height, 44) < 44, 'old usable predicate would retire this required rail');
        return;
    }
}
