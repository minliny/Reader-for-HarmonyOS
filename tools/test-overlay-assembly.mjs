import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectOverlayAssembly } from './check-overlay-assembly.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';

const selected = selectContractCases({
  'slot-tracing': { description: 'Exact historical directory header and local Builder chains reject overlay-in-flow while current header and normal PageState remain legal.', resources: [] },
  'native-detached': { description: 'Native detached popup/sheet/cover, StandardPage bounded overlay and explicitly positioned overlay declarations stay outside measured flow; dynamic Builder values remain unresolved.', resources: [] },
  'geometry-isolation': { description: 'Declared base geometry rejects overlay reads and overlay Watch-to-frame invalidation, while overlay-to-overlay measurement remains legal.', resources: [] },
});
const fixturePath = 'entry/src/main/ets/OverlayAssemblyFixture.ets';

function inspect(source, geometryContracts = []) {
  return inspectOverlayAssembly({ files: [fixturePath], sourceOverrides: new Map([[fixturePath, source]]), geometryContracts });
}

const page = body => `@Component struct Fixture {
  @Builder heading() { Text('Header'); }
  @Builder notice() { ReaderRecoveryNotice({ view: this.recovery }); }
  @Builder body() { ReaderPageState({ message: 'Loading' }); }
  ${body}
}`;

for (const id of selected) {
  if (id === 'slot-tracing') {
    const valid = inspect(page(`build() { ReaderStandardPage({ header: (): void => this.heading(),
      content: (): void => this.body(), overlayContent: (): void => this.notice() }); }`));
    assert.equal(valid.status, 'PASS');
    assert.equal(valid.slots.length, 3);

    for (const [frame, slot, props] of [
      ['ReaderStandardPage', 'nativeListItems', "scrollOwner: 'native-list',"],
      ['SettingsShell', 'homeContent', "activeSection: 'home',"],
      ['SettingsShell', 'generalContent', "activeSection: 'general',"],
    ]) {
      const flowSource = page(`build() { ${frame}({ ${props} ${slot}: (): void => this.body() }); }`);
      const flow = inspect(flowSource);
      assert.equal(flow.status, 'PASS');
      assert.ok(flow.slots.some(row => row.frame === frame && row.slot === slot), `${frame}.${slot} must be traced`);
      const recoveryInFlow = inspect(flowSource.replace('this.body()', 'this.notice()'));
      assert.equal(recoveryInFlow.status, 'FAIL');
      assert.ok(recoveryInFlow.diagnostics.some(row => row.rule === 'OVERLAY_IN_FLOW' && row.slot === slot));
    }

    for (const frame of ['ReaderPageScaffold', 'ReaderStandardPage', 'MainTabShell', 'SettingsShell', 'BookshelfShell']) {
      const futureSlot = `@Component struct ${frame} {
          @BuilderParam futureContent: () => void;
          onAction: () => void;
          build() {}
        }
        ${page(`build() { ${frame}({ futureContent: (): void => this.notice() }); }`)}`;
      const unmapped = inspect(futureSlot);
      assert.equal(unmapped.status, 'UNRESOLVED');
      assert.ok(unmapped.diagnostics.some(row => row.rule === 'UNRESOLVED' && row.slot === 'futureContent' &&
        row.message.includes('no assembly role')));
      assert.equal(inspect(futureSlot.replace('futureContent: (): void => this.notice()',
        'onAction: (): void => this.notice()')).status, 'PASS', 'ordinary callbacks are not Builder slots');
    }

    const nested = inspect(page(`@Builder measuredHeader() { Column() { this.heading(); this.notice(); } }
      build() { ReaderStandardPage({ header: (): void => this.measuredHeader(), content: (): void => this.body() }); }`));
    assert.equal(nested.status, 'FAIL');
    assert.ok(nested.diagnostics.some(row => row.rule === 'OVERLAY_IN_FLOW' && row.slot === 'header' &&
      row.chain.includes('Fixture.measuredHeader') && row.chain.includes('Fixture.notice')));

    const historical = JSON.parse(readFileSync(new URL('./fixtures/overlay-full-directory-header-before-20261113.json', import.meta.url), 'utf8'));
    const old = inspectOverlayAssembly({ files: [historical.path], checkedSlots: ['header'],
      sourceOverrides: new Map([[historical.path, historical.source]]) });
    assert.equal(old.status, 'FAIL');
    assert.ok(old.diagnostics.some(row => row.rule === 'OVERLAY_IN_FLOW' && row.slot === 'header' &&
      row.component === 'ReaderDirectoryRecoverySurface'), 'the exact original phone header reaches its recovery component');
    const current = inspectOverlayAssembly({ files: [historical.path], checkedSlots: ['header'] });
    assert.equal(current.status, 'PASS', JSON.stringify(current.diagnostics));
    const loop = inspect(page(`@Builder loopHeader() { Repeat([1]).each((item): void => { this.notice(); }); }
      build() { ReaderStandardPage({ header: (): void => this.loopHeader() }); }`));
    assert.ok(loop.diagnostics.some(row => row.rule === 'OVERLAY_IN_FLOW'));

    const toolsPage = inspectOverlayAssembly({ files: ['entry/src/main/ets/features/source/ui/SourceToolsPage.ets'],
      checkedSlots: ['content', 'overlayContent'] });
    assert.equal(toolsPage.status, 'PASS', 'actual typed contradictory guards keep recovery out of the SourceTools content slot');
    const toolsPath = 'entry/src/main/ets/features/source/ui/SourceToolsPage.ets';
    const toolsSource = readFileSync(new URL('../' + toolsPath, import.meta.url), 'utf8');
    const { ts, options } = installedEtsCompiler();
    const toolsTree = ts.createSourceFile(toolsPath, toolsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const toolsOwner = toolsTree.statements.find(node => node.name?.text === 'SourceToolsPage');
    const content = toolsOwner.members.find(member => member.name?.getText(toolsTree) === 'pageContent');
    const guard = content.body.statements.find(ts.isIfStatement);
    assert.ok(guard.expression.getText(toolsTree).includes("this.snapshot.original?.blocked !== true"));
    const restoredHelper = toolsSource.slice(0, guard.thenStatement.getStart(toolsTree)) +
      '{ this.recoveryAction(); }' + toolsSource.slice(guard.thenStatement.end);
    const guardedHelper = inspectOverlayAssembly({ files: [toolsPath], checkedSlots: ['content'],
      sourceOverrides: new Map([[toolsPath, restoredHelper]]) });
    assert.equal(guardedHelper.status, 'PASS', JSON.stringify(guardedHelper.diagnostics));
    assert.ok(guardedHelper.inputs.some(input => input.path.endsWith('SourceToolsOrchestrator.ets')),
      'truthiness is resolved from the actual imported snapshot type, not a source-path exemption');
    const typedGuard = `interface Snapshot { blocked?: boolean; }
      @Component struct Fixture { @Prop snapshot: Snapshot;
        @Builder recovery() { if (this.snapshot.blocked) { ReaderRecoveryNotice({view: this.view}); } }
        @Builder body() { if (this.snapshot.blocked !== true) this.recovery(); }
        build() { ReaderStandardPage({ content: (): void => this.body() }); }
      }`;
    assert.equal(inspect(typedGuard).status, 'PASS');
    assert.equal(inspect(typedGuard.replace('blocked?: boolean', 'blocked?: any')).status, 'FAIL',
      'truthy arbitrary values cannot be treated as the declared Boolean true');
  }

  if (id === 'native-detached') {
    const boundedSource = page(`build() { ReaderStandardPage({
      boundedOverlayVisible: this.pending,
      boundedOverlayContent: (): void => this.notice(), content: (): void => this.body() }); }`);
    const bounded = inspect(boundedSource);
    assert.equal(bounded.status, 'PASS');
    assert.ok(bounded.slots.some(row => row.frame === 'ReaderStandardPage' && row.slot === 'boundedOverlayContent'),
      'the current bounded overlay entry is traced as an explicit StandardPage slot');
    const boundedInHeader = inspect(boundedSource.replace('boundedOverlayContent:', 'header:'));
    assert.ok(boundedInHeader.diagnostics.some(row => row.rule === 'OVERLAY_IN_FLOW' && row.slot === 'header'));
    const dynamicBounded = inspect(page(`private selectedOverlay: () => void;
      build() { ReaderStandardPage({ boundedOverlayVisible: true, boundedOverlayContent: this.selectedOverlay }); }`));
    assert.equal(dynamicBounded.status, 'UNRESOLVED');
    assert.ok(dynamicBounded.diagnostics.some(row => row.rule === 'UNRESOLVED' && row.slot === 'boundedOverlayContent'));

    for (const shell of ['MainTabShell', 'SettingsShell']) {
      const shellSource = page(`build() { ${shell}({
        boundedOverlayVisible: true, boundedOverlayContent: (): void => this.notice() }); }`);
      const shellBounded = inspect(shellSource);
      assert.equal(shellBounded.status, 'PASS');
      assert.ok(shellBounded.slots.some(row => row.frame === shell && row.slot === 'boundedOverlayContent'),
        `${shell}'s actual bounded overlay callback must be traced`);
      const shellDynamic = inspect(page(`private selectedOverlay: () => void;
        build() { ${shell}({ boundedOverlayVisible: true, boundedOverlayContent: this.selectedOverlay }); }`));
      assert.equal(shellDynamic.status, 'UNRESOLVED');
      assert.ok(shellDynamic.diagnostics.some(row => row.rule === 'UNRESOLVED' && row.slot === 'boundedOverlayContent'));
    }
    for (const slot of ['header', 'content']) {
      const shellFlow = inspect(page(`build() { MainTabShell({ ${slot}: (): void => this.notice() }); }`));
      assert.equal(shellFlow.status, 'FAIL');
      assert.ok(shellFlow.diagnostics.some(row => row.rule === 'OVERLAY_IN_FLOW' && row.slot === slot));
    }

    const native = inspect(page(`@Builder detachedHeader() {
      Text('Popup').bindPopup(this.popup, { builder: (): void => this.notice() });
      Text('Sheet').bindSheet(this.sheet, (): void => this.notice());
      Text('Cover').bindContentCover(this.cover, (): void => this.notice());
    }
    build() { ReaderPageScaffold({ header: (): void => this.detachedHeader(), content: (): void => this.body() }); }`));
    assert.equal(native.status, 'PASS');
    assert.deepEqual(native.detached.map(row => row.method).sort(), ['bindContentCover', 'bindPopup', 'bindSheet']);

    const positioned = inspect(page(`@Builder floating() { Stack() { this.notice(); }.position({ x: 0, y: 0 }); }
      build() { ReaderStandardPage({ content: (): void => this.floating() }); }`));
    assert.equal(positioned.status, 'PASS');
    const stacked = inspect(page(`@Builder stacked() {
      Stack() { this.body(); Column() { this.notice(); } }.width('100%').height('100%');
    }
    build() { ReaderStandardPage({ content: (): void => this.stacked() }); }`));
    assert.equal(stacked.status, 'PASS', 'a separate overlay-only child of a full viewport Stack keeps its sibling page geometry');
    const mixed = inspect(page(`@Builder mixed() {
      Stack() { Column() { Text('Base content'); this.notice(); } }.width('100%').height('100%');
    }
    build() { ReaderStandardPage({ content: (): void => this.mixed() }); }`));
    assert.equal(mixed.status, 'FAIL', 'a mixed linear child still allows recovery to move base content');

    const card = inspect(`import { ReaderCard } from './ui/surfaces/ReaderCard';
      @Component struct Fixture { @Builder body() { ReaderCard() { ReaderRecoveryNotice({view:this.view}); } }
        build() { ReaderStandardPage({ content: (): void => this.body() }); }
      }`);
    assert.equal(card.status, 'FAIL');
    assert.ok(card.diagnostics.some(row => row.chain.includes('ReaderCard.build') && row.rule === 'OVERLAY_IN_FLOW'));
    const dynamic = inspect(page(`private selectedHeader: () => void;
      build() { ReaderStandardPage({ header: this.selectedHeader }); }`));
    assert.equal(dynamic.status, 'UNRESOLVED');
    assert.ok(dynamic.diagnostics.every(row => row.rule === 'UNRESOLVED'));
  }

  if (id === 'geometry-isolation') {
    const contract = [{ file: fixturePath, owner: 'Fixture', methods: ['baseHeight'],
      overlayMembers: ['recovery', 'recovering', 'recoveryHeight'], invalidationMethods: ['invalidateFrame'] }];
    const members = `@Prop recovery: object;
      private baseHeight(): number { return this.viewportHeight - this.chromeHeight(); }
      private chromeHeight(): number { return 44; }
      private recoveryHeight(): number { return this.recovery.height; }
      private overlayTop(): number { return this.recoveryHeight() + 8; }
      private onRecoveryChanged(): void { this.refreshHeader(); }
      private refreshHeader(): void { this.invalidateFrame(); }
      private invalidateFrame(): void { this.revision += 1; }
      build() { ReaderStandardPage({ header: (): void => this.heading(), overlayContent: (): void => this.notice() }); }`;
    const source = page(members);
    assert.equal(inspect(source, contract).status, 'PASS', 'overlay-to-overlay placement is not a base geometry dependency');
    const coupled = inspect(source.replace('this.viewportHeight - this.chromeHeight()',
      'this.viewportHeight - this.chromeHeight() - this.recoveryHeight()'), contract);
    assert.equal(coupled.status, 'FAIL');
    assert.ok(coupled.diagnostics.some(row => row.rule === 'OVERLAY_GEOMETRY_DEPENDENCY' && row.method === 'baseHeight'));
    const watched = inspect(source.replace('@Prop recovery: object;',
      "@Prop @Watch('onRecoveryChanged') recovery: object;"), contract);
    assert.equal(watched.status, 'FAIL');
    assert.ok(watched.diagnostics.some(row => row.rule === 'OVERLAY_FRAME_INVALIDATION' &&
      row.chain.includes('Fixture.refreshHeader')));
  }
  recordContractCasePass(id);
}
