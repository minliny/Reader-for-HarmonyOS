import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'cover-lifecycle': { description: 'Actual SDK cover builders/error closures: empty/broken image fallback and retired entity/URL/opening/load rejection', resources: [] },
  'header-lane': { description: 'Actual download header geometry/material and padding: opaque top lane with unchanged bar/list/footer bounds', resources: [] },
};
for (const id of selectContractCases(cases)) {
  await run(id);
  recordContractCasePass(id);
}

async function run(id) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const read = name => readFileSync(`entry/src/main/ets/${name}.ets`, 'utf8');
  if (id === 'cover-lifecycle') {
    const source = read('features/downloads/ui/SharedDownloadBookCover');
    const placeholder = read('ui/patterns/NoCoverCover');
    const members = ['bookKey', 'coverUrl', 'presentationGeneration', 'coverWidth', 'coverHeight',
      'imageFailed', 'requestGeneration', 'mounted', 'aboutToAppear', 'aboutToDisappear',
      'resetImage', 'requestIdentity', 'rejectImage', 'build'];
    function fixture(coverSource = source, params = {}) {
      const properties = createArkUIPropertyRuntimeProbe();
      const placeholderClass = createReaderBuilderProbe(placeholder,
        ['appThemeScheme', 'coverWidth', 'coverHeight', 'build', 'ruleWidth', 'labelWidth'],
        properties.sdk, properties.hooks).Component;
      const probe = createReaderBuilderProbe(coverSource, members,
        { ...properties.sdk, NoCoverCover: placeholderClass }, { ...properties.hooks,
          mountChildren: true, childSources: { NoCoverCover: placeholder },
          initialParams: { bookKey: 'source-a/book-a', coverUrl: 'https://invalid.test/cover-a.png',
            presentationGeneration: 1, coverWidth: 60, coverHeight: 90, ...params } });
      probe.owner.aboutToAppear();
      probe.owner.initialRender();
      return probe.owner;
    }
    const image = owner => [...owner.nodes.values()].find(node => node.type === 'Image');
    const update = (owner, patch) => owner.updateStateVars(Object.assign(Object.fromEntries(
      ['bookKey', 'coverUrl', 'presentationGeneration', 'coverWidth', 'coverHeight'].map(key => [key, owner[key]])), patch));
    for (const coverUrl of ['', '   ']) {
      const owner = fixture(source, { coverUrl });
      assert.equal(image(owner), undefined, 'empty/whitespace URLs use only the shared placeholder');
      assert.ok([...owner.children.values()].some(child => [...child.nodes.values()]
        .some(node => node.type === 'Text' && node.create === '暂无封面')), 'the real common placeholder paints');
    }
    const current = fixture();
    assert.equal(current.children.size, 0, 'valid images do not reveal placeholder text through transparent pixels');
    image(current).onError();
    assert.equal(current.imageFailed, true, 'the current image failure selects the placeholder');
    current.nodes.clear(); current.keys.clear(); current.observers.length = 0;
    current.initialRender();
    assert.equal(image(current), undefined, 'the failed image is no longer admitted by the actual builder');
    assert.ok([...current.children.values()].some(child => [...child.nodes.values()]
      .some(node => node.type === 'Text' && node.create === '暂无封面')), 'failed images paint the actual shared placeholder');

    function rejectsRetired(coverSource) {
      for (const patch of [{ bookKey: 'source-b/book-b' }, { coverUrl: 'https://invalid.test/cover-b.png' },
        { presentationGeneration: 2 }]) {
        const owner = fixture(coverSource), oldError = image(owner).onError;
        update(owner, patch);
        oldError();
        assert.equal(owner.imageFailed, false, 'an old entity, URL, or presentation cannot fail its successor');
      }
      const rebound = fixture(coverSource), oldError = image(rebound).onError;
      update(rebound, { coverUrl: 'https://invalid.test/cover-b.png' });
      update(rebound, { coverUrl: 'https://invalid.test/cover-a.png' });
      oldError();
      assert.equal(rebound.imageFailed, false, 'A-B-A URL reuse still rejects the earlier load generation');
      const retired = fixture(coverSource), retiredError = image(retired).onError;
      retired.aboutToDisappear(); retiredError();
      assert.equal(retired.imageFailed, false, 'a disappeared row cannot accept native completion');
    }
    rejectsRetired(source);
    const unguarded = source.replace('if (!this.mounted || identity !== this.requestIdentity()) return;', '');
    assert.notEqual(unguarded, source);
    assert.throws(() => rejectsRetired(unguarded), /successor|earlier load|completion/,
      'the probe detects a missing production callback lifetime guard');
    return;
  }

  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { readerFrameStyle, ReaderPageGeometryInput, resolveReaderPageGeometry } = actualReaderPageLayout();
  const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { DOWNLOAD_VISUAL } = await import('../entry/src/main/ets/features/downloads/ui/SharedDownloadVisualSpec.ts');
  const page = read('features/downloads/ui/SharedDownloadPage');
  const fixed = read('ui/layout/ReaderFixedHeaderHost');
  for (const scheme of ['day', 'night']) for (const overflow of [false, true]) {
    const metrics = createDefaultReaderWindowMetrics();
    metrics.windowRect.width = 393; metrics.windowRect.height = 852;
    const owner = createReaderBuilderProbe(page, ['frameStyle', 'pageGeometry', 'fixedHeader'],
      { readerFrameStyle, ReaderPageGeometryInput, resolveReaderPageGeometry, DOWNLOAD_VISUAL }).owner;
    Object.assign(owner, { appThemeScheme: scheme, fontsReady: true, measurementRevision: 7,
      currentMetrics: () => metrics, mainChromeOverflow: () => overflow, availableHeight: () => 800,
      headerTop: () => 10, resolvedHeaderHeight: () => 54, leftInset: () => 8, rightInset: () => 11,
      headerContentGap: () => 22, resolvedDockHeight: () => 62, bottomInset: () => 18,
      dockLeftInset: () => 30, dockRightInset: () => 30, contentBottom: () => 92,
      modalBlocking: () => false, topBar: () => {} });
    const geometry = owner.pageGeometry(), frame = owner.frameStyle();
    const previous = new ReaderPageGeometryInput(metrics);
    Object.assign(previous, { viewportWidth: 393, viewportHeight: 800, measurementRevision: 7,
      chromeMode: overflow ? 'inline' : 'overlay', headerTop: 10, headerHeight: 54,
      headerInsetLeft: 8, headerInsetRight: 11, contentGap: 22, footerHeight: 62,
      footerBottom: 18, footerInsetLeft: 30, footerInsetRight: 30, contentEndInset: 92 });
    const baseline = resolveReaderPageGeometry(previous);
    assert.deepEqual(geometry.content, baseline.content, 'list start/end and native viewport clearance stay unchanged');
    assert.deepEqual(geometry.footer, baseline.footer, 'footer and scroll-return lane stay unchanged');
    assert.equal(geometry.header.bottom, baseline.header.bottom);
    assert.equal(geometry.header.clearance, baseline.header.clearance);
    assert.equal(geometry.header.top, 0, 'the material begins at the page origin');
    assert.equal(geometry.header.insetLeft + geometry.header.insetRight, 0, 'the material owns the full top lane');
    assert.equal(frame.header.transparent, false);
    assert.match(frame.header.backgroundColor, /^#FF[0-9A-F]{6}$/i, 'both themes use an opaque material');
    const properties = createArkUIPropertyRuntimeProbe();
    const host = createReaderBuilderProbe(fixed,
      ['style', 'measurementKey', 'onHeightChange', 'content', 'emptySlot', 'build', 'areaChangeHandler'],
      properties.sdk, { ...properties.hooks, initialParams: { style: frame.header,
        content: () => owner.fixedHeader() } }).owner;
    host.initialRender();
    assert.ok([...host.nodes.values()].some(node => node.backgroundColor === frame.header.backgroundColor && node.clip === true),
      'the existing fixed-header host paints and clips the material');
    const slot = [...owner.nodes.values()].find(node => node.type === 'Column');
    if (overflow) assert.equal(slot, undefined, 'inline overflow keeps its existing compact header');
    else assert.deepEqual(slot.padding, { top: 10, left: 8, right: 11 }, 'bar bounds retain the original offsets inside the host');
  }
}
