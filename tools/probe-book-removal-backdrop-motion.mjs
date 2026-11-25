import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { BookRemovalDialogPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/BookRemovalDialogPresentation.ts';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe, productionReaderMotionSdk } from './lib/reader-control-builder-probe.mjs';
import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';

const source = readFileSync(
  new URL('../entry/src/main/ets/features/bookshelf/ui/BookRemovalDialogHost.ets', import.meta.url), 'utf8');
const motion = productionReaderMotionSdk();
const syntax = createRequire(import.meta.url)(`${resolveEtsLoaderRoot()}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('BookRemovalDialog');
syntax.componentCollection.customDialogs.add('BookRemovalDialog');
syntax.propCollection.set('BookRemovalDialog', new Set(['message', 'reducedMotion']));

function fixture(reduced, withAnimation = true) {
  const properties = createArkUIPropertyRuntimeProbe();
  const controllers = [];
  const animations = [];
  const faults = [];
  let failOpen = false;

  class NativeController {
    constructor(options) {
      this.options = options;
      controllers.push(this);
    }
    open() {
      if (failOpen) throw Error('native open unavailable');
    }
    close() {
      if (this.failClose) throw Error('native close unavailable');
      this.options.onWillDisappear?.();
    }
  }

  const context = {
    animateTo(options, apply) {
      const from = backdrop().opacity;
      apply();
      animations.push({ options, from, to: backdrop().opacity });
    },
  };
  const presentation = new BookRemovalDialogPresentation();
  const { owner } = createReaderBuilderProbe(source, boundedMembers(source), {
    ...properties.sdk,
    ...motion,
    AppStorage: { get: () => undefined },
    readerReduceMotionFromStorage: () => reduced,
    readerMotionStandardCurve: () => motion.motionSpecGet('app.sheet.open').curve,
    readerAppColor,
    BookRemovalDialog: class {},
    CustomDialogController: NativeController,
    DialogAlignment: { Center: 'center' },
    uiContext: withAnimation ? context : {},
  }, properties.hooks);
  owner.presentation = presentation;
  owner.aboutToAppear();
  owner.initialRender();

  function backdrop() {
    properties.flush(candidate => candidate === owner);
    return [...owner.nodes.values()].find(node => node.type === 'Stack');
  }

  let confirmations = 0;
  function open() {
    presentation.open('移出书架', () => true, () => { confirmations += 1; }, phase => faults.push(phase));
    return controllers.at(-1);
  }

  return { animations, backdrop, open, owner, presentation, faults,
    failNextOpen: () => { failOpen = true; }, confirmations: () => confirmations };
}

for (const reduced of [false, true]) {
  const f = fixture(reduced);
  const controller = f.open();
  assert.deepEqual([f.backdrop().width, f.backdrop().backdropBlur], ['100%', 6]);
  assert.equal(f.animations.length, 1, 'the 6vp backdrop opens through an opacity fade');
  const [enter] = f.animations;
  assert.deepEqual([enter.from, enter.to, enter.options.duration], [0, 1, reduced ? 120 : 220]);
  assert.equal(f.backdrop().hitTestBehavior, 'HitTestMode.None');
  assert.equal(f.backdrop().accessibilityLevel, 'no-hide-descendants');
  assert.equal(controller.options.maskColor, readerAppColor('app.scrim.modal', 'day'));
  assert.deepEqual([controller.options.openAnimation.duration, controller.options.closeAnimation.duration],
    reduced ? [0, 0] : [220, 180]);
  f.presentation.confirm();
  const [, leave] = f.animations;
  assert.deepEqual([leave.from, leave.to, leave.options.duration], [1, 0, reduced ? 120 : 180]);
  assert.equal(f.confirmations(), 1);
  controller.options.onDidDisappear();
  assert.deepEqual([f.backdrop().width, f.backdrop().backdropBlur], ['100%', 6],
    'native close cannot remove the backdrop actor midway through its own fade');
  leave.options.onFinish();
  assert.deepEqual([f.backdrop().width, f.backdrop().backdropBlur], [0, 0]);
}

{
  const f = fixture(false);
  const retired = f.open();
  retired.options.onWillDisappear();
  retired.options.cancel();
  const retiredFade = f.animations.at(-1);
  const current = f.open();
  retiredFade.options.onFinish();
  retired.options.onDidDisappear();
  assert.equal(f.presentation.isOpen(), true);
  assert.equal(f.backdrop().opacity, 1, 'a stale dismissal cannot retire a newer backdrop');
  current.options.onWillDisappear();
  current.options.cancel();
  assert.equal(f.presentation.isOpen(), false);
  f.owner.aboutToDisappear();
  f.animations.at(-1).options.onFinish();
  assert.deepEqual([f.backdrop().opacity, f.backdrop().width], [0, 0]);
}

{
  const f = fixture(false);
  const controller = f.open();
  controller.failClose = true;
  f.presentation.confirm();
  assert.deepEqual(f.faults, ['close']);
  assert.equal(f.confirmations(), 0);
  assert.deepEqual([f.backdrop().opacity, f.backdrop().width], [0, 0]);
  f.failNextOpen();
  f.open();
  assert.deepEqual(f.faults, ['close', 'open']);
  assert.deepEqual([f.backdrop().opacity, f.backdrop().width], [0, 0]);
}

{
  const f = fixture(true, false);
  const controller = f.open();
  assert.equal(f.backdrop().opacity, 1, 'a missing animation context still paints the dialog backdrop');
  controller.options.onWillDisappear();
  controller.options.onDidDisappear();
  assert.deepEqual([f.backdrop().opacity, f.backdrop().width], [0, 0]);
}

{
  const f = fixture(true);
  const controller = f.open();
  controller.options.onDidDisappear();
  const exit = f.animations.at(-1);
  assert.deepEqual([exit.from, exit.to, exit.options.duration], [1, 0, 120]);
  assert.equal(f.presentation.isOpen(), false, 'native dismissal still releases the confirmation');
  exit.options.onFinish();
  assert.deepEqual([f.backdrop().opacity, f.backdrop().width], [0, 0]);
}

console.log('PASS BookRemovalDialogHost SDK backdrop attributes and timed opening/closing lifecycle');
