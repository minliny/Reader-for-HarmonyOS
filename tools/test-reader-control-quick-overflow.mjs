import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const definitions = {
  'quick-height-eligibility': {
    description: 'Actual four Quick height predicates and module Scroll declarations share precise required/capacity semantics.',
    resources: [],
  },
};
for (const id of selectContractCases(definitions)) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts');
  const actor = await import('../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts');
  const morph = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts');
  const replace = await import('../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts');
  const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url), 'utf8');
  const sources = Object.fromEntries(['settings', 'tts', 'autoPage', 'replace'].map(module => [module,
    read('ReaderControl' + { settings: 'Settings', tts: 'Tts', autoPage: 'AutoPage', replace: 'Replace' }[module] + 'Content.ets')]));
  const plainRectangle = { x: 0, y: 0, width: 200, height: 100, opacity: 1 };

  // These ports delimit eligibility evidence. They do not simulate the module
  // paint, profile measurement, content layout or native scrollbar state.
  function consumer(module, required, capacity, progress, current, source = sources[module], layer = '') {
    const methods = ['currentInputEnabled', 'fullInput'];
    if (module !== 'replace') methods.push('p');
    if (module === 'replace') methods.push('build', 'quickInput', 'quickFlowExtra', 'quickFlowContentHeight', 'quickFlowInput');
    else {
      methods.push(module === 'settings' ? 'build' : 'normalContent',
        'quickMinimumScrollInput', 'quickMinimumScrollPresentation');
      if (module === 'settings') methods.push('scrollContentHeight');
    }
    const owner = createReaderBuilderProbe(source, methods,
      { ...actor, ...morph, ...replace, readerControlExtentFits: geometry.readerControlExtentFits }).owner;
    const state = { status: 'ready', rules: [{}], errorMessage: '', mutationPending: false };
    const profile = { minimum: { quick: { heightVp: required } } };
    const frame = {
      contentHeight: required, progress, rowGap: 0, actionHeight: 32, statusHeight: 0,
      list: { ...plainRectangle }, content: { ...plainRectangle }, details: { ...plainRectangle },
      detail: { ...plainRectangle }, config: { ...plainRectangle },
    };
    Object.assign(owner, {
      motionProgress: progress, availableWidth: 260, availableHeight: capacity, quickContentHeight: capacity,
      interactionEnabled: true, preparedMinimumRequired: false, inputCurrent: () => current,
      sourceOnly: 'none', form: progress === 1 ? 'full' : 'quick', configField: '', appScheme: 'day', appThemeScheme: 'day',
      scrollMotion: morph.createReaderControlMorphScroll(), quickScrollMotion: morph.createReaderControlMorphScroll(),
      geometry: () => frame, frame: () => frame, minimumProfile: () => profile, selectedMinimum: () => profile,
      presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
      state, layer, localError: '', displayState: () => state, displayLayer: () => layer,
      displayedFacts: () => ({ statusVisible: false }),
      currentMinimumProfile: () => ({ quick: { backHeight: 24, rowHeight: required - 47.55 - 32 - 30.45,
        statusHeight: 0, actionHeight: 32 } }),
      screenGroup() {}, addedGroup() {}, quickHeader() {}, controlSection() {}, timerSection() {},
      moduleHeader() {}, speedRow() {}, followHighlightRow() {},
      quickBackdrop() {}, playback() {}, timer() {}, speed() {}, detailSection() {}, systemSection() {},
      configurationOverlay() {}, managerOverlay() {}, managerCoverOptions: () => ({}), actorId: () => 'eligibility-only',
      quickBack() {}, ruleToolbar() {}, ruleRow() {}, statusContent() {}, textAction() {}, quickFooter() {},
      sharedScrollTranslation: () => 0, fullOnlyScrollTranslation: () => 0, quickScrollTranslation: () => 0,
      listContentMinHeight: () => 0,
    });
    if (module === 'settings' || module === 'replace') owner.initialRender();
    else owner.normalContent();
    const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll' &&
      node.width === 260 && node.height === capacity);
    assert.ok(scroll, 'actual ' + module + ' Builder emits its real outer native Scroll');
    assert.equal(scroll.scrollBar, 'BarState.Off', 'existing module scrollbar policy is unchanged');
    return { owner, scroll };
  }

  function check(module, required, capacity, progress, current, source) {
    const sample = consumer(module, required, capacity, progress, current, source);
    const overflow = !geometry.readerControlExtentFits(required, capacity);
    const expected = current && (module === 'replace' ? progress === 0 && overflow :
      progress === 1 || progress === 0 && overflow);
    assert.equal(sample.scroll.enableScrollInteraction, expected,
      module + ' actual native Scroll consumes the same height fit at p=' + progress);
    if (module === 'replace') {
      assert.equal(sample.owner.quickFlowInput(), current && progress === 0 && overflow);
      assert.ok(Math.abs(sample.owner.quickFlowExtra() - Math.max(0, required - capacity)) < 1e-12,
        'replace extra is actual required content beyond the Quick capacity');
    } else {
      assert.equal(sample.owner.quickMinimumScrollPresentation(), progress === 0 && overflow);
      assert.equal(sample.owner.quickMinimumScrollInput(), current && progress === 0 && overflow);
    }
    return sample;
  }

  const extents = [
    { required: 190, capacity: 190, label: 'equal' },
    { required: 190.05, capacity: 190, label: 'real .05 deficit' },
    { required: 190 + Number.EPSILON * 190, capacity: 190, label: 'arithmetic neighbour' },
    { required: 190.0000000001, capacity: 190, label: 'real small deficit' },
    { required: 230, capacity: 190, label: 'growing content' },
  ];
  let samples = 0;
  for (const module of Object.keys(sources)) for (const extent of extents)
    for (const progress of [0, .5, 1]) for (const current of [true, false]) {
      check(module, extent.required, extent.capacity, progress, current);
      samples++;
    }
  for (const module of ['tts', 'autoPage']) {
    const missing = consumer(module, 190.05, 190, 0, true);
    if (module === 'tts') missing.owner.selectedMinimum = () => undefined;
    else missing.owner.minimumProfile = () => undefined;
    assert.equal(missing.owner.quickMinimumScrollPresentation(), false, 'missing profile keeps the original unavailable presentation');
  }
  const blocked = consumer('replace', 190.05, 190, 0, true);
  blocked.owner.layer = 'editor';
  blocked.owner.replayOnly(new Set([blocked.scroll.id]));
  assert.equal(blocked.owner.quickFlowInput(), false, 'existing temporary editor blocks Quick scrolling');
  assert.equal(blocked.scroll.enableScrollInteraction, false, 'actual retained outer Scroll observes the live layer guard');

  const mutations = {
    settings: ['!readerControlExtentFits(this.geometry().contentHeight, this.availableHeight)',
      'this.geometry().contentHeight > this.availableHeight + .1'],
    tts: ['!readerControlExtentFits(profile.minimum.quick.heightVp, this.availableHeight)',
      'profile.minimum.quick.heightVp > this.availableHeight + .1'],
    autoPage: ['!readerControlExtentFits(profile.minimum.quick.heightVp, this.availableHeight)',
      'profile.minimum.quick.heightVp > this.availableHeight + .1'],
    replace: ['!readerControlExtentFits(this.quickContentHeight + this.quickFlowExtra(), this.quickContentHeight)',
      'this.quickFlowExtra() > .1'],
  };
  for (const [module, [current, previous]] of Object.entries(mutations)) {
    const mutant = sources[module].replace(current, previous);
    assert.notEqual(mutant, sources[module]);
    assert.throws(() => check(module, 190.05, 190, 0, true, mutant), /same height fit|strictly equal/,
      module + ' previous .1 tolerance must fail the actual Consumer declaration');
  }
  console.log(JSON.stringify({ kind: id, modules: 4, samples, missingProfileCases: 2, temporaryLayerCases: 1,
    oldThresholdMutantsRejected: 4, actualBuilders: ['Settings.build', 'Tts.normalContent', 'AutoPage.normalContent', 'Replace.build'],
    boundary: 'Actual height predicates and emitted Scroll eligibility; finite paint/data/profile ports; Native layout and scrollbar rasterization NOT_RUN' }));
  recordContractCasePass(id);
}
